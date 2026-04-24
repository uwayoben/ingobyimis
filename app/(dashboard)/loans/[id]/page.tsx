"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Printer, ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LOANS, CUSTOMERS, generateAmortization, formatCurrency } from "@/lib/mock-data";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const loan = LOANS.find((l) => l.id === id);
  if (!loan) notFound();

  const customer = CUSTOMERS.find((c) => c.id === loan.customerId);
  const amortization = generateAmortization(
    loan.amount, loan.interestRate, loan.installments,
    loan.interestType, loan.disbursedAt || loan.createdAt, loan.paidInstallments
  );

  const [activeTab, setActiveTab] = useState<"overview" | "amortization" | "contract">("overview");
  const [approveModal, setApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleApprove = () => {
    setApproving(true);
    setTimeout(() => { setApproving(false); setApproveModal(false); }, 1500);
  };

  const progressPct = loan.installments > 0 ? (loan.paidInstallments / loan.installments) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Loan {loan.id.toUpperCase()}</h2>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[loan.status])}>
              {STATUS_LABELS[loan.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{loan.purpose} · Created {formatDate(loan.createdAt)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {loan.status === "pending" && (
            <>
              <Button variant="danger" size="sm" icon={<XCircle className="w-4 h-4" />}>Reject</Button>
              <Button size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setApproveModal(true)}>Approve</Button>
            </>
          )}
          {loan.status === "approved" && (
            <Button size="sm" icon={<ArrowDownToLine className="w-4 h-4" />}>Disburse</Button>
          )}
          <Button variant="outline" size="sm" icon={<Printer className="w-4 h-4" />}>Print Contract</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["overview", "amortization", "contract"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeTab === t
                ? "border-green-600 text-green-600 dark:text-green-400 dark:border-green-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {t === "amortization" ? "Amortization Table" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Loan Amount", value: formatCurrency(loan.amount), color: "text-gray-900 dark:text-gray-100" },
              { label: "Disbursed", value: loan.disbursedAmount > 0 ? formatCurrency(loan.disbursedAmount) : "—", color: "text-green-600 dark:text-green-400" },
              { label: "Total Paid", value: formatCurrency(loan.totalPaid), color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Outstanding", value: formatCurrency(loan.outstandingBalance), color: "text-red-600 dark:text-red-400" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Progress */}
          {loan.status === "active" && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>{loan.paidInstallments} of {loan.installments} installments paid</span>
                  <span>{progressPct.toFixed(0)}% complete</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-green-600 rounded-full"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loan Details */}
            <Card>
              <CardHeader><CardTitle>Loan Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {[
                    { label: "Customer", value: loan.customerName },
                    { label: "Interest Rate", value: `${loan.interestRate}% / month (${loan.interestType})` },
                    { label: "Payment Frequency", value: loan.frequency },
                    { label: "Installments", value: `${loan.installments} months` },
                    { label: "Next Payment", value: loan.status === "active" ? `${formatDate(loan.nextPaymentDate)} · ${formatCurrency(loan.nextPaymentAmount)}` : "—" },
                    { label: "Due Date", value: formatDate(loan.dueDate) },
                    { label: "Total Repayable", value: formatCurrency(loan.totalRepayable) },
                    ...(loan.penaltyAmount > 0 ? [{ label: "Penalty", value: formatCurrency(loan.penaltyAmount) }] : []),
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-start gap-4">
                      <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.label}</dt>
                      <dd className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Fees & Workflow */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Fees</CardTitle></CardHeader>
                <CardContent>
                  {loan.fees.length === 0 ? (
                    <p className="text-xs text-gray-400">No fees applied</p>
                  ) : (
                    <div className="space-y-2">
                      {loan.fees.map((fee) => (
                        <div key={fee.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{fee.name}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {fee.type === "fixed" ? formatCurrency(fee.value) : `${fee.value}%`}
                            {fee.isRecurring && <Badge variant="neutral" className="ml-1">Recurring</Badge>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Created", date: loan.createdAt, done: true },
                      { label: "Approved", date: loan.approvedAt, done: !!loan.approvedAt },
                      { label: "Disbursed", date: loan.disbursedAt, done: !!loan.disbursedAt },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs", step.done ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                          {step.done ? "✓" : i + 1}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{step.label}</p>
                          {step.date && <p className="text-xs text-gray-400">{formatDate(step.date)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      )}

      {/* Amortization Tab */}
      {activeTab === "amortization" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule — {loan.installments} installments</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    {["#", "Date", "Opening Balance", "Principal", "Interest", "Total Payment", "Closing Balance", "Status"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {amortization.map((row) => (
                    <tr
                      key={row.installmentNo}
                      className={cn(
                        "transition-colors text-xs",
                        row.status === "paid" ? "bg-emerald-50/50 dark:bg-emerald-900/5" :
                        row.installmentNo === loan.paidInstallments + 1 ? "bg-green-50/50 dark:bg-green-900/5" : "",
                        "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.installmentNo}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{formatDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{formatCurrency(row.openingBalance)}</td>
                      <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">{formatCurrency(row.principal)}</td>
                      <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400">{formatCurrency(row.interest)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.totalPayment)}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{formatCurrency(row.closingBalance)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={row.status === "paid" ? "success" : row.installmentNo === loan.paidInstallments + 1 ? "info" : "neutral"}>
                          {row.status === "paid" ? "Paid" : row.installmentNo === loan.paidInstallments + 1 ? "Next" : "Pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Contract Tab */}
      {activeTab === "contract" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="py-8">
              <div className="max-w-2xl mx-auto space-y-6 text-sm text-gray-700 dark:text-gray-300">
                <div className="text-center border-b border-gray-200 dark:border-gray-800 pb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">LOAN AGREEMENT</h3>
                  <p className="text-gray-500 mt-1">Ingobyi Finance Ltd</p>
                  <p className="text-xs text-gray-400 mt-0.5">KG 12 Ave, Kigali, Rwanda · REG: RDB/2023/000123</p>
                </div>

                <div className="space-y-1">
                  <p><strong>Loan Reference:</strong> {loan.id.toUpperCase()}</p>
                  <p><strong>Date:</strong> {formatDate(loan.createdAt)}</p>
                  <p><strong>Borrower:</strong> {loan.customerName}</p>
                  {customer && <p><strong>National ID:</strong> {customer.nationalId}</p>}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Loan Terms</h4>
                  <p>Principal Amount: <strong>{formatCurrency(loan.amount)}</strong></p>
                  <p>Interest Rate: <strong>{loan.interestRate}% per month ({loan.interestType} balance)</strong></p>
                  <p>Repayment Period: <strong>{loan.installments} {loan.frequency} installments</strong></p>
                  <p>Monthly Payment: <strong>{formatCurrency(loan.nextPaymentAmount)}</strong></p>
                  <p>Total Repayable: <strong>{formatCurrency(loan.totalRepayable)}</strong></p>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  The borrower agrees to repay the loan in the installments specified above. Late payment will attract a penalty of 1% per day on the overdue amount. The lender reserves the right to demand full repayment upon default. This agreement is governed by the laws of Rwanda and the regulations of the National Bank of Rwanda (BNR).
                </p>

                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Borrower Signature</p>
                    <p className="text-xs font-medium">{loan.customerName}</p>
                  </div>
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Lender Representative</p>
                    <p className="text-xs font-medium">Ingobyi Finance Ltd</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Approve Modal */}
      <Modal isOpen={approveModal} onClose={() => setApproveModal(false)} title="Approve Loan" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You are about to approve the loan of <strong>{formatCurrency(loan.amount)}</strong> for <strong>{loan.customerName}</strong>. After approval, the loan will be ready for disbursement.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button loading={approving} onClick={handleApprove} icon={<CheckCircle2 className="w-4 h-4" />}>
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
