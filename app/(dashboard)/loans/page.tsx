"use client";
import { useState } from "react";
import { Plus, Search, Filter, FileText, AlertTriangle, CheckCircle2, Clock, XCircle, ArrowDownToLine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { LOANS, formatCurrency } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/utils";
import type { LoanStatus } from "@/types";

const STATUS_TABS: { label: string; value: LoanStatus | "all"; icon?: React.ReactNode; color?: string }[] = [
  { label: "All Loans", value: "all" },
  { label: "Active", value: "active", color: "text-green-600" },
  { label: "Pending", value: "pending", color: "text-amber-600" },
  { label: "Overdue", value: "overdue", color: "text-red-600" },
  { label: "Disbursed", value: "disbursed", color: "text-blue-600" },
  { label: "Completed", value: "completed", color: "text-gray-500" },
];

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-amber-500",
  overdue: "bg-red-500",
  disbursed: "bg-blue-500",
  completed: "bg-gray-400",
};

export default function LoansPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<LoanStatus | "all">("all");

  const filtered = LOANS.filter((l) => {
    const matchSearch = l.customerName.toLowerCase().includes(search.toLowerCase()) || l.id.includes(search);
    const matchTab = tab === "all" || l.status === tab;
    return matchSearch && matchTab;
  });

  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t.value] = t.value === "all" ? LOANS.length : LOANS.filter((l) => l.status === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  const totalActive = LOANS.filter((l) => l.status === "active").length;
  const totalPending = LOANS.filter((l) => l.status === "pending").length;
  const totalOverdue = LOANS.filter((l) => l.status === "overdue").length;
  const totalOutstanding = LOANS.filter((l) => l.status === "active").reduce((s, l) => s + l.outstandingBalance, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-green-200 text-sm font-medium mb-1">Loan Portfolio</p>
            <h2 className="text-2xl font-bold">Loans</h2>
            <p className="text-green-100/80 text-sm mt-1">{LOANS.length} total loan records across all statuses</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{totalActive}</p>
              <p className="text-xs text-green-100/70">Active</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{totalPending}</p>
              <p className="text-xs text-green-100/70">Pending</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold text-red-200">{totalOverdue}</p>
              <p className="text-xs text-green-100/70">Overdue</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-green-100/70 text-sm">Outstanding portfolio: <span className="font-semibold text-white">RWF {(totalOutstanding / 1_000_000).toFixed(1)}M</span></p>
          <Link href="/loans/new" className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> New Loan
          </Link>
        </div>
      </motion.div>

      {/* Status Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.value
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.value !== "all" && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.value] ?? "bg-gray-400"}`} />
            )}
            {t.label}
            {counts[t.value] > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                tab === t.value ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}>
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer or loan ID..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>
        <Button variant="outline" icon={<Filter className="w-4 h-4" />}>Filter</Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {filtered.length} loan{filtered.length !== 1 ? "s" : ""} {tab !== "all" && <span className="text-gray-400 font-normal">· {STATUS_LABELS[tab as LoanStatus]}</span>}
          </p>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No loans found"
            description="Try a different filter or create a new loan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {["Loan ID", "Customer", "Amount", "Interest", "Frequency", "Disbursed", "Outstanding", "Next Payment", "Status"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                <AnimatePresence>
                  {filtered.map((loan, i) => (
                    <motion.tr
                      key={loan.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                      <td className="pl-6 pr-4 py-3.5">
                        <Link href={`/loans/${loan.id}`} className="font-mono text-xs font-semibold text-green-600 dark:text-green-400 hover:underline">
                          {loan.id.toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/customers/${loan.customerId}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                          {loan.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-gray-200">{loan.interestRate}%</span>
                        <span className="text-gray-400 ml-1">({loan.interestType})</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400 capitalize">{loan.frequency}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                        {loan.disbursedAt ? formatDate(loan.disbursedAt) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {loan.outstandingBalance > 0 ? formatCurrency(loan.outstandingBalance) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                        {loan.status === "active" ? (
                          <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(loan.nextPaymentDate)}</span>
                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 pr-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[loan.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[loan.status] ?? "bg-gray-400"}`} />
                          {STATUS_LABELS[loan.status]}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
