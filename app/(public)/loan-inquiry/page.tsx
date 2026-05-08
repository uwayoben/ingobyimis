"use client";
import { useState } from "react";
import { Search, AlertTriangle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, ArrowLeft, Loader2, Printer } from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-RW", { day: "2-digit", month: "short", year: "numeric" });
}

function freqLabel(days: number) {
  if (days === 1)  return "Daily";
  if (days === 7)  return "Weekly";
  if (days === 14) return "Bi-weekly";
  if (days === 30) return "Monthly";
  return `Every ${days} days`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: "Pending",    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",       icon: <Clock className="w-3.5 h-3.5" /> },
  approved:   { label: "Approved",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  disbursed:  { label: "Disbursed",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  active:     { label: "Active",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  overdue:    { label: "Overdue",    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",        icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  completed:  { label: "Completed",  color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:   { label: "Rejected",   color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",        icon: <XCircle className="w-3.5 h-3.5" /> },
  written_off:{ label: "Written Off",color: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",       icon: <XCircle className="w-3.5 h-3.5" /> },
};

const INST_COLOR: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── types ──────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  principal: number;
  interest: number;
  penalty: number;
}

interface Installment {
  installmentNo: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  amountPaid: number;
  paidDate: string | null;
  status: string;
}

interface LoanData {
  id: string;
  customerName: string;
  status: string;
  amount: number;
  disbursedAmount: number;
  disbursementDate: string | null;
  totalRepayable: number;
  annualInterestRate: number;
  interestMethod: string;
  repaymentFrequencyDays: number;
  totalInstallments: number;
  installmentsPaid: number;
  amountRepaidPrincipal: number;
  amountRepaidInterest: number;
  totalPaid: number;
  balanceOutstanding: number;
  remainingInterest: number;
  totalOutstanding: number;
  penaltyAmount: number;
  nextPaymentDate: string | null;
  nextPaymentAmount: number;
  agreedMaturityDate: string;
  firstPaymentDate: string | null;
  daysOverdue: number;
  loanClass: string;
  fees: { name: string; type: string; value: number; isRecurring: boolean }[];
  installments: Installment[];
  payments: Payment[];
}

// ── sub-components ─────────────────────────────────────────────────────────────

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <p className={`text-base font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function ScheduleTable({ installments }: { installments: Installment[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? installments : installments.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Repayment Schedule</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{installments.length} installments total</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {["#", "Due Date", "Principal", "Interest", "Total", "Paid", "Status"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((row) => (
              <tr key={row.installmentNo} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{row.installmentNo}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{fmtDate(row.dueDate)}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">{fmt(row.principalDue)}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">{fmt(row.interestDue)}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 text-xs whitespace-nowrap">{fmt(row.totalDue)}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                  {row.amountPaid > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(row.amountPaid)}</span>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${INST_COLOR[row.status] ?? INST_COLOR.pending}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {installments.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-xs text-green-700 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 flex items-center justify-center gap-1 border-t border-gray-100 dark:border-gray-800 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {installments.length} installments</>}
        </button>
      )}
    </div>
  );
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  const [expanded, setExpanded] = useState(false);
  if (payments.length === 0) return null;
  const visible = expanded ? payments : payments.slice(0, 5);
  const methodLabel = (m: string) => m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Payment History</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{payments.length} payment{payments.length !== 1 ? "s" : ""} recorded</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {["Date", "Amount", "Principal", "Interest", "Penalty", "Method", "Reference"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{fmtDate(p.date)}</td>
                <td className="px-3 py-2.5 font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-xs">{fmt(p.amount)}</td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{fmt(p.principal)}</td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{fmt(p.interest)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                  {p.penalty > 0 ? <span className="text-red-600 dark:text-red-400">{fmt(p.penalty)}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">{methodLabel(p.method)}</td>
                <td className="px-3 py-2.5 font-mono text-gray-500 dark:text-gray-500 text-[11px] whitespace-nowrap">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-xs text-green-700 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 flex items-center justify-center gap-1 border-t border-gray-100 dark:border-gray-800 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {payments.length} payments</>}
        </button>
      )}
    </div>
  );
}

function LoanResult({ loan, onReset }: { loan: LoanData; onReset: () => void }) {
  const statusCfg = STATUS_CONFIG[loan.status] ?? STATUS_CONFIG.pending;
  const progressPct = loan.totalInstallments > 0
    ? Math.min(100, (loan.installmentsPaid / loan.totalInstallments) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-green-300 text-xs font-medium mb-1">Loan Statement</p>
            <h2 className="text-xl font-bold">{loan.customerName}</h2>
            <p className="text-green-300 text-xs mt-1 font-mono">{loan.id.toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors print:hidden"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-green-400 text-xs">Loan Amount</p>
            <p className="font-semibold">{fmt(loan.amount)}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs">Interest Rate</p>
            <p className="font-semibold">{loan.annualInterestRate}% / year ({loan.interestMethod})</p>
          </div>
          <div>
            <p className="text-green-400 text-xs">Frequency</p>
            <p className="font-semibold">{freqLabel(loan.repaymentFrequencyDays)}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs">First Payment</p>
            <p className="font-semibold">{fmtDate(loan.firstPaymentDate)}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs">Maturity Date</p>
            <p className="font-semibold">{fmtDate(loan.agreedMaturityDate)}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs">Loan Class</p>
            <p className="font-semibold">{loan.loanClass}</p>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KPI label="Total Repayable"    value={fmt(loan.totalRepayable)}         color="text-blue-600 dark:text-blue-400" />
        <KPI label="Total Paid"         value={fmt(loan.totalPaid)}              color="text-emerald-600 dark:text-emerald-400" />
        <KPI label="Principal Repaid"   value={fmt(loan.amountRepaidPrincipal)}  color="text-green-600 dark:text-green-400" />
        <KPI label="Interest Repaid"    value={fmt(loan.amountRepaidInterest)}   color="text-amber-600 dark:text-amber-400" />
        <KPI label="Balance (Principal)"value={fmt(loan.balanceOutstanding)}     color={loan.balanceOutstanding > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"} />
        <KPI label="Total Outstanding"  value={fmt(loan.totalOutstanding)}       color={loan.totalOutstanding > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"} />
      </div>

      {/* Progress + next payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Progress */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span>{loan.installmentsPaid} of {loan.totalInstallments} installments paid</span>
            <span>{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {loan.daysOverdue > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {loan.daysOverdue} day{loan.daysOverdue !== 1 ? "s" : ""} overdue
            </p>
          )}
          {loan.status === "completed" && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Loan fully repaid
            </p>
          )}
        </div>

        {/* Next payment */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Next Payment Due</p>
          {loan.nextPaymentDate && loan.status !== "completed" ? (
            <>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(loan.nextPaymentAmount)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(loan.nextPaymentDate)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">
              {loan.status === "completed" ? "No payment due — loan completed." : "No upcoming payment scheduled."}
            </p>
          )}
          {loan.penaltyAmount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Penalty accrued: {fmt(loan.penaltyAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Outstanding breakdown (only when something is owed) */}
      {loan.totalOutstanding > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-3">Outstanding Breakdown</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Principal balance</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(loan.balanceOutstanding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Remaining interest</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(loan.remainingInterest)}</span>
            </div>
            {loan.penaltyAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-red-600 dark:text-red-400">Penalty charges</span>
                <span className="font-medium text-red-600 dark:text-red-400">{fmt(loan.penaltyAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-red-200 dark:border-red-800/40">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Total to pay off</span>
              <span className="font-bold text-red-700 dark:text-red-400">{fmt(loan.totalOutstanding)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fees */}
      {loan.fees.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Loan Fees</p>
          <div className="space-y-1.5">
            {loan.fees.map((fee, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {fee.name}
                  {fee.isRecurring && <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">recurring</span>}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {fee.type === "percentage" ? `${fee.value}%` : fmt(fee.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <PaymentHistory payments={loan.payments} />

      {/* Schedule */}
      <ScheduleTable installments={loan.installments} />

      {/* Search again */}
      <button
        onClick={onReset}
        className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Check another loan
      </button>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function LoanInquiryPage() {
  const [loanId, setLoanId]   = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [loan, setLoan]       = useState<LoanData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loanId.trim() || !phone.trim()) {
      setError("Please enter both your Loan ID and phone number.");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/public/loan-inquiry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ loanId: loanId.trim().toLowerCase(), phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Loan not found or phone number does not match.");
        return;
      }
      setLoan(json.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLoan(null);
    setError("");
    setLoanId("");
    setPhone("");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-600 mb-4">
            <Search className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loan Statement</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enter your Loan ID and registered phone number to view your loan details.
          </p>
        </div>

        {!loan ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Loan ID
                </label>
                <input
                  type="text"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="e.g. CM9XABCDE12345"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your Loan ID is printed on your loan agreement.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0788 123 456"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The phone number you registered with.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3.5 py-3 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
                ) : (
                  <><Search className="w-4 h-4" /> View Loan Statement</>
                )}
              </button>
            </form>
          </div>
        ) : (
          <LoanResult loan={loan} onReset={handleReset} />
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
          ipfundoMIS · Powered by CREDLY SOFTWARE SOLUTIONS
        </p>
      </div>
    </div>
  );
}
