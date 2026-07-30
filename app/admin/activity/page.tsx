import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ActivityTable from "./ActivityTable";
import Logo from "@/app/components/Logo";

export const dynamic = "force-dynamic";

export type StudentActivity = {
  studentId: string;
  fullName: string;
  email: string;
  days: {
    dayNumber: number;
    topicName: string;
    pdfViewed: boolean;
    pdfViewedAt: string | null;
    pdfViewCount: number;
    quizTaken: boolean;
    score: number | null;
    total: number | null;
    takenAt: string | null;
  }[];
};

export default async function ActivityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [{ data: profiles }, { data: days }, { data: attempts }, { data: pdfViews }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, email").order("full_name"),
      admin.from("course_days").select("id, day_number, topic_name").order("day_number"),
      admin.from("attempts").select("student_id, course_day_id, score, total, taken_at"),
      admin
        .from("pdf_views")
        .select("student_id, course_day_id, view_count, first_viewed_at"),
    ]);

  const attemptKey = (studentId: string, dayId: string) => `${studentId}:${dayId}`;
  const attemptMap = new Map<string, any>(
    (attempts || []).map((a: any) => [attemptKey(a.student_id, a.course_day_id), a])
  );
  const viewMap = new Map<string, any>(
    (pdfViews || []).map((v: any) => [attemptKey(v.student_id, v.course_day_id), v])
  );

  const activity: StudentActivity[] = (profiles || []).map((p: any) => ({
    studentId: p.id,
    fullName: p.full_name,
    email: p.email,
    days: (days || []).map((d: any) => {
      const attempt = attemptMap.get(attemptKey(p.id, d.id));
      const view = viewMap.get(attemptKey(p.id, d.id));
      return {
        dayNumber: d.day_number,
        topicName: d.topic_name,
        pdfViewed: !!view,
        pdfViewedAt: view?.first_viewed_at || null,
        pdfViewCount: view?.view_count || 0,
        quizTaken: !!attempt,
        score: attempt?.score ?? null,
        total: attempt?.total ?? null,
        takenAt: attempt?.taken_at || null,
      };
    }),
  }));

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Logo className="h-9" />
            <div>
              <h1 className="text-2xl font-bold text-ink">Student Activity</h1>
              <p className="text-gray-500 text-sm">
                Who's opened each PDF, who's taken each quiz, and their scores.
              </p>
            </div>
          </div>
          <Link href="/admin" className="text-sm font-medium text-ink underline">
            Back to admin
          </Link>
        </div>

        <ActivityTable activity={activity} />
      </div>
    </div>
  );
}
