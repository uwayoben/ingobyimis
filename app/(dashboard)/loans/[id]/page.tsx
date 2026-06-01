"use client";
import React, { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, Printer, ArrowDownToLine, Loader2,
  AlertTriangle, Banknote, TrendingDown, CreditCard, ArrowDownUp, FileText, ExternalLink,
  MinusCircle, TrendingUp, Upload, X, Receipt, Trash2, MessageSquare, Send, PlusCircle,
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
import type { Loan, Installment, Payment, LoanComment } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import { useRole } from "@/components/RoleContext";

function formatCurrency(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}

function openInstallmentInvoice(
  row: Installment,
  loan: { id: string; amount: number; annualInterestRate: number; totalInstallments: number; customer?: { names?: string; nationalId?: string; phone?: string; province?: string; district?: string } | null; customerName?: string },
  companyName: string,
) {
  const customerName = loan.customer?.names ?? (loan as any).customerName ?? "—";
  const nationalId   = loan.customer?.nationalId ?? "—";
  const phone        = loan.customer?.phone ?? "—";
  const address      = [loan.customer?.district, loan.customer?.province].filter(Boolean).join(", ") || "—";
  const balance      = Math.max(0, row.totalDue - row.amountPaid);
  const today        = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const dueDate      = new Date(row.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const refNo        = `INV-${loan.id.toUpperCase()}-${String(row.installmentNo).padStart(3, "0")}`;

  const statusStyles: Record<string, string> = {
    paid:    "background:#dcfce7;color:#166534",
    pending: "background:#f3f4f6;color:#374151",
    overdue: "background:#fee2e2;color:#991b1b",
    partial: "background:#dbeafe;color:#1e40af",
  };
  const statusStyle = statusStyles[row.status] ?? statusStyles.pending;

  const mgmtFeeRow = row.managementFeeDue > 0
    ? `<tr style="background:#fff"><td style="padding:10px 14px;color:#6b7280">Management Fee</td><td style="padding:10px 14px;text-align:right;font-weight:500">RWF ${row.managementFeeDue.toLocaleString()}</td></tr>`
    : "";

  const procFeeRow = (row.processingFeeDue ?? 0) > 0
    ? `<tr style="background:#fff"><td style="padding:10px 14px;color:#6b7280">Processing Fee</td><td style="padding:10px 14px;text-align:right;font-weight:500">RWF ${(row.processingFeeDue ?? 0).toLocaleString()}</td></tr>`
    : "";

  const paidRow = row.amountPaid > 0
    ? `<tr style="background:#f0fdf4"><td style="padding:10px 14px;color:#16a34a;font-weight:600">Amount Paid</td><td style="padding:10px 14px;text-align:right;color:#16a34a;font-weight:700">− RWF ${row.amountPaid.toLocaleString()}</td></tr>`
    : "";

  const overdueNotice = row.status === "overdue"
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:11px;color:#92400e;line-height:1.6;margin-bottom:24px">
        <strong>⚠ Overdue Notice:</strong> This installment is past its due date of ${dueDate}. Please make payment immediately to avoid additional penalties. Contact us if you need assistance.
       </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;font-size:11px;color:#166534;line-height:1.6;margin-bottom:24px">
        <strong>Payment Instructions:</strong> Please pay by <strong>${dueDate}</strong>. You can pay via bank transfer, mobile money, or visit our office. Include the reference number <strong>${refNo}</strong> in your payment.
       </div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${refNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
    .page{max-width:700px;margin:0 auto;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #166534}
    .co-name{font-size:22px;font-weight:700;color:#166534}
    .co-sub{font-size:11px;color:#888;margin-top:3px}
    .inv-title h1{font-size:26px;font-weight:800;color:#166534;letter-spacing:-0.5px;text-align:right}
    .inv-title p{font-size:11px;color:#666;text-align:right;margin-top:3px;line-height:1.5}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
    .box{background:#f8fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px}
    .box h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:8px}
    .box p{font-size:12px;line-height:1.7;color:#374151}
    .box strong{color:#111}
    .inst-line{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
    .inst-badge{background:#166534;color:#fff;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700}
    .due-text{font-size:12px;color:#6b7280}
    .status-pill{padding:4px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
    table.bk{width:100%;border-collapse:collapse;margin-bottom:6px}
    table.bk td{padding:10px 14px}
    table.bk tr:nth-child(odd) td{background:#f9fafb}
    .lbl{color:#6b7280}
    .val{text-align:right;font-weight:500;color:#111}
    .total-row td{background:#166534!important;color:#fff!important;font-size:14px;font-weight:700}
    .bal-row td{background:#f0fdf4!important;color:#166534!important;font-size:14px;font-weight:800}
    .footer{margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}
    .sig{text-align:center}
    .sig-line{border-top:1px solid #d1d5db;width:160px;margin:30px auto 4px}
    .sig-label{font-size:10px;color:#9ca3af}
    .toolbar{position:fixed;top:16px;right:16px;display:flex;gap:8px}
    .print-btn{background:#166534;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
    .dl-btn{background:#fff;color:#166534;border:2px solid #166534;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
    @media print{.toolbar{display:none}.page{padding:20px}}
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="dl-btn" onclick="downloadInvoice()">⬇ Download</button>
    <button class="print-btn" onclick="window.print()">🖨 Print / PDF</button>
  </div>
  <div class="page">
    <div class="header">
      <div>
        <div class="co-name">${companyName}</div>
        <div class="co-sub">Microfinance Institution</div>
      </div>
      <div class="inv-title">
        <h1>PAYMENT NOTICE</h1>
        <p>Ref: <strong>${refNo}</strong></p>
        <p>Issued: ${today}</p>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h3>Billed To</h3>
        <p><strong>${customerName}</strong></p>
        <p>National ID: ${nationalId}</p>
        <p>Phone: ${phone}</p>
        <p>Address: ${address}</p>
      </div>
      <div class="box">
        <h3>Loan Details</h3>
        <p><strong>Loan ID:</strong> ${loan.id.toUpperCase()}</p>
        <p><strong>Loan Amount:</strong> RWF ${loan.amount.toLocaleString()}</p>
        <p><strong>Interest Rate:</strong> ${(loan.annualInterestRate / 12).toFixed(2)}%/month</p>
        <p><strong>Total Installments:</strong> ${loan.totalInstallments}</p>
      </div>
    </div>

    <div class="inst-line">
      <span class="inst-badge">Installment ${row.installmentNo} of ${loan.totalInstallments}</span>
      <span class="due-text">Due Date: <strong>${dueDate}</strong></span>
      <span class="status-pill" style="${statusStyle}">${row.status}</span>
    </div>

    <table class="bk">
      <tr style="background:#fff"><td class="lbl">Principal</td><td class="val">RWF ${row.principalDue.toLocaleString()}</td></tr>
      <tr><td class="lbl">Interest</td><td class="val">RWF ${row.interestDue.toLocaleString()}</td></tr>
      ${mgmtFeeRow}
      ${procFeeRow}
      <tr class="total-row"><td>TOTAL DUE</td><td class="val">RWF ${row.totalDue.toLocaleString()}</td></tr>
      ${paidRow}
      <tr class="bal-row"><td>BALANCE DUE</td><td class="val">RWF ${balance.toLocaleString()}</td></tr>
    </table>

    <br/>
    ${overdueNotice}

    <div class="footer">
      <div>
        <p style="font-size:11px;color:#6b7280">Generated by ${companyName} MIS &nbsp;·&nbsp; ${today}</p>
        <p style="font-size:10px;color:#9ca3af;margin-top:2px">This is an automated payment notice. Not a receipt.</p>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">Authorised Signature</div>
      </div>
    </div>
  </div>
  <script>
    function downloadInvoice(){
      var blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download='${refNo}.html';
      document.body.appendChild(a);a.click();
      document.body.removeChild(a);URL.revokeObjectURL(url);
    }
    window.onload=()=>window.print();
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function loanPeriodRate(loan: Loan): number {
  return loan.annualInterestRate / 100 / (360 / loan.repaymentFrequencyDays);
}

function interestRemaining(loan: Loan): number {
  const totalMgmtFeeScheduled = loan.totalMgmtFeeScheduled ?? 0;
  const totalProcFeeScheduled = loan.totalProcessingFeeScheduled ?? 0;
  const totalInterest = (loan.totalInterestScheduled ?? 0) > 0
    ? loan.totalInterestScheduled!
    : loan.totalRepayable - loan.amount - totalMgmtFeeScheduled - totalProcFeeScheduled;
  return Math.max(0, totalInterest - loan.amountRepaidInterest);
}

function mgmtFeeRemaining(loan: Loan): number {
  return Math.max(0, (loan.totalMgmtFeeScheduled ?? 0) - (loan.amountRepaidMgmtFee ?? 0));
}

function processingFeeRemaining(loan: Loan): number {
  return Math.max(0, (loan.totalProcessingFeeScheduled ?? 0) - (loan.amountRepaidProcessingFee ?? 0));
}

function trueOutstanding(loan: Loan): number {
  return loan.balanceOutstanding + interestRemaining(loan) + mgmtFeeRemaining(loan) + processingFeeRemaining(loan) + loan.penaltyAmount + (loan.additionalInterest ?? 0) + (loan.additionalMgmtFee ?? 0) + (loan.additionalProcessingFee ?? 0);
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

// ── Add Charges Dropdown ──────────────────────────────────────────────────────
function AddChargesDropdown({
  canAddInterest, canAddMgmtFee, canAddProcFee, canWaive,
  onAddInterest, onAddMgmtFee, onAddProcFee, onWaive,
}: {
  canAddInterest: boolean; canAddMgmtFee: boolean; canAddProcFee: boolean; canWaive: boolean;
  onAddInterest: () => void; onAddMgmtFee: () => void; onAddProcFee: () => void; onWaive: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    canAddInterest && { label: "Add Interest",       icon: <TrendingUp className="w-3.5 h-3.5 text-orange-500" />, color: "text-orange-700 dark:text-orange-300", onClick: onAddInterest },
    canAddMgmtFee  && { label: "Add Mgmt Fee",        icon: <PlusCircle className="w-3.5 h-3.5 text-purple-500" />, color: "text-purple-700 dark:text-purple-300", onClick: onAddMgmtFee  },
    canAddProcFee  && { label: "Add Processing Fee",  icon: <PlusCircle className="w-3.5 h-3.5 text-sky-500" />,    color: "text-sky-700 dark:text-sky-300",       onClick: onAddProcFee  },
    canWaive       && { label: "Waive Penalty",       icon: <MinusCircle className="w-3.5 h-3.5 text-red-500" />,   color: "text-red-700 dark:text-red-300",        onClick: onWaive       },
  ].filter(Boolean) as { label: string; icon: React.ReactNode; color: string; onClick: () => void }[];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <PlusCircle className="w-3.5 h-3.5" />
        Add Charge
        <svg className={cn("w-3 h-3 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20 overflow-hidden">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { setOpen(false); item.onClick(); }}
                className={cn("w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors", item.color)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

  const penalty          = loan.penaltyAmount;
  const addlInterest     = loan.additionalInterest    ?? 0;
  const addlMgmtFee      = loan.additionalMgmtFee     ?? 0;
  const addlProcFee      = loan.additionalProcessingFee ?? 0;
  const totalOuts        = trueOutstanding(loan);
  const amt              = Math.min(Number(amount) || 0, totalOuts);

  const periodsPerYear    = 360 / loan.repaymentFrequencyDays;
  const periodRate        = Number(loan.annualInterestRate)         / 100 / periodsPerYear;
  const mgmtFeePeriodRate = Number(loan.managementFeeRate ?? 0)     / 100 / periodsPerYear;
  const procFeePeriodRate = Number(loan.processingFeeRate ?? 0)     / 100 / periodsPerYear;

  const remainingProcFee  = processingFeeRemaining(loan);
  const periodProcFee     = loan.balanceOutstanding > 0
    ? Math.round(loan.balanceOutstanding * procFeePeriodRate) : remainingProcFee;
  const currentProcFee    = Math.min(periodProcFee, remainingProcFee);

  const remainingMgmtFee  = mgmtFeeRemaining(loan);
  const periodMgmtFee     = loan.balanceOutstanding > 0
    ? Math.round(loan.balanceOutstanding * mgmtFeePeriodRate) : remainingMgmtFee;
  const currentMgmtFee    = Math.min(periodMgmtFee, remainingMgmtFee);

  const remainingInt   = interestRemaining(loan);
  const periodInterest = loan.balanceOutstanding > 0
    ? Math.round(loan.balanceOutstanding * periodRate) : remainingInt;
  const currentInt     = Math.min(periodInterest, remainingInt);

  const isPayoffPreview = amt >= (penalty + addlInterest + addlMgmtFee + addlProcFee + remainingProcFee + remainingMgmtFee + remainingInt + loan.balanceOutstanding);

  let remaining0              = amt;
  const penaltyPaid           = Math.min(remaining0, penalty);                                                         remaining0 -= penaltyPaid;
  const addlInterestPreview   = Math.min(remaining0, addlInterest);                                                    remaining0 -= addlInterestPreview;
  const addlMgmtFeePreview    = Math.min(remaining0, addlMgmtFee);                                                     remaining0 -= addlMgmtFeePreview;
  const addlProcFeePreview    = Math.min(remaining0, addlProcFee);                                                      remaining0 -= addlProcFeePreview;
  const mgmtFeePreview        = Math.min(remaining0, isPayoffPreview ? remainingMgmtFee : currentMgmtFee);             remaining0 -= mgmtFeePreview;
  const procFeePreview        = Math.min(remaining0, isPayoffPreview ? remainingProcFee : currentProcFee);              remaining0 -= procFeePreview;
  const interest              = Math.min(remaining0, isPayoffPreview ? remainingInt : currentInt);                     remaining0 -= interest;
  const principal             = remaining0;

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
        {addlInterest > 0 && (
          <div className="flex justify-between">
            <span className="text-orange-500 dark:text-orange-400">Additional Interest</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(addlInterest)}</span>
          </div>
        )}
        {addlMgmtFee > 0 && (
          <div className="flex justify-between">
            <span className="text-purple-500 dark:text-purple-400">Additional Mgmt Fee</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(addlMgmtFee)}</span>
          </div>
        )}
        {addlProcFee > 0 && (
          <div className="flex justify-between">
            <span className="text-sky-500 dark:text-sky-400">Additional Processing Fee</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(addlProcFee)}</span>
          </div>
        )}
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
          {addlInterestPreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Additional Interest</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(addlInterestPreview)}</span>
            </div>
          )}
          {addlMgmtFeePreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Additional Mgmt Fee</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(addlMgmtFeePreview)}</span>
            </div>
          )}
          {addlProcFeePreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Additional Processing Fee</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(addlProcFeePreview)}</span>
            </div>
          )}
          {mgmtFeePreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Management Fee</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(mgmtFeePreview)}</span>
            </div>
          )}
          {procFeePreview > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">→ Processing Fee</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(procFeePreview)}</span>
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

// ── Add Additional Interest Form ──────────────────────────────────────────────
function AddInterestForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount,  setAmount]  = useState("");
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const addlAmt       = Math.max(0, Number(amount) || 0);
  const currentAddl   = loan.additionalInterest ?? 0;
  const newTotal      = currentAddl + addlAmt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!addlAmt || addlAmt <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!reason.trim()) { setError("A reason is required."); return; }
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/v1/loans/${loan.id}/additional-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: addlAmt, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to add additional interest."); return; }
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

      {currentAddl > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-xs">
          <p className="font-semibold text-orange-700 dark:text-orange-300 mb-1">Existing Additional Interest</p>
          <p className="text-orange-600 dark:text-orange-400">{formatCurrency(currentAddl)} already outstanding — the new amount will be added on top.</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-300">How it works</p>
        <p className="text-gray-500 dark:text-gray-400">The amount you enter will be added to this loan&apos;s outstanding balance. When the customer next pays, it will be collected automatically (after any penalty, before regular interest).</p>
      </div>

      <Input
        label="Additional Interest Amount (RWF)"
        type="number"
        min="1"
        placeholder="e.g. 50000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {addlAmt > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount to Add</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(addlAmt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Additional Interest After</span>
            <span className="font-semibold text-orange-700 dark:text-orange-300">{formatCurrency(newTotal)}</span>
          </div>
        </div>
      )}

      <Textarea
        label="Reason (required)"
        placeholder="e.g. Late payment — May 2026 installment overdue by 15 days"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<PlusCircle className="w-4 h-4" />}>
          Add Interest
        </Button>
      </div>
    </form>
  );
}

// ── Add Additional Management Fee Form ───────────────────────────────────────
function AddMgmtFeeForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount,  setAmount]  = useState("");
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const addlAmt     = Math.max(0, Number(amount) || 0);
  const currentAddl = loan.additionalMgmtFee ?? 0;
  const newTotal    = currentAddl + addlAmt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!addlAmt || addlAmt <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!reason.trim()) { setError("A reason is required."); return; }
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/v1/loans/${loan.id}/additional-management-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: addlAmt, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to add additional management fee."); return; }
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

      {currentAddl > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-xs">
          <p className="font-semibold text-purple-700 dark:text-purple-300 mb-1">Existing Additional Management Fee</p>
          <p className="text-purple-600 dark:text-purple-400">{formatCurrency(currentAddl)} already outstanding — the new amount will be added on top.</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-300">How it works</p>
        <p className="text-gray-500 dark:text-gray-400">The amount you enter will be added to this loan&apos;s outstanding balance as a management fee charge. It will be collected automatically when the customer next pays (after penalty and additional interest).</p>
      </div>

      <Input
        label="Additional Management Fee Amount (RWF)"
        type="number"
        min="1"
        placeholder="e.g. 20000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {addlAmt > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount to Add</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(addlAmt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Additional Mgmt Fee After</span>
            <span className="font-semibold text-purple-700 dark:text-purple-300">{formatCurrency(newTotal)}</span>
          </div>
        </div>
      )}

      <Textarea
        label="Reason (required)"
        placeholder="e.g. Additional management fee for loan restructuring"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<PlusCircle className="w-4 h-4" />}>
          Add Management Fee
        </Button>
      </div>
    </form>
  );
}

// ── Add Additional Processing Fee Form ───────────────────────────────────────
function AddProcessingFeeForm({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount,  setAmount]  = useState("");
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const addlAmt     = Math.max(0, Number(amount) || 0);
  const currentAddl = loan.additionalProcessingFee ?? 0;
  const newTotal    = currentAddl + addlAmt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!addlAmt || addlAmt <= 0) { setError("Enter a valid amount greater than zero."); return; }
    if (!reason.trim()) { setError("A reason is required."); return; }
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/v1/loans/${loan.id}/additional-processing-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: addlAmt, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to add additional processing fee."); return; }
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

      {currentAddl > 0 && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-3 text-xs">
          <p className="font-semibold text-sky-700 dark:text-sky-300 mb-1">Existing Additional Processing Fee</p>
          <p className="text-sky-600 dark:text-sky-400">{formatCurrency(currentAddl)} already outstanding — the new amount will be added on top.</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-xs space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-300">How it works</p>
        <p className="text-gray-500 dark:text-gray-400">The amount you enter will be added to this loan&apos;s outstanding balance as a processing fee charge. It will be collected automatically when the customer next pays (after penalty and additional interest).</p>
      </div>

      <Input
        label="Additional Processing Fee Amount (RWF)"
        type="number"
        min="1"
        placeholder="e.g. 10000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {addlAmt > 0 && (
        <div className="bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800/50 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount to Add</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">{formatCurrency(addlAmt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Additional Processing Fee After</span>
            <span className="font-semibold text-sky-700 dark:text-sky-300">{formatCurrency(newTotal)}</span>
          </div>
        </div>
      )}

      <Textarea
        label="Reason (required)"
        placeholder="e.g. Additional processing fee for loan amendment"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<PlusCircle className="w-4 h-4" />}>
          Add Processing Fee
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

  const canApprove       = ["managing_director", "super_admin"].includes(role);
  const canDisburse      = ["managing_director", "loan_officer", "super_admin"].includes(role);
  const canRecordPayment = ["managing_director", "loan_officer", "super_admin"].includes(role);
  const canDelete        = ["managing_director", "loan_officer", "super_admin"].includes(role);

  const [loan, setLoan]                 = useState<(Loan & { customer?: any; loanOfficer?: any; approvedBy?: any }) | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments]         = useState<(Payment & { recordedByName?: string })[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [activeTab, setActiveTab]       = useState<"overview" | "schedule" | "payments" | "documents" | "contract" | "comments">("overview");
  const [comments, setComments]         = useState<LoanComment[]>([]);
  const [commentText, setCommentText]   = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError]     = useState("");
  const [actionModal, setActionModal]   = useState<"approve" | "reject" | "disburse" | null>(null);
  const [actioning, setActioning]       = useState(false);
  const [actionError, setActionError]   = useState("");
  const [showPayModal,            setShowPayModal]            = useState(false);
  const [showWaiveModal,          setShowWaiveModal]          = useState(false);
  const [showAddInterestModal,    setShowAddInterestModal]    = useState(false);
  const [showAddMgmtFeeModal,     setShowAddMgmtFeeModal]     = useState(false);
  const [showAddProcFeeModal,     setShowAddProcFeeModal]     = useState(false);
  const [showTopUpModal,          setShowTopUpModal]          = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [disburseDate,      setDisburseDate]      = useState(() => new Date().toISOString().slice(0, 10));
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [deleteError,       setDeleteError]       = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loanRes, instRes, payRes, commentsRes] = await Promise.all([
        apiFetch(`/api/v1/loans/${id}`),
        apiFetch(`/api/v1/loans/${id}/installments`),
        apiFetch(`/api/v1/payments?loanId=${id}&limit=100`),
        apiFetch(`/api/v1/loans/${id}/comments`),
      ]);
      if (loanRes.status === 404) { setError("Loan not found."); return; }
      if (!loanRes.ok) { setError("Failed to load loan."); return; }
      const loanJson = await loanRes.json();
      setLoan(loanJson.data);
      if (instRes.ok)     { const j = await instRes.json();     setInstallments(j.data ?? []); }
      if (payRes.ok)      { const j = await payRes.json();      setPayments(j.data ?? []); }
      if (commentsRes.ok) { const j = await commentsRes.json(); setComments(j.data ?? []); }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: "approve" | "reject" | "disburse") => {
    setActioning(true);
    setActionError("");
    try {
      const body =
        action === "approve"  ? { status: "approved" } :
        action === "reject"   ? { status: "rejected" } :
        { status: "active", disbursementDate: disburseDate };
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

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const res  = await apiFetch(`/api/v1/loans/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setDeleteError(json.error || "Delete failed."); return; }
      router.push("/loans");
    } catch {
      setDeleteError("Network error.");
    } finally {
      setDeleting(false);
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
  const mgmtFeeRepaid  = loan.amountRepaidMgmtFee ?? 0;
  const procFeeRepaid  = loan.amountRepaidProcessingFee ?? 0;
  const totalPaid      = loan.amountRepaidPrincipal + loan.amountRepaidInterest + mgmtFeeRepaid + procFeeRepaid + (loan.penaltyPaid ?? 0);
  const companyName   = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "NDF" : "NDF";
  const canPayment      = ["active", "overdue", "disbursed"].includes(loan.status) ||
    (loan.status === "completed" && trueOutstanding(loan) > 0);
  const canWaive        = canApprove && ["active", "overdue", "completed"].includes(loan.status) && loan.penaltyAmount > 0;
  const canAddInterest  = canRecordPayment && ["active", "overdue", "disbursed"].includes(loan.status);
  const canAddMgmtFee   = canRecordPayment && ["active", "overdue", "disbursed"].includes(loan.status);
  const canAddProcFee   = canRecordPayment && ["active", "overdue", "disbursed"].includes(loan.status);
  const canTopUp        = canDisburse && ["active", "overdue"].includes(loan.status) && loan.balanceOutstanding > 0;

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
        <div className="flex items-center gap-2 flex-wrap">
          {/* ── Workflow: Approve / Reject / Disburse ── */}
          {loan.status === "pending" && canApprove && (
            <>
              <Button variant="danger"  size="sm" icon={<XCircle className="w-4 h-4" />}       onClick={() => setActionModal("reject")}>Reject</Button>
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />}  onClick={() => setActionModal("approve")}>Approve</Button>
            </>
          )}
          {loan.status === "approved" && canDisburse && (
            <Button size="sm" icon={<ArrowDownToLine className="w-4 h-4" />} onClick={() => setActionModal("disburse")}>Disburse</Button>
          )}

          {/* ── Primary action ── */}
          {canPayment && canRecordPayment && (
            <Button size="sm" icon={<Banknote className="w-4 h-4" />} onClick={() => setShowPayModal(true)}>
              Record Payment
            </Button>
          )}

          {/* ── Top Up ── */}
          {canTopUp && (
            <Button variant="outline" size="sm" icon={<TrendingUp className="w-4 h-4" />} onClick={() => setShowTopUpModal(true)}>
              Top Up
            </Button>
          )}

          {/* ── Add Charges dropdown ── */}
          {(canAddInterest || canAddMgmtFee || canAddProcFee || canWaive) && (
            <AddChargesDropdown
              canAddInterest={canAddInterest}
              canAddMgmtFee={canAddMgmtFee}
              canAddProcFee={canAddProcFee}
              canWaive={canWaive}
              onAddInterest={() => setShowAddInterestModal(true)}
              onAddMgmtFee={() => setShowAddMgmtFeeModal(true)}
              onAddProcFee={() => setShowAddProcFeeModal(true)}
              onWaive={() => setShowWaiveModal(true)}
            />
          )}

          {/* ── Utility ── */}
          <Button variant="outline" size="sm" icon={<FileText className="w-4 h-4" />} onClick={() => setShowContractModal(true)}>
            Agreement
          </Button>
          {canDelete && (
            <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => { setDeleteError(""); setShowDeleteModal(true); }}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {([
          { label: "Loan Amount",       value: formatCurrency(loan.amount),               color: "text-gray-900 dark:text-gray-100",        border: "border-l-gray-400" },
          { label: "Total Repayable",   value: formatCurrency(loan.totalRepayable),        color: "text-blue-600 dark:text-blue-400",         border: "border-l-blue-500" },
          { label: "Total Paid",        value: formatCurrency(totalPaid),                  color: "text-emerald-600 dark:text-emerald-400",   border: "border-l-emerald-500" },
          { label: "Total Outstanding", value: formatCurrency(totalOuts),                  color: totalOuts > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400", border: totalOuts > 0 ? "border-l-red-500" : "border-l-gray-200" },
          { label: "Principal Repaid",  value: formatCurrency(loan.amountRepaidPrincipal), color: "text-green-600 dark:text-green-400",       border: "border-l-green-500" },
          { label: "Interest Paid",     value: formatCurrency(loan.amountRepaidInterest),  color: "text-amber-600 dark:text-amber-400",       border: "border-l-amber-500" },
          { label: "Interest Remaining",value: formatCurrency(intRemaining),               color: intRemaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-gray-400", border: intRemaining > 0 ? "border-l-amber-400" : "border-l-gray-200" },
          ...(loan.managementFeeRate > 0 ? [
            {
              label: "Mgmt Fee Paid",
              value: formatCurrency(mgmtFeeRepaid),
              color: "text-purple-600 dark:text-purple-400",
              border: "border-l-purple-400",
            },
            {
              label: "Mgmt Fee Remaining",
              value: formatCurrency(mgmtFeeRemaining(loan)),
              color: mgmtFeeRemaining(loan) > 0 ? "text-purple-700 dark:text-purple-300" : "text-gray-400",
              border: mgmtFeeRemaining(loan) > 0 ? "border-l-purple-500" : "border-l-gray-200",
            },
          ] : []),
          ...((loan.processingFeeRate ?? 0) > 0 ? [
            {
              label: "Proc Fee Paid",
              value: formatCurrency(loan.amountRepaidProcessingFee ?? 0),
              color: "text-sky-600 dark:text-sky-400",
              border: "border-l-sky-400",
            },
            {
              label: "Proc Fee Remaining",
              value: formatCurrency(processingFeeRemaining(loan)),
              color: processingFeeRemaining(loan) > 0 ? "text-sky-700 dark:text-sky-300" : "text-gray-400",
              border: processingFeeRemaining(loan) > 0 ? "border-l-sky-500" : "border-l-gray-200",
            },
          ] : []),
        ] as { label: string; value: string; color: string; border: string }[]).map((s) => (
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
              {processingFeeRemaining(loan) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sky-500 dark:text-sky-400">Processing Fee Remaining</span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(processingFeeRemaining(loan))}</span>
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
              {(loan.additionalInterest ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-500 dark:text-orange-400">Additional Interest</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {formatCurrency(loan.additionalInterest)}
                  </span>
                </div>
              )}
              {(loan.additionalMgmtFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-purple-500 dark:text-purple-400">Additional Mgmt Fee</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    {formatCurrency(loan.additionalMgmtFee!)}
                  </span>
                </div>
              )}
              {(loan.additionalProcessingFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sky-500 dark:text-sky-400">Additional Processing Fee</span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {formatCurrency(loan.additionalProcessingFee!)}
                  </span>
                </div>
              )}
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
        {(["overview", "schedule", "payments", "documents", "contract", "comments"] as const).map((t) => {
          const docs = (loan as any).documents ?? [];
          const label =
            t === "schedule"  ? "Payment Schedule" :
            t === "payments"  ? `Payments (${payments.length})` :
            t === "documents" ? `Documents (${docs.length})` :
            t === "comments"  ? `Comments (${comments.length})` :
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
                    ...((loan.processingFeeRate ?? 0) > 0 ? [{ label: "Proc Fee Rate", value: `${(loan.processingFeeRate ?? 0) / 12}%/month (per installment)` }] : []),
                    { label: "Repayment",      value: `${loan.repaymentFrequencyDays === 30 ? "Monthly" : loan.repaymentFrequencyDays === 7 ? "Weekly" : loan.repaymentFrequencyDays === 14 ? "Bi-weekly" : `Every ${loan.repaymentFrequencyDays}d`} · ${loan.totalInstallments} installments` },
                    { label: "First Payment",  value: loan.firstPaymentDate ? formatDate(loan.firstPaymentDate) : "—" },
                    { label: "Maturity Date",  value: formatDate(loan.agreedMaturityDate) },
                    { label: "Total Repayable",    value: formatCurrency(loan.totalRepayable) },
                    { label: "Interest Paid",      value: formatCurrency(loan.amountRepaidInterest) },
                    { label: "Interest Remaining", value: formatCurrency(intRemaining) },
                    ...(loan.managementFeeRate > 0 ? [
                      { label: "Mgmt Fee Paid",      value: formatCurrency(mgmtFeeRepaid) },
                      { label: "Mgmt Fee Remaining", value: formatCurrency(mgmtFeeRemaining(loan)) },
                    ] : []),
                    ...((loan.processingFeeRate ?? 0) > 0 ? [
                      { label: "Proc Fee Paid",      value: formatCurrency(procFeeRepaid) },
                      { label: "Proc Fee Remaining", value: formatCurrency(processingFeeRemaining(loan)) },
                    ] : []),
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
                const hasMgmtFee  = loan.managementFeeRate > 0;
                const hasProcFee  = (loan.processingFeeRate ?? 0) > 0;
                const headers = [
                  "#", "Due Date", "Principal",
                  ...(hasMgmtFee  ? ["Mgmt Fee"]  : []),
                  ...(hasProcFee  ? ["Proc Fee"]  : []),
                  "Interest", "Total Due", "Paid", "Status", "",
                ];
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
                          {hasProcFee && (
                            <td className="px-4 py-2.5 text-sky-600 dark:text-sky-400">{formatCurrency(row.processingFeeDue ?? 0)}</td>
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
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => openInstallmentInvoice(row, loan, companyName)}
                              title="Download invoice"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            >
                              <Receipt className="w-3 h-3" /> Invoice
                            </button>
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
                      {["Reference", "Date", "Total", "Principal", "Mgmt Fee", "Interest", "Penalty", "Add. Interest", "Method", "Recorded By", "Receipt"].map((h) => (
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
                            {(p.additionalInterest ?? 0) > 0
                              ? <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(p.additionalInterest!)}</span>
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
                      <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{formatCurrency(payments.reduce((s,p)=>s+(p.additionalInterest??0),0))}</td>
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

      {/* ── Comments Tab ──────────────────────────────────────────────── */}
      {activeTab === "comments" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Add comment form */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment or internal note about this loan…"
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                  {commentError && <p className="text-xs text-red-500">{commentError}</p>}
                  <div className="flex justify-end">
                    <button
                      disabled={commentLoading || !commentText.trim()}
                      onClick={async () => {
                        if (!commentText.trim()) return;
                        setCommentLoading(true);
                        setCommentError("");
                        try {
                          const res  = await apiFetch(`/api/v1/loans/${loan.id}/comments`, {
                            method:  "POST",
                            headers: { "Content-Type": "application/json" },
                            body:    JSON.stringify({ content: commentText.trim() }),
                          });
                          const json = await res.json();
                          if (!res.ok) { setCommentError(json.error || "Failed to post comment."); return; }
                          setComments((prev) => [json.data, ...prev]);
                          setCommentText("");
                        } catch {
                          setCommentError("Network error.");
                        } finally {
                          setCommentLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                    >
                      {commentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments list */}
          {comments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-gray-500">No comments yet. Be the first to add one.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <Card key={c.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                        {c.createdByName?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{c.createdByName}</span>
                            <span className="text-[10px] capitalize px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              {c.createdByRole?.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {new Date(c.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {(c.createdById === (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").userId : "") || canApprove) && (
                              <button
                                onClick={async () => {
                                  if (!confirm("Delete this comment?")) return;
                                  const res = await apiFetch(`/api/v1/loans/${loan.id}/comments?commentId=${c.id}`, { method: "DELETE" });
                                  if (res.ok) setComments((prev) => prev.filter((x) => x.id !== c.id));
                                }}
                                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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

      {/* ── Add Interest Modal ────────────────────────────────────────── */}
      <Modal isOpen={showAddInterestModal} onClose={() => setShowAddInterestModal(false)} title="Add Additional Interest" size="sm">
        <AddInterestForm
          loan={loan}
          onClose={() => setShowAddInterestModal(false)}
          onSaved={() => { setShowAddInterestModal(false); fetchData(); }}
        />
      </Modal>

      {/* ── Add Additional Management Fee Modal ───────────────────────── */}
      <Modal isOpen={showAddMgmtFeeModal} onClose={() => setShowAddMgmtFeeModal(false)} title="Add Additional Management Fee" size="sm">
        <AddMgmtFeeForm
          loan={loan}
          onClose={() => setShowAddMgmtFeeModal(false)}
          onSaved={() => { setShowAddMgmtFeeModal(false); fetchData(); }}
        />
      </Modal>

      {/* ── Add Additional Processing Fee Modal ───────────────────────── */}
      <Modal isOpen={showAddProcFeeModal} onClose={() => setShowAddProcFeeModal(false)} title="Add Additional Processing Fee" size="sm">
        <AddProcessingFeeForm
          loan={loan}
          onClose={() => setShowAddProcFeeModal(false)}
          onSaved={() => { setShowAddProcFeeModal(false); fetchData(); }}
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
          {actionModal === "disburse" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Disbursement Date</label>
              <input
                type="date"
                value={disburseDate}
                onChange={(e) => setDisburseDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Backdate if recording a past disbursement</p>
            </div>
          )}
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

      {/* ── Delete Confirmation Modal ─────────────────────────────────── */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Loan" size="sm">
        <div className="p-6 space-y-4">
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">This action cannot be undone</p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Loan <span className="font-mono font-bold">{loan.id.toUpperCase()}</span> and all its installments, payments, and documents will be permanently deleted.
                {loan.disbursedAmount > 0 && " The disbursed amount will be reversed in the company ledger."}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" loading={deleting} icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
              Delete Permanently
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
