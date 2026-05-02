"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, FileText, Loader2, AlertTriangle, CheckCircle2, Clock, Banknote, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/utils";
import type { Loan, LoanStatus } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import { useRole } from "@/components/RoleContext";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

// True total owed = remaining repayable + accrued penalty
function trueOutstanding(loan: Loan): number {
  return Math.max(0, loan.totalRepayable - loan.amountRepaidPrincipal - loan.amountRepaidInterest) + loan.penaltyAmount;
}

function freqLabel(days: number) {
  if (days === 1)  return "Daily";
  if (days === 7)  return "Weekly";
  if (days === 14) return "Bi-weekly";
  if (days === 30) return "Monthly";
  return `${days}d`;
}

const STATUS_TABS: { label: string; value: LoanStatus | "all" }[] = [
  { label: "All",        value: "all" },
  { label: "Active",     value: "active" },
  { label: "Pending",    value: "pending" },
  { label: "Approved",   value: "approved" },
  { label: "Disbursed",  value: "disbursed" },
  { label: "Overdue",    value: "overdue" },
  { label: "Completed",  value: "completed" },
  { label: "Written Off",value: "written_off" },
];

const STATUS_DOT: Record<string, string> = {
  active:      "bg-emerald-500",
  pending:     "bg-amber-500",
  approved:    "bg-blue-500",
  disbursed:   "bg-indigo-500",
  overdue:     "bg-red-500",
  completed:   "bg-gray-400",
  rejected:    "bg-red-400",
  written_off: "bg-gray-500",
};

const CLASS_BADGE: Record<string, string> = {
  Normal:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Watch:       "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Substandard: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Doubtful:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Loss:        "bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300",
};

const CLASS_OPTIONS = ["All Classes", "Normal", "Watch", "Substandard", "Doubtful", "Loss"] as const;

export default function LoansPage() {
  const { role } = useRole();
  const canCreateLoan = ["managing_director", "loan_officer", "super_admin"].includes(role);
  const [loans, setLoans]       = useState<Loan[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState<LoanStatus | "all">("all");
  const [classFilter, setClassFilter] = useState("All Classes");

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (tab !== "all") params.set("status", tab);
      const res = await apiFetch(`/api/v1/loans?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setLoans(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, tab]);

  useEffect(() => {
    const t = setTimeout(fetchLoans, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLoans]);

  const displayed = classFilter === "All Classes"
    ? loans
    : loans.filter((l) => l.loanClass === classFilter);

  // Derived summary from loaded data
  const activeLoans    = loans.filter((l) => l.status === "active");
  const overdueLoans   = loans.filter((l) => l.status === "overdue");
  const pendingLoans   = loans.filter((l) => l.status === "pending");
  const totalPortfolio = loans.reduce((s, l) => s + trueOutstanding(l), 0);
  const totalPenalty   = loans.reduce((s, l) => s + l.penaltyAmount, 0);

  const summaryCards = [
    { label: "Active Portfolio", value: `RWF ${(activeLoans.reduce((s,l)=>s+trueOutstanding(l),0)/1_000_000).toFixed(1)}M`, sub: `${activeLoans.length} loans (incl. interest)`, icon: <Banknote className="w-5 h-5" />, border: "border-l-emerald-500", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: "Overdue Loans",    value: overdueLoans.length.toString(),  sub: `RWF ${(overdueLoans.reduce((s,l)=>s+trueOutstanding(l),0)/1_000).toFixed(0)}K outstanding`, icon: <AlertTriangle className="w-5 h-5" />, border: "border-l-red-500",     iconBg: "bg-red-500/15 text-red-600 dark:text-red-400" },
    { label: "Pending Approval", value: pendingLoans.length.toString(),  sub: "Awaiting review", icon: <Clock className="w-5 h-5" />,          border: "border-l-amber-500",   iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    { label: "Accrued Penalties",value: formatCurrency(totalPenalty),    sub: "Across all loans", icon: <AlertTriangle className="w-5 h-5" />, border: totalPenalty > 0 ? "border-l-rose-500" : "border-l-gray-300", iconBg: totalPenalty > 0 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-gray-500/15 text-gray-400" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Banner ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-green-300 text-sm font-medium mb-1">Loan Portfolio</p>
            <h2 className="text-xl sm:text-2xl font-bold">Loans</h2>
            <p className="text-green-100/80 text-sm mt-1">{total} total loan record{total !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{activeLoans.length}</p>
              <p className="text-xs text-green-100/70">Active</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold text-amber-300">{pendingLoans.length}</p>
              <p className="text-xs text-green-100/70">Pending</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold text-red-300">{overdueLoans.length}</p>
              <p className="text-xs text-green-100/70">Overdue</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-green-100/70 text-sm">
            Total outstanding: <span className="font-semibold text-white">RWF {(totalPortfolio / 1_000_000).toFixed(1)}M</span>
            {totalPenalty > 0 && <span className="text-red-300 ml-2">· {formatCurrency(totalPenalty)} in penalties</span>}
          </p>
          {canCreateLoan && (
            <Link
              href="/loans/new"
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Loan
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${card.border} p-4 hover:shadow-md transition-all`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Status Tabs + Class Filter ─────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto shrink-0 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                tab === t.value
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t.value !== "all" && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.value] ?? "bg-gray-400"}`} />
              )}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          {/* Class Filter */}
          <div className="relative shrink-0">
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
            >
              {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer or loan ID…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {displayed.length} loan{displayed.length !== 1 ? "s" : ""}
            {tab !== "all" && <span className="text-gray-400 font-normal"> · {STATUS_LABELS[tab as LoanStatus]}</span>}
            {classFilter !== "All Classes" && <span className="text-gray-400 font-normal"> · {classFilter}</span>}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No loans found"
            description="Try a different filter or create a new loan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {[
                    "Loan / Customer",
                    "Class · Status",
                    "Principal",
                    "Total Paid",
                    "Penalty",
                    "Outstanding",
                    "Due Date",
                    "Rate / Freq",
                  ].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                <AnimatePresence>
                  {displayed.map((loan, i) => {
                    const totalPaid = loan.amountRepaidPrincipal + loan.amountRepaidInterest;
                    const totalOutstanding = trueOutstanding(loan);
                    const isPastDue = new Date(loan.agreedMaturityDate) < new Date() && !["completed", "written_off", "rejected"].includes(loan.status);

                    return (
                      <motion.tr
                        key={loan.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.025 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        {/* Loan / Customer */}
                        <td className="pl-6 pr-4 py-3.5">
                          <Link href={`/loans/${loan.id}`} className="font-mono text-xs font-bold text-green-600 dark:text-green-400 hover:underline block">
                            {loan.id.slice(0, 12).toUpperCase()}
                          </Link>
                          <Link href={`/customers/${loan.customerId}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors truncate block max-w-[140px]">
                            {loan.customerName}
                          </Link>
                        </td>

                        {/* Class · Status */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${CLASS_BADGE[loan.loanClass] ?? "bg-gray-100 text-gray-600"}`}>
                              {loan.loanClass !== "Normal"
                                ? <AlertTriangle className="w-2.5 h-2.5" />
                                : <CheckCircle2 className="w-2.5 h-2.5" />}
                              {loan.loanClass}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${STATUS_COLORS[loan.status]}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[loan.status] ?? "bg-gray-400"}`} />
                              {STATUS_LABELS[loan.status]}
                            </span>
                          </div>
                        </td>

                        {/* Principal */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(loan.amount)}</p>
                          <p className="text-[10px] text-gray-400">{loan.interestMethod} · {loan.annualInterestRate}%</p>
                        </td>

                        {/* Total Paid */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</p>
                          {loan.amountRepaidPrincipal > 0 && (
                            <p className="text-[10px] text-gray-400">Princ: {formatCurrency(loan.amountRepaidPrincipal)}</p>
                          )}
                        </td>

                        {/* Penalty */}
                        <td className="px-4 py-3.5">
                          {loan.penaltyAmount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              {formatCurrency(loan.penaltyAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Outstanding */}
                        <td className="px-4 py-3.5">
                          {totalOutstanding > 0 ? (
                            <div>
                              <p className={`text-sm font-bold ${totalOutstanding > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                                {formatCurrency(totalOutstanding)}
                              </p>
                              {loan.daysOverdue > 0 && (
                                <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${loan.daysOverdue > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                  {loan.daysOverdue}d overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Cleared
                            </span>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="px-4 py-3.5">
                          <div className={`text-xs font-medium flex items-center gap-1 ${isPastDue ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
                            {isPastDue && <AlertTriangle className="w-3 h-3 shrink-0" />}
                            {formatDate(loan.agreedMaturityDate)}
                          </div>
                          {loan.nextPaymentDate && ["active", "overdue"].includes(loan.status) && (
                            <p className="text-[10px] text-gray-400 mt-0.5">Next: {formatDate(loan.nextPaymentDate)}</p>
                          )}
                        </td>

                        {/* Rate / Freq */}
                        <td className="px-4 pr-6 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                          <p className="font-semibold text-gray-900 dark:text-gray-200">{loan.annualInterestRate}% p.a.</p>
                          <p className="text-gray-400">{freqLabel(loan.repaymentFrequencyDays)}</p>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
