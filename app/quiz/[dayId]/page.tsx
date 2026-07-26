import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CourseDay, QuizQuestion } from "@/types/database";
import QuizForm from "./QuizForm";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: { dayId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: day } = await supabase
    .from("course_days")
    .select("*")
    .eq("id", params.dayId)
    .single();

  if (!day) redirect("/dashboard");

  const courseDay = day as CourseDay;

  // Guard: quiz must actually be unlocked
  if (new Date(courseDay.quiz_unlock_at).getTime() > Date.now()) {
    redirect("/dashboard");
  }

  // Guard: already taken? send back with their score visible on the dashboard
  const { data: existing } = await supabase
    .from("attempts")
    .select("id")
    .eq("student_id", user!.id)
    .eq("course_day_id", courseDay.id)
    .maybeSingle();

  if (existing) redirect("/dashboard");

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, course_day_id, question_order, question_text, options")
    .eq("course_day_id", courseDay.id)
    .order("question_order", { ascending: true });

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-ink mb-1">
          Day {courseDay.day_number} Quiz
        </h1>
        <p className="text-gray-500 mb-8">{courseDay.topic_name}</p>

        <QuizForm
          courseDayId={courseDay.id}
          questions={(questions || []) as Omit<QuizQuestion, "correct_index">[]}
        />
      </div>
    </div>
  );
}
