"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  question_order: number;
  question_text: string;
  options: { idx: number; text: string }[];
};

export default function QuizForm({
  courseDayId,
  questions,
}: {
  courseDayId: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(
    null
  );

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  async function handleSubmit() {
    if (!allAnswered) {
      setError("Please answer every question before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseDayId, answers }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong submitting your quiz.");
      return;
    }

    setResult({ score: data.score, total: data.total });
  }

  if (result) {
    return (
      <div className="bg-white rounded-2xl shadow p-8 text-center">
        <h2 className="text-xl font-bold text-ink mb-2">Quiz submitted!</h2>
        <p className="text-3xl font-bold text-ink mb-4">
          {result.score} / {result.total}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-ink text-white rounded-lg px-4 py-2 font-medium"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-2xl shadow p-6">
          <p className="font-medium text-ink mb-4">
            {i + 1}. {q.question_text}
          </p>
          <div className="space-y-2">
            {q.options.map((option) => (
              <label
                key={option.idx}
                className={`flex items-center gap-3 border rounded-lg px-4 py-2.5 cursor-pointer transition ${
                  answers[q.id] === option.idx
                    ? "border-ink bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === option.idx}
                  onChange={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: option.idx }))
                  }
                />
                <span className="text-sm text-gray-700">{option.text}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-ink text-white rounded-lg py-3 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit Quiz"}
      </button>
    </div>
  );
}
