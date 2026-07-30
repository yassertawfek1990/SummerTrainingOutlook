"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type SkippedRow = { row: any; reason: string };

export default function ImportScoresForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setSkipped([]);
    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(sheet);

      // Case-insensitive column matching so "Email"/"email"/"EMAIL" all work.
      const rows = raw.map((r) => {
        const get = (name: string) => {
          const key = Object.keys(r).find(
            (k) => k.trim().toLowerCase() === name.toLowerCase()
          );
          return key ? r[key] : undefined;
        };
        return {
          email: get("Email"),
          dayNumber: get("Day Number"),
          score: get("Score"),
          total: get("Total"),
        };
      });

      const res = await fetch("/api/admin/import-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus(
          `Imported ${data.imported} score${data.imported === 1 ? "" : "s"}${
            data.skipped.length > 0 ? `, ${data.skipped.length} skipped` : ""
          }.`
        );
        setSkipped(data.skipped);
      }
    } catch (err: any) {
      setStatus(`Error reading file: ${err.message}`);
    }

    setImporting(false);
    e.target.value = ""; // allow re-uploading the same file if needed
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-ink mb-1">
          Import historical quiz scores
        </h2>
        <p className="text-sm text-gray-500">
          For quizzes already taken before this site existed. Upload an Excel
          file with columns: <strong>Email</strong>, <strong>Day Number</strong>,{" "}
          <strong>Score</strong>, <strong>Total</strong>. Existing scores for
          the same student + day get overwritten if you re-upload.
        </p>
      </div>

      <a
        href="/scores-template.xlsx"
        download
        className="inline-block text-sm text-ink underline"
      >
        Download template
      </a>

      <div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          disabled={importing}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {status && (
        <p
          className={`text-sm ${
            status.startsWith("Error") ? "text-red-600" : "text-green-700"
          }`}
        >
          {importing ? "Importing…" : status}
        </p>
      )}

      {skipped.length > 0 && (
        <div className="text-xs text-gray-500 space-y-1 max-h-48 overflow-y-auto border-t border-gray-100 pt-3">
          <p className="font-medium text-gray-700">Skipped rows:</p>
          {skipped.map((s, i) => (
            <p key={i}>
              {s.row.email || "(no email)"} / day {s.row.dayNumber || "?"} —{" "}
              {s.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
