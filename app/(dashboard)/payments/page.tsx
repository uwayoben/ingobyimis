"use client";
import { useState } from "react";
import { Plus, Search, CreditCard, TrendingDown, TrendingUp, DollarSign, ArrowDownUp } from "lucide-react";
import { motion } from "framer-motion";
import { PAYMENTS, LOANS, formatCurrency } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import type { Payment } from "@/types";

function RecordPaymentForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState("");
  const [amount, setAmount] = useState(0);

  const activeLoans = LOANS.filter((l) => l.status === "active");
  const loan = activeLoans.find((l) => l.id === selectedLoan);

  const principalShare = loan ? amount * (loan.outstandingBalance / loan.totalRepayable) : 0;
  const interestShare = amount - principalShare;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onClose(); }, 1200);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      <Select
        label="Select Loan"
        options={[{ value: "", label: "— Select active loan —" }, ...activeLoans.map((l) => ({ value: l.id, label: `${l.customerName} — ${l.id.toUpperCase()} (${formatCurrency(l.outstandingBalance)} due)` }))]}
        value={selectedLoan}
        onChange={(e) => setSelectedLoan(e.target.value)}
        required
      />

      {loan && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p>Next payment: <strong>{formatCurrency(loan.nextPaymentAmount)}</strong> due {formatDate(loan.nextPaymentDate)}</p>
          {loan.penaltyAmount > 0 && <p>Penalty accrued: <strong>{formatCurrency(loan.penaltyAmount)}</strong></p>}
        </div>
      )}

      <Input
        label="Payment Amount (RWF)"
        type="number"
        value={amount || ""}
        onChange={(e) => setAmount(Number(e.target.value))}
        required
      />

      {amount > 0 && loan && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50 rounded-xl p-3 text-xs space-y-2">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Auto-allocation preview</p>
          {loan.penaltyAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Penalty</span>
              <span className="text-red-600 font-semibold">{formatCurrency(Math.min(amount, loan.penaltyAmount))}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Interest</span>
            <span className="text-amber-600 font-semibold">{formatCurrency(Math.round(interestShare))}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Principal</span>
            <span className="text-green-600 font-semibold">{formatCurrency(Math.round(principalShare))}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Payment Method"
          options={[
            { value: "cash", label: "Cash" },
            { value: "bank_transfer", label: "Bank Transfer" },
            { value: "mobile_money", label: "Mobile Money" },
          ]}
        />
        <Input label="Reference / Receipt #" placeholder="e.g. MM-2024-001" />
      </div>

      <Textarea label="Notes (optional)" placeholder="Any additional notes..." />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Record Payment</Button>
      </div>
    </form>
  );
}

function PaymentRow({ payment, index }: { payment: Payment; index: number }) {
  const methodConfig: Record<string, { variant: "success" | "info" | "neutral"; label: string }> = {
    cash: { variant: "success", label: "Cash" },
    bank_transfer: { variant: "info", label: "Bank Transfer" },
    mobile_money: { variant: "neutral", label: "Mobile Money" },
  };
  const method = methodConfig[payment.method] ?? { variant: "neutral" as const, label: payment.method };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      <td className="pl-6 pr-4 py-3.5">
        <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">{payment.reference}</span>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{payment.customerName}</p>
        <p className="text-xs text-gray-400 font-mono">{payment.loanId.toUpperCase()}</p>
      </td>
      <td className="px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(payment.amount)}</td>
      <td className="px-4 py-3.5 text-xs font-semibold text-green-600 dark:text-green-400">{formatCurrency(payment.principal)}</td>
      <td className="px-4 py-3.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(payment.interest)}</td>
      <td className="px-4 py-3.5 text-xs font-semibold text-red-500 dark:text-red-400">{payment.penalty > 0 ? formatCurrency(payment.penalty) : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
      <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(payment.date)}</td>
      <td className="px-4 pr-6 py-3.5">
        <Badge variant={method.variant} className="text-[10px]">{method.label}</Badge>
      </td>
    </motion.tr>
  );
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = PAYMENTS.filter((p) =>
    p.customerName.toLowerCase().includes(search.toLowerCase()) ||
    p.reference.toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = PAYMENTS.reduce((sum, p) => sum + p.amount, 0);
  const totalPrincipal = PAYMENTS.reduce((sum, p) => sum + p.principal, 0);
  const totalInterest = PAYMENTS.reduce((sum, p) => sum + p.interest, 0);
  const totalPenalty = PAYMENTS.reduce((sum, p) => sum + p.penalty, 0);

  const summaryCards = [
    { label: "Total Collected", value: formatCurrency(totalCollected), icon: <DollarSign className="w-5 h-5" />, border: "border-l-emerald-500", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: "Principal Collected", value: formatCurrency(totalPrincipal), icon: <TrendingDown className="w-5 h-5" />, border: "border-l-green-500", iconBg: "bg-green-500/15 text-green-600 dark:text-green-400" },
    { label: "Interest Earned", value: formatCurrency(totalInterest), icon: <TrendingUp className="w-5 h-5" />, border: "border-l-amber-500", iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    { label: "Penalties Collected", value: formatCurrency(totalPenalty), icon: <CreditCard className="w-5 h-5" />, border: "border-l-red-500", iconBg: "bg-red-500/15 text-red-600 dark:text-red-400" },
  ];

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
            <p className="text-green-200 text-sm font-medium mb-1">Collections</p>
            <h2 className="text-2xl font-bold">Payments</h2>
            <p className="text-green-100/80 text-sm mt-1">{PAYMENTS.length} payment records · auto-allocated</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">RWF {(totalCollected / 1_000_000).toFixed(1)}M</p>
              <p className="text-xs text-green-100/70">Total Collected</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">RWF {(totalInterest / 1_000_000).toFixed(1)}M</p>
              <p className="text-xs text-green-100/70">Interest Earned</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${stat.border} p-4 hover:shadow-md transition-all`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.iconBg}`}>
              {stat.icon}
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{filtered.length} payment{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-6 h-6" />}
            title="No payments found"
            description="Record the first payment to see it here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  {["Reference", "Customer", "Total Amount", "Principal", "Interest", "Penalty", "Date", "Method"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((payment, i) => (
                  <PaymentRow key={payment.id} payment={payment} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Payment" size="md">
        <RecordPaymentForm onClose={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}
