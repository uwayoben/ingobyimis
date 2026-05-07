"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const HEADERS = [
  "customer_national_id",
  "purpose",
  "amount",
  "annual_interest_rate",
  "interest_method",
  "repayment_frequency_days",
  "total_installments",
  "first_payment_date",
  "branch_name",
  "collateral_type",
  "collateral_amount",
];

const REQUIRED_HEADERS = [
  "customer_national_id",
  "purpose",
  "amount",
  "annual_interest_rate",
  "interest_method",
  "repayment_frequency_days",
  "total_installments",
  "first_payment_date",
];

const SAMPLE_ROWS = [
  ["1199780012345678", "Business Capital",  "500000", "24", "declining", "30", "12", "2025-06-01", "Kigali Branch", "property",  "2000000"],
  ["1198560098765432", "School Fees Loan",  "200000", "18", "flat",      "30",  "6", "2025-06-15", "",              "",          ""],
];

function downloadTemplate() {
  const lines = [
    HEADERS.join(","),
    ...SAMPLE_ROWS.map((r) => r.join(",")),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a   = document.createElement("a");
  a.href     = url;
  a.download = "loans_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => {
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
}

type ParsedRow = Record<string, string>;

function validateRow(row: ParsedRow): string | null {
  if (!row.customer_national_id?.trim()) return "customer_national_id is required";
  if (!row.purpose?.trim())              return "purpose is required";

  const amount = Number(row.amount);
  if (!row.amount || isNaN(amount) || amount <= 0 || !Number.isInteger(amount))
    return "amount must be a positive whole number (e.g. 500000)";

  const rate = Number(row.annual_interest_rate);
  if (!row.annual_interest_rate || isNaN(rate) || rate <= 0 || rate > 200)
    return "annual_interest_rate must be a number between 0.1 and 200 (e.g. 24)";

  if (!["flat", "declining"].includes(row.interest_method?.toLowerCase?.()))
    return "interest_method must be 'flat' or 'declining'";

  const freq = Number(row.repayment_frequency_days);
  if (!row.repayment_frequency_days || isNaN(freq) || freq <= 0 || !Number.isInteger(freq))
    return "repayment_frequency_days must be a positive integer (e.g. 30 for monthly)";

  const insts = Number(row.total_installments);
  if (!row.total_installments || isNaN(insts) || insts <= 0 || !Number.isInteger(insts))
    return "total_installments must be a positive integer";

  if (!row.first_payment_date?.trim()) return "first_payment_date is required";
  if (isNaN(new Date(row.first_payment_date).getTime()))
    return "first_payment_date must be a valid date in YYYY-MM-DD format";

  if (row.collateral_amount && row.collateral_amount.trim()) {
    const ca = Number(row.collateral_amount);
    if (isNaN(ca) || ca <= 0 || !Number.isInteger(ca))
      return "collateral_amount must be a positive integer if provided";
  }

  return null;
}

function formatAmount(v: string) {
  const n = Number(v);
  return isNaN(n) ? v : "RWF " + n.toLocaleString();
}

type ImportResult = { imported: number; errors: { row: number; message: string }[]; total: number };

export function ImportLoansModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep]         = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [rowErrors, setRowErrors] = useState<(string | null)[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    if (!file.name.endsWith(".csv")) { setParseError("Only .csv files are supported."); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text     = e.target?.result as string;
      const matrix   = parseCSV(text);
      if (matrix.length < 2) { setParseError("File must have a header row and at least one data row."); return; }

      const fileHeaders = matrix[0].map((h) => h.toLowerCase().replace(/\s+/g, "_").trim());
      const missing = REQUIRED_HEADERS.filter((h) => !fileHeaders.includes(h));
      if (missing.length > 0) { setParseError(`Missing required columns: ${missing.join(", ")}`); return; }

      const parsed: ParsedRow[] = matrix.slice(1)
        .map((cols) => {
          const obj: ParsedRow = {};
          fileHeaders.forEach((h, i) => {
            const key = HEADERS.find((hdr) => hdr === h) ?? h;
            obj[key] = (cols[i] ?? "").trim();
          });
          return obj;
        })
        .filter((r) => Object.values(r).some((v) => v));

      if (parsed.length === 0) { setParseError("No data rows found after the header."); return; }
      if (parsed.length > 500) { setParseError("Maximum 500 rows per import. Please split into smaller files."); return; }

      setRows(parsed);
      setRowErrors(parsed.map(validateRow));
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const validRows   = rows.filter((_, i) => rowErrors[i] === null);
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setLoading(true);
    try {
      const res  = await apiFetch("/api/v1/loans/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loans: validRows }),
      });
      const json = await res.json();
      if (!res.ok) { setParseError(json.error ?? "Import failed."); return; }
      setResult(json.data);
      setStep("result");
      if (json.data?.imported > 0) onImported();
    } catch {
      setParseError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Upload step ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <>
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Download CSV Template</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Fill it with loan data, then upload below</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Template
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
              dragging
                ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                : "border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
          >
            <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop your CSV file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · .csv only · max 500 rows</p>
            <input
              ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Column reference */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Expected CSV columns</p>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              {HEADERS.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "text-[11px] font-mono px-2 py-0.5 rounded",
                    REQUIRED_HEADERS.includes(h)
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  )}
                >
                  {h}
                </span>
              ))}
            </div>
            <p className="px-4 pb-3 text-[10px] text-gray-400">
              <span className="inline-block w-2 h-2 rounded-sm bg-green-100 dark:bg-green-900/30 mr-1" />
              green = required &nbsp;·&nbsp; interest_method: <code className="font-mono">flat</code> or <code className="font-mono">declining</code>
              &nbsp;·&nbsp; frequency: 7 weekly, 14 bi-weekly, 30 monthly
            </p>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}
        </>
      )}

      {/* ── Preview step ────────────────────────────────────────────── */}
      {step === "preview" && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rows.length} rows parsed</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                {validRows.length} valid
              </span>
              {invalidCount > 0 && (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  {invalidCount} invalid (will be skipped)
                </span>
              )}
            </div>
            <button
              onClick={() => { setStep("upload"); setRows([]); setRowErrors([]); setParseError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              ← Change file
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-72">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                <tr>
                  {["#", "National ID", "Purpose", "Amount", "Rate", "Method", "Freq×Inst", "First Payment", "Status"].map((h) => (
                    <th key={h} className="text-left font-semibold text-gray-500 dark:text-gray-400 px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {rows.map((row, i) => {
                  const err = rowErrors[i];
                  return (
                    <tr
                      key={i}
                      className={cn(
                        "transition-colors",
                        err
                          ? "bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      )}
                    >
                      <td className="px-3 py-2 text-gray-400">{i + 2}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {row.customer_national_id || <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                        {row.purpose || <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {row.amount ? formatAmount(row.amount) : <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.annual_interest_rate ? `${row.annual_interest_rate}%` : <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          row.interest_method === "flat"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : row.interest_method === "declining"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-red-100 text-red-600"
                        )}>
                          {row.interest_method || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {row.repayment_frequency_days && row.total_installments
                          ? `${row.repayment_frequency_days}d × ${row.total_installments}`
                          : <span className="text-red-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.first_payment_date || <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-2">
                        {err
                          ? <span title={err}><XCircle className="w-3.5 h-3.5 text-red-500" /></span>
                          : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Row errors list */}
          {invalidCount > 0 && (
            <div className="rounded-xl border border-red-100 dark:border-red-800 overflow-hidden">
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {invalidCount} row{invalidCount !== 1 ? "s" : ""} with errors — these will be skipped
                </p>
              </div>
              <div className="divide-y divide-red-50 dark:divide-red-900/20 max-h-32 overflow-y-auto">
                {rowErrors.map((err, i) =>
                  err ? (
                    <div key={i} className="flex gap-4 px-4 py-1.5 text-xs">
                      <span className="text-gray-400 shrink-0 w-12">Row {i + 2}</span>
                      <span className="text-red-600 dark:text-red-400">{err}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {parseError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {parseError}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-4 py-2 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || validRows.length === 0}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading
                ? "Importing…"
                : `Import ${validRows.length} Loan${validRows.length !== 1 ? "s" : ""}${invalidCount > 0 ? ` (skip ${invalidCount})` : ""}`}
            </button>
          </div>
        </>
      )}

      {/* ── Result step ─────────────────────────────────────────────── */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Imported",      value: result.imported,        color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
              { label: "Skipped (CSV)", value: rows.length - validRows.length, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
              { label: "Server Errors", value: result.errors.length,   color: "text-red-600 dark:text-red-400",           bg: "bg-red-50 dark:bg-red-900/20" },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl p-4 text-center", s.bg)}>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {result.imported > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                {result.imported} loan{result.imported !== 1 ? "s" : ""} imported as <strong>Pending</strong> — they still need approval before disbursement.
              </p>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-100 dark:border-red-800 overflow-hidden">
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Server-side errors (not imported)</p>
              </div>
              <div className="divide-y divide-red-50 dark:divide-red-900/20 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex gap-4 px-4 py-2 text-xs">
                    <span className="text-gray-400 shrink-0 w-12">Row {err.row}</span>
                    <span className="text-red-600 dark:text-red-400">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
