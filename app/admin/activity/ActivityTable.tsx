"use client";

import { useState } from "react";
import type { StudentActivity } from "./page";

export default function ActivityTable({
  activity,
}: {
  activity: StudentActivity[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = activity.filter(
    (a) =>
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                Student
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                PDFs Opened
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                Quizzes Taken
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                Total Score
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">
                Last Activity
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((student) => {
              const daysWithContent = student.days.length;
              const pdfsViewed = student.days.filter((d) => d.pdfViewed).length;
              const quizzesTaken = student.days.filter((d) => d.quizTaken).length;
              const totalScore = student.days.reduce(
                (sum, d) => sum + (d.score ?? 0),
                0
              );
              const totalPossible = student.days.reduce(
                (sum, d) => sum + (d.total ?? 0),
                0
              );

              const lastActivityTimestamps = student.days
                .flatMap((d) => [d.pdfViewedAt, d.takenAt])
                .filter((t): t is string => !!t)
                .map((t) => new Date(t).getTime());
              const lastActivity =
                lastActivityTimestamps.length > 0
                  ? new Date(Math.max(...lastActivityTimestamps))
                  : null;

              const isExpanded = expanded === student.studentId;

              return (
                <>
                  <tr
                    key={student.studentId}
                    onClick={() =>
                      setExpanded(isExpanded ? null : student.studentId)
                    }
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 text-sm">
                      <p className="font-medium text-ink">{student.fullName}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {pdfsViewed} / {daysWithContent}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {quizzesTaken} / {daysWithContent}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-ink">
                      {totalScore} / {totalPossible}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {lastActivity ? lastActivity.toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {isExpanded ? "▲" : "▼"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-5 py-4">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 uppercase">
                              <th className="pb-2 pr-4">Day</th>
                              <th className="pb-2 pr-4">PDF</th>
                              <th className="pb-2 pr-4">Quiz</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {student.days.map((d) => (
                              <tr key={d.dayNumber}>
                                <td className="py-2 pr-4">
                                  Day {d.dayNumber}: {d.topicName}
                                </td>
                                <td className="py-2 pr-4">
                                  {d.pdfViewed ? (
                                    <span className="text-green-700">
                                      Opened {d.pdfViewCount > 1 ? `(${d.pdfViewCount}x) ` : ""}
                                      {d.pdfViewedAt &&
                                        new Date(d.pdfViewedAt).toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Not opened</span>
                                  )}
                                </td>
                                <td className="py-2 pr-4">
                                  {d.quizTaken ? (
                                    <span className="text-green-700">
                                      {d.score}/{d.total}
                                      {d.takenAt &&
                                        ` — ${new Date(d.takenAt).toLocaleString()}`}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Not taken</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
