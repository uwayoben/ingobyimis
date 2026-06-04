"use client";
import { useState, useMemo } from "react";
import { Calculator, Printer, RefreshCw } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function fmt(n: number) { return "RWF " + Math.round(n).toLocaleString(); }

const FREQ_OPTIONS = [
  { value: "1",  label: "Daily",      days: 1  },
  { value: "7",  label: "Weekly",     days: 7  },
  { value: "14", label: "Bi-Weekly",  days: 14 },
  { value: "30", label: "Monthly",    days: 30 },
  { value: "90", label: "Quarterly",  days: 90 },
];

type Row = {
  no: number;
  dueDate: string;
  openingBalance: number;
  principal: number;
  interest: number;
  emi: number;
  closingBalance: number;
};

function buildSchedule(
  principal: number,
  annualRate: number,
  method: "flat" | "declining",
  installments: number,
  freqDays: number,
  startDate: string,
): Row[] {
  if (principal <= 0 || installments <= 0) return [];

  const periodsPerYear = 360 / freqDays;
  const periodRate     = annualRate / 100 / periodsPerYear;

  let emi: number;
  if (method === "flat") {
    const totalInterest = principal * periodRate * installments;
    emi = (principal + totalInterest) / installments;
  } else {
    emi = periodRate === 0
      ? principal / installments
      : (principal * periodRate) / (1 - Math.pow(1 + periodRate, -installments));
  }
  emi = Math.round(emi);

  const rows: Row[] = [];
  let balance = principal;
  const base  = new Date(startDate);

  for (let i = 1; i <= installments; i++) {
    const due = new Date(base);
    due.setDate(due.getDate() + (i - 1) * freqDays);

    const isLast = i === installments;
    let interest: number;
    let princ: number;

    if (method === "flat") {
      interest = Math.round(principal * periodRate);
      princ    = isLast ? balance : Math.round(principal / installments);
    } else {
      interest = Math.round(balance * periodRate);
      princ    = isLast ? balance : Math.min(Math.round(emi - interest), balance);
    }

    const closing = isLast ? 0 : Math.max(0, balance - princ);

    rows.push({
      no: i,
      dueDate: due.toISOString().slice(0, 10),
      openingBalance: Math.round(balance),
      principal: princ,
      interest,
      emi,          // always the fixed constant — no per-row rounding drift
      closingBalance: closing,
    });

    balance = closing;
  }

  return rows;
}

export default function LoanCalculatorPage() {
  const [principal,    setPrincipal]    = useState("1000000");
  const [monthlyRate,  setMonthlyRate]  = useState("5");
  const [method,       setMethod]       = useState<"flat" | "declining">("declining");
  const [installments, setInstallments] = useState("12");
  const [freqKey,     setFreqKey]     = useState("30");
  const [startDate,   setStartDate]   = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  const freq           = FREQ_OPTIONS.find((o) => o.value === freqKey)!;
  const principalNum   = Math.max(0, Number(principal)    || 0);
  const installmentsNum = Math.max(1, Number(installments) || 1);
  const annualRate     = (parseFloat(monthlyRate) || 0) * 12;
  const schedule       = useMemo(
    () => buildSchedule(principalNum, annualRate, method, installmentsNum, freq.days, startDate),
    [principalNum, annualRate, method, installmentsNum, freq.days, startDate],
  );

  const totalInterest  = schedule.reduce((s, r) => s + r.interest, 0);
  const totalRepayable = schedule.reduce((s, r) => s + r.emi, 0);
  const emi            = schedule[0]?.emi ?? 0;

  const handleReset = () => {
    setPrincipal("1000000");
    setMonthlyRate("5");
    setMethod("declining");
    setInstallments("12");
    setFreqKey("30");
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    setStartDate(d.toISOString().slice(0, 10));
  };

  const handlePrint = () => {
    const rows = schedule.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td>${r.no}</td>
        <td>${r.dueDate}</td>
        <td>RWF ${r.openingBalance.toLocaleString()}</td>
        <td style="color:#16a34a">RWF ${r.principal.toLocaleString()}</td>
        <td style="color:#d97706">RWF ${r.interest.toLocaleString()}</td>
        <td style="font-weight:600">RWF ${r.emi.toLocaleString()}</td>
        <td>RWF ${r.closingBalance.toLocaleString()}</td>
      </tr>`).join("");

    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Loan Amortisation Schedule</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
        h2{margin:0 0 2px}p{margin:0 0 4px;color:#555;font-size:11px}
        .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px}
        .kpi p{font-size:10px;color:#6b7280;margin:0}.kpi strong{font-size:14px;color:#052e16}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th{background:#052e16;color:#fff;text-align:left;padding:8px 10px;font-size:11px}
        tfoot td{background:#f0fdf4;font-weight:700;padding:8px 10px;border-top:2px solid #16a34a}
        @media print{button{display:none}}
      </style></head>
      <body>
        <h2>Loan Amortisation Schedule</h2>
        <p>Principal: RWF ${principalNum.toLocaleString()} &nbsp;·&nbsp; Rate: ${monthlyRate}% / month (${annualRate}% p.a.) &nbsp;·&nbsp; Method: ${method === "flat" ? "Flat Rate" : "Declining Balance"} &nbsp;·&nbsp; ${installmentsNum} ${freq.label} installments</p>
        <div class="summary">
          <div class="kpi"><p>Principal</p><strong>RWF ${principalNum.toLocaleString()}</strong></div>
          <div class="kpi"><p>EMI / Installment</p><strong>RWF ${emi.toLocaleString()}</strong></div>
          <div class="kpi"><p>Total Interest</p><strong>RWF ${totalInterest.toLocaleString()}</strong></div>
          <div class="kpi"><p>Total Repayable</p><strong>RWF ${totalRepayable.toLocaleString()}</strong></div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Due Date</th><th>Opening Balance</th><th>Principal</th><th>Interest</th><th>EMI</th><th>Closing Balance</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="3">TOTALS</td>
            <td>RWF ${schedule.reduce((s, r) => s + r.principal, 0).toLocaleString()}</td>
            <td>RWF ${totalInterest.toLocaleString()}</td>
            <td>RWF ${totalRepayable.toLocaleString()}</td>
            <td></td>
          </tr></tfoot>
        </table>
        <script>window.onload=()=>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-green-600" /> Loan Calculator
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Simulate loan terms and preview the full amortisation schedule before disbursing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
          {schedule.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Schedule
            </button>
          )}
        </div>
      </div>

      {/* Inputs + Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input form */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Loan Parameters</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Principal Amount (RWF)"
                  type="number"
                  min="1"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                />
                <Input
                  label="Interest Rate (% / month)"
                  type="number"
                  step="any"
                  min="0"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                />
                <Select
                  label="Interest Method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as "flat" | "declining")}
                  options={[
                    { value: "declining", label: "Declining Balance" },
                    { value: "flat",      label: "Flat Rate" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="No. of Installments"
                  type="number"
                  min="1"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
                <Select
                  label="Repayment Frequency"
                  value={freqKey}
                  onChange={(e) => setFreqKey(e.target.value)}
                  options={FREQ_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <Input
                  label="First Payment Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary card */}
        <div>
          <Card className="border-green-200 dark:border-green-800/50">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {schedule.length > 0 ? (
                <>
                  {[
                    { label: "Principal",           value: fmt(principalNum),       bold: false },
                    { label: "Annual Rate (equiv)",  value: `${annualRate}% p.a.`, bold: false },
                    { label: "Interest Method",      value: method === "flat" ? "Flat Rate" : "Declining Balance", bold: false },
                    { label: "Frequency",            value: freq.label,           bold: false },
                    { label: "No. of Installments",  value: String(installmentsNum), bold: false },
                    { label: "EMI / Installment",    value: fmt(emi),             bold: true },
                    { label: "Total Interest",       value: fmt(totalInterest),   bold: false },
                    { label: "Total Repayable",      value: fmt(totalRepayable),  bold: true },
                  ].map((r) => (
                    <div key={r.label} className={`flex justify-between text-xs ${r.bold ? "border-t border-gray-100 dark:border-gray-800 pt-2 mt-1" : ""}`}>
                      <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
                      <span className={r.bold ? "font-bold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"}>
                        {r.value}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-center">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                      {installmentsNum} × {fmt(emi)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{freq.label} installments</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">Enter loan details to see summary</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Amortisation Schedule */}
      {schedule.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Amortisation Schedule — {schedule.length} installments</CardTitle>
              <span className="text-xs text-gray-400">
                Last payment: {schedule[schedule.length - 1]?.dueDate}
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  {["#", "Due Date", "Opening Balance", "Principal", "Interest", "EMI", "Closing Balance"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {schedule.map((row, i) => (
                  <tr key={row.no} className={`text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/20" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.no}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-mono">{row.dueDate}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(row.openingBalance)}</td>
                    <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">{fmt(row.principal)}</td>
                    <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400">{fmt(row.interest)}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">{fmt(row.emi)}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {row.closingBalance === 0
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">RWF 0</span>
                        : fmt(row.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-gray-600 dark:text-gray-400">TOTALS</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400">{fmt(schedule.reduce((s, r) => s + r.principal, 0))}</td>
                  <td className="px-4 py-3 text-amber-600 dark:text-amber-400">{fmt(totalInterest)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmt(totalRepayable)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
