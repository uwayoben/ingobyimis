"use client";
import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, FileText, Users, TrendingUp, TrendingDown, AlertTriangle,
  Activity, ArrowDownToLine, ArrowUpToLine, Percent, ClipboardList, UserPlus,
  Loader2, CalendarDays, Banknote, Receipt, PiggyBank, BadgePercent,
  CircleDollarSign, Tag, ChevronDown, Landmark,
} from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { LoanChart } from "@/components/dashboard/LoanChart";
import { LoanStatusChart } from "@/components/dashboard/LoanStatusChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRole } from "@/components/RoleContext";
import { apiFetch } from "@/lib/api-fetch";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

interface KPIData {
  // Period-filtered
  totalLoans: number;
  totalDisbursed: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  pendingLoans: number;
  writtenOffLoans: number;
  totalFees: number;
  totalPenaltyPaid: number;
  totalExpenses: number;
  // All-time running balances
  totalAmountCollected: number;
  totalOutstanding: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalOutstandingPrincipal: number;
  // Computed
  totalEarnings: number;
  netProfit: number;
  // Misc
  totalCustomers: number;
  disbursedToday: number;
  collectionRate: number;
  accountBalance: number;
  // Legacy aliases
  outstandingBalance: number;
  totalRevenue: number;
}

interface PendingLoan {
  id: string;
  customerName: string;
  customerId: string;
  purpose: string;
  amount: number;
  createdAt: string;
}

const FILTERS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
] as const;

const PERIOD_LABEL: Record<string, string> = {
  all: "all time", today: "today", this_week: "this week",
  this_month: "this month", last_month: "last month",
  this_quarter: "this quarter", last_quarter: "last quarter",
  this_year: "this year", last_year: "last year",
};

const GREETINGS: Record<string, string> = {
  super_admin: "System is running smoothly.",
  managing_director: "Here's your portfolio overview.",
  loan_officer: "You have tasks awaiting your attention.",
  receptionist: "Ready to assist customers today?",
  shareholder: "Here's your investment performance.",
};

export default function DashboardPage() {
  const { role } = useRole();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUser>>(null);
  useEffect(() => { setStoredUser(getStoredUser()); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const companyName = storedUser?.companyName ?? "";
  const period = PERIOD_LABEL[filter] ?? "all time";

  const fetchData = useCallback((activeFilter: string) => {
    const storedRole = getStoredUser()?.role;
    if (storedRole === "super_admin") { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      apiFetch(`/api/v1/dashboard?filter=${activeFilter}`).then((r) => r.json()),
      apiFetch("/api/v1/loans?status=pending&limit=5").then((r) => r.json()),
    ]).then(([dashData, loansData]) => {
      if (dashData.data) setKpi(dashData.data);
      if (loansData.data) setPendingLoans(loansData.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(filter); }, [filter, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  // Super admin redirect panel
  if (role === "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-green-900/20">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Super Admin Panel</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">
              Create and manage lending companies, assign managing directors, and oversee all users from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin" className="flex flex-col items-center gap-2 p-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl transition-colors shadow-md shadow-green-900/20">
              <Users className="w-6 h-6" />
              <span className="text-sm font-semibold">Admin Panel</span>
              <span className="text-xs text-green-200">Manage companies & users</span>
            </Link>
            <Link href="/settings" className="flex flex-col items-center gap-2 p-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl transition-colors">
              <TrendingUp className="w-6 h-6" />
              <span className="text-sm font-semibold">Settings</span>
              <span className="text-xs text-gray-400">Account & platform</span>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const kd: KPIData = kpi ?? {
    totalLoans: 0, totalDisbursed: 0, activeLoans: 0, completedLoans: 0,
    overdueLoans: 0, pendingLoans: 0, writtenOffLoans: 0,
    totalFees: 0, totalPenaltyPaid: 0, totalExpenses: 0,
    totalAmountCollected: 0, totalOutstanding: 0, totalPrincipalPaid: 0,
    totalInterestPaid: 0, totalOutstandingPrincipal: 0,
    totalEarnings: 0, netProfit: 0,
    totalCustomers: 0, disbursedToday: 0, collectionRate: 0,
    accountBalance: 0,
    outstandingBalance: 0, totalRevenue: 0,
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-green-300 text-sm font-medium mb-1">{greeting} 👋</p>
            <h2 className="text-xl sm:text-2xl font-bold">{storedUser?.name?.split(" ")[0] ?? "Welcome"}</h2>
            <p className="text-green-100/80 text-sm mt-1">{GREETINGS[role] ?? GREETINGS.managing_director}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date filter — managing_director only */}
            {role === "managing_director" && (
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-300 pointer-events-none" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-300 pointer-events-none" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="appearance-none bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-medium rounded-xl pl-9 pr-8 py-2 cursor-pointer hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {FILTERS.map((f) => (
                    <option key={f.value} value={f.value} className="bg-green-900 text-white">
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{kd.activeLoans}</p>
              <p className="text-xs text-green-100/70">Active</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{kd.collectionRate}%</p>
              <p className="text-xs text-green-100/70">Collection</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{kd.pendingLoans}</p>
              <p className="text-xs text-green-100/70">Pending</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-0 text-[11px]">{ROLE_LABELS[role]}</Badge>
          {companyName && (
            <>
              <span className="text-green-300/50 text-xs">·</span>
              <span className="text-green-300/70 text-xs">{companyName}</span>
            </>
          )}
          {role === "managing_director" && filter !== "all" && (
            <>
              <span className="text-green-300/50 text-xs">·</span>
              <span className="text-green-300/70 text-xs capitalize">Showing {period}</span>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Managing Director Full KPI Grid ───────────────────────────── */}
      {role === "managing_director" && (
        <div className="space-y-5">

          {/* Account Balance Banner */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-5 border flex items-center gap-5 shadow-sm ${
              kd.accountBalance >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/50"
                : "bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/50"
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              kd.accountBalance >= 0
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
            }`}>
              <Landmark className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                kd.accountBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              }`}>Company Account Balance</p>
              <p className={`text-3xl font-extrabold tracking-tight ${
                kd.accountBalance >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
              }`}>
                {formatCurrency(kd.accountBalance)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Updated in real-time as loans are disbursed, repayments received, and expenses paid
              </p>
            </div>
            <Link
              href="/accounting"
              className={`shrink-0 text-xs font-semibold px-4 py-2 rounded-xl border transition-colors ${
                kd.accountBalance >= 0
                  ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  : "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
              }`}
            >
              View Ledger →
            </Link>
          </motion.div>

          {/* Section 1: Loan Portfolio */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
              Loan Portfolio — {period}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Loans"
                value={kd.totalLoans.toLocaleString()}
                icon={<FileText />}
                accent="blue"
                index={0}
                subtitle={`${kd.activeLoans} active · ${kd.completedLoans} completed`}
              />
              <KPICard
                title="Total Disbursed"
                value={formatCurrency(kd.totalDisbursed)}
                icon={<ArrowDownToLine />}
                accent="amber"
                index={1}
                subtitle={`Principal lent out — ${period}`}
              />
              <KPICard
                title="Total Collected"
                value={formatCurrency(kd.totalAmountCollected)}
                icon={<ArrowUpToLine />}
                accent="green"
                index={2}
                subtitle="Total repayments received (all time)"
              />
              <KPICard
                title="Outstanding Balance"
                value={formatCurrency(kd.totalOutstanding)}
                icon={<AlertTriangle />}
                accent={kd.writtenOffLoans > 0 ? "red" : "blue"}
                index={3}
                subtitle={`${kd.writtenOffLoans} written-off loan(s) (all time)`}
              />
            </div>
          </div>

          {/* Section 2: Repayment Breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
              Repayment Breakdown — all time
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Principal Paid"
                value={formatCurrency(kd.totalPrincipalPaid)}
                icon={<Banknote />}
                accent="emerald"
                index={4}
                subtitle="Total principal recovered (all time)"
              />
              <KPICard
                title="Outstanding Principal"
                value={formatCurrency(kd.totalOutstandingPrincipal)}
                icon={<TrendingDown />}
                accent={kd.totalOutstandingPrincipal > 0 ? "red" : "green"}
                index={5}
                subtitle="Principal yet to be recovered (all time)"
              />
              <KPICard
                title="Interest Earned"
                value={formatCurrency(kd.totalInterestPaid)}
                icon={<BadgePercent />}
                accent="blue"
                index={6}
                subtitle="Total interest collected (all time)"
              />
              <KPICard
                title="Penalty Collected"
                value={formatCurrency(kd.totalPenaltyPaid)}
                icon={<Receipt />}
                accent="amber"
                index={7}
                subtitle={`Penalties collected — ${period}`}
              />
            </div>
          </div>

          {/* Section 3: Profitability */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
              Profitability — {period}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Fees"
                value={formatCurrency(kd.totalFees)}
                icon={<Tag />}
                accent="violet"
                index={8}
                subtitle={`Processing & application fees — ${period}`}
              />
              <KPICard
                title="Total Earnings"
                value={formatCurrency(kd.totalEarnings)}
                icon={<CircleDollarSign />}
                accent="green"
                index={9}
                subtitle="Interest + Fees + Penalty"
              />
              <KPICard
                title="Total Expenses"
                value={formatCurrency(kd.totalExpenses)}
                icon={<TrendingDown />}
                accent="red"
                index={10}
                subtitle={`All recorded expenses — ${period}`}
              />
              <KPICard
                title="Net Profit"
                value={formatCurrency(kd.netProfit)}
                icon={kd.netProfit >= 0 ? <PiggyBank /> : <AlertTriangle />}
                accent={kd.netProfit >= 0 ? "emerald" : "red"}
                index={11}
                subtitle={kd.netProfit >= 0 ? `Profitable — ${period}` : `Running at a loss — ${period}`}
              />
            </div>
          </div>

          {/* Section 4: Customers & Operations */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">
              Operations
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Total Customers" value={kd.totalCustomers.toLocaleString()} icon={<Users />} accent="violet" index={12} />
              <KPICard title="Overdue Loans" value={kd.overdueLoans.toString()} icon={<AlertTriangle />} accent="red" index={13} subtitle="Needs follow-up" />
              <KPICard title="Disbursed Today" value={formatCurrency(kd.disbursedToday)} icon={<ArrowDownToLine />} accent="emerald" index={14} />
              <KPICard title="Collection Rate" value={`${kd.collectionRate}%`} icon={<Percent />} accent="amber" index={15} subtitle="All-time repayment rate" />
            </div>
          </div>
        </div>
      )}

      {/* ── Loan Officer KPIs ──────────────────────────────────────────── */}
      {role === "loan_officer" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Active Loans" value={kd.activeLoans.toString()} icon={<FileText />} accent="green" index={0} />
          <KPICard title="Pending Approvals" value={kd.pendingLoans.toString()} icon={<ClipboardList />} accent="amber" index={1} subtitle="Awaiting review" />
          <KPICard title="Overdue Accounts" value={kd.overdueLoans.toString()} icon={<AlertTriangle />} accent="red" index={2} subtitle="Follow up needed" />
          <KPICard title="Disbursed Today" value={formatCurrency(kd.disbursedToday)} icon={<ArrowDownToLine />} accent="emerald" index={3} />
        </div>
      )}

      {/* ── Receptionist KPIs ─────────────────────────────────────────── */}
      {role === "receptionist" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard title="Total Customers" value={kd.totalCustomers.toString()} icon={<Users />} accent="green" index={0} />
          <KPICard title="Active Loans" value={kd.activeLoans.toString()} icon={<FileText />} accent="blue" index={1} />
          <KPICard title="Disbursed Today" value={formatCurrency(kd.disbursedToday)} icon={<DollarSign />} accent="emerald" index={2} />
        </div>
      )}

      {/* ── Shareholder KPIs ──────────────────────────────────────────── */}
      {role === "shareholder" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Portfolio Value" value={`RWF ${(kd.totalOutstanding / 1_000_000).toFixed(0)}M`} icon={<TrendingUp />} accent="green" index={0} />
          <KPICard title="Total Revenue" value={`RWF ${(kd.totalRevenue / 1_000_000).toFixed(1)}M`} icon={<DollarSign />} accent="emerald" index={1} />
          <KPICard title="Active Borrowers" value={kd.activeLoans.toString()} icon={<Users />} accent="blue" index={2} />
          <KPICard title="Collection Rate" value={`${kd.collectionRate}%`} icon={<Percent />} accent="amber" index={3} />
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────── */}
      {(role === "managing_director" || role === "shareholder") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <LoanChart />
          <LoanStatusChart />
        </div>
      )}

      {/* ── Bottom Panels ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {role !== "receptionist" && <RecentActivity />}

        {(role === "managing_director" || role === "loan_officer") && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Pending Approvals</h3>
                <p className="text-xs text-gray-500 mt-0.5">Loans awaiting review</p>
              </div>
              {pendingLoans.length > 0 && (
                <Badge variant="warning" className="text-xs">{pendingLoans.length} pending</Badge>
              )}
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {pendingLoans.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">All clear!</p>
                  <p className="text-xs text-gray-400 mt-1">No pending approvals</p>
                </div>
              ) : (
                pendingLoans.map((loan) => (
                  <Link
                    key={loan.id}
                    href={`/loans/${loan.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-bold shrink-0">
                      {loan.customerName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{loan.customerName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{loan.purpose} · {formatDate(loan.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(loan.amount)}</p>
                      <Badge variant="warning" className="text-[10px] mt-0.5">Pending</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
            {pendingLoans.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <Link href="/loans?status=pending" className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline">
                  View all pending loans →
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {role === "receptionist" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col items-center justify-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Register a Customer</p>
            <p className="text-xs text-gray-500">Add a new client to start a loan application.</p>
            <Link href="/customers" className="mt-1 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
              Go to Customers
            </Link>
          </motion.div>
        )}

        {role === "managing_director" && kd.overdueLoans > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800/50 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-red-100 dark:border-red-800/50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Overdue Accounts</h3>
              <Badge variant="danger" className="ml-auto">{kd.overdueLoans}</Badge>
            </div>
            <div className="p-5 text-sm text-red-700 dark:text-red-400">
              <p>{kd.overdueLoans} loan{kd.overdueLoans > 1 ? "s" : ""} require immediate follow-up.</p>
              <Link href="/loans?status=overdue" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold underline underline-offset-2">
                Review overdue loans →
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
