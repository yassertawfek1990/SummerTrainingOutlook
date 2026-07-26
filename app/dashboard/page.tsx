import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CourseDay, Attempt } from "@/types/database";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const nowIso = new Date().toISOString();

  // Only days whose PDF has actually unlocked so far are shown.
  const { data: days } = await supabase
    .from("course_days")
    .select("*")
    .lte("pdf_unlock_at", nowIso)
    .order("day_number", { ascending: true });

  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", user!.id);

  const attemptByDay = new Map<string, Attempt>();
  (attempts || []).forEach((a: Attempt) => attemptByDay.set(a.course_day_id, a));

  const rows = (days || []) as CourseDay[];

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-ink">Your Course Dashboard</h1>
            <p className="text-gray-500 text-sm">
              Welcome, {profile?.full_name || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/leaderboard"
              className="text-sm font-medium text-ink underline"
            >
              Leaderboard
            </Link>
            <LogoutButton />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">
            No days have unlocked yet. Check back after the first PDF is sent!
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Topic
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                    PDF
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                    Quiz
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((day) => {
                  const attempt = attemptByDay.get(day.id);
                  const quizUnlocked =
                    new Date(day.quiz_unlock_at).getTime() <= Date.now();

                  return (
                    <tr key={day.id}>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {new Date(day.pdf_unlock_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-ink">
                        Day {day.day_number}: {day.topic_name}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <a
                          href={day.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          Open PDF
                        </a>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {attempt ? (
                          <span className="font-semibold text-green-700">
                            Score: {attempt.score}/{attempt.total}
                          </span>
                        ) : quizUnlocked ? (
                          <Link
                            href={`/quiz/${day.id}`}
                            className="inline-block bg-ink text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                          >
                            Take Quiz
                          </Link>
                        ) : (
                          <span className="text-gray-400">
                            Unlocks{" "}
                            {new Date(day.quiz_unlock_at).toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
