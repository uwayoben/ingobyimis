"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download, BarChart3, FileCheck, TrendingUp, Building2, X, Loader2,
  AlertTriangle, CheckCircle2, Search, RefreshCw, Calendar, FileText, Printer,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: "bnr",       title: "BNR Compliance",    desc: "BNR-format Excel for submission",     icon: <FileCheck className="w-5 h-5" />,  badge: "Excel",     variant: "info"    as const },
          { id: "portfolio", title: "Portfolio Report",   desc: "Full loan portfolio and aging",        icon: <BarChart3 className="w-5 h-5" />,  badge: "Real-time", variant: "success" as const },
          { id: "crb",       title: "CRB Report",        desc: "Credit reference bureau export",       icon: <Building2 className="w-5 h-5" />,  badge: "Monthly",   variant: "neutral" as const },
          { id: "income",    title: "Income & Expense",   desc: "Revenue vs expenditure statement",     icon: <TrendingUp className="w-5 h-5" />, badge: "Period",    variant: "warning" as const },
        ].map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{r.icon}</div>
              <Badge variant={r.variant}>{r.badge}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{r.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{r.desc}</p>
            <button
              onClick={() => r.id === "bnr" && onBNR()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Download className="w-3 h-3" />
              {r.id === "bnr" ? "Download" : "Coming soon"}
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
                const rates: Record<string, number> = { Normal: 1, Watch: 3, Substandard: 20, Doubtful: 50, Loss: 100 };
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
          <CardHeader><CardTitle>Expenses Breakdown</CardTitle></CardHeader>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Income & Expenses", "Payment Schedule"] as const;
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
      {loading && tab !== "Payment Schedule" ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      ) : error && tab !== "Payment Schedule" ? (
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
      ) : null}
    </div>
  );
}
