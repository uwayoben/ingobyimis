"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download, BarChart3, FileCheck, TrendingUp, Building2, X, Loader2,
  AlertTriangle, CheckCircle2, Search, RefreshCw, Calendar, FileText, Printer, Scale,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useTheme } from "@/components/ThemeProvider";
import { apiFetch } from "@/lib/api-fetch";
import { cn, formatDate } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}

function pct(n: number) {
  return n.toFixed(1) + "%";
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function getPreset(label: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (label) {
    case "This Month":
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
    case "Last Month":
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
    case "This Quarter":
      return { from: isoDate(new Date(y, q * 3, 1)), to: isoDate(new Date(y, q * 3 + 3, 0)) };
    case "Last Quarter":
      return { from: isoDate(new Date(y, (q - 1) * 3, 1)), to: isoDate(new Date(y, q * 3, 0)) };
    case "This Year":
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) };
    default:
      return { from: isoDate(new Date(y, 0, 1)), to: isoDate(new Date(y, 11, 31)) };
  }
}

// ── P&L Statement Generator ───────────────────────────────────────────────────

function downloadPLStatement(
  income: { interestIncome: number; penaltyIncome: number; feeIncome: number; totalIncome: number },
  expenses: { byCategory: { category: string; amount: number }[]; total: number },
  period: { from: string; to: string }
) {
  const companyName = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company"; } catch { return "Company"; } })()
    : "Company";

  const today     = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const fromLabel = new Date(period.from).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const toLabel   = new Date(period.to).toLocaleDateString("en-GB",   { day: "2-digit", month: "long", year: "numeric" });
  const netProfit = income.totalIncome - expenses.total;
  const isProfit  = netProfit >= 0;

  const incomeRows = [
    { label: "Interest Income",  amount: income.interestIncome },
    { label: "Penalty Income",   amount: income.penaltyIncome  },
    { label: "Processing / Loan Fees", amount: income.feeIncome },
  ].map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
      <td style="padding:8px 16px;border-bottom:1px solid #e5e7eb">${r.label}</td>
      <td></td>
      <td style="padding:8px 16px;text-align:right;font-weight:600;color:#166534;border-bottom:1px solid #e5e7eb">${r.amount > 0 ? "RWF " + r.amount.toLocaleString() : "—"}</td>
    </tr>`).join("");

  const expenseRows = expenses.byCategory.map((c, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
      <td style="padding:8px 16px;border-bottom:1px solid #e5e7eb">${c.category}</td>
      <td></td>
      <td style="padding:8px 16px;text-align:right;font-weight:600;color:#dc2626;border-bottom:1px solid #e5e7eb">(RWF ${c.amount.toLocaleString()})</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Profit & Loss Statement</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff}
  .page{max-width:720px;margin:0 auto;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #166534}
  .co-name{font-size:20px;font-weight:800;color:#166534}
  .co-sub{font-size:11px;color:#888;margin-top:3px}
  .title h1{font-size:18px;font-weight:800;color:#166534;text-align:right;text-transform:uppercase;letter-spacing:1px}
  .title p{font-size:10px;color:#666;text-align:right;margin-top:4px;line-height:1.7}
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  .section-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff;background:#052e16;padding:7px 16px}
  .subtotal td{background:#f0fdf4;font-weight:700;font-size:12px;padding:8px 16px;border-top:2px solid #16a34a}
  .subtotal td:last-child{text-align:right;color:#166534}
  .total-expenses td:last-child{color:#dc2626 !important}
  .net-row td{padding:12px 16px;font-size:15px;font-weight:800;border-top:3px double #111}
  .net-row td:last-child{text-align:right}
  .col-label{width:55%}.col-spacer{width:20%}.col-amount{width:25%;text-align:right}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:9}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:24px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div>
      <div class="co-name">${companyName}</div>
      <div class="co-sub">NDFSP Microfinance</div>
    </div>
    <div class="title">
      <h1>Profit & Loss Statement</h1>
      <p>Period: ${fromLabel} – ${toLabel}<br/>Generated: ${today}</p>
    </div>
  </div>

  <table>
    <colgroup>
      <col class="col-label"/><col class="col-spacer"/><col class="col-amount"/>
    </colgroup>

    <!-- INCOME -->
    <tr><td colspan="3" class="section-label">Income</td></tr>
    ${incomeRows}
    <tr class="subtotal">
      <td>Total Income</td><td></td>
      <td>RWF ${income.totalIncome.toLocaleString()}</td>
    </tr>

    <!-- SPACER -->
    <tr><td colspan="3" style="padding:6px"></td></tr>

    <!-- EXPENSES -->
    <tr><td colspan="3" class="section-label">Operating Expenses</td></tr>
    ${expenseRows}
    <tr class="subtotal total-expenses">
      <td>Total Expenses</td><td></td>
      <td>(RWF ${expenses.total.toLocaleString()})</td>
    </tr>

    <!-- SPACER -->
    <tr><td colspan="3" style="padding:6px"></td></tr>

    <!-- NET -->
    <tr class="net-row" style="color:${isProfit ? "#166534" : "#dc2626"}">
      <td colspan="2"><strong>Net ${isProfit ? "Profit" : "Loss"}</strong></td>
      <td><strong>${isProfit ? "" : "("}RWF ${Math.abs(netProfit).toLocaleString()}${isProfit ? "" : ")"}</strong></td>
    </tr>
  </table>

  <p style="margin-top:40px;font-size:9px;color:#aaa;text-align:center">
    This statement was generated automatically from recorded income and expense data for the period stated above.
  </p>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[12,12,12,12],
      filename:'ProfitLoss-Statement-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

  const w = window.open("", "_blank", "width=860,height=750");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SummaryData {
  portfolio: {
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    pendingLoans: number;
    completedLoans: number;
    totalOutstanding: number;
    nplAmount: number;
    nplRate: number;
    totalProvision: number;
    provisionCoverage: number;
    byStatus: { status: string; count: number; amount: number }[];
    byClass:  { class: string;  count: number; amount: number }[];
  };
  income: {
    interestIncome: number;
    penaltyIncome:  number;
    feeIncome:      number;
    totalIncome:    number;
    totalCollected: number;
    principalCollected: number;
  };
  expenses: {
    byCategory: { category: string; amount: number }[];
    total: number;
  };
  chartData: { month: string; disbursed: number; collected: number }[];
  period: { from: string; to: string };
}

interface InstallmentRow {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  amountPaid: number;
  status: string;
  loan: {
    id: string;
    purpose: string;
    status: string;
    customer: { names: string; phone: string };
  };
}

interface ScheduleData {
  installments: InstallmentRow[];
  summary: {
    total: number;
    totalDue: number;
    totalPaid: number;
    overdueCount: number;
    paidCount: number;
    pendingCount: number;
  };
}

// ── Status / class colours ────────────────────────────────────────────────────

const STATUS_PIE_COLORS: Record<string, string> = {
  active:     "#16a34a",
  overdue:    "#dc2626",
  pending:    "#d97706",
  approved:   "#3b82f6",
  disbursed:  "#8b5cf6",
  completed:  "#6b7280",
  rejected:   "#9ca3af",
  written_off:"#374151",
};

const CLASS_BADGE: Record<string, string> = {
  Normal:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Watch:       "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Substandard: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Doubtful:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Loss:        "bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300",
};

const INST_STATUS_COLOR: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── BNR Modal ─────────────────────────────────────────────────────────────────

function BNRModal({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const storedUser = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })()
    : null;

  const [reportingDate,  setReportingDate]  = useState(today);
  const [institutionName,setInstitutionName]= useState(storedUser?.companyName ?? "");
  const [sector,  setSector]   = useState("");
  const [district,setDistrict] = useState("");
  const [loading, setLoading]  = useState(false);
  const [error,   setError]    = useState("");

  const handleDownload = async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ reportingDate, institutionName, sector, district });
      const res = await apiFetch(`/api/v1/reports/bnr?${params}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Failed"); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `BNR_Report_${reportingDate.replace(/-/g,"")}.xlsx`; a.click();
      URL.revokeObjectURL(url); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">BNR Compliance Report</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configure report parameters</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reporting Date</label>
            <input type="date" value={reportingDate} onChange={(e) => setReportingDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Institution Name</label>
            <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="e.g. SACCO Name"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sector</label>
              <input type="text" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. Kacyiru"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">District</label>
              <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Gasabo"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleDownload} disabled={loading || !institutionName.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? "Generating…" : "Download Excel"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Date Range Filter ─────────────────────────────────────────────────────────

const PRESETS = ["This Month", "Last Month", "This Quarter", "This Year"] as const;

function DateRangeFilter({
  from, to, onChange,
}: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex items-center gap-2">
        <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button key={p}
            onClick={() => { const { from: f, to: t } = getPreset(p); onChange(f, t); }}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data, dark, onBNR }: { data: SummaryData; dark: boolean; onBNR: () => void }) {
  const gridColor = dark ? "#1f2937" : "#f3f4f6";
  const textColor = dark ? "#6b7280" : "#9ca3af";
  const [dlIncome,    setDlIncome]    = useState(false);
  const [dlPortfolio, setDlPortfolio] = useState(false);
  const [dlCRB,       setDlCRB]       = useState(false);
  const [dlPL,        setDlPL]        = useState(false);

  const handleIncomeReport = async () => {
    setDlIncome(true);
    try {
      const res  = await apiFetch("/api/v1/expenses");
      const json = await res.json();
      const expenses: any[] = json.data ?? json ?? [];

      const { income } = data;
      const totalPaid   = expenses.filter((e) => e.isPaid).reduce((s: number, e: any) => s + e.amount, 0);
      const totalUnpaid = expenses.filter((e) => !e.isPaid).reduce((s: number, e: any) => s + e.amount, 0);
      const totalExpAmt = expenses.reduce((s: number, e: any) => s + e.amount, 0);
      const netProfit   = income.totalIncome - totalExpAmt;
      const today       = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      const companyName = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company" : "Company";

      const expRows = expenses.map((e: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${new Date(e.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${e.category}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${e.description}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600">RWF ${e.amount.toLocaleString()}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;${e.isPaid?"background:#dcfce7;color:#166534":"background:#fef3c7;color:#92400e"}">${e.isPaid?"Paid":"Unpaid"}</span></td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Income & Expense Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff}
  .page{max-width:900px;margin:0 auto;padding:36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #166534}
  .co-name{font-size:20px;font-weight:700;color:#166534}.co-sub{font-size:11px;color:#888;margin-top:2px}
  .title h1{font-size:22px;font-weight:800;color:#166534;text-align:right}.title p{font-size:10px;color:#666;text-align:right;line-height:1.6}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
  .box{background:#f8fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .box h3{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:6px}
  .box p{font-size:15px;font-weight:800;color:#111}.box .sub{font-size:10px;color:#888;margin-top:2px;font-weight:400}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#374151;margin:18px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead th{background:#052e16;color:#fff;text-align:left;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px}
  tfoot td{background:#f0fdf4;font-weight:700;padding:7px 10px;border-top:2px solid #16a34a;font-size:11px}
  .net{text-align:right;font-size:14px;font-weight:800;padding:12px 0;border-top:2px solid #111}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:20px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div><div class="co-name">${companyName}</div><div class="co-sub">NDFSP</div></div>
    <div class="title"><h1>INCOME & EXPENSE REPORT</h1><p>Generated: ${today}</p></div>
  </div>

  <div class="grid3">
    <div class="box"><h3>Total Income</h3><p style="color:#166534">RWF ${income.totalIncome.toLocaleString()}</p><div class="sub">Cash collected: RWF ${income.totalCollected.toLocaleString()}</div></div>
    <div class="box"><h3>Total Expenses</h3><p style="color:#dc2626">RWF ${totalExpAmt.toLocaleString()}</p><div class="sub">Paid: RWF ${totalPaid.toLocaleString()} · Unpaid: RWF ${totalUnpaid.toLocaleString()}</div></div>
    <div class="box"><h3>Net ${netProfit >= 0 ? "Profit" : "Loss"}</h3><p style="color:${netProfit >= 0 ? "#166534" : "#dc2626"}">RWF ${Math.abs(netProfit).toLocaleString()}</p><div class="sub">${netProfit >= 0 ? "Surplus" : "Deficit"}</div></div>
  </div>

  <div class="grid2">
    <div>
      <div class="section-title">Income Breakdown</div>
      <table>
        <thead><tr><th>Source</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          <tr style="background:#fff"><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">Interest Income</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#166534;border-bottom:1px solid #e5e7eb">RWF ${income.interestIncome.toLocaleString()}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">Penalty Income</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#166534;border-bottom:1px solid #e5e7eb">RWF ${income.penaltyIncome.toLocaleString()}</td></tr>
          <tr style="background:#fff"><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">Processing Fees</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#166534;border-bottom:1px solid #e5e7eb">RWF ${income.feeIncome.toLocaleString()}</td></tr>
        </tbody>
        <tfoot><tr><td>TOTAL INCOME</td><td style="text-align:right">RWF ${income.totalIncome.toLocaleString()}</td></tr></tfoot>
      </table>
    </div>
    <div>
      <div class="section-title">Expenses by Category</div>
      <table>
        <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${data.expenses.byCategory.map((c,i)=>`<tr style="background:${i%2===0?"#fff":"#f9fafb"}"><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${c.category}</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#dc2626;border-bottom:1px solid #e5e7eb">RWF ${c.amount.toLocaleString()}</td></tr>`).join("")}
        </tbody>
        <tfoot><tr><td>TOTAL EXPENSES</td><td style="text-align:right">RWF ${totalExpAmt.toLocaleString()}</td></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="section-title">Expense Records (${expenses.length} entries)</div>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${expRows}</tbody>
    <tfoot><tr><td colspan="3">TOTALS</td><td>RWF ${totalExpAmt.toLocaleString()}</td><td></td></tr></tfoot>
  </table>

  <div class="net" style="color:${netProfit>=0?"#166534":"#dc2626"}">
    NET ${netProfit >= 0 ? "PROFIT" : "LOSS"}: RWF ${Math.abs(netProfit).toLocaleString()}
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[8,8,8,8],filename:'Income-Expense-Report-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

      const w = window.open("", "_blank", "width=960,height=750");
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch { /* silent */ }
    finally { setDlIncome(false); }
  };

  const handlePortfolioReport = async () => {
    setDlPortfolio(true);
    try {
      const res  = await apiFetch("/api/v1/loans?limit=100");
      const json = await res.json();
      const loans: any[] = json.data ?? [];
      const { portfolio } = data;
      const today       = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      const companyName = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company" : "Company";

      const classColors: Record<string,string> = {
        Normal:      "#166534", Watch: "#92400e", Substandard: "#9a3412",
        Doubtful:    "#991b1b", Loss: "#881337",
      };
      const statusColors: Record<string,string> = {
        active: "#166534", overdue: "#dc2626", pending: "#d97706",
        approved: "#1d4ed8", completed: "#6b7280", written_off: "#374151",
      };

      const loanRows = loans.map((l: any, i: number) => {
        const outstanding = l.balanceOutstanding ?? 0;
        const sc = statusColors[l.status] ?? "#374151";
        const cc = classColors[l.loanClass] ?? "#374151";
        return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px">${l.id?.toUpperCase()}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${l.customerName ?? l.customer?.names ?? "—"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">RWF ${(l.amount ?? 0).toLocaleString()}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${outstanding > 0 ? "#dc2626" : "#6b7280"}">RWF ${outstanding.toLocaleString()}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb"><span style="padding:2px 6px;border-radius:10px;font-size:9px;font-weight:700;text-transform:capitalize;background:${sc}20;color:${sc}">${l.status}</span></td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb"><span style="padding:2px 6px;border-radius:10px;font-size:9px;font-weight:700;background:${cc}20;color:${cc}">${l.loanClass}</span></td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${l.installmentsPaid ?? 0}/${l.totalInstallments ?? 0}</td>
        </tr>`;
      }).join("");

      const byStatusRows = portfolio.byStatus.map((s: any) => {
        const sc = statusColors[s.status] ?? "#374151";
        return `<tr style="background:#fff"><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb"><span style="padding:2px 6px;border-radius:8px;font-size:9px;font-weight:700;text-transform:capitalize;background:${sc}20;color:${sc}">${s.status}</span></td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${s.count}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">RWF ${(s.amount ?? 0).toLocaleString()}</td></tr>`;
      }).join("");

      const classRates: Record<string,number> = { Normal:0, Watch:1, Substandard:20, Doubtful:50, Loss:100 };
      const byClassRows = (["Normal","Watch","Substandard","Doubtful","Loss"]).map((cls: string) => {
        const row = portfolio.byClass.find((b: any) => b.class === cls) ?? { count: 0, amount: 0 };
        const provision = Math.round((row.amount ?? 0) * classRates[cls] / 100);
        const cc = classColors[cls] ?? "#374151";
        return `<tr style="background:#fff"><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb"><span style="padding:2px 6px;border-radius:8px;font-size:9px;font-weight:700;background:${cc}20;color:${cc}">${cls}</span></td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${row.count}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">RWF ${(row.amount??0).toLocaleString()}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${classRates[cls]}%</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">RWF ${provision.toLocaleString()}</td></tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Portfolio Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
  .page{max-width:1000px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #166534}
  .co-name{font-size:20px;font-weight:700;color:#166534}.co-sub{font-size:11px;color:#888;margin-top:2px}
  .title h1{font-size:20px;font-weight:800;color:#166534;text-align:right}.title p{font-size:10px;color:#666;text-align:right;line-height:1.6}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
  .box{background:#f8fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
  .box h3{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#9ca3af;margin-bottom:4px}
  .box p{font-size:14px;font-weight:800;color:#111}.box .sub{font-size:9px;color:#888;margin-top:1px;font-weight:400}
  .section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#374151;margin:16px 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  thead th{background:#052e16;color:#fff;text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px}
  thead th.r{text-align:right}
  tfoot td{background:#f0fdf4;font-weight:700;padding:6px 8px;border-top:2px solid #16a34a;font-size:10px}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:16px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div><div class="co-name">${companyName}</div><div class="co-sub">NDFSP</div></div>
    <div class="title"><h1>PORTFOLIO REPORT</h1><p>Generated: ${today}<br/>${loans.length} loans shown</p></div>
  </div>

  <div class="grid4">
    <div class="box"><h3>Total Loans</h3><p>${portfolio.totalLoans}</p></div>
    <div class="box"><h3>Active</h3><p style="color:#166534">${portfolio.activeLoans}</p></div>
    <div class="box"><h3>Overdue</h3><p style="color:#dc2626">${portfolio.overdueLoans}</p></div>
    <div class="box"><h3>Total Outstanding</h3><p>RWF ${(portfolio.totalOutstanding/1_000_000).toFixed(1)}M</p></div>
    <div class="box"><h3>NPL Amount</h3><p style="color:#dc2626">RWF ${(portfolio.nplAmount/1_000_000).toFixed(1)}M</p></div>
    <div class="box"><h3>NPL Rate</h3><p style="color:${portfolio.nplRate>5?"#dc2626":"#166534"}">${portfolio.nplRate.toFixed(1)}%</p></div>
    <div class="box"><h3>Total Provision</h3><p>RWF ${(portfolio.totalProvision/1_000_000).toFixed(1)}M</p></div>
    <div class="box"><h3>Provision Coverage</h3><p>${portfolio.provisionCoverage.toFixed(1)}%</p></div>
  </div>

  <div class="grid2">
    <div>
      <div class="section">By Status</div>
      <table><thead><tr><th>Status</th><th class="r">Loans</th><th class="r">Outstanding</th></tr></thead>
      <tbody>${byStatusRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td style="text-align:right">${portfolio.totalLoans}</td><td style="text-align:right">RWF ${portfolio.totalOutstanding.toLocaleString()}</td></tr></tfoot></table>
    </div>
    <div>
      <div class="section">By BNR Class (Provisioning)</div>
      <table><thead><tr><th>Class</th><th class="r">Loans</th><th class="r">Outstanding</th><th class="r">Rate</th><th class="r">Provision</th></tr></thead>
      <tbody>${byClassRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td></td><td style="text-align:right">RWF ${portfolio.totalOutstanding.toLocaleString()}</td><td></td><td style="text-align:right">RWF ${portfolio.totalProvision.toLocaleString()}</td></tr></tfoot></table>
    </div>
  </div>

  <div class="section">Loan Details (${loans.length} records)</div>
  <table>
    <thead><tr><th>Loan ID</th><th>Customer</th><th class="r">Amount</th><th class="r">Outstanding</th><th>Status</th><th>Class</th><th class="r">Installments</th></tr></thead>
    <tbody>${loanRows}</tbody>
    <tfoot><tr>
      <td colspan="2">TOTALS (${loans.length} loans)</td>
      <td style="text-align:right">RWF ${loans.reduce((s:number,l:any)=>s+(l.amount??0),0).toLocaleString()}</td>
      <td style="text-align:right">RWF ${loans.reduce((s:number,l:any)=>s+(l.balanceOutstanding??0),0).toLocaleString()}</td>
      <td colspan="3"></td>
    </tr></tfoot>
  </table>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[6,6,6,6],filename:'Portfolio-Report-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

      const w = window.open("", "_blank", "width=1100,height=800");
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch { /* silent */ }
    finally { setDlPortfolio(false); }
  };

  const handleCRBReport = async () => {
    setDlCRB(true);
    try {
      const res  = await apiFetch("/api/v1/loans?limit=100");
      const json = await res.json();
      const loans: any[] = json.data ?? [];

      const accountTypeMap: Record<string,string> = {
        active: "Open", overdue: "Delinquent", completed: "Closed",
        written_off: "Written Off", pending: "Pending", approved: "Approved",
      };

      const esc = (v: any) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };

      const headers = [
        "Borrower Name", "National ID", "Phone", "Gender", "Province", "District",
        "Account Number", "Loan Type", "Credit Limit (RWF)", "Outstanding Balance (RWF)",
        "Amount Repaid (RWF)", "Days Overdue", "BNR Classification", "Account Status",
        "Disbursement Date", "Maturity Date", "Last Payment Date", "Interest Rate (%)",
        "Installments Paid", "Total Installments",
      ];

      const csvRows = loans.map((l: any) => {
        const c = l.customer ?? {};
        return [
          esc(c.names),
          esc(c.nationalId),
          esc(c.phone),
          esc(c.gender),
          esc(c.province),
          esc(c.district),
          esc(l.id?.toUpperCase()),
          esc(l.interestMethod === "flat" ? "Flat Rate" : "Declining Balance"),
          esc(l.amount ?? 0),
          esc(l.balanceOutstanding ?? 0),
          esc(l.amountRepaidPrincipal ?? 0),
          esc(l.daysOverdue ?? 0),
          esc(l.loanClass),
          esc(accountTypeMap[l.status] ?? l.status),
          esc(l.disbursementDate ? new Date(l.disbursementDate).toISOString().slice(0,10) : ""),
          esc(l.agreedMaturityDate ? new Date(l.agreedMaturityDate).toISOString().slice(0,10) : ""),
          esc(l.lastPaymentDate ? new Date(l.lastPaymentDate).toISOString().slice(0,10) : ""),
          esc(Number(l.annualInterestRate ?? 0).toFixed(3)),
          esc(l.installmentsPaid ?? 0),
          esc(l.totalInstallments ?? 0),
        ].join(",");
      });

      const csv  = [headers.join(","), ...csvRows].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `CRB-Report-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setDlCRB(false); }
  };

  const barData = data.chartData.map((d) => ({
    month: d.month,
    Disbursed: Math.round(d.disbursed / 1_000_000),
    Collected: Math.round(d.collected / 1_000_000),
  }));

  const pieData = data.portfolio.byStatus.map((s) => ({
    name: s.status.replace("_", " "),
    value: s.count,
    color: STATUS_PIE_COLORS[s.status] ?? "#6b7280",
  }));

  const kpis = [
    { label: "Total Active Portfolio", value: fmt(data.portfolio.totalOutstanding), sub: `${data.portfolio.activeLoans} active loans`, color: "text-green-600 dark:text-green-400", border: "border-l-green-500" },
    { label: "Overdue Loans",          value: String(data.portfolio.overdueLoans),  sub: "currently overdue", color: "text-red-600 dark:text-red-400", border: "border-l-red-500" },
    { label: "NPL Rate",               value: pct(data.portfolio.nplRate),          sub: `${fmt(data.portfolio.nplAmount)} non-performing`, color: data.portfolio.nplRate > 5 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400", border: data.portfolio.nplRate > 5 ? "border-l-red-500" : "border-l-emerald-500" },
    { label: "Provision Coverage",     value: pct(data.portfolio.provisionCoverage),sub: `${fmt(data.portfolio.totalProvision)} provisioned`, color: data.portfolio.provisionCoverage >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400", border: data.portfolio.provisionCoverage >= 100 ? "border-l-emerald-500" : "border-l-red-500" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className={cn("border-l-4", k.border)}>
            <CardContent className="pt-4 pb-4">
              <p className={cn("text-xl font-bold", k.color)}>{k.value}</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Disbursements vs Collections (RWF M)</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {barData.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-16">No disbursement or payment data in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`RWF ${v}M`, ""]}
                    contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Disbursed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected"  fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Loans by Status</CardTitle></CardHeader>
          <CardContent className="pt-2">
            {pieData.length === 0 ? (
              <p className="text-sm text-center text-gray-400 py-16">No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Download cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { id: "bnr",       title: "BNR Compliance",       desc: "BNR-format Excel for submission",       icon: <FileCheck className="w-5 h-5" />,  badge: "Excel",     variant: "info"    as const },
          { id: "portfolio", title: "Portfolio Report",      desc: "Full loan portfolio and aging",          icon: <BarChart3 className="w-5 h-5" />,  badge: "Real-time", variant: "success" as const },
          { id: "crb",       title: "CRB Report",           desc: "Credit reference bureau export",         icon: <Building2 className="w-5 h-5" />,  badge: "CSV",       variant: "neutral" as const },
          { id: "income",    title: "Income & Expense",      desc: "Revenue vs expenditure statement",       icon: <TrendingUp className="w-5 h-5" />, badge: "Period",    variant: "warning" as const },
          { id: "pl",        title: "P&L Statement",         desc: "Formal profit & loss with breakdowns",  icon: <FileText className="w-5 h-5" />,   badge: "PDF",       variant: "success" as const },
        ].map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{r.icon}</div>
              <Badge variant={r.variant}>{r.badge}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{r.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{r.desc}</p>
            <button
              disabled={
                (r.id === "income" && dlIncome) || (r.id === "portfolio" && dlPortfolio) ||
                (r.id === "crb" && dlCRB) || (r.id === "pl" && dlPL)
              }
              onClick={() => {
                if (r.id === "bnr")       onBNR();
                if (r.id === "income")    handleIncomeReport();
                if (r.id === "portfolio") handlePortfolioReport();
                if (r.id === "crb")       handleCRBReport();
                if (r.id === "pl") {
                  setDlPL(true);
                  downloadPLStatement(data.income, data.expenses, data.period);
                  setTimeout(() => setDlPL(false), 1500);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              <Download className="w-3 h-3" />
              {r.id === "bnr"       ? "Download" :
               r.id === "income"    ? (dlIncome     ? "Loading…" : "Download") :
               r.id === "portfolio" ? (dlPortfolio  ? "Loading…" : "Download") :
               r.id === "crb"       ? (dlCRB        ? "Loading…" : "Download") :
               r.id === "pl"        ? (dlPL         ? "Opening…" : "Download") :
               "Coming soon"}
            </button>
          </div>
        ))}
      </div>

      {/* BNR classification table */}
      <Card>
        <CardHeader className="items-center justify-between">
          <CardTitle>BNR Loan Classification Breakdown</CardTitle>
          <Badge variant={data.portfolio.nplRate <= 5 ? "success" : "danger"}>
            {data.portfolio.nplRate <= 5 ? "Compliant" : "NPL Breach"}
          </Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {["Class", "Loans", "Outstanding (RWF)", "Provision Rate", "Provision Required", "Status"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(["Normal","Watch","Substandard","Doubtful","Loss"] as const).map((cls) => {
                const row = data.portfolio.byClass.find((b) => b.class === cls);
                const count  = row?.count  ?? 0;
                const amount = row?.amount ?? 0;
                const rates: Record<string, number> = { Normal: 0, Watch: 1, Substandard: 20, Doubtful: 50, Loss: 100 };
                const rate = rates[cls];
                const provision = Math.round(amount * rate / 100);
                const isNpl = ["Substandard","Doubtful","Loss"].includes(cls);
                return (
                  <tr key={cls} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 text-xs">
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold", CLASS_BADGE[cls])}>{cls}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{count}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{count > 0 ? fmt(amount) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rate}%</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{count > 0 ? fmt(provision) : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isNpl && count > 0 ? "danger" : "success"}>{isNpl && count > 0 ? "NPL" : "OK"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{data.portfolio.activeLoans}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmt(data.portfolio.totalOutstanding)}</td>
                <td className="px-4 py-3 text-gray-500">—</td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmt(data.portfolio.totalProvision)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">NPL: {pct(data.portfolio.nplRate)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Income & Expenses Tab ─────────────────────────────────────────────────────

function IncomeTab({ data }: { data: SummaryData }) {
  const { income, expenses } = data;
  const netProfit = income.totalIncome - expenses.total;
  const [downloading, setDownloading] = useState(false);
  const [dlPL, setDlPL] = useState(false);

  const handleDownloadPL = () => {
    setDlPL(true);
    downloadPLStatement(income, expenses, data.period);
    setTimeout(() => setDlPL(false), 1500);
  };

  const handleDownloadExpenses = async () => {
    setDownloading(true);
    try {
      const res  = await apiFetch("/api/v1/expenses");
      const json = await res.json();
      const list: any[] = json.data ?? json ?? [];

      const today       = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      const companyName = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company" : "Company";
      const totalPaid   = list.filter((e) => e.isPaid).reduce((s: number, e: any) => s + e.amount, 0);
      const totalUnpaid = list.filter((e) => !e.isPaid).reduce((s: number, e: any) => s + e.amount, 0);
      const totalAll    = list.reduce((s: number, e: any) => s + e.amount, 0);

      const rows = list.map((e: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${new Date(e.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${e.category}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${e.description}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#dc2626">RWF ${e.amount.toLocaleString()}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">
            <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;${e.isPaid ? "background:#dcfce7;color:#166534" : "background:#fef3c7;color:#92400e"}">${e.isPaid ? "Paid" : "Unpaid"}</span>
          </td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Expense Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff}
  .page{max-width:860px;margin:0 auto;padding:36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #166534}
  .co-name{font-size:20px;font-weight:700;color:#166534}.co-sub{font-size:11px;color:#888;margin-top:2px}
  .title h1{font-size:22px;font-weight:800;color:#166534;text-align:right}.title p{font-size:10px;color:#666;text-align:right;line-height:1.6}
  .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:22px}
  .box{background:#f8fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .box h3{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:4px}
  .box p{font-size:16px;font-weight:800;color:#111}
  table{width:100%;border-collapse:collapse}
  thead th{background:#052e16;color:#fff;text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
  tfoot td{background:#f0fdf4;font-weight:700;padding:8px 12px;border-top:2px solid #16a34a;font-size:11px}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:20px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div><div class="co-name">${companyName}</div><div class="co-sub">NDFSP</div></div>
    <div class="title"><h1>EXPENSE REPORT</h1><p>Generated: ${today}<br/>${list.length} records</p></div>
  </div>
  <div class="summary">
    <div class="box"><h3>Total Expenses</h3><p>RWF ${totalAll.toLocaleString()}</p></div>
    <div class="box"><h3>Total Paid</h3><p style="color:#166534">RWF ${totalPaid.toLocaleString()}</p></div>
    <div class="box"><h3>Total Unpaid</h3><p style="color:#b45309">RWF ${totalUnpaid.toLocaleString()}</p></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3"><strong>TOTALS</strong></td>
      <td><strong>RWF ${totalAll.toLocaleString()}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[8,8,8,8],filename:'Expense-Report-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

      const w = window.open("", "_blank", "width=960,height=750");
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* P&L download banner */}
      <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-3.5">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">Profit & Loss Statement</p>
            <p className="text-xs text-green-700/70 dark:text-green-400/70">Download a formal P&L with income breakdown, expense categories, and net result</p>
          </div>
        </div>
        <button
          onClick={handleDownloadPL}
          disabled={dlPL}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-green-700 hover:bg-green-800 text-white transition-colors disabled:opacity-60 shrink-0"
        >
          {dlPL ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {dlPL ? "Opening…" : "Download P&L"}
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(income.totalIncome)}</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">Total Income</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Collected: {fmt(income.totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(expenses.total)}</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">Total Expenses</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Including provisioning</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", netProfit >= 0 ? "border-l-green-500" : "border-l-red-500")}>
          <CardContent className="pt-4 pb-4">
            <p className={cn("text-xl font-bold", netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
              {fmt(Math.abs(netProfit))}
            </p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">
              Net {netProfit >= 0 ? "Profit" : "Loss"}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Income minus expenses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income breakdown */}
        <Card>
          <CardHeader><CardTitle>Income Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Revenue Sources</div>
              {[
                { label: "Interest Income",  value: income.interestIncome  },
                { label: "Penalty Income",   value: income.penaltyIncome   },
                { label: "Processing Fees",  value: income.feeIncome       },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2.5 font-bold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total Income</span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{fmt(income.totalIncome)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-gray-500">Principal Collected</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{fmt(income.principalCollected)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-gray-500">Total Cash Collected</span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{fmt(income.totalCollected)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Expenses Breakdown</CardTitle>
              <button
                onClick={handleDownloadExpenses}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-600 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {downloading ? "Loading…" : "Download Report"}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Expense Categories</div>
              {expenses.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No expenses recorded in this period.</p>
              ) : expenses.byCategory.map((item) => (
                <div key={item.category} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">({fmt(item.amount)})</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2.5 font-bold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total Expenses</span>
                <span className="text-sm text-red-600 dark:text-red-400">({fmt(expenses.total)})</span>
              </div>
              <div className="flex justify-between items-center py-3 mt-1 border-t-2 border-gray-200 dark:border-gray-700">
                <span className="font-bold text-gray-900 dark:text-gray-100">Net {netProfit >= 0 ? "Profit" : "Loss"}</span>
                <span className={cn("font-bold text-lg", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600")}>
                  {netProfit < 0 ? "-" : ""}{fmt(Math.abs(netProfit))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ── Payment Schedule Tab ──────────────────────────────────────────────────────

function ScheduleTab({ from, to }: { from: string; to: string }) {
  const [data,    setData]    = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, st: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to, status: st, search: q });
      const res = await apiFetch(`/api/v1/reports/schedule?${params}`);
      if (!res.ok) { setError("Failed to load schedule."); return; }
      const json = await res.json();
      setData(json.data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search, status), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [load, search, status]);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Customer","Loan ID","Installment #","Due Date","Principal Due","Interest Due","Total Due","Amount Paid","Balance Due","Status","Loan Status"];
    const rows = data.installments.map((i) => [
      i.loan.customer.names,
      i.loanId.slice(0,12).toUpperCase(),
      i.installmentNo,
      i.dueDate.split("T")[0],
      i.principalDue,
      i.interestDue,
      i.totalDue,
      i.amountPaid,
      i.totalDue - i.amountPaid,
      i.status,
      i.loan.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `PaymentSchedule_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
        <button
          onClick={exportCSV}
          disabled={!data || data.installments.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Installments", value: data.summary.total,           color: "text-gray-900 dark:text-gray-100",      border: "border-l-gray-400" },
            { label: "Total Due",          value: fmt(data.summary.totalDue),   color: "text-blue-600 dark:text-blue-400",       border: "border-l-blue-500" },
            { label: "Total Paid",         value: fmt(data.summary.totalPaid),  color: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
            { label: "Overdue",            value: data.summary.overdueCount,    color: "text-red-600 dark:text-red-400",         border: "border-l-red-500" },
          ].map((s) => (
            <Card key={s.label} className={cn("border-l-4", s.border)}>
              <CardContent className="pt-3 pb-3">
                <p className={cn("text-base font-bold", s.color)}>{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Loan Payment Schedule — {data ? data.summary.total : "…"} installments
            {from && to && <span className="text-xs font-normal text-gray-400 ml-2">({from} → {to})</span>}
          </CardTitle>
        </CardHeader>
        {loading ? (
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </CardContent>
        ) : error ? (
          <CardContent className="py-10 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  {["Customer","Loan","#","Due Date","Principal","Interest","Total Due","Paid","Balance Due","Status"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.installments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                      No installments found for this period / filter.
                    </td>
                  </tr>
                ) : data?.installments.map((row) => {
                  const balanceDue = row.totalDue - row.amountPaid;
                  return (
                    <tr key={row.id}
                      className={cn(
                        "text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                        row.status === "paid"    ? "bg-emerald-50/40 dark:bg-emerald-900/5" :
                        row.status === "overdue" ? "bg-red-50/40 dark:bg-red-900/5" : ""
                      )}>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[140px] truncate">
                        {row.loan.customer.names}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        {row.loanId.slice(0, 10).toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{row.installmentNo}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                      <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">{fmt(row.principalDue)}</td>
                      <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400">{fmt(row.interestDue)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">{fmt(row.totalDue)}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {row.amountPaid > 0 ? fmt(row.amountPaid) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {balanceDue > 0
                          ? <span className={cn("font-semibold", row.status === "overdue" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100")}>{fmt(balanceDue)}</span>
                          : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Paid</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", INST_STATUS_COLOR[row.status])}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ── Trial Balance Tab ─────────────────────────────────────────────────────────

interface TBRow {
  account:        string;
  initialBalance: number;
  debit:          number;
  credit:         number;
  balance:        number;
}
interface TBData {
  rows:   TBRow[];
  totals: TBRow;
  period: { from: string; to: string };
}

function fmtTB(n: number) {
  return n === 0 ? "—" : Math.round(n).toLocaleString();
}

function downloadTrialBalance(data: TBData) {
  const companyName = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company"; } catch { return "Company"; } })()
    : "Company";

  const today     = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const fromLabel = new Date(data.period.from).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const toLabel   = new Date(data.period.to).toLocaleDateString("en-GB",   { day: "2-digit", month: "long", year: "numeric" });

  const bodyRows = data.rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f5f5f5"}">
      <td style="padding:7px 10px;border-bottom:1px solid #ddd">${r.account}</td>
      <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #ddd">${r.initialBalance === 0 ? "—" : Math.round(r.initialBalance).toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #ddd">${r.debit === 0 ? "—" : Math.round(r.debit).toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #ddd">${r.credit === 0 ? "—" : Math.round(r.credit).toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #ddd;font-weight:600">${Math.round(r.balance).toLocaleString()}</td>
    </tr>`).join("");

  const t = data.totals;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Trial Balance</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
  .page{max-width:820px;margin:0 auto;padding:36px}
  .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #222}
  .co-name{font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
  .title{font-size:13px;font-weight:700;text-transform:uppercase;margin-top:4px;letter-spacing:0.5px}
  .period{font-size:10px;color:#555;margin-top:3px}
  table{width:100%;border-collapse:collapse}
  thead th{background:#d9d9d9;border:1px solid #bbb;padding:7px 10px;font-size:10px;font-weight:700;text-align:right}
  thead th:first-child{text-align:left}
  .total-row td{background:#d9d9d9;border:1px solid #bbb;padding:8px 10px;font-size:11px;font-weight:800;text-align:right}
  .total-row td:first-child{text-align:left}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:9}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:20px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div class="co-name">${companyName}</div>
    <div class="title">Trial Balance</div>
    <div class="period">Period: ${fromLabel} — ${toLabel} &nbsp;|&nbsp; Generated: ${today}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:36%">Accounts</th>
        <th>Initial balance</th>
        <th>Debit</th>
        <th>Credit</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td>Total</td>
        <td>${Math.round(t.initialBalance).toLocaleString()}</td>
        <td>${Math.round(t.debit).toLocaleString()}</td>
        <td>${Math.round(t.credit).toLocaleString()}</td>
        <td>${Math.round(t.balance).toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[12,12,12,12],
      filename:'Trial-Balance-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

  const w = window.open("", "_blank", "width=880,height=750");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function TrialBalanceTab({ from, to }: { from: string; to: string }) {
  const [data,    setData]    = useState<TBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await apiFetch(`/api/v1/reports/trial-balance?${params}`);
      if (!res.ok) { setError("Failed to load trial balance."); return; }
      const json = await res.json();
      setData(json.data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header banner */}
      <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">Trial Balance</p>
            <p className="text-xs text-green-700/70 dark:text-green-400/70">
              All account balances — initial balance, debit, credit, and closing balance
            </p>
          </div>
        </div>
        <button
          onClick={() => data && downloadTrialBalance(data)}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-green-700 hover:bg-green-800 text-white transition-colors disabled:opacity-60 shrink-0"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </div>
      ) : data && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-[36%]">Accounts</th>
                  <th className="px-4 py-3 text-right">Initial Balance</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 text-xs">
                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium">{r.account}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">
                      {r.initialBalance === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : fmtTB(r.initialBalance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {r.debit === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : fmtTB(r.debit)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {r.credit === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : fmtTB(r.credit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {fmtTB(Math.abs(r.balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-900 dark:text-gray-100">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{fmtTB(data.totals.initialBalance)}</td>
                  <td className="px-4 py-3 text-right">{fmtTB(data.totals.debit)}</td>
                  <td className="px-4 py-3 text-right">{fmtTB(data.totals.credit)}</td>
                  <td className="px-4 py-3 text-right">{fmtTB(Math.abs(data.totals.balance))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  );
}

// ── Balance Sheet Tab ─────────────────────────────────────────────────────────

interface BSData {
  asOf:   string;
  period: { from: string; to: string };
  assets: {
    current: {
      cashAndBank: number; loanPortfolioGross: number; provision: number;
      loanPortfolioNet: number; interestReceivable: number; total: number;
    };
    nonCurrent: {
      fixedAssetsGross: number; accumulatedDeprec: number; fixedAssetsNet: number;
      items: { name: string; category: string; value: number }[];
      total: number;
    };
    total: number;
  };
  liabilities: {
    current: {
      accountsPayable: number;
      loansPayable: { name: string; amount: number; dueDate: string | null }[];
      totalLoansPayable: number; total: number;
    };
    total: number;
  };
  equity: { retainedEarnings: number; netProfitLoss: number; total: number };
  balanced: boolean;
}

function downloadBalanceSheet(data: BSData) {
  const companyName = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company"; } catch { return "Company"; } })()
    : "Company";

  const today  = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const asOfLabel = new Date(data.asOf).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const n = (v: number) => Math.round(v).toLocaleString();
  const isProfit = data.equity.netProfitLoss >= 0;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Balance Sheet</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
  .page{max-width:760px;margin:0 auto;padding:36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #166534}
  .co-name{font-size:18px;font-weight:800;color:#166534}
  .co-sub{font-size:10px;color:#888;margin-top:3px}
  .title h1{font-size:16px;font-weight:800;color:#166534;text-align:right;text-transform:uppercase;letter-spacing:1px}
  .title p{font-size:10px;color:#666;text-align:right;margin-top:4px;line-height:1.6}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .section-header{background:#052e16;color:#fff;padding:7px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:0}
  .sub-header{background:#e7f3ec;color:#166534;padding:5px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
  .row{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #f0f0f0}
  .row.indent{padding-left:24px}
  .row label{color:#374151}
  .row span{font-weight:600;color:#111}
  .sub-total{display:flex;justify-content:space-between;padding:6px 12px;background:#f0fdf4;font-weight:700;font-size:11px;border-top:1px solid #16a34a}
  .sub-total span{color:#166534}
  .grand-total{display:flex;justify-content:space-between;padding:10px 12px;background:#052e16;color:#fff;font-size:13px;font-weight:800;margin-top:4px}
  .note{font-size:10px;color:#111;padding:7px 12px;background:#fefce8;border:1px solid #fde68a;margin-top:6px}
  .toolbar{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:9}
  .btn-dl{background:#166534;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  .btn-pr{background:#fff;color:#166534;border:2px solid #166534;padding:7px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
  @media print{.toolbar{display:none}.page{padding:20px}}
</style></head>
<body>
<div class="toolbar">
  <button class="btn-pr" onclick="window.print()">🖨 Print</button>
  <button class="btn-dl" id="dlBtn" onclick="downloadPDF()">⬇ Download PDF</button>
</div>
<div class="page" id="content">
  <div class="header">
    <div><div class="co-name">${companyName}</div><div class="co-sub">NDFSP Microfinance</div></div>
    <div class="title"><h1>Balance Sheet</h1><p>As at: ${asOfLabel}<br/>Generated: ${today}</p></div>
  </div>

  <div class="grid">
    <!-- LEFT: ASSETS -->
    <div>
      <div class="section-header">Assets</div>

      <div class="sub-header">Current Assets</div>
      <div class="row"><label>Cash &amp; Bank Balance</label><span>RWF ${n(data.assets.current.cashAndBank)}</span></div>
      <div class="row"><label>Loan Portfolio (Gross)</label><span>RWF ${n(data.assets.current.loanPortfolioGross)}</span></div>
      <div class="row indent"><label>Less: Loan Loss Provision</label><span style="color:#dc2626">(RWF ${n(data.assets.current.provision)})</span></div>
      <div class="row"><label>Loan Portfolio (Net)</label><span>RWF ${n(data.assets.current.loanPortfolioNet)}</span></div>
      <div class="row"><label>Interest Receivable</label><span>RWF ${n(data.assets.current.interestReceivable)}</span></div>
      <div class="sub-total"><label>Total Current Assets</label><span>RWF ${n(data.assets.current.total)}</span></div>

      <div class="sub-header" style="margin-top:10px">Non-Current Assets</div>
      <div class="row"><label>Fixed Assets (Gross)</label><span>RWF ${n(data.assets.nonCurrent.fixedAssetsGross)}</span></div>
      <div class="row indent"><label>Less: Accumulated Depreciation</label><span style="color:#dc2626">(RWF ${n(data.assets.nonCurrent.accumulatedDeprec)})</span></div>
      <div class="row"><label>Fixed Assets (Net)</label><span>RWF ${n(data.assets.nonCurrent.fixedAssetsNet)}</span></div>
      <div class="sub-total"><label>Total Non-Current Assets</label><span>RWF ${n(data.assets.nonCurrent.total)}</span></div>

      <div class="grand-total"><span>TOTAL ASSETS</span><span>RWF ${n(data.assets.total)}</span></div>
    </div>

    <!-- RIGHT: LIABILITIES + EQUITY -->
    <div>
      <div class="section-header">Liabilities &amp; Equity</div>

      <div class="sub-header">Current Liabilities</div>
      ${data.assets.current.cashAndBank < 0 ? `<div class="row"><label>Bank Overdraft</label><span style="color:#dc2626">RWF ${n(Math.abs(data.assets.current.cashAndBank))}</span></div>` : ""}
      <div class="row"><label>Accounts Payable (Unpaid Expenses)</label><span>RWF ${n(data.liabilities.current.accountsPayable)}</span></div>
      ${data.liabilities.current.loansPayable.map((l) =>
        `<div class="row"><label>Loan Payable — ${l.name}</label><span>RWF ${n(l.amount)}</span></div>`
      ).join("")}
      <div class="sub-total"><label>Total Liabilities</label><span>RWF ${n(data.liabilities.total)}</span></div>

      <div class="sub-header" style="margin-top:10px">Equity</div>
      <div class="row"><label>Retained Earnings / Capital</label><span>RWF ${n(data.equity.retainedEarnings)}</span></div>
      <div class="row"><label>${isProfit ? "Net Profit" : "Net Loss"} (Period)</label>
        <span style="color:${isProfit ? "#166534" : "#dc2626"}">${isProfit ? "" : "("}RWF ${n(Math.abs(data.equity.netProfitLoss))}${isProfit ? "" : ")"}</span>
      </div>
      <div class="sub-total"><label>Total Equity</label><span>RWF ${n(data.equity.total)}</span></div>

      <div class="grand-total"><span>TOTAL LIABILITIES + EQUITY</span><span>RWF ${n(data.liabilities.total + data.equity.total)}</span></div>

      ${data.balanced
        ? `<div class="note" style="background:#f0fdf4;border-color:#16a34a;color:#166534;margin-top:8px">✓ Balance sheet is balanced — Assets = Liabilities + Equity</div>`
        : `<div class="note" style="background:#fef2f2;border-color:#fca5a5;color:#dc2626;margin-top:8px">⚠ Balance sheet is out of balance. Review equity / retained earnings.</div>`
      }
    </div>
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  function downloadPDF(){
    var btn=document.getElementById('dlBtn');
    btn.disabled=true;btn.textContent='Generating…';
    html2pdf().set({
      margin:[12,12,12,12],
      filename:'Balance-Sheet-${new Date().toISOString().slice(0,10)}.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.getElementById('content')).save().then(function(){
      btn.disabled=false;btn.textContent='⬇ Download PDF';
    });
  }
  window.onload=()=>window.print();
</script>
</body></html>`;

  const w = window.open("", "_blank", "width=880,height=750");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function BalanceSheetTab({ from, to }: { from: string; to: string }) {
  const [data,    setData]    = useState<BSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await apiFetch(`/api/v1/reports/balance-sheet?${params}`);
      if (!res.ok) { setError("Failed to load balance sheet."); return; }
      const json = await res.json();
      setData(json.data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const isProfit = (data?.equity.netProfitLoss ?? 0) >= 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-3.5">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-200">Balance Sheet</p>
            <p className="text-xs text-green-700/70 dark:text-green-400/70">
              Statement of financial position — Assets = Liabilities + Equity
            </p>
          </div>
        </div>
        <button
          onClick={() => data && downloadBalanceSheet(data)}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-green-700 hover:bg-green-800 text-white transition-colors disabled:opacity-60 shrink-0"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </div>
      ) : data && (
        <>
          {/* Balance check */}
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium",
            data.balanced
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
          )}>
            {data.balanced ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {data.balanced
              ? "Balance sheet is balanced — Total Assets equal Total Liabilities + Equity."
              : "Balance sheet is out of balance. Retained earnings may need adjustment."}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── ASSETS ── */}
            <div className="space-y-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
              <div className="bg-gray-800 dark:bg-gray-950 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                Assets
              </div>

              {/* Current assets */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Current Assets
              </div>
              {[
                { label: "Cash & Bank Balance",      value: data.assets.current.cashAndBank,       color: "text-gray-900 dark:text-gray-100" },
                { label: "Loan Portfolio (Gross)",   value: data.assets.current.loanPortfolioGross, color: "text-gray-900 dark:text-gray-100" },
                { label: "Less: Loan Loss Provision",value: -data.assets.current.provision,        color: "text-red-600 dark:text-red-400", indent: true },
                { label: "Loan Portfolio (Net)",     value: data.assets.current.loanPortfolioNet,  color: "font-semibold text-gray-900 dark:text-gray-100" },
                { label: "Interest Receivable",      value: data.assets.current.interestReceivable, color: "text-gray-900 dark:text-gray-100" },
              ].map((r) => (
                <div key={r.label} className={cn("flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs", r.indent && "pl-8")}>
                  <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                  <span className={cn("font-medium", r.color)}>
                    {r.value < 0 ? `(${fmt(Math.abs(r.value))})` : fmt(Math.abs(r.value))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-bold border-b border-emerald-200 dark:border-emerald-800">
                <span className="text-gray-800 dark:text-gray-200">Total Current Assets</span>
                <span className="text-emerald-700 dark:text-emerald-400">{fmt(data.assets.current.total)}</span>
              </div>

              {/* Non-current assets */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Non-Current Assets
              </div>
              {[
                { label: "Fixed Assets (Gross)",        value: data.assets.nonCurrent.fixedAssetsGross,  color: "text-gray-900 dark:text-gray-100" },
                { label: "Less: Accumulated Depreciation", value: -data.assets.nonCurrent.accumulatedDeprec, color: "text-red-600 dark:text-red-400", indent: true },
                { label: "Fixed Assets (Net)",          value: data.assets.nonCurrent.fixedAssetsNet,   color: "font-semibold text-gray-900 dark:text-gray-100" },
              ].map((r) => (
                <div key={r.label} className={cn("flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs", r.indent && "pl-8")}>
                  <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                  <span className={cn("font-medium", r.color)}>
                    {r.value < 0 ? `(${fmt(Math.abs(r.value))})` : fmt(Math.abs(r.value))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-bold border-b border-emerald-200 dark:border-emerald-800">
                <span className="text-gray-800 dark:text-gray-200">Total Non-Current Assets</span>
                <span className="text-emerald-700 dark:text-emerald-400">{fmt(data.assets.nonCurrent.total)}</span>
              </div>

              {/* Grand total */}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-800 dark:bg-gray-950 text-white text-sm font-bold">
                <span>TOTAL ASSETS</span>
                <span>{fmt(data.assets.total)}</span>
              </div>
            </div>

            {/* ── LIABILITIES + EQUITY ── */}
            <div className="space-y-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
              <div className="bg-gray-800 dark:bg-gray-950 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                Liabilities &amp; Equity
              </div>

              {/* Liabilities */}
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                Liabilities
              </div>
              {data.assets.current.cashAndBank < 0 && (
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Bank Overdraft</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{fmt(Math.abs(data.assets.current.cashAndBank))}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-600 dark:text-gray-400">Accounts Payable (Unpaid Expenses)</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(data.liabilities.current.accountsPayable)}</span>
              </div>
              {data.liabilities.current.loansPayable.map((l) => (
                <div key={l.name} className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Loan Payable — {l.name}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-xs font-bold border-b border-red-200 dark:border-red-800">
                <span className="text-gray-800 dark:text-gray-200">Total Liabilities</span>
                <span className="text-red-700 dark:text-red-400">{fmt(data.liabilities.total)}</span>
              </div>

              {/* Equity */}
              <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Equity
              </div>
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-600 dark:text-gray-400">Retained Earnings / Capital</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(data.equity.retainedEarnings)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {isProfit ? "Net Profit" : "Net Loss"} (Period)
                </span>
                <span className={cn("font-medium", isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {!isProfit && "("}
                  {fmt(Math.abs(data.equity.netProfitLoss))}
                  {!isProfit && ")"}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-xs font-bold border-b border-blue-200 dark:border-blue-800">
                <span className="text-gray-800 dark:text-gray-200">Total Equity</span>
                <span className="text-blue-700 dark:text-blue-400">{fmt(data.equity.total)}</span>
              </div>

              {/* Grand total */}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-800 dark:bg-gray-950 text-white text-sm font-bold">
                <span>TOTAL LIABILITIES + EQUITY</span>
                <span>{fmt(data.liabilities.total + data.equity.total)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Income & Expenses", "Payment Schedule", "Trial Balance", "Balance Sheet"] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const defaultPeriod = getPreset("This Year");
  const [from, setFrom] = useState(defaultPeriod.from);
  const [to,   setTo]   = useState(defaultPeriod.to);
  const [tab,  setTab]  = useState<Tab>("Overview");

  const [summary, setSummary]   = useState<SummaryData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [showBNR, setShowBNR]   = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await apiFetch(`/api/v1/reports/summary?${params}`);
      if (!res.ok) { setError("Failed to load report data."); return; }
      const json = await res.json();
      setSummary(json.data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  return (
    <div className="space-y-6">
      <AnimatePresence>{showBNR && <BNRModal onClose={() => setShowBNR(false)} />}</AnimatePresence>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reports & Compliance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial reports, compliance, and analytics</p>
        </div>
        <button
          onClick={loadSummary}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
        <DateRangeFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
              tab === t
                ? "border-green-600 text-green-600 dark:text-green-400 dark:border-green-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && tab !== "Payment Schedule" && tab !== "Trial Balance" && tab !== "Balance Sheet" ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      ) : error && tab !== "Payment Schedule" && tab !== "Trial Balance" && tab !== "Balance Sheet" ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <Button variant="outline" onClick={loadSummary}>Retry</Button>
        </div>
      ) : summary && tab === "Overview" ? (
        <OverviewTab data={summary} dark={dark} onBNR={() => setShowBNR(true)} />
      ) : summary && tab === "Income & Expenses" ? (
        <IncomeTab data={summary} />
      ) : tab === "Payment Schedule" ? (
        <ScheduleTab from={from} to={to} />
      ) : tab === "Trial Balance" ? (
        <TrialBalanceTab from={from} to={to} />
      ) : tab === "Balance Sheet" ? (
        <BalanceSheetTab from={from} to={to} />
      ) : null}
    </div>
  );
}
