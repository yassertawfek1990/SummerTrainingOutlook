import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPdfEmail, sendQuizEmail } from "@/lib/mailer";

// How far back we're willing to look for "just unlocked" days. This is what
// stops a student who signs up on day 20 from getting 19 backlog emails —
// we only ever email for unlocks that happened recently, not all past ones.
// 30 hours gives headroom for Vercel Hobby's once-a-day, up-to-59-min-late cron.
const LOOKBACK_HOURS = 30;

// Instead of sending all emails in one burst, each cron run only sends up to
// this many, then stops — the next scheduled run (see vercel.json, several
// runs spread across the unlock hour) picks up whoever's left. This keeps
// sending gentle and gradual rather than one big spike, which matters if
// you're sending through a personal Gmail account rather than a dedicated
// email service.
const MAX_EMAILS_PER_RUN = 12;

// Small pause between individual sends within a run, so even a single run
// doesn't fire them all in the same second.
const DELAY_BETWEEN_EMAILS_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PendingEmail = {
  student: { id: string; email: string; full_name: string };
  day: { id: string; day_number: number; topic_name: string; pdf_url: string };
  type: "pdf" | "quiz";
};

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify this request actually came from Vercel Cron (or you, testing manually
  // with the same secret), not a random visitor hitting the URL.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const lookbackStart = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const { data: students } = await supabase.from("profiles").select("*");

  // ---- Build the full pending queue (everyone who's due an email and hasn't
  // gotten one yet), across both PDF and quiz unlocks ----
  const pending: PendingEmail[] = [];

  const { data: pdfDays } = await supabase
    .from("course_days")
    .select("*")
    .lte("pdf_unlock_at", now.toISOString())
    .gte("pdf_unlock_at", lookbackStart.toISOString());

  const { data: quizDays } = await supabase
    .from("course_days")
    .select("*")
    .lte("quiz_unlock_at", now.toISOString())
    .gte("quiz_unlock_at", lookbackStart.toISOString());

  const { data: alreadySentRows } = await supabase
    .from("email_log")
    .select("student_id, course_day_id, email_type");

  const sentSet = new Set(
    (alreadySentRows || []).map(
      (r: any) => `${r.student_id}:${r.course_day_id}:${r.email_type}`
    )
  );

  for (const day of pdfDays || []) {
    for (const student of students || []) {
      if (!sentSet.has(`${student.id}:${day.id}:pdf`)) {
        pending.push({ student, day, type: "pdf" });
      }
    }
  }

  for (const day of quizDays || []) {
    for (const student of students || []) {
      if (!sentSet.has(`${student.id}:${day.id}:quiz`)) {
        pending.push({ student, day, type: "quiz" });
      }
    }
  }

  // ---- Only send the first batch this run; the rest wait for the next
  // scheduled cron trigger a few minutes later (see vercel.json) ----
  const batch = pending.slice(0, MAX_EMAILS_PER_RUN);

  const results = {
    sentThisRun: 0,
    remainingAfterThisRun: pending.length - batch.length,
    errors: [] as string[],
  };

  for (const item of batch) {
    try {
      if (item.type === "pdf") {
        await sendPdfEmail({
          to: item.student.email,
          studentName: item.student.full_name,
          topicName: item.day.topic_name,
          dayId: item.day.id,
        });
      } else {
        await sendQuizEmail({
          to: item.student.email,
          studentName: item.student.full_name,
          topicName: item.day.topic_name,
          dayId: item.day.id,
        });
      }

      await supabase.from("email_log").insert({
        student_id: item.student.id,
        course_day_id: item.day.id,
        email_type: item.type,
      });

      results.sentThisRun++;
    } catch (err: any) {
      results.errors.push(
        `${item.type}/${item.student.email}/day${item.day.day_number}: ${err.message}`
      );
    }

    // Pace ourselves — don't fire the next email immediately.
    await sleep(DELAY_BETWEEN_EMAILS_MS);
  }

  return NextResponse.json(results);
}
