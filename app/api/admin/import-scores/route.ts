import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

type ScoreRow = {
  email: string;
  dayNumber: number;
  score: number;
  total: number;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { rows } = (await request.json()) as { rows: ScoreRow[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profiles } = await admin.from("profiles").select("id, email");
  const { data: days } = await admin.from("course_days").select("id, day_number");

  const profileByEmail = new Map<string, string>(
    (profiles || []).map((p: any) => [p.email.trim().toLowerCase(), p.id as string])
  );
  const dayByNumber = new Map<number, string>(
    (days || []).map((d: any) => [d.day_number as number, d.id as string])
  );

  const toInsert: { student_id: string; course_day_id: string; score: number; total: number }[] = [];
  const skipped: { row: ScoreRow; reason: string }[] = [];

  for (const row of rows) {
    const email = (row.email || "").trim().toLowerCase();
    const studentId = profileByEmail.get(email);
    const courseDayId = dayByNumber.get(Number(row.dayNumber));

    if (!studentId) {
      skipped.push({ row, reason: `No student found with email "${row.email}"` });
      continue;
    }
    if (!courseDayId) {
      skipped.push({ row, reason: `No course day found with day number ${row.dayNumber}` });
      continue;
    }
    if (
      row.score === undefined ||
      row.total === undefined ||
      isNaN(Number(row.score)) ||
      isNaN(Number(row.total))
    ) {
      skipped.push({ row, reason: "Missing or invalid score/total" });
      continue;
    }

    toInsert.push({
      student_id: studentId,
      course_day_id: courseDayId,
      score: Number(row.score),
      total: Number(row.total),
    });
  }

  let imported = 0;
  if (toInsert.length > 0) {
    // Upsert so re-running the same import (e.g. after fixing a typo) doesn't
    // fail on the attempts table's unique(student_id, course_day_id) constraint —
    // it just overwrites with the latest values instead.
    const { error, count } = await admin
      .from("attempts")
      .upsert(toInsert, { onConflict: "student_id,course_day_id", count: "exact" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    imported = count ?? toInsert.length;
  }

  return NextResponse.json({ imported, skipped });
}
