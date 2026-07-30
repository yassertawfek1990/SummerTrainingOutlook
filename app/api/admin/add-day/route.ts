import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const { dayNumber, topicName, pdfUrl, pdfUnlockAt, quizUnlockAt, questions } = body;

  if (!dayNumber || !topicName || !pdfUrl || !pdfUnlockAt || !quizUnlockAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: day, error: dayError } = await admin
    .from("course_days")
    .insert({
      day_number: dayNumber,
      topic_name: topicName,
      pdf_url: pdfUrl,
      pdf_unlock_at: pdfUnlockAt,
      quiz_unlock_at: quizUnlockAt,
    })
    .select()
    .single();

  if (dayError) {
    return NextResponse.json(
      {
        error: dayError.message,
        code: dayError.code,
        details: dayError.details,
        hint: dayError.hint,
      },
      { status: 500 }
    );
  }

  if (Array.isArray(questions) && questions.length > 0) {
    const rows = questions.map((q: any, i: number) => ({
      course_day_id: day.id,
      question_order: i,
      question_text: q.questionText,
      options: q.options,
      correct_index: q.correctIndex,
    }));

    const { error: qError } = await admin.from("quiz_questions").insert(rows);
    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, day });
}
