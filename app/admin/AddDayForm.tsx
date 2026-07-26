"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type QuestionDraft = {
  questionText: string;
  options: string[];
  correctIndex: number;
};

const emptyQuestion = (): QuestionDraft => ({
  questionText: "",
  options: ["", "", "", ""],
  correctIndex: 0,
});

// Expected columns (case-insensitive, matches the downloadable template):
// Question | Option 1 | Option 2 | Option 3 | Option 4 | Correct Option (1-4)
function parseQuizExcel(rows: Record<string, any>[]): {
  questions: QuestionDraft[];
  errors: string[];
} {
  const errors: string[] = [];
  const questions: QuestionDraft[] = [];

  const getCell = (row: Record<string, any>, name: string) => {
    const key = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === name.toLowerCase()
    );
    return key ? String(row[key] ?? "").trim() : "";
  };

  rows.forEach((row, i) => {
    const questionText = getCell(row, "Question");
    if (!questionText) return; // skip blank rows

    const options = [1, 2, 3, 4].map((n) => getCell(row, `Option ${n}`));
    const correctRaw = getCell(row, "Correct Option");
    const correctNum = parseInt(correctRaw, 10);

    if (options.some((o) => !o)) {
      errors.push(`Row ${i + 2}: missing one or more options — skipped`);
      return;
    }
    if (!correctNum || correctNum < 1 || correctNum > 4) {
      errors.push(
        `Row ${i + 2}: "Correct Option" must be 1-4, got "${correctRaw}" — skipped`
      );
      return;
    }

    questions.push({
      questionText,
      options,
      correctIndex: correctNum - 1,
    });
  });

  return { questions, errors };
}

export default function AddDayForm() {
  const [dayNumber, setDayNumber] = useState("");
  const [topicName, setTopicName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [pdfUnlockAt, setPdfUnlockAt] = useState("");
  const [quizUnlockAt, setQuizUnlockAt] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleExcelImport(file: File) {
    setImportErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
          defval: "",
        });

        const { questions: parsed, errors } = parseQuizExcel(rows);

        if (parsed.length === 0) {
          setImportErrors([
            "No valid questions found. Check that your columns match the template exactly.",
            ...errors,
          ]);
          return;
        }

        setQuestions(parsed);
        setImportErrors(errors); // non-blocking warnings, if any rows were skipped
      } catch (err: any) {
        setImportErrors([`Couldn't read that file: ${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function updateQuestion(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  }

  function updateOption(qIdx: number, oIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) }
          : q
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!pdfFile) {
      setStatus("Error: please choose a PDF file");
      return;
    }

    setSubmitting(true);

    // Step 1: upload the PDF to Supabase Storage
    setUploadProgress("Uploading PDF…");
    const fileForm = new FormData();
    fileForm.append("file", pdfFile);

    const uploadRes = await fetch("/api/admin/upload-pdf", {
      method: "POST",
      body: fileForm,
    });
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      setSubmitting(false);
      setUploadProgress(null);
      setStatus(`Error uploading PDF: ${uploadData.error}`);
      return;
    }

    // Step 2: create the course day, pointing at the uploaded file's URL
    setUploadProgress("Saving day…");
    const res = await fetch("/api/admin/add-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayNumber: Number(dayNumber),
        topicName,
        pdfUrl: uploadData.url,
        pdfUnlockAt: new Date(pdfUnlockAt).toISOString(),
        quizUnlockAt: new Date(quizUnlockAt).toISOString(),
        questions,
      }),
    });

    const data = await res.json();
    setSubmitting(false);
    setUploadProgress(null);

    if (!res.ok) {
      setStatus(`Error: ${data.error}`);
      return;
    }

    setStatus("Day added successfully!");
    setDayNumber("");
    setTopicName("");
    setPdfFile(null);
    setPdfUnlockAt("");
    setQuizUnlockAt("");
    setQuestions([emptyQuestion()]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day number
          </label>
          <input
            type="number"
            required
            value={dayNumber}
            onChange={(e) => setDayNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic name (used as email subject too)
          </label>
          <input
            type="text"
            required
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PDF file
          </label>
          <input
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {pdfFile && (
            <p className="text-xs text-gray-500 mt-1">
              {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF unlock (your local time)
            </label>
            <input
              type="datetime-local"
              required
              value={pdfUnlockAt}
              onChange={(e) => setPdfUnlockAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quiz unlock (your local time)
            </label>
            <input
              type="datetime-local"
              required
              value={quizUnlockAt}
              onChange={(e) => setQuizUnlockAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Import questions from Excel</h2>
          <a
            href="/quiz-template.xlsx"
            download
            className="text-sm text-ink underline"
          >
            Download template
          </a>
        </div>
        <p className="text-sm text-gray-500">
          Columns: <strong>Question</strong>, <strong>Option 1-4</strong>,{" "}
          <strong>Correct Option</strong> (a number 1-4). Importing replaces
          whatever's currently in the question builder below.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleExcelImport(file);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {importErrors.length > 0 && (
          <ul className="text-xs text-amber-700 space-y-0.5">
            {importErrors.map((err, i) => (
              <li key={i}>⚠ {err}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Quiz Questions</h2>
          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            className="text-sm text-ink underline"
          >
            + Add question
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="bg-white rounded-2xl shadow p-6 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Question {qIdx + 1}
              </label>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                  }
                  className="text-xs text-red-600 underline"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={q.questionText}
              onChange={(e) =>
                updateQuestion(qIdx, { questionText: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Question text"
            />
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qIdx}`}
                  checked={q.correctIndex === oIdx}
                  onChange={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                />
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <p className="text-xs text-gray-400">
              Select the radio button next to the correct answer.
            </p>
          </div>
        ))}
      </div>

      {status && (
        <p
          className={`text-sm ${
            status.startsWith("Error") ? "text-red-600" : "text-green-700"
          }`}
        >
          {status}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-ink text-white rounded-lg py-3 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? uploadProgress || "Working…" : "Add Day"}
      </button>
    </form>
  );
}
