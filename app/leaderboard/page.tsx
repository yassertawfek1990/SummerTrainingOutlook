import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import Logo from "@/app/components/Logo";

export const dynamic = "force-dynamic";

type Row = {
  student_id: string;
  full_name: string;
  total_score: number;
  total_possible: number;
  quizzes_taken: number;
};

export default async function LeaderboardPage() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name");

  const { data: attempts } = await supabase
    .from("attempts")
    .select("student_id, score, total");

  const byStudent = new Map<string, Row>();
  (profiles || []).forEach((p: any) => {
    byStudent.set(p.id, {
      student_id: p.id,
      full_name: p.full_name,
      total_score: 0,
      total_possible: 0,
      quizzes_taken: 0,
    });
  });
  (attempts || []).forEach((a: any) => {
    const row = byStudent.get(a.student_id);
    if (row) {
      row.total_score += a.score;
      row.total_possible += a.total;
      row.quizzes_taken += 1;
    }
  });

  const ranked = Array.from(byStudent.values())
    .filter((r) => r.quizzes_taken > 0)
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, 10);

  const [first, second, third, ...rest] = ranked;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Logo className="h-9" />
            <h1 className="text-2xl font-bold text-ink">Leaderboard</h1>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-ink underline">
            Back to dashboard
          </Link>
        </div>

        {ranked.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">
            No quiz attempts yet — scores will appear here once quizzes are taken.
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="flex items-end justify-center gap-4 mb-12">
              {second && <PodiumBlock row={second} place={2} height="h-28" />}
              {first && <PodiumBlock row={first} place={1} height="h-36" />}
              {third && <PodiumBlock row={third} place={3} height="h-20" />}
            </div>

            {/* Rest of top 10 */}
            {rest.length > 0 && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Rank
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rest.map((row, idx) => (
                      <tr key={row.student_id}>
                        <td className="px-5 py-3 text-sm text-gray-500">
                          #{idx + 4}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-ink">
                          {row.full_name}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {row.total_score}/{row.total_possible}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PodiumBlock({
  row,
  place,
  height,
}: {
  row: Row;
  place: 1 | 2 | 3;
  height: string;
}) {
  const colors = {
    1: "bg-gold",
    2: "bg-silver",
    3: "bg-bronze",
  };
  return (
    <div className="flex flex-col items-center w-28">
      <div className="text-2xl mb-1">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
      <p className="text-sm font-semibold text-ink text-center truncate w-full">
        {row.full_name}
      </p>
      <p className="text-xs text-gray-500 mb-2">
        {row.total_score}/{row.total_possible}
      </p>
      <div
        className={`${colors[place]} ${height} w-full rounded-t-lg flex items-start justify-center pt-2 text-white font-bold`}
      >
        {place}
      </div>
    </div>
  );
}
