"use client";
import { useState } from "react";
import { Plus, TrendingDown, Package, DollarSign, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EXPENSES, ASSETS, formatCurrency } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onClose(); }, 1000);
  };
  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <Select label="Category" options={[
        { value: "Staff Salaries", label: "Staff Salaries" },
        { value: "Rent", label: "Rent" },
        { value: "Utilities", label: "Utilities" },
        { value: "Marketing", label: "Marketing" },
        { value: "Other", label: "Other" },
      ]} required />
      <Input label="Amount (RWF)" type="number" placeholder="500000" required />
      <Input label="Date" type="date" required />
      <Textarea label="Description" placeholder="Brief description..." required />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Expense</Button>
      </div>
    </form>
  );
}

export default function AccountingPage() {
  const [tab, setTab] = useState<"expenses" | "assets">("expenses");
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0);
  const totalAssetValue = ASSETS.reduce((s, a) => s + a.currentValue, 0);
  const totalPurchaseValue = ASSETS.reduce((s, a) => s + a.purchaseValue, 0);
  const totalDepreciation = totalPurchaseValue - totalAssetValue;

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
            <p className="text-green-200 text-sm font-medium mb-1">Financial Records</p>
            <h2 className="text-2xl font-bold">Accounting</h2>
            <p className="text-green-100/80 text-sm mt-1">Expenses, income records, and asset register</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{EXPENSES.length}</p>
              <p className="text-xs text-green-100/70">Expense Entries</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{ASSETS.length}</p>
              <p className="text-xs text-green-100/70">Assets</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          {tab === "expenses" && (
            <button
              onClick={() => setShowExpenseModal(true)}
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {[
          { label: "Expenses", value: "expenses" as const, icon: <TrendingDown className="w-3.5 h-3.5" /> },
          { label: "Assets", value: "assets" as const, icon: <Package className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.value
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "expenses" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Total Expenses (Month)", value: formatCurrency(totalExpenses), border: "border-l-red-500", iconBg: "bg-red-500/15 text-red-600 dark:text-red-400", icon: <TrendingDown className="w-5 h-5" /> },
              { label: "Expense Entries", value: EXPENSES.length.toString(), border: "border-l-amber-500", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <BarChart3 className="w-5 h-5" /> },
              { label: "Avg. Per Entry", value: formatCurrency(Math.round(totalExpenses / EXPENSES.length)), border: "border-l-blue-500", iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: <DollarSign className="w-5 h-5" /> },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${stat.border} p-4`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.iconBg}`}>{stat.icon}</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Expense Records</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    {["Date", "Category", "Description", "Amount"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {EXPENSES.map((expense, i) => (
                    <motion.tr key={expense.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(expense.date)}</td>
                      <td className="px-6 py-3.5"><Badge variant="neutral" className="text-[11px]">{expense.category}</Badge></td>
                      <td className="px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300">{expense.description}</td>
                      <td className="px-6 py-3.5 text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(expense.amount)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {tab === "assets" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Purchase Value", value: formatCurrency(totalPurchaseValue), border: "border-l-green-500", iconBg: "bg-green-500/15 text-green-600 dark:text-green-400", icon: <Package className="w-5 h-5" /> },
              { label: "Current Book Value", value: formatCurrency(totalAssetValue), border: "border-l-emerald-500", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: <DollarSign className="w-5 h-5" /> },
              { label: "Accumulated Depreciation", value: formatCurrency(totalDepreciation), border: "border-l-amber-500", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <TrendingDown className="w-5 h-5" /> },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${stat.border} p-4`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.iconBg}`}>{stat.icon}</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader className="items-center justify-between">
              <CardTitle>Asset Register</CardTitle>
              <Button icon={<Plus className="w-4 h-4" />} size="sm">Add Asset</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    {["Asset Name", "Category", "Purchase Date", "Purchase Value", "Current Value", "Rate", "Depreciation"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {ASSETS.map((asset, i) => (
                    <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{asset.name}</td>
                      <td className="px-6 py-3.5"><Badge variant="neutral" className="text-[11px]">{asset.category}</Badge></td>
                      <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(asset.purchaseDate)}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(asset.purchaseValue)}</td>
                      <td className="px-6 py-3.5 text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(asset.currentValue)}</td>
                      <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{asset.depreciationRate}% p.a.</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(asset.purchaseValue - asset.currentValue)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense" size="sm">
        <ExpenseForm onClose={() => setShowExpenseModal(false)} />
      </Modal>
    </div>
  );
}
