"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, Download, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

const HEADERS = [
  "names", "nationalId", "dateOfBirth", "gender",
  "province", "district", "sector", "cell", "village",
  "phone", "email", "maritalStatus", "employmentStatus",
  "employerName", "relationshipWithNdfsp",
  "spouseName", "spousePhone", "spouseIdNumber", "maritalPropertyRegime",
];

const SAMPLE_ROW = [
  "Jean Paul Habimana", "1199780012345678", "1985-03-15", "Male",
  "Kigali", "Gasabo", "Kimironko", "Bibare", "Nyabisindu",
  "0781234567", "jean@example.com", "Married", "Employed",
  "Rwanda Development Board", "Client", "Marie Uwase", "0789876543", "1198580012345679", "Separate",
];

// Maps the Excel display headers (customers-2026-*.xlsx) to API camelCase keys
const XLSX_COLUMN_MAP: Record<string, string> = {
  "full names":               "names",
  "national id":              "nationalId",
  "date of birth":            "dateOfBirth",
  "gender":                   "gender",
  "marital status":           "maritalStatus",
  "phone number":             "phone",
  "email address":            "email",
  "employment status":        "employmentStatus",
  "employer name":            "employerName",
  "province":                 "province",
  "district":                 "district",
  "sector":                   "sector",
  "cell":                     "cell",
  "village":                  "village",
  "relationship with ndfsp":  "relationshipWithNdfsp",
  "spouse name":              "spouseName",
  "spouse phone":             "spousePhone",
  "spouse national id":       "spouseIdNumber",
  "marital property regime":  "maritalPropertyRegime",
};

/** Convert DD/MM/YYYY → YYYY-MM-DD. Passes through anything already ISO-shaped. */
function normaliseDOB(raw: string): string {
  if (!raw) return raw;
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, "0")}-${ddmmyyyy[1].padStart(2, "0")}`;
  return raw;
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

async function parseXLSX(file: File): Promise<{ headers: string[]; matrix: string[][] }> {
  const { read, utils } = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headers = (raw[0] as string[]).map((h) => String(h ?? "").trim());
  const matrix = (raw.slice(1) as unknown[][]).map((row) =>
    headers.map((_, i) => {
      const v = row[i];
      return v === null || v === undefined ? "" : String(v);
    })
  );
  return { headers, matrix };
}

function downloadTemplate() {
  const csv = [HEADERS.join(","), SAMPLE_ROW.join(",")].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "customers_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type ParsedRow = Record<string, string>;
type ImportResult = { imported: number; skipped: number; errors: { row: number; message: string }[]; total: number };

const REQUIRED_COLS = ["names", "nationalid", "dateofbirth", "gender", "province", "district", "sector", "cell", "village", "phone", "maritalstatus", "employmentstatus"];

export function ImportCustomersModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processMatrix = useCallback((fileHeaders: string[], matrix: string[][], isXlsx: boolean) => {
    // Resolve each file header to an API key
    const resolvedHeaders = fileHeaders.map((h) => {
      const lower = h.toLowerCase();
      if (isXlsx) return XLSX_COLUMN_MAP[lower] ?? HEADERS.find((k) => k.toLowerCase() === lower) ?? lower;
      return HEADERS.find((k) => k.toLowerCase() === lower) ?? lower;
    });

    const missing = REQUIRED_COLS.filter((r) => !resolvedHeaders.map((h) => h.toLowerCase()).includes(r));
    if (missing.length > 0) { setParseError(`Missing required columns: ${missing.join(", ")}`); return; }

    const parsed: ParsedRow[] = matrix
      .map((cols) => {
        const obj: ParsedRow = {};
        resolvedHeaders.forEach((key, i) => {
          let val = cols[i] ?? "";
          if (key === "dateOfBirth") val = normaliseDOB(val);
          if (key === "nationalId")  val = val.replace(/\.0$/, ""); // strip Excel float suffix
          obj[key] = val;
        });
        return obj;
      })
      .filter((r) => Object.values(r).some((v) => v));

    setRows(parsed);
    setStep("preview");
  }, []);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv  = file.name.endsWith(".csv");
    if (!isXlsx && !isCsv) { setParseError("Only .xlsx or .csv files are supported."); return; }

    if (isXlsx) {
      parseXLSX(file)
        .then(({ headers, matrix }) => {
          if (matrix.length < 1) { setParseError("File must have a header row and at least one data row."); return; }
          processMatrix(headers, matrix, true);
        })
        .catch(() => setParseError("Failed to read the Excel file. Please check the file is not corrupt."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const matrix = parseCSV(text);
      if (matrix.length < 2) { setParseError("File must have a header row and at least one data row."); return; }
      const fileHeaders = matrix[0].map((h) => h.toLowerCase().trim());
      processMatrix(fileHeaders, matrix.slice(1), false);
    };
    reader.readAsText(file);
  }, [processMatrix]);

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: rows }),
      });
      const json = await res.json();
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
      {/* ── Upload step ── */}
      {step === "upload" && (
        <>
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Download CSV Template</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Fill it with customer data then upload below</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Template
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${dragging ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
          >
            <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop your CSV or Excel file here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse · .csv or .xlsx · max 500 rows</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Column reference */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Expected CSV columns</p>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-1.5">
              {HEADERS.map((h) => (
                <span key={h} className={`text-[11px] font-mono px-2 py-0.5 rounded ${REQUIRED_COLS.includes(h.toLowerCase()) ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                  {h}
                </span>
              ))}
            </div>
            <p className="px-4 pb-3 text-[10px] text-gray-400"><span className="inline-block w-2 h-2 rounded-sm bg-green-100 dark:bg-green-900/30 mr-1" />green = required</p>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}
        </>
      )}

      {/* ── Preview step ── */}
      {step === "preview" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rows.length} rows ready to import</p>
            <button onClick={() => { setStep("upload"); setRows([]); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              ← Change file
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                <tr>
                  {["#", "Name", "National ID", "DOB", "Gender", "District", "Phone", "Employment"].map((h) => (
                    <th key={h} className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 2}</td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.names || <span className="text-red-400">missing</span>}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.nationalId || <span className="text-red-400">missing</span>}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.dateOfBirth}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.gender}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.district}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.phone}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.employmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="text-[11px] text-gray-400 text-center">Showing first 100 of {rows.length} rows</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-4 py-2 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || rows.length === 0}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Importing…" : `Import ${rows.length} Customers`}
            </button>
          </div>
        </>
      )}

      {/* ── Result step ── */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Imported", value: result.imported, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
              { label: "Skipped (duplicate)", value: result.skipped, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
              { label: "Errors", value: result.errors.length, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-100 dark:border-red-800 overflow-hidden">
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Rows with errors (not imported)</p>
              </div>
              <div className="divide-y divide-red-50 dark:divide-red-900/20 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex gap-4 px-4 py-2 text-xs">
                    <span className="text-gray-400 shrink-0">Row {err.row}</span>
                    <span className="text-red-600 dark:text-red-400">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={onClose} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
