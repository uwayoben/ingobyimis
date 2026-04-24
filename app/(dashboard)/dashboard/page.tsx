"use client";
import { DollarSign, FileText, Users, TrendingUp, AlertTriangle, Activity, ArrowDownToLine, Percent, ClipboardList, Eye, UserPlus } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { LoanChart } from "@/components/dashboard/LoanChart";
import { LoanStatusChart } from "@/components/dashboard/LoanStatusChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { KPI_DATA, LOANS, formatCurrency, CURRENT_USER, CUSTOMERS } from "@/lib/mock-data";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRole } from "@/components/RoleContext";
import { Button } from "@/components/ui/Button";

const pendingLoans = LOANS.filter((l) => l.status === "pending");
const overdueLoans = LOANS.filter((l) => l.status === "overdue");
const recentCustomers = CUSTOMERS.slice(0, 3);

const GREETINGS: Record<string, string> = {
  super_admin: "System is running smoothly.",
  managing_director: "Here's your portfolio overview for today.",
  loan_officer: "You have tasks awaiting your attention.",
  receptionist: "Ready to assist customers today?",
  shareholder: "Here's your investment performance.",
};

export default function DashboardPage() {
  const { role } = useRole();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

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
            <p className="text-green-200 text-sm font-medium mb-1">{greeting} 👋</p>
            <h2 className="text-2xl font-bold">{CURRENT_USER.name.split(" ")[0]}</h2>
            <p className="text-green-100/80 text-sm mt-1">{GREETINGS[role] || GREETINGS.managing_director}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{KPI_DATA.activeLoans}</p>
              <p className="text-xs text-green-100/70">Active Loans</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{KPI_DATA.collectionRate}%</p>
              <p className="text-xs text-green-100/70">Collection Rate</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{pendingLoans.length}</p>
              <p className="text-xs text-green-100/70">Pending Approval</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge className="bg-white/20 text-white border-0 text-[11px]">{ROLE_LABELS[role]}</Badge>
          <span className="text-green-200/50 text-xs">·</span>
          <span className="text-green-200/70 text-xs">Ingobyi Finance Ltd</span>
        </div>
      </motion.div>

      {/* Role-based KPIs */}
      {(role === "managing_director" || role === "super_admin") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Active Loans" value={KPI_DATA.activeLoans.toLocaleString()} change={8.2} icon={<FileText />} accent="green" index={0} />
          <KPICard title="Outstanding" value={`RWF ${(KPI_DATA.outstandingBalance / 1_000_000).toFixed(0)}M`} change={12.5} icon={<DollarSign />} accent="blue" index={1} />
          <KPICard title="Revenue (Month)" value={`RWF ${(KPI_DATA.totalRevenue / 1_000_000).toFixed(1)}M`} change={15.4} icon={<TrendingUp />} accent="emerald" index={2} />
          <KPICard title="Collection Rate" value={`${KPI_DATA.collectionRate}%`} change={-1.3} icon={<Percent />} accent="amber" index={3} />
          <KPICard title="Total Customers" value={KPI_DATA.totalCustomers.toLocaleString()} change={5.1} icon={<Users />} accent="violet" index={4} />
          <KPICard title="Overdue Loans" value={KPI_DATA.overdueLoans.toString()} change={-3.2} icon={<AlertTriangle />} accent="red" index={5} subtitle="Needs attention" />
          <KPICard title="Disbursed Today" value={formatCurrency(KPI_DATA.disbursedToday)} icon={<ArrowDownToLine />} accent="green" index={6} />
          <KPICard title="Total Loans" value={KPI_DATA.totalLoans.toLocaleString()} change={4.7} icon={<Activity />} accent="blue" index={7} />
        </div>
      )}

      {role === "loan_officer" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="My Active Loans" value="14" change={3} icon={<FileText />} accent="green" index={0} subtitle="Under management" />
          <KPICard title="Pending Approvals" value={pendingLoans.length.toString()} icon={<ClipboardList />} accent="amber" index={1} subtitle="Awaiting review" />
          <KPICard title="Overdue Accounts" value="3" change={-1} icon={<AlertTriangle />} accent="red" index={2} subtitle="Follow up needed" />
          <KPICard title="Disbursed This Week" value="RWF 8.5M" change={12} icon={<ArrowDownToLine />} accent="emerald" index={3} />
        </div>
      )}

      {role === "receptionist" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard title="Customers Today" value="7" change={40} icon={<Users />} accent="green" index={0} subtitle="Walk-in customers" />
          <KPICard title="New Registrations" value="3" icon={<UserPlus />} accent="blue" index={1} />
          <KPICard title="Payments Recorded" value="12" change={20} icon={<DollarSign />} accent="emerald" index={2} subtitle="Today" />
        </div>
      )}

      {role === "shareholder" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Portfolio Value" value={`RWF ${(KPI_DATA.outstandingBalance / 1_000_000).toFixed(0)}M`} change={12.5} icon={<TrendingUp />} accent="green" index={0} />
          <KPICard title="Monthly Returns" value={`RWF ${(KPI_DATA.totalRevenue / 1_000_000).toFixed(1)}M`} change={15.4} icon={<DollarSign />} accent="emerald" index={1} />
          <KPICard title="Active Borrowers" value={KPI_DATA.activeLoans.toString()} change={8.2} icon={<Users />} accent="blue" index={2} />
          <KPICard title="Collection Rate" value={`${KPI_DATA.collectionRate}%`} icon={<Percent />} accent="amber" index={3} />
        </div>
      )}

      {/* Charts — only for roles that need them */}
      {(role === "managing_director" || role === "shareholder" || role === "super_admin") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <LoanChart />
          <LoanStatusChart />
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent activity — shown to all except receptionist */}
        {role !== "receptionist" && <RecentActivity />}

        {/* Pending Approvals — for MD and Loan Officer */}
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

        {/* Receptionist panel */}
        {role === "receptionist" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Customers</h3>
                <p className="text-xs text-gray-500 mt-0.5">Latest registrations</p>
              </div>
              <Link href="/customers">
                <Button size="sm" variant="outline" icon={<UserPlus className="w-3 h-3" />}>Add</Button>
              </Link>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {recentCustomers.map((c, i) => (
                <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 text-xs font-bold">
                    {(c.names ?? "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.names}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                  </div>
                  <Badge variant={c.activeLoans > 0 ? "success" : "neutral"} className="text-[10px]">
                    {c.activeLoans > 0 ? `${c.activeLoans} loan` : "No loans"}
                  </Badge>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Overdue alerts for MD */}
        {role === "managing_director" && overdueLoans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800/50 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-red-100 dark:border-red-800/50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Overdue Accounts</h3>
              <Badge variant="danger" className="ml-auto">{overdueLoans.length}</Badge>
            </div>
            <div className="p-5 text-sm text-red-700 dark:text-red-400">
              <p>{overdueLoans.length} loan{overdueLoans.length > 1 ? "s" : ""} require immediate follow-up.</p>
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
