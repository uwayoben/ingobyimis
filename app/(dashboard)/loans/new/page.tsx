"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Calculator } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { CUSTOMERS, formatCurrency } from "@/lib/mock-data";

interface Fee {
  id: string;
  name: string;
  type: "fixed" | "percentage";
  value: number;
  isRecurring: boolean;
}

interface LoanCalc {
  monthlyPayment: number;
  totalInterest: number;
  totalRepayable: number;
  disbursedAmount: number;
}

function calculateLoan(
  amount: number,
  rate: number,
  installments: number,
  interestType: "flat" | "declining",
  fees: Fee[]
): LoanCalc {
  const monthlyRate = rate / 100;
  let monthlyPayment = 0;
  let totalInterest = 0;

  if (interestType === "flat") {
    totalInterest = amount * monthlyRate * installments;
    monthlyPayment = (amount + totalInterest) / installments;
  } else {
    if (monthlyRate === 0) {
      monthlyPayment = amount / installments;
    } else {
      monthlyPayment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -installments));
    }
    totalInterest = monthlyPayment * installments - amount;
  }

  const upfrontFees = fees.reduce((sum, f) => {
    if (f.isRecurring) return sum;
    return sum + (f.type === "fixed" ? f.value : amount * f.value / 100);
  }, 0);

  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalInterest: Math.round(totalInterest),
    totalRepayable: Math.round(amount + totalInterest),
    disbursedAmount: Math.round(amount - upfrontFees),
  };
}

export default function NewLoanPage() {
  const [loading, setLoading] = useState(false);
  const [fees, setFees] = useState<Fee[]>([
    { id: "1", name: "Management Fee", type: "percentage", value: 2, isRecurring: false },
    { id: "2", name: "Application Fee", type: "fixed", value: 10000, isRecurring: false },
  ]);
  const [form, setForm] = useState({
    customerId: "", amount: 1000000, interestRate: 2.5,
    interestType: "declining" as "flat" | "declining",
    frequency: "monthly", installments: 12, purpose: "",
  });
  const [calc, setCalc] = useState<LoanCalc | null>(null);

  useEffect(() => {
    if (form.amount && form.interestRate && form.installments) {
      setCalc(calculateLoan(form.amount, form.interestRate, form.installments, form.interestType, fees));
    }
  }, [form, fees]);

  const addFee = () => {
    setFees((prev) => [...prev, { id: Date.now().toString(), name: "Custom Fee", type: "fixed", value: 0, isRecurring: false }]);
  };

  const removeFee = (id: string) => setFees((prev) => prev.filter((f) => f.id !== id));

  const updateFee = (id: string, field: keyof Fee, value: unknown) => {
    setFees((prev) => prev.map((f) => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create New Loan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the loan details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Borrower */}
            <Card>
              <CardHeader><CardTitle>Borrower</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Select Customer"
                  options={[{ value: "", label: "— Select customer —" }, ...CUSTOMERS.map((c) => ({ value: c.id, label: c.names }))]}
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                  required
                />
                <Input label="Loan Purpose" placeholder="e.g. Business expansion" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} required />
              </CardContent>
            </Card>

            {/* Loan Terms */}
            <Card>
              <CardHeader><CardTitle>Loan Terms</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Loan Amount (RWF)"
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    required
                  />
                  <Input
                    label="Interest Rate (% / month)"
                    type="number"
                    step="0.1"
                    value={form.interestRate}
                    onChange={(e) => setForm((f) => ({ ...f, interestRate: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Interest Type"
                    options={[{ value: "declining", label: "Declining Balance" }, { value: "flat", label: "Flat Rate" }]}
                    value={form.interestType}
                    onChange={(e) => setForm((f) => ({ ...f, interestType: e.target.value as "flat" | "declining" }))}
                  />
                  <Select
                    label="Payment Frequency"
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "biweekly", label: "Bi-weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  />
                </div>
                <Input
                  label="Number of Installments"
                  type="number"
                  value={form.installments}
                  onChange={(e) => setForm((f) => ({ ...f, installments: Number(e.target.value) }))}
                  required
                />
              </CardContent>
            </Card>

            {/* Fees */}
            <Card>
              <CardHeader className="items-center justify-between">
                <CardTitle>Fees & Charges</CardTitle>
                <Button type="button" variant="outline" size="sm" icon={<Plus className="w-3 h-3" />} onClick={addFee}>Add Fee</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnimatePresence>
                  {fees.map((fee) => (
                    <motion.div
                      key={fee.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-4">
                        <Input
                          label="Fee Name"
                          value={fee.name}
                          onChange={(e) => updateFee(fee.id, "name", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Select
                          label="Type"
                          options={[{ value: "fixed", label: "Fixed (RWF)" }, { value: "percentage", label: "Percentage (%)" }]}
                          value={fee.type}
                          onChange={(e) => updateFee(fee.id, "type", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          label="Value"
                          type="number"
                          value={fee.value}
                          onChange={(e) => updateFee(fee.id, "value", Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-1 flex items-center pb-1.5">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fee.isRecurring}
                            onChange={(e) => updateFee(fee.id, "isRecurring", e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-xs text-gray-500">Recurring</span>
                        </label>
                      </div>
                      <div className="col-span-1 pb-1.5">
                        <button type="button" onClick={() => removeFee(fee.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Link href="/loans"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" loading={loading}>Submit for Approval</Button>
            </div>
          </div>

          {/* Summary Card */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="sticky top-6">
              <CardHeader className="flex-row items-center gap-2">
                <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                <CardTitle>Loan Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {calc ? (
                  <>
                    <div className="space-y-2.5">
                      {[
                        { label: "Loan Amount", value: formatCurrency(form.amount), highlight: false },
                        { label: "Disbursed Amount", value: formatCurrency(calc.disbursedAmount), highlight: false },
                        { label: "Monthly Payment", value: formatCurrency(calc.monthlyPayment), highlight: true },
                        { label: "Total Interest", value: formatCurrency(calc.totalInterest), highlight: false },
                        { label: "Total Repayable", value: formatCurrency(calc.totalRepayable), highlight: true },
                      ].map((item) => (
                        <div key={item.label} className={`flex justify-between items-center py-1.5 ${item.highlight ? "border-t border-gray-100 dark:border-gray-800 mt-1 pt-2.5" : ""}`}>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                          <span className={`text-sm font-${item.highlight ? "bold" : "medium"} text-gray-900 dark:text-gray-100`}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">{form.installments} × {formatCurrency(calc.monthlyPayment)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{form.frequency} installments</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Fill in loan details to see summary</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
