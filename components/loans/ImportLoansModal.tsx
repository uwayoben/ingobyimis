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
  "status",
  "days_overdue",
  "disbursement_date",
  "branch_name",
  "collateral_type",
  "collateral_amount",
];

const REQUIRED_HEADERS = [
  "customer_national_id",
  "amount",
];

const SAMPLE_ROWS = [
  ["1199780012345678", "Business Capital", "500000", "24", "declining", "30", "12", "2025-06-01", "active",  "",   "2025-05-01", "Kigali Branch", "property", "2000000"],
  ["1198560098765432", "School Fees Loan", "200000", "18", "flat",      "30",  "6", "2024-12-01", "overdue", "45", "2024-11-01", "",              "",          ""],
  ["1197450076543210", "Working Capital",  "300000", "20", "declining", "30", "12", "2026-07-01", "pending", "",   "",           "",              "",          ""],
];

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

/** Convert an Excel serial date number or DD/MM/YYYY string to YYYY-MM-DD. */
function toISODate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "number" && val > 1000) {
    // Excel serial: offset from Dec 30 1899
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split("T")[0];
  }
  const s = String(val ?? "").trim();
  const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, "0")}-${ddmm[1].padStart(2, "0")}`;
  return s;
}

/** Columns from report-style xlsx files → our API field names */
const LOAN_COLUMN_MAP: Record<string, string> = {
  "national id":                    "customer_national_id",
  "national_id":                    "customer_national_id",
  "client id":                      "customer_national_id",
  "customer id":                    "customer_national_id",
  "id number":                      "customer_national_id",
  "customer name":                  "customer_name",
  "client name":                    "customer_name",
  "borrower":                       "customer_name",
  "phone":                          "customer_phone",
  "mobile":                         "customer_phone",
  "telephone":                      "customer_phone",
  "loan number":                    "loan_id",
  "loan no":                        "loan_id",
  "loan id":                        "loan_id",
  "loan status":                    "status",
  "status":                         "status",
  "disbursement date":              "disbursement_date",
  "date disbursed":                 "disbursement_date",
  "first payment date":             "first_payment_date",
  "last payment date":              "last_payment_date",
  "principal amount (rwf)":         "amount",
  "principal amount":               "amount",
  "loan amount":                    "amount",
  "amount":                         "amount",
  "remaining balance (rwf)":        "balance_outstanding",
  "remaining balance":              "balance_outstanding",
  "outstanding balance":            "balance_outstanding",
  "interest rate (%)":              "annual_interest_rate",
  "interest rate":                  "annual_interest_rate",
  "annual rate":                    "annual_interest_rate",
  "rate (%)":                       "annual_interest_rate",
  "interest type":                  "interest_method",
  "interest method":                "interest_method",
  "method":                         "interest_method",
  "days overdue":                   "days_overdue",
  "overdue days":                   "days_overdue",
  "dpd":                            "days_overdue",
  "collateral type":                "collateral_type",
  "collateral":                     "collateral_type",
  "collateral value (rwf)":         "collateral_amount",
  "collateral value":               "collateral_amount",
  "collateral amount":              "collateral_amount",
  "penalty rate (%)":               "penalty_rate",
  "repayment frequency":            "repayment_frequency_days",
  "installment frequency":          "repayment_frequency_days",
  "frequency":                      "repayment_frequency_days",
  "no. of installments":            "total_installments",
  "total installments":             "total_installments",
  "installments":                   "total_installments",
  "number of installments":         "total_installments",
  "term":                           "total_installments",
  "purpose":                        "purpose",
  "loan purpose":                   "purpose",
  "branch":                         "branch_name",
  "branch name":                    "branch_name",
};

/** Fields whose values need date conversion (Excel serial or DD/MM/YYYY → YYYY-MM-DD) */
const DATE_FIELDS = new Set(["disbursement_date", "first_payment_date", "last_payment_date"]);

/** Installment frequency string → days */
const FREQUENCY_MAP: Record<string, string> = {
  "monthly":   "30",
  "weekly":    "7",
  "biweekly":  "14",
  "bi-weekly": "14",
  "daily":     "1",
};

/** Status values from reports → our API status */
const STATUS_MAP: Record<string, string> = {
  "active":    "active",
  "overdue":   "overdue",
  "pending":   "pending",
  "completed": "completed",
  "disbursed": "active",
  "written off": "written_off",
  "written_off": "written_off",
  "rejected":  "rejected",
};

async function parseXLSX(file: File): Promise<{ headers: string[]; matrix: string[][] }> {
  const { read, utils } = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Auto-detect the real header row: the row with the most non-empty cells in the first 15 rows
  let headerRowIdx = 0;
  let maxNonEmpty = 0;
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const count = (raw[i] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length;
    if (count > maxNonEmpty) { maxNonEmpty = count; headerRowIdx = i; }
  }

  const rawHeaders = raw[headerRowIdx] as unknown[];
  const headers = rawHeaders.map((h) => String(h ?? "").trim());

  // Detect if this is a monthly-rate file (has "Installment Frequency" column)
  // e.g. "Loans-Standard-Fixed.xlsx" stores rates per month, not per year
  const isMonthlyRateFile = headers.some((h) => h.toLowerCase() === "installment frequency");

  // Map raw values; apply date/frequency/rate conversions
  const matrix = (raw.slice(headerRowIdx + 1) as unknown[][])
    // Filter out TOTALS / summary rows
    .filter((row) => {
      const first = String(row[0] ?? "").trim().toUpperCase();
      return first !== "" && !first.startsWith("TOTALS") && !first.startsWith("TOTAL LOANS");
    })
    .map((row) =>
      headers.map((h, i) => {
        const rawKey = h.toLowerCase().trim();
        const apiKey = LOAN_COLUMN_MAP[rawKey];
        const v = row[i];
        if (DATE_FIELDS.has(apiKey ?? "") && v !== "" && v !== undefined) return toISODate(v);
        if (apiKey === "status") {
          const mapped = STATUS_MAP[(String(v ?? "")).toLowerCase().trim()];
          return mapped ?? String(v ?? "").trim().toLowerCase();
        }
        if (apiKey === "interest_method") return (String(v ?? "")).toLowerCase().trim();
        if (apiKey === "repayment_frequency_days") {
          const freqStr = String(v ?? "").toLowerCase().trim();
          return FREQUENCY_MAP[freqStr] ?? String(v ?? "");
        }
        if (apiKey === "annual_interest_rate" && isMonthlyRateFile) {
          const n = Number(v);
          return isNaN(n) ? String(v ?? "") : String(Math.round(n * 12 * 1000) / 1000);
        }
        return v === null || v === undefined ? "" : String(v);
      })
    );

  return { headers, matrix };
}

type ParsedRow = Record<string, string>;

const VALID_STATUSES = ["pending", "active", "overdue"];

function validateRow(row: ParsedRow): string | null {
  if (!row.customer_national_id?.trim()) return "National ID is required";

  const amount = Number(row.amount);
  if (!row.amount || isNaN(amount) || amount <= 0)
    return "amount must be a positive number";

  const rate = Number(row.annual_interest_rate);
  if (!row.annual_interest_rate || isNaN(rate) || rate < 0 || rate > 999)
    return "interest rate must be between 0 and 999";

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

  const processMatrix = useCallback((fileHeaders: string[], matrix: string[][]) => {
    // Resolve each file header to an API key via alias map or direct normalisation
    const resolvedHeaders = fileHeaders.map((h) => {
      const lower = h.toLowerCase().trim();
      return LOAN_COLUMN_MAP[lower]
        ?? HEADERS.find((k) => k === lower)
        ?? lower.replace(/[\s\-/(%)]+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
    });

    const missing = REQUIRED_HEADERS.filter((h) => !resolvedHeaders.includes(h));
    if (missing.length > 0) {
      const found = resolvedHeaders.filter(Boolean).join(", ") || "(none)";
      setParseError(`Missing required columns: ${missing.join(", ")}.\nFound in file: ${found}.\nMake sure you are using the correct template.`);
      return;
    }

    const parsed: ParsedRow[] = matrix
      .map((cols) => {
        const obj: ParsedRow = {};
        resolvedHeaders.forEach((key, i) => {
          obj[key] = (cols[i] ?? "").toString().trim();
        });
        return obj;
      })
      .filter((r) => Object.values(r).some((v) => v));

    if (parsed.length === 0) { setParseError("No data rows found after the header."); return; }
    if (parsed.length > 500) { setParseError("Maximum 500 rows per import. Please split into smaller files."); return; }

    setRows(parsed);
    setRowErrors(parsed.map(validateRow));
    setStep("preview");
  }, []);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv  = file.name.endsWith(".csv");
    if (!isXlsx && !isCsv) { setParseError("Only .csv or .xlsx files are supported."); return; }

    if (isXlsx) {
      parseXLSX(file)
        .then(({ headers, matrix }) => {
          if (matrix.length < 1) { setParseError("File must have a header row and at least one data row."); return; }
          processMatrix(headers, matrix);
        })
        .catch(() => setParseError("Failed to read the Excel file. Please check the file is not corrupt."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text   = e.target?.result as string;
      const matrix = parseCSV(text);
      if (matrix.length < 2) { setParseError("File must have a header row and at least one data row."); return; }
      processMatrix(matrix[0].map((h) => h.trim()), matrix.slice(1));
    };
    reader.readAsText(file);
  }, [processMatrix]);

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
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Download Template</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Pre-filled with active, overdue, and pending examples</p>
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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop your CSV or Excel file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · .csv or .xlsx · max 500 rows</p>
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
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
              &nbsp;·&nbsp; frequency: 7/14/30 &nbsp;·&nbsp; status: <code className="font-mono">pending</code> / <code className="font-mono">active</code> / <code className="font-mono">overdue</code> (default: active)
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
                {result.imported} loan{result.imported !== 1 ? "s" : ""} imported successfully with their respective statuses.
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
