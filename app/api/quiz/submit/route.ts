import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { courseDayId, answers } = (await request.json()) as {
    courseDayId: string;
    answers: Record<string, number>;
  };

  // Confirm quiz is actually unlocked
  const { data: day } = await supabase
    .from("course_days")
    .select("quiz_unlock_at")
    .eq("id", courseDayId)
    .single();

  if (!day || new Date(day.quiz_unlock_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "Quiz is not unlocked yet" }, { status: 403 });
  }

  // Prevent double submission
  const { data: existing } = await supabase
    .from("attempts")
    .select("id")
    .eq("student_id", user.id)
    .eq("course_day_id", courseDayId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You've already taken this quiz" },
      { status: 409 }
    );
  }

  // Grade server-side using correct_index — never trust a score computed in the browser
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, correct_index")
    .eq("course_day_id", courseDayId);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "No questions found" }, { status: 400 });
  }

  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correct_index) score++;
  }

  const total = questions.length;

  const { error: insertError } = await supabase.from("attempts").insert({
    student_id: user.id,
    course_day_id: courseDayId,
    score,
    total,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ score, total });
}
