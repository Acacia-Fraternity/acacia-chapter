"use client";

import { useState } from "react";
import { createMembersBulk, type BulkMemberRow } from "@/app/dashboard/admin/actions";

const BATCH = 10;

function randomPassword() {
  // Unambiguous characters — these get read off a sheet and typed on phones.
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

interface Parsed {
  rows: Omit<BulkMemberRow, "password">[];
  skipped: string[];
}

// Accepts pasted spreadsheet rows (tab-separated) or CSV, in any column order:
// the cell containing "@" is the email, a cell reading pledge/exec/active is the
// status, and the first remaining cell is the name.
function parseList(text: string): Parsed {
  const rows: Parsed["rows"] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line
      .split(/\t|,/)
      .map((c) => c.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    const email = cells.find((c) => c.includes("@"));
    if (!email) {
      // A header row ("Name, Email, Status") is expected; anything else is worth flagging.
      if (!/email/i.test(line)) skipped.push(line.trim());
      continue;
    }
    const rest = cells.filter((c) => c !== email);
    const statusCell = rest.find((c) => /^(active|pledge|exec)$/i.test(c));
    const name = rest.find((c) => c !== statusCell);
    if (!name || seen.has(email.toLowerCase())) {
      skipped.push(line.trim());
      continue;
    }
    seen.add(email.toLowerCase());
    rows.push({
      full_name: name,
      email,
      status: (statusCell?.toLowerCase() as BulkMemberRow["status"]) ?? "active",
    });
  }
  return { rows, skipped };
}

export function BulkAddMembers() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sharedPassword, setSharedPassword] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<
    { email: string; name: string; password: string; error?: string }[] | null
  >(null);

  const parsed = parseList(text);

  async function run() {
    setError(null);
    setReport(null);
    if (sharedPassword && sharedPassword.length < 6) {
      setError("A shared password needs at least 6 characters.");
      return;
    }

    const withPasswords: BulkMemberRow[] = parsed.rows.map((r) => ({
      ...r,
      password: sharedPassword || randomPassword(),
    }));
    const out: NonNullable<typeof report> = [];

    try {
      for (let i = 0; i < withPasswords.length; i += BATCH) {
        setRunning(`Creating ${Math.min(i + BATCH, withPasswords.length)} of ${withPasswords.length}…`);
        const batch = withPasswords.slice(i, i + BATCH);
        const results = await createMembersBulk(batch);
        batch.forEach((row, j) =>
          out.push({
            email: row.email,
            name: row.full_name,
            password: row.password,
            error: results[j]?.error,
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import stopped unexpectedly");
    }
    setRunning(null);
    setReport(out);
  }

  function downloadCsv() {
    if (!report) return;
    const lines = ["name,email,password,result"].concat(
      report.map((r) =>
        [r.name, r.email, r.error ? "" : r.password, r.error ?? "created"]
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(","),
      ),
    );
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "new-member-logins.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const failures = report?.filter((r) => r.error) ?? [];

  return (
    <div className="rounded-lg border border-surface-border p-3 space-y-3">
      <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium">
        {open ? "▾" : "▸"} Bulk add members
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste rows straight from a spreadsheet (or CSV): name, email, and optionally
            <code> active</code> / <code>pledge</code> / <code>exec</code> (default active). Column
            order doesn&apos;t matter.
          </p>

          <input
            type="file"
            accept=".csv,.txt,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
            }}
            className="block text-xs"
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Ian Stein, ianstein20@gmail.com, exec\nJane Doe, jane@example.com, pledge"}
            className="w-full rounded-md border border-surface-border px-2 py-1.5 font-mono text-xs"
          />

          <input
            value={sharedPassword}
            onChange={(e) => setSharedPassword(e.target.value)}
            placeholder="Optional: one shared starting password (blank = unique random password each)"
            className="w-full rounded-md border border-surface-border px-2 py-1.5 text-sm"
          />

          <p className="text-xs text-muted">
            {parsed.rows.length} to add
            {parsed.skipped.length > 0 && (
              <span className="text-amber-600"> · {parsed.skipped.length} line(s) skipped (no email, no name, or duplicate)</span>
            )}
          </p>

          <button
            onClick={run}
            disabled={parsed.rows.length === 0 || running !== null}
            className="rounded-md bg-acacia-gold text-acacia-black px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {running ?? `Create ${parsed.rows.length} accounts`}
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {report && (
            <div className="space-y-2">
              <p className="text-sm">
                {report.length - failures.length} created
                {failures.length > 0 && <span className="text-red-600"> · {failures.length} failed</span>}
              </p>
              <button onClick={downloadCsv} className="rounded-md border border-surface-border px-3 py-1.5 text-xs">
                Download logins (CSV)
              </button>
              <p className="text-xs text-muted-foreground">
                Passwords are only shown here and in this file — they can&apos;t be looked up later.
              </p>
              {failures.length > 0 && (
                <ul className="space-y-0.5 text-xs text-red-600">
                  {failures.map((f) => (
                    <li key={f.email}>
                      {f.email}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
