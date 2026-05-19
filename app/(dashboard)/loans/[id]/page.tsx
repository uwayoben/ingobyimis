"use client";
import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, Printer, ArrowDownToLine, Loader2,
  AlertTriangle, Banknote, TrendingDown, CreditCard, ArrowDownUp, FileText, ExternalLink,
  MinusCircle, TrendingUp, Upload, X, Receipt,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Loan, Installment, Payment } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import { useRole } from "@/components/RoleContext";

function formatCurrency(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}

function loanPeriodRate(loan: Loan): number {
  return loan.annualInterestRate / 100 / (360 / loan.repaymentFrequencyDays);
}

function interestRemaining(loan: Loan): number {
  const totalMgmtFeeScheduled = loan.totalMgmtFeeScheduled ?? 0;
  return Math.max(0, (loan.totalRepayable - loan.amount - totalMgmtFeeScheduled) - loan.amountRepaidInterest);
}

function mgmtFeeRemaining(loan: Loan): number {
  return Math.max(0, (loan.totalMgmtFeeScheduled ?? 0) - (loan.amountRepaidMgmtFee ?? 0));
}

function trueOutstanding(loan: Loan): number {
  return loan.balanceOutstanding + interestRemaining(loan) + mgmtFeeRemaining(loan) + loan.penaltyAmount;
}

const INSTALLMENT_STATUS_COLOR: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const CLASS_COLOR: Record<string, string> = {
  Normal:      "text-emerald-600 dark:text-emerald-400",
  Watch:       "text-amber-600 dark:text-amber-400",
  Substandard: "text-orange-600 dark:text-orange-400",
  Doubtful:    "text-red-600 dark:text-red-400",
  Loss:        "text-red-800 dark:text-red-300",
};

const CLASS_BADGE: Record<string, string> = {
  Normal:      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Watch:       "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Substandard: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Doubtful:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Loss:        "bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id:       "National ID",
  passport:          "Passport",
  employment_letter: "Employment Letter",
  bank_statement:    "Bank Statement",
  collateral_proof:  "Collateral Proof",
  other:             "Other",
};

const METHOD_CONFIG: Record<string, { variant: "success" | "info" | "neutral"; label: string }> = {
  cash:          { variant: "success", label: "Cash" },
  bank_transfer: { variant: "info",    label: "Bank Transfer" },
  mobile_money:  { variant: "neutral", label: "Mobile Money" },
};

// ── Record Payment Form ────────────────────────────────────────────────────────
function RecordPaymentForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount]           = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod]           = useState("cash");
  const [reference, setReference]     = useState("");
  const [notes, setNotes]             = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const penalty      = loan.penaltyAmount;
  const totalOuts    = trueOutstanding(loan);
  const amt          = Math.min(Number(amount) || 0, totalOuts);

  const periodsPerYear   = 360 / loan.repaymentFrequencyDays;
  const periodRate       = Number(loan.annualInterestRate)     / 100 / periodsPerYear;
  const mgmtFeePeriodRate = Number(loan.managementFeeRate ?? 0) / 100 / periodsPerYear;

  const totalMgmtFeeScheduled = loan.totalMgmtFeeScheduled ?? 0;
  const remainingMgmtFee      = mgmtFeeRemaining(loan);
  const periodMgmtFee         = loan.balanceOutstanding > 0
    ? Math.round(loan.balanceOutstanding * mgmtFeePeriodRate) : remainingMgmtFee;
  const currentMgmtFee = Math.min(periodMgmtFee, remainingMgmtFee);

  const remainingInt   = interestRemaining(loan);
  const periodInterest = loan.balanceOutstanding > 0
    ? Math.round(loan.balanceOutstanding * periodRate) : remainingInt;
  const currentInt     = Math.min(periodInterest, remainingInt);

  const isPayoffPreview = amt >= (penalty + remainingMgmtFee + remainingInt + loan.balanceOutstanding);

  let remaining0      = amt;
  const penaltyPaid   = Math.min(remaining0, penalty);        remaining0 -= penaltyPaid;
  const mgmtFeePreview = Math.min(remaining0, isPayoffPreview ? remainingMgmtFee : currentMgmtFee); remaining0 -= mgmtFeePreview;
  const interest      = Math.min(remaining0, isPayoffPreview ? remainingInt : currentInt);          remaining0 -= interest;
  const principal     = remaining0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!amount || !reference) { setError("Amount and reference are required."); return; }
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) { setError("Enter a valid amount."); return; }

    let receiptUrl: string | undefined;

    if (receiptFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", receiptFile);
        fd.append("folder", "receipts");
        const upRes  = await apiFetch("/api/v1/uploads", { method: "POST", body: fd });
        const upJson = await upRes.json();
        if (!upRes.ok) { setError(upJson.error || "Receipt upload failed."); setUploading(false); return; }
        receiptUrl = upJson.data?.url;
      } catch {
        setError("Receipt upload failed. Please try again.");
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId: loan.id, amount: parsed, date: paymentDate, method, reference, notes: notes || undefined, receiptUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to record payment."); return; }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Penalty status */}
      {penalty > 0 ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Unpaid Penalty: {formatCurrency(penalty)}</p>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 ml-6">Penalties are settled first before interest and principal.</p>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">No outstanding penalties</p>
        </div>
      )}

      {/* Outstanding summary */}
      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 text-xs">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Outstanding Summary</p>
        <div className="flex justify-between">
          <span className="text-gray-500">Principal Outstanding</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(loan.balanceOutstanding)}</span>
        </div>
        {remainingMgmtFee > 0 && (
          <div className="flex justify-between">
            <span className="text-purple-500 dark:text-purple-400">Management Fee Remaining</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(remainingMgmtFee)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Interest Remaining</span>
          <span className={cn("font-semibold", remainingInt > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400")}>
            {formatCurrency(remainingInt)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={penalty > 0 ? "text-red-500 dark:text-red-400" : "text-gray-500"}>Unpaid Penalty</span>
          <span className={cn("font-semibold", penalty > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400")}>{formatCurrency(penalty)}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 flex justify-between">
          <span className="font-bold text-gray-700 dark:text-gray-300">TOTAL OUTSTANDING</span>
          <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOuts)}</span>
        </div>
      </div>

      {/* Amount */}
      <Input
        label={`Payment Amount (RWF) — max ${formatCurrency(totalOuts)}`}
        type="number"
        min="1"
        max={totalOuts}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {/* Allocation preview */}
      {amt > 0 && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50 rounded-xl p-3 text-xs space-y-2">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Auto-allocation preview</p>
          {penaltyPaid > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Penalty</span>
              <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(penaltyPaid)}</span>
            </div>
          )}
          {mgmtFeePreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Management Fee</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(mgmtFeePreview)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">→ Interest</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(interest)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">→ Principal</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(principal)}</span>
          </div>
        </div>
      )}

      <Input
        label="Payment Date"
        type="date"
        value={paymentDate}
        onChange={(e) => setPaymentDate(e.target.value)}
        required
        hint="Backdate if recording a delayed payment"
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Payment Method"
          options={[
            { value: "cash",          label: "Cash" },
            { value: "bank_transfer", label: "Bank Transfer" },
            { value: "mobile_money",  label: "Mobile Money" },
          ]}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />
        <Input
          label="Reference / Receipt #"
          placeholder="e.g. RCP-001"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
        />
      </div>

      <Textarea
        label="Notes (optional)"
        placeholder="Optional payment notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Receipt upload */}
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Receipt (optional)</p>
        {receiptFile ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10">
            <Receipt className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300 flex-1 truncate">{receiptFile.name}</span>
            <button
              type="button"
              onClick={() => setReceiptFile(null)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40 cursor-pointer hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all">
            <Upload className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Click to upload receipt (JPG, PNG, PDF — max 5 MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          loading={uploading || loading}
          icon={<Banknote className="w-4 h-4" />}
        >
          {uploading ? "Uploading receipt…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}

// ── Waiver Form ───────────────────────────────────────────────────────────────
function WaiverForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [amount,  setAmount]  = useState(String(loan.penaltyAmount));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const waivedAmt   = Math.min(Math.max(0, Number(amount) || 0), loan.penaltyAmount);
  const remaining   = loan.penaltyAmount - waivedAmt;
  const isFullWaive = waivedAmt === loan.penaltyAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reason.trim()) { setError("A reason is required."); return; }
    if (!waivedAmt || waivedAmt <= 0) { setError("Enter a valid waiver amount."); return; }
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/v1/loans/${loan.id}/waive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, amount: waivedAmt }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Waiver failed."); return; }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1 text-xs">
        <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Outstanding Penalty</p>
        <div className="flex justify-between items-center">
          <span className="text-red-600 dark:text-red-400">Total Penalty Balance</span>
          <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(loan.penaltyAmount)}</span>
        </div>
        {loan.penaltyWaived > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-500 dark:text-gray-400">Previously Waived</span>
            <span className="font-medium text-gray-600 dark:text-gray-400">{formatCurrency(loan.penaltyWaived)}</span>
          </div>
        )}
      </div>

      <Input
        label={`Amount to Waive (RWF) — max ${formatCurrency(loan.penaltyAmount)}`}
        type="number"
        min="1"
        max={loan.penaltyAmount}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {waivedAmt > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount to Write Off</span>
            <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(waivedAmt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Penalty Remaining After Waiver</span>
            <span className={cn("font-semibold", remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {remaining > 0 ? formatCurrency(remaining) : "None"}
            </span>
          </div>
          {!isFullWaive && (
            <p className="text-amber-700 dark:text-amber-400 pt-0.5">Partial waiver — {formatCurrency(remaining)} will still be owed.</p>
          )}
          {isFullWaive && (
            <p className="text-emerald-700 dark:text-emerald-400 pt-0.5">Full waiver — penalty will be completely cleared.</p>
          )}
        </div>
      )}

      <Textarea
        label="Reason (required)"
        placeholder="State the reason for waiving this penalty..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} variant="danger" icon={<MinusCircle className="w-4 h-4" />}>
          {isFullWaive ? "Waive Full Penalty" : "Waive Partial Penalty"}
        </Button>
      </div>
    </form>
  );
}

// ── Top Up Form ───────────────────────────────────────────────────────────────
function TopUpForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [topUpType,       setTopUpType]       = useState<"addon" | "refinance">("addon");
  const [topUpAmount,     setTopUpAmount]     = useState("");
  const [newInstallments, setNewInstallments] = useState(
    String(loan.totalInstallments - loan.installmentsPaid || loan.totalInstallments)
  );
  const [firstPaymentDate, setFirstPaymentDate] = useState(defaultDate);
  const [newRate,           setNewRate]          = useState(String(loan.annualInterestRate / 12));
  const [loading,           setLoading]          = useState(false);
  const [error,             setError]            = useState("");

  const outstanding = loan.balanceOutstanding;
  const topUp       = Math.max(0, Number(topUpAmount) || 0);
  const n           = Math.max(1, Number(newInstallments) || 1);
  // rate is the monthly interest rate entered by the user
  const rate        = Math.max(0.01, Number(newRate) || (loan.annualInterestRate / 12));
  // convert monthly rate to period rate using 30-day month convention
  const periodRate  = (rate / 100) * (loan.repaymentFrequencyDays / 30);

  // New principal depends on type
  const newPrincipal = topUpType === "addon"
    ? outstanding + topUp               // add-on: stack on top of outstanding
    : topUp;                            // refinance: top-up IS the new loan

  const cashToClient = topUpType === "addon"
    ? topUp                             // client receives the extra amount
    : Math.max(0, topUp - outstanding); // client receives surplus after clearing old balance

  // Live repayment calculation on newPrincipal (same formula as a normal loan)
  let newInstallmentAmt = 0;
  let newTotalRepayable = 0;
  if (newPrincipal > 0) {
    if (loan.interestMethod === "flat") {
      const totalInterest = newPrincipal * periodRate * n;
      newTotalRepayable   = Math.round(newPrincipal + totalInterest);
      newInstallmentAmt   = Math.round(newTotalRepayable / n);
    } else {
      const exactEmi    = periodRate === 0
        ? newPrincipal / n
        : (newPrincipal * periodRate) / (1 - Math.pow(1 + periodRate, -n));
      newInstallmentAmt = Math.round(exactEmi);
      newTotalRepayable = Math.round(exactEmi * n);
    }
  }

  const newMaturityDate = (() => {
    if (!firstPaymentDate) return "—";
    const d = new Date(firstPaymentDate);
    d.setDate(d.getDate() + (n - 1) * loan.repaymentFrequencyDays);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!topUp || topUp <= 0) { setError("Top-up amount must be greater than zero."); return; }
    if (topUpType === "refinance" && topUp < outstanding) {
      setError(`Refinance amount must be at least the outstanding balance (${formatCurrency(outstanding)}).`);
      return;
    }
    if (!firstPaymentDate) { setError("First payment date is required."); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/loans/${loan.id}/topup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topUpType,
          topUpAmount:           topUp,
          newTotalInstallments:  n,
          newFirstPaymentDate:   firstPaymentDate,
          newAnnualInterestRate: Number(newRate) * 12,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Top-up failed."); return; }
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const freqLabel = loan.repaymentFrequencyDays === 30 ? "Monthly"
    : loan.repaymentFrequencyDays === 7 ? "Weekly"
    : `Every ${loan.repaymentFrequencyDays}d`;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Type selector */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top-Up Type</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              value: "addon",
              label: "Add-on",
              desc: "Top-up amount is added to the existing outstanding balance. Client receives the extra cash.",
            },
            {
              value: "refinance",
              label: "Refinance",
              desc: "Top-up amount replaces the entire outstanding balance. Client receives the surplus as cash.",
            },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setTopUpType(opt.value); setError(""); }}
              className={cn(
                "text-left rounded-xl border p-3 transition-all",
                topUpType === opt.value
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <p className={cn("text-xs font-bold mb-0.5", topUpType === opt.value ? "text-green-700 dark:text-green-400" : "text-gray-800 dark:text-gray-200")}>
                {opt.label}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Current state summary */}
      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 text-xs">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Current Loan State</p>
        <div className="flex justify-between">
          <span className="text-gray-500">Outstanding Principal</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(outstanding)}</span>
        </div>
        {loan.penaltyAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-red-500">Accrued Penalty (will be cleared)</span>
            <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(loan.penaltyAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Installments Paid</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{loan.installmentsPaid} of {loan.totalInstallments}</span>
        </div>
      </div>

      {/* Top-up amount */}
      <Input
        label={topUpType === "addon" ? "Amount to Add (RWF)" : "New Loan Amount / Refinance Amount (RWF)"}
        type="number"
        min="1"
        placeholder="e.g. 5000000"
        value={topUpAmount}
        onChange={(e) => setTopUpAmount(e.target.value)}
        required
      />

      {/* Principal breakdown preview */}
      {topUp > 0 && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-xl p-3 text-xs space-y-1.5">
          <p className="font-semibold text-gray-700 dark:text-gray-300">
            {topUpType === "addon" ? "New Principal Breakdown" : "Refinance Breakdown"}
          </p>
          {topUpType === "addon" ? (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Outstanding Balance</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(outstanding)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">+ Top-Up Amount (cash to client)</span>
                <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(topUp)}</span>
              </div>
              <div className="border-t border-green-200 dark:border-green-800/50 pt-1.5 flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-300">= New Principal</span>
                <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(newPrincipal)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">New Loan Amount</span>
                <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(topUp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">— Covers Outstanding Balance</span>
                <span className="font-medium text-red-600 dark:text-red-400">− {formatCurrency(outstanding)}</span>
              </div>
              <div className="border-t border-green-200 dark:border-green-800/50 pt-1.5 flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-300">= Cash to Client</span>
                <span className={cn("font-bold", cashToClient > 0 ? "text-green-700 dark:text-green-400" : "text-gray-400")}>
                  {cashToClient > 0 ? formatCurrency(cashToClient) : "—"}
                </span>
              </div>
              {topUp < outstanding && (
                <p className="text-red-600 dark:text-red-400 pt-1">
                  ⚠ Amount must be at least {formatCurrency(outstanding)} to cover the outstanding balance.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* New schedule inputs */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="New Installments Count"
          type="number"
          min="1"
          value={newInstallments}
          onChange={(e) => setNewInstallments(e.target.value)}
          required
        />
        <Input
          label="First Payment Date"
          type="date"
          value={firstPaymentDate}
          onChange={(e) => setFirstPaymentDate(e.target.value)}
          required
        />
      </div>

      <Input
        label={`Monthly Interest Rate (%) — current: ${loan.annualInterestRate / 12}%`}
        type="number"
        min="0.01"
        step="0.1"
        value={newRate}
        onChange={(e) => setNewRate(e.target.value)}
        required
      />

      {/* Schedule preview */}
      {topUp > 0 && newInstallmentAmt > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 space-y-2 text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">New Repayment Schedule Preview</p>
          <div className="flex justify-between">
            <span className="text-gray-500">New Principal</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(newPrincipal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Interest Method</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{loan.interestMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Interest</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(newTotalRepayable - newPrincipal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Repayable</span>
            <span className="font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(newTotalRepayable)}</span>
          </div>
          <div className="border-t border-blue-200 dark:border-blue-800/50 pt-1.5 flex justify-between">
            <span className="font-bold text-gray-700 dark:text-gray-300">{freqLabel} Installment</span>
            <span className="font-bold text-lg text-green-700 dark:text-green-400">{formatCurrency(newInstallmentAmt)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>New Maturity Date</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{newMaturityDate}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          loading={loading}
          icon={<TrendingUp className="w-4 h-4" />}
        >
          Confirm {topUpType === "addon" ? "Add-on" : "Refinance"} Top-Up
        </Button>
      </div>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useRole();

  const canApprove      = ["managing_director", "super_admin"].includes(role);
  const canDisburse     = ["managing_director", "loan_officer", "super_admin"].includes(role);
  const canRecordPayment = ["managing_director", "loan_officer", "super_admin"].includes(role);

  const [loan, setLoan]                 = useState<(Loan & { customer?: any; loanOfficer?: any; approvedBy?: any }) | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments]         = useState<(Payment & { recordedByName?: string })[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [activeTab, setActiveTab]       = useState<"overview" | "schedule" | "payments" | "documents" | "contract">("overview");
  const [actionModal, setActionModal]   = useState<"approve" | "reject" | "disburse" | null>(null);
  const [actioning, setActioning]       = useState(false);
  const [actionError, setActionError]   = useState("");
  const [showPayModal,      setShowPayModal]      = useState(false);
  const [showWaiveModal,    setShowWaiveModal]    = useState(false);
  const [showTopUpModal,    setShowTopUpModal]    = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loanRes, instRes, payRes] = await Promise.all([
        apiFetch(`/api/v1/loans/${id}`),
        apiFetch(`/api/v1/loans/${id}/installments`),
        apiFetch(`/api/v1/payments?loanId=${id}&limit=100`),
      ]);
      if (loanRes.status === 404) { setError("Loan not found."); return; }
      if (!loanRes.ok) { setError("Failed to load loan."); return; }
      const loanJson = await loanRes.json();
      setLoan(loanJson.data);
      if (instRes.ok) { const j = await instRes.json(); setInstallments(j.data ?? []); }
      if (payRes.ok)  { const j = await payRes.json();  setPayments(j.data ?? []); }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reclassify before loading so the detail page shows the current classification
  useEffect(() => {
    apiFetch("/api/v1/cron/classify-loans", { method: "POST" })
      .catch(() => {})
      .finally(() => fetchData());
  }, [fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (action: "approve" | "reject" | "disburse") => {
    setActioning(true);
    setActionError("");
    try {
      const body =
        action === "approve"  ? { status: "approved" } :
        action === "reject"   ? { status: "rejected" } :
        { status: "active" };
      const res  = await apiFetch(`/api/v1/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setActionError(json.error || "Action failed."); return; }
      setActionModal(null);
      fetchData();
    } catch {
      setActionError("Network error.");
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-gray-600 dark:text-gray-400">{error || "Loan not found."}</p>
        <Link href="/loans"><Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />}>Back to Loans</Button></Link>
      </div>
    );
  }

  const progressPct    = loan.totalInstallments > 0 ? (loan.installmentsPaid / loan.totalInstallments) * 100 : 0;
  const totalOuts      = trueOutstanding(loan);
  const intRemaining   = interestRemaining(loan);
  const totalPaid      = loan.amountRepaidPrincipal + loan.amountRepaidInterest + (loan.penaltyPaid ?? 0);
  const companyName   = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "NDF" : "NDF";
  const canPayment    = ["active", "overdue", "disbursed"].includes(loan.status) ||
    (loan.status === "completed" && trueOutstanding(loan) > 0);
  const canWaive      = canApprove && ["active", "overdue", "completed"].includes(loan.status) && loan.penaltyAmount > 0;
  const canTopUp      = canDisburse && ["active", "overdue"].includes(loan.status) && loan.balanceOutstanding > 0;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">{loan.id.slice(0, 12).toUpperCase()}</h2>
            <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[loan.status])}>
              {STATUS_LABELS[loan.status]}
            </span>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", CLASS_BADGE[loan.loanClass])}>
              {loan.loanClass}
            </span>
            {loan.isRestructured && <Badge variant="info" className="text-[10px]">Restructured</Badge>}
            {loan.topUpAmount > 0 && (
              <Badge variant="success" className="text-[10px]">Topped Up +{formatCurrency(loan.topUpAmount)}</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loan.purpose} · {loan.customer?.names ?? loan.customerName} · Created {formatDate(loan.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canTopUp && (
            <Button
              variant="outline"
              size="sm"
              icon={<TrendingUp className="w-4 h-4" />}
              onClick={() => setShowTopUpModal(true)}
            >
              Top Up
            </Button>
          )}
          {canWaive && (
            <Button
              variant="outline"
              size="sm"
              icon={<MinusCircle className="w-4 h-4" />}
              onClick={() => setShowWaiveModal(true)}
            >
              Waive
            </Button>
          )}
          {canPayment && canRecordPayment && (
            <Button
              size="sm"
              icon={<Banknote className="w-4 h-4" />}
              onClick={() => setShowPayModal(true)}
            >
              Record Payment
            </Button>
          )}
          {loan.status === "pending" && canApprove && (
            <>
              <Button variant="danger" size="sm" icon={<XCircle className="w-4 h-4" />} onClick={() => setActionModal("reject")}>Reject</Button>
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setActionModal("approve")}>Approve</Button>
            </>
          )}
          {loan.status === "approved" && canDisburse && (
            <Button size="sm" icon={<ArrowDownToLine className="w-4 h-4" />} onClick={() => setActionModal("disburse")}>Disburse</Button>
          )}
          <Button variant="outline" size="sm" icon={<FileText className="w-4 h-4" />} onClick={() => setShowContractModal(true)}>Loan Agreement</Button>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Loan Amount",       value: formatCurrency(loan.amount),               color: "text-gray-900 dark:text-gray-100",      border: "border-l-gray-400" },
          { label: "Total Repayable",   value: formatCurrency(loan.totalRepayable),        color: "text-blue-600 dark:text-blue-400",       border: "border-l-blue-500" },
          { label: "Total Paid",        value: formatCurrency(totalPaid),                  color: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
          { label: "Principal Repaid",  value: formatCurrency(loan.amountRepaidPrincipal), color: "text-green-600 dark:text-green-400",     border: "border-l-green-500" },
          { label: "Interest Repaid",   value: formatCurrency(loan.amountRepaidInterest),  color: "text-amber-600 dark:text-amber-400",     border: "border-l-amber-500" },
          { label: "Total Outstanding", value: formatCurrency(totalOuts),                  color: totalOuts > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400", border: totalOuts > 0 ? "border-l-red-500" : "border-l-gray-200" },
        ].map((s) => (
          <Card key={s.label} className={cn("border-l-4", s.border)}>
            <CardContent className="pt-3 pb-3">
              <p className={cn("text-base font-bold", s.color)}>{s.value}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Outstanding Summary (active/overdue) ──────────────────────── */}
      {["active", "overdue"].includes(loan.status) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Progress */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span>{loan.installmentsPaid} of {loan.totalInstallments} installments paid</span>
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
              {loan.daysOverdue > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {loan.daysOverdue} day{loan.daysOverdue !== 1 ? "s" : ""} overdue
                  {loan.arrearsStartDate ? ` · since ${formatDate(loan.arrearsStartDate)}` : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Outstanding breakdown */}
          <Card className={totalOuts > 0 ? "border-red-200 dark:border-red-800/50" : ""}>
            <CardContent className="pt-4 pb-4 space-y-2.5 text-xs">
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Balance Due</p>
              <div className="flex justify-between">
                <span className="text-gray-500">Principal Outstanding</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(loan.balanceOutstanding)}</span>
              </div>
              {mgmtFeeRemaining(loan) > 0 && (
                <div className="flex justify-between">
                  <span className="text-purple-500 dark:text-purple-400">Management Fee Remaining</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(mgmtFeeRemaining(loan))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">
                  {loan.interestMethod === "flat" ? "Interest Remaining" : "Interest (this period)"}
                </span>
                <span className={cn("font-semibold", intRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400")}>
                  {formatCurrency(intRemaining)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={loan.penaltyAmount > 0 ? "text-red-500 dark:text-red-400" : "text-gray-500"}>Unpaid Penalty</span>
                <span className={cn("font-semibold", loan.penaltyAmount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400")}>
                  {formatCurrency(loan.penaltyAmount)}
                </span>
              </div>
              {loan.penaltyWaived > 0 && (
                <div className="flex justify-between text-[11px] bg-amber-50 dark:bg-amber-900/10 rounded px-2 py-1 -mx-1">
                  <span className="text-amber-600 dark:text-amber-400">
                    Penalty Waived{loan.penaltyWaivedByName ? ` by ${loan.penaltyWaivedByName}` : ""}
                    {loan.penaltyWaivedAt ? ` · ${formatDate(loan.penaltyWaivedAt)}` : ""}
                  </span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(loan.penaltyWaived)}</span>
                </div>
              )}
              {loan.nextPaymentDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Next Due</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(loan.nextPaymentDate)} · {formatCurrency(loan.nextPaymentAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-300">TOTAL OUTSTANDING</span>
                <span className={cn("font-bold text-base", totalOuts > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                  {formatCurrency(totalOuts)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {(["overview", "schedule", "payments", "documents", "contract"] as const).map((t) => {
          const docs = (loan as any).documents ?? [];
          const label =
            t === "schedule"  ? "Payment Schedule" :
            t === "payments"  ? `Payments (${payments.length})` :
            t === "documents" ? `Documents (${docs.length})` :
            t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap",
                activeTab === t
                  ? "border-green-600 text-green-600 dark:text-green-400 dark:border-green-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Loan Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {[
                    { label: "Customer",       value: loan.customer?.names ?? loan.customerName },
                    { label: "Loan Officer",   value: loan.loanOfficer?.name ?? "—" },
                    { label: "Purpose",        value: loan.purpose },
                    { label: "Interest Rate",     value: `${loan.annualInterestRate / 12}%/month (${loan.interestMethod})` },
                    ...(loan.managementFeeRate > 0 ? [{ label: "Mgmt Fee Rate", value: `${loan.managementFeeRate / 12}%/month (per installment)` }] : []),
                    { label: "Repayment",      value: `${loan.repaymentFrequencyDays === 30 ? "Monthly" : loan.repaymentFrequencyDays === 7 ? "Weekly" : loan.repaymentFrequencyDays === 14 ? "Bi-weekly" : `Every ${loan.repaymentFrequencyDays}d`} · ${loan.totalInstallments} installments` },
                    { label: "First Payment",  value: loan.firstPaymentDate ? formatDate(loan.firstPaymentDate) : "—" },
                    { label: "Maturity Date",  value: formatDate(loan.agreedMaturityDate) },
                    { label: "Total Repayable",value: formatCurrency(loan.totalRepayable) },
                    ...(loan.branchName ? [{ label: "Branch", value: loan.branchName }] : []),
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-start gap-4">
                      <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.label}</dt>
                      <dd className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* BNR Classification */}
              <Card>
                <CardHeader><CardTitle>BNR Classification</CardTitle></CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    {[
                      { label: "Loan Class",         value: <span className={cn("font-bold", CLASS_COLOR[loan.loanClass])}>{loan.loanClass}</span> },
                      { label: "Provisioning Rate",  value: `${loan.provisioningRate}%` },
                      { label: "Provision Required", value: formatCurrency(loan.provisionRequired) },
                      { label: "Is Restructured",    value: loan.isRestructured ? "Yes" : "No" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-start gap-4">
                        <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.label}</dt>
                        <dd className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              {/* Collateral */}
              {loan.collateralType && (
                <Card>
                  <CardHeader><CardTitle>Collateral</CardTitle></CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      {[
                        { label: "Type",            value: loan.collateralType },
                        ...(loan.collateralAmount   ? [{ label: "Value",           value: formatCurrency(loan.collateralAmount) }]   : []),
                        ...(loan.eligibleCollateral ? [{ label: "Eligible Amount", value: formatCurrency(loan.eligibleCollateral) }] : []),
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between items-start gap-4">
                          <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.label}</dt>
                          <dd className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}

              {/* Workflow */}
              <Card>
                <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Created",   date: loan.createdAt,        done: true },
                      { label: "Approved",  date: loan.approvedAt,       done: !!loan.approvedAt },
                      { label: "Disbursed", date: loan.disbursementDate, done: !!loan.disbursementDate },
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

              {/* Fees */}
              {loan.fees && loan.fees.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Fees</CardTitle></CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Payment Schedule ──────────────────────────────────────────── */}
      {activeTab === "schedule" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment Schedule — {loan.totalInstallments} installments</CardTitle>
                <button
                  onClick={() => {
                    const rows = installments.map((r, i) => `
                      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"}">
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${r.installmentNo}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${new Date(r.dueDate).toLocaleDateString()}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#16a34a">RWF ${r.principalDue.toLocaleString()}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#d97706">RWF ${r.interestDue.toLocaleString()}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">RWF ${r.totalDue.toLocaleString()}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb">${r.amountPaid > 0 ? "RWF " + r.amountPaid.toLocaleString() : "—"}</td>
                        <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${r.status}</td>
                      </tr>`).join("");
                    const totalDue  = installments.reduce((s, r) => s + r.totalDue, 0);
                    const totalPrincipal = installments.reduce((s, r) => s + r.principalDue, 0);
                    const totalInterest  = installments.reduce((s, r) => s + r.interestDue, 0);
                    const w = window.open("", "_blank", "width=900,height=700");
                    if (!w) return;
                    w.document.write(`<!DOCTYPE html><html><head><title>Payment Schedule</title>
                      <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
                      table{width:100%;border-collapse:collapse}
                      th{background:#052e16;color:#fff;text-align:left;padding:9px 12px;font-size:11px}
                      tfoot td{background:#f0fdf4;font-weight:700;padding:9px 12px;border-top:2px solid #16a34a}
                      h2{margin:0 0 4px}p{margin:0 0 16px;color:#555;font-size:11px}
                      @media print{button{display:none}}</style></head>
                      <body>
                        <h2>Payment Schedule</h2>
                        <p>Loan: ${loan.id.toUpperCase()} &nbsp;·&nbsp; Customer: ${loan.customer?.names ?? ""} &nbsp;·&nbsp; ${loan.totalInstallments} installments</p>
                        <table>
                          <thead><tr>
                            <th>#</th><th>Due Date</th><th>Principal</th><th>Interest</th><th>Total Due</th><th>Amount Paid</th><th>Status</th>
                          </tr></thead>
                          <tbody>${rows}</tbody>
                          <tfoot><tr>
                            <td colspan="2">TOTALS</td>
                            <td>RWF ${totalPrincipal.toLocaleString()}</td>
                            <td>RWF ${totalInterest.toLocaleString()}</td>
                            <td>RWF ${totalDue.toLocaleString()}</td>
                            <td colspan="2"></td>
                          </tr></tfoot>
                        </table>
                        <script>window.onload=()=>window.print();</script>
                      </body></html>`);
                    w.document.close();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Schedule
                </button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              {(() => {
                const hasMgmtFee = loan.managementFeeRate > 0;
                const headers = hasMgmtFee
                  ? ["#", "Due Date", "Principal", "Mgmt Fee", "Interest", "Total Due", "Paid", "Status"]
                  : ["#", "Due Date", "Principal", "Interest", "Total Due", "Paid", "Status"];
                return (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        {headers.map((h) => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {installments.length === 0 ? (
                        <tr>
                          <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                            No installment schedule found for this loan.
                          </td>
                        </tr>
                      ) : installments.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                            row.status === "paid"    ? "bg-emerald-50/40 dark:bg-emerald-900/5" :
                            row.status === "overdue" ? "bg-red-50/40 dark:bg-red-900/5" : ""
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.installmentNo}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{formatDate(row.dueDate)}</td>
                          <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">{formatCurrency(row.principalDue)}</td>
                          {hasMgmtFee && (
                            <td className="px-4 py-2.5 text-purple-600 dark:text-purple-400">{formatCurrency(row.managementFeeDue)}</td>
                          )}
                          <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400">{formatCurrency(row.interestDue)}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.totalDue)}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                            {row.amountPaid > 0 ? formatCurrency(row.amountPaid) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", INSTALLMENT_STATUS_COLOR[row.status])}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Payments Tab ──────────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment History — {payments.length} record{payments.length !== 1 ? "s" : ""}</CardTitle>
                {canPayment && canRecordPayment && (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                  >
                    <Banknote className="w-3 h-3" /> Record Payment
                  </button>
                )}
              </div>
            </CardHeader>
            {payments.length === 0 ? (
              <CardContent>
                <p className="text-xs text-gray-400 text-center py-8">No payments recorded yet.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {["Reference", "Date", "Total", "Principal", "Mgmt Fee", "Interest", "Penalty", "Method", "Recorded By", "Receipt"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 first:pl-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {payments.map((p, i) => {
                      const m = METHOD_CONFIG[p.method] ?? { variant: "neutral" as const, label: p.method };
                      return (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-xs"
                        >
                          <td className="pl-6 pr-4 py-3">
                            <span className="font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{p.reference}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(p.date)}</td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">{formatCurrency(p.principal)}</td>
                          <td className="px-4 py-3">
                            {(p.managementFee ?? 0) > 0
                              ? <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(p.managementFee)}</span>
                              : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(p.interest)}</td>
                          <td className="px-4 py-3">
                            {p.penalty > 0
                              ? <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(p.penalty)}</span>
                              : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{p.recordedByName ?? "—"}</td>
                          <td className="px-4 py-3">
                            {p.receiptUrl ? (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline"
                              >
                                <Receipt className="w-3.5 h-3.5" /> View
                              </a>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold">
                      <td colSpan={2} className="pl-6 pr-4 py-3 text-gray-600 dark:text-gray-400">Totals</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{formatCurrency(payments.reduce((s,p)=>s+p.amount,0))}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(payments.reduce((s,p)=>s+p.principal,0))}</td>
                      <td className="px-4 py-3 text-purple-600 dark:text-purple-400">{formatCurrency(payments.reduce((s,p)=>s+(p.managementFee??0),0))}</td>
                      <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{formatCurrency(payments.reduce((s,p)=>s+p.interest,0))}</td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400">{formatCurrency(payments.reduce((s,p)=>s+p.penalty,0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── Documents Tab ─────────────────────────────────────────────── */}
      {activeTab === "documents" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader><CardTitle>Supporting Documents</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const docs: Array<{ id: string; documentType: string; name: string; url: string; createdAt: string }> =
                  (loan as any).documents ?? [];
                if (docs.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <FileText className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                      <p className="text-sm text-gray-400">No documents were attached to this loan.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {docs.map((doc) => {
                      const isPdf = doc.url.toLowerCase().includes(".pdf") || doc.name.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-green-300 dark:hover:border-green-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                              </span>
                              <span className="text-[10px] text-gray-400">{formatDate(doc.createdAt)}</span>
                            </div>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {isPdf ? "View PDF" : "View"}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Contract Tab ──────────────────────────────────────────────── */}
      {activeTab === "contract" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="py-8">
              <div className="max-w-2xl mx-auto space-y-6 text-sm text-gray-700 dark:text-gray-300">
                {/* Open full agreement CTA */}
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-4">
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300 text-base">Full Loan Agreement</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Print-ready BNR-compliant agreement with all borrower and loan details filled in.</p>
                  </div>
                  <button
                    onClick={() => setShowContractModal(true)}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" /> Open &amp; Print
                  </button>
                </div>

                <div className="text-center border-b border-gray-200 dark:border-gray-800 pb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">LOAN AGREEMENT — SUMMARY</h3>
                  <p className="text-gray-500 mt-1">{companyName}</p>
                </div>
                <div className="space-y-1">
                  <p><strong>Loan Reference:</strong> {loan.id.toUpperCase()}</p>
                  <p><strong>Date:</strong> {formatDate(loan.createdAt)}</p>
                  <p><strong>Borrower:</strong> {loan.customer?.names ?? loan.customerName}</p>
                  {loan.customer?.nationalId && <p><strong>National ID:</strong> {loan.customer.nationalId}</p>}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Loan Terms</h4>
                  <p>Principal Amount: <strong>{formatCurrency(loan.amount)}</strong></p>
                  <p>Monthly Interest Rate: <strong>{loan.annualInterestRate / 12}%/month ({loan.interestMethod} balance)</strong></p>
                  <p>Repayment Period: <strong>{loan.totalInstallments} installments</strong></p>
                  <p>Installment Amount: <strong>{formatCurrency(loan.nextPaymentAmount)}</strong></p>
                  <p>Total Repayable: <strong>{formatCurrency(loan.totalRepayable)}</strong></p>
                  <p>Maturity Date: <strong>{formatDate(loan.agreedMaturityDate)}</strong></p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The borrower agrees to repay the loan in the installments specified above. Late payment will attract a penalty on the overdue amount. The lender reserves the right to demand full repayment upon default. This agreement is governed by the laws of Rwanda and the regulations of the National Bank of Rwanda (BNR).
                </p>
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Borrower Signature</p>
                    <p className="text-xs font-medium">{loan.customer?.names ?? loan.customerName}</p>
                  </div>
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Lender Representative</p>
                    <p className="text-xs font-medium">{companyName}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Record Payment Modal ───────────────────────────────────────── */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Payment" size="md">
        <RecordPaymentForm
          loan={loan}
          onClose={() => setShowPayModal(false)}
          onSaved={() => { setShowPayModal(false); fetchData(); }}
        />
      </Modal>

      {/* ── Waiver Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={showWaiveModal} onClose={() => setShowWaiveModal(false)} title="Waive Penalty" size="sm">
        <WaiverForm
          loan={loan}
          onClose={() => setShowWaiveModal(false)}
          onSaved={() => { setShowWaiveModal(false); fetchData(); }}
        />
      </Modal>

      {/* ── Top-Up Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} title="Loan Top-Up" size="md">
        <TopUpForm
          loan={loan}
          onClose={() => setShowTopUpModal(false)}
          onSaved={() => { setShowTopUpModal(false); fetchData(); }}
        />
      </Modal>

      {/* ── Approve / Reject / Disburse Modals ────────────────────────── */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => { setActionModal(null); setActionError(""); }}
        title={
          actionModal === "approve"  ? "Approve Loan" :
          actionModal === "reject"   ? "Reject Loan"  :
          "Disburse Loan"
        }
        size="sm"
      >
        <div className="p-6 space-y-4">
          {actionError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{actionError}</p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {actionModal === "approve"  && <>Approve the loan of <strong>{formatCurrency(loan.amount)}</strong> for <strong>{loan.customer?.names ?? loan.customerName}</strong>? It will be ready for disbursement.</>}
            {actionModal === "reject"   && <>Reject this loan application? This action cannot be undone.</>}
            {actionModal === "disburse" && <>Disburse <strong>{formatCurrency(loan.amount)}</strong> to <strong>{loan.customer?.names ?? loan.customerName}</strong>? The loan will become active and repayment will start.</>}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setActionModal(null); setActionError(""); }}>Cancel</Button>
            <Button
              loading={actioning}
              variant={actionModal === "reject" ? "danger" : "primary"}
              icon={actionModal === "approve" ? <CheckCircle2 className="w-4 h-4" /> : actionModal === "reject" ? <XCircle className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
              onClick={() => actionModal && handleAction(actionModal)}
            >
              {actionModal === "approve" ? "Confirm Approval" : actionModal === "reject" ? "Confirm Reject" : "Confirm Disburse"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Contract Fullscreen Modal ──────────────────────────────────── */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
          <div className="flex items-center justify-between bg-green-900 px-5 py-3 flex-shrink-0">
            <span className="text-white font-semibold text-sm">Loan Agreement — {loan.id}</span>
            <button
              onClick={() => setShowContractModal(false)}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <iframe
            src={`/api/v1/loans/${id}/agreement`}
            className="flex-1 w-full bg-white"
            title="Loan Agreement"
          />
        </div>
      )}
    </div>
  );
}
