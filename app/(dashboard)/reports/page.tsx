"use client";
import { useState } from "react";
import { Download, BarChart3, FileCheck, TrendingUp, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CHART_DATA, LOAN_STATUS_DATA, formatCurrency } from "@/lib/mock-data";
import { useTheme } from "next-themes";

const REPORT_CARDS = [
  { id: "bnr", title: "BNR Compliance Report", description: "Structured report for National Bank of Rwanda submission", icon: <FileCheck className="w-5 h-5" />, badge: "Q3 2024", variant: "info" as const },
  { id: "crb", title: "CRB Report", description: "Credit reference bureau data export", icon: <Building2 className="w-5 h-5" />, badge: "Monthly", variant: "neutral" as const },
  { id: "portfolio", title: "Portfolio Report", description: "Full loan portfolio analysis and aging", icon: <BarChart3 className="w-5 h-5" />, badge: "Real-time", variant: "success" as const },
  { id: "income", title: "Income & Expense", description: "Revenue vs expenditure financial statement", icon: <TrendingUp className="w-5 h-5" />, badge: "Oct 2024", variant: "warning" as const },
];

const INCOME_DATA = [
  { category: "Interest Income", amount: 28_400_000 },
  { category: "Processing Fees", amount: 4_200_000 },
  { category: "Management Fees", amount: 6_100_000 },
  { category: "Penalties", amount: 1_820_000 },
];

const EXPENSE_CATEGORIES = ["Staff Salaries", "Rent", "Utilities", "Marketing", "Provisioning"];
const EXPENSE_AMOUNTS = [8_500_000, 1_200_000, 280_000, 450_000, 2_100_000];

export default function ReportsPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const gridColor = dark ? "#1f2937" : "#f3f4f6";
  const textColor = dark ? "#6b7280" : "#9ca3af";

  const [activeReport, setActiveReport] = useState<string | null>(null);

  const totalIncome = INCOME_DATA.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = EXPENSE_AMOUNTS.reduce((a, b) => a + b, 0);
  const netProfit = totalIncome - totalExpenses;

  const barData = CHART_DATA.map((d) => ({
    month: d.month,
    Disbursed: Math.round(d.disbursed / 1_000_000),
    Collected: Math.round(d.collected / 1_000_000),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reports & Compliance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial reports, compliance, and analytics</p>
        </div>
        <Button variant="outline" icon={<Download className="w-4 h-4" />}>Export All</Button>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_CARDS.map((report, i) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => setActiveReport(report.id === activeReport ? null : report.id)}
            className={`bg-white dark:bg-gray-900 rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${
              activeReport === report.id
                ? "border-green-500 dark:border-green-500 ring-1 ring-green-500/30"
                : "border-gray-200 dark:border-gray-800"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {report.icon}
              </div>
              <Badge variant={report.variant}>{report.badge}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{report.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{report.description}</p>
            <Button variant="outline" size="sm" icon={<Download className="w-3 h-3" />} className="w-full">
              Download
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="items-center justify-between">
            <CardTitle>Monthly Disbursements vs Collections (RWF M)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`RWF ${v}M`, ""]}
                  contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Disbursed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Portfolio by Status</CardTitle></CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={LOAN_STATUS_DATA} cx="50%" cy="45%" outerRadius={70} paddingAngle={3} dataKey="value">
                  {LOAN_STATUS_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="items-center justify-between">
            <CardTitle>Income Statement — October 2024</CardTitle>
            <Button variant="ghost" size="sm" icon={<Download className="w-3 h-3" />}>Export</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Revenue</div>
              {INCOME_DATA.map((item) => (
                <div key={item.category} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total Revenue</span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome)}</span>
              </div>

              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">Expenses</div>
              {EXPENSE_CATEGORIES.map((cat, i) => (
                <div key={cat} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">({formatCurrency(EXPENSE_AMOUNTS[i])})</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total Expenses</span>
                <span className="text-sm text-red-600 dark:text-red-400">({formatCurrency(totalExpenses)})</span>
              </div>

              <div className="flex justify-between items-center py-3 mt-1 border-t-2 border-gray-200 dark:border-gray-700">
                <span className="font-bold text-gray-900 dark:text-gray-100">Net Profit</span>
                <span className={`font-bold text-lg ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet */}
        <Card>
          <CardHeader className="items-center justify-between">
            <CardTitle>Balance Sheet Snapshot</CardTitle>
            <Button variant="ghost" size="sm" icon={<Download className="w-3 h-3" />}>Export</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Assets</div>
              {[
                { label: "Loan Portfolio (Net)", value: 458_000_000 },
                { label: "Cash & Bank", value: 45_200_000 },
                { label: "Fixed Assets", value: 35_700_000 },
                { label: "Other Assets", value: 8_100_000 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total Assets</span>
                <span className="text-sm text-green-600 dark:text-green-400">{formatCurrency(547_000_000)}</span>
              </div>

              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">Liabilities & Equity</div>
              {[
                { label: "Borrowings", value: 280_000_000 },
                { label: "Other Liabilities", value: 12_000_000 },
                { label: "Shareholder Equity", value: 255_000_000 },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-sm text-gray-900 dark:text-gray-100">Total L & E</span>
                <span className="text-sm text-green-600 dark:text-green-400">{formatCurrency(547_000_000)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BNR Compliance Table */}
      <Card>
        <CardHeader className="items-center justify-between">
          <CardTitle>BNR Compliance Indicators</CardTitle>
          <Badge variant="success">Compliant</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {["Indicator", "Required", "Actual", "Status"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { indicator: "Capital Adequacy Ratio", required: ">= 10%", actual: "14.2%", ok: true },
                { indicator: "Liquidity Ratio", required: ">= 20%", actual: "28.5%", ok: true },
                { indicator: "Non-Performing Loans (NPL)", required: "<= 5%", actual: "3.8%", ok: true },
                { indicator: "Loan Loss Provision Coverage", required: ">= 100%", actual: "112%", ok: true },
                { indicator: "Single Borrower Limit", required: "<= 25% of capital", actual: "18%", ok: true },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">{row.indicator}</td>
                  <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">{row.required}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{row.actual}</td>
                  <td className="px-6 py-3"><Badge variant={row.ok ? "success" : "danger"}>{row.ok ? "Compliant" : "Breach"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
