"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Calculator, User, ChevronDown, ChevronUp, Search, Upload, FileText, X, Loader2, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import type { Customer } from "@/types";
import { apiFetch } from "@/lib/api-fetch";
import { useRole } from "@/components/RoleContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return "RWF " + Math.round(n).toLocaleString(); }

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

function generateLoanNumber(): string {
  const user = getStoredUser();
  const companyName: string = user?.companyName ?? "LN";
  const prefix = companyName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase().padEnd(2, "X");
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq    = String(Date.now()).slice(-4);
  return `${prefix}${date}-${seq}`;
}

function addPeriods(dateStr: string, n: number, frequency: string): string {
  if (!dateStr || n <= 0) return "";
  const d = new Date(dateStr);
  const periods = n - 1;
  switch (frequency) {
    case "daily":     d.setDate(d.getDate() + periods);           break;
    case "weekly":    d.setDate(d.getDate() + periods * 7);       break;
    case "bi_weekly": d.setDate(d.getDate() + periods * 14);      break;
    case "quarterly": d.setMonth(d.getMonth() + periods * 3);     break;
    default:          d.setMonth(d.getMonth() + periods);         break; // monthly
  }
  return d.toISOString().slice(0, 10);
}

function calcLoan(principal: number, periodRate: number, periodMgmtFeeRate: number, n: number, method: "flat" | "declining") {
  if (principal <= 0 || n <= 0) return null;
  const r = periodRate       / 100;
  const m = periodMgmtFeeRate / 100;
  const combinedRate = r + m;
  let emi = 0, totalInterest = 0, totalMgmtFee = 0;
  if (method === "flat") {
    totalInterest = principal * r * n;
    totalMgmtFee  = principal * m * n;
    emi = (principal + totalInterest + totalMgmtFee) / n;
  } else {
    if (combinedRate === 0) {
      emi = principal / n;
    } else {
      emi = (principal * combinedRate * Math.pow(1 + combinedRate, n)) / (Math.pow(1 + combinedRate, n) - 1);
    }
    const totalFees = emi * n - principal;
    totalInterest   = combinedRate > 0 ? totalFees * (r / combinedRate) : 0;
    totalMgmtFee    = combinedRate > 0 ? totalFees * (m / combinedRate) : 0;
  }
  return {
    emi:           Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalMgmtFee:  Math.round(totalMgmtFee),
    totalRepayable: Math.round(emi * n),
  };
}

const FREQ_OPTIONS = [
  { value: "daily",     label: "Daily",     days: 1  },
  { value: "weekly",    label: "Weekly",    days: 7  },
  { value: "bi_weekly", label: "Bi-Weekly", days: 14 },
  { value: "monthly",   label: "Monthly",   days: 30 },
  { value: "quarterly", label: "Quarterly", days: 90 },
];

const DOC_TYPE_OPTIONS = [
  { value: "national_id",       label: "National ID" },
  { value: "passport",          label: "Passport" },
  { value: "employment_letter", label: "Employment Letter" },
  { value: "bank_statement",    label: "Bank Statement" },
  { value: "collateral_proof",  label: "Collateral Proof" },
  { value: "other",             label: "Other" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id:       "National ID",
  passport:          "Passport",
  employment_letter: "Employment Letter",
  bank_statement:    "Bank Statement",
  collateral_proof:  "Collateral Proof",
  other:             "Other",
};

const COLLATERAL_OPTIONS = [
  { value: "",                                                    label: "— Select type —" },
  { value: "cash_collateral",                                     label: "Cash Collateral" },
  { value: "government_or_central_bank",                          label: "Government or Central Bank" },
  { value: "other_securities_offered_by_banks_operating_in_rwanda", label: "Other Securities (Banks in Rwanda)" },
  { value: "land_and_building",                                   label: "Land and Building" },
  { value: "movable_collaterals",                                 label: "Movable Collaterals" },
];

// ── Collapsible Section ───────────────────────────────────────────────────────

function Section({
  title, description, children, defaultOpen = true,
}: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 pb-5 space-y-4">{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Customer Search Combobox ──────────────────────────────────────────────────

function CustomerSearch({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string;
  onChange: (c: Customer | null) => void;
}) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    if (selected) setDisplayValue(`${selected.nationalId} — ${selected.names}`);
    else setDisplayValue("");
  }, [selected]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (selected) setDisplayValue(`${selected.nationalId} — ${selected.names}`);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selected]);

  const filtered = query.trim()
    ? customers.filter(
        (c) =>
          c.names.toLowerCase().includes(query.toLowerCase()) ||
          c.nationalId.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : customers.slice(0, 20);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        Customer <span className="text-red-500">*</span>
        <span className="text-gray-400 font-normal ml-1">(search by name or national ID)</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          value={open ? query : displayValue}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type name or national ID…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-52 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400">No customers found</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => {
                    onChange(c);
                    setDisplayValue(`${c.nationalId} — ${c.names}`);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors ${c.id === value ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                >
                  <span className="font-mono text-xs text-gray-400 mr-2">{c.nationalId}</span>
                  {c.names}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Read-only Info Field ──────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{value || "—"}</p>
    </div>
  );
}

// ── Fee Input with fixed / % toggle ──────────────────────────────────────────

function FeeInput({
  label,
  type,
  value,
  principal,
  onTypeChange,
  onValueChange,
}: {
  label: string;
  type: "fixed" | "percentage";
  value: number;
  principal: number;
  onTypeChange: (t: "fixed" | "percentage") => void;
  onValueChange: (v: number) => void;
}) {
  const computed = type === "percentage" ? Math.round(principal * value / 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-[10px] font-bold">
          <button
            type="button"
            onClick={() => onTypeChange("fixed")}
            className={`px-2.5 py-0.5 transition-colors ${type === "fixed" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
          >
            RWF
          </button>
          <button
            type="button"
            onClick={() => onTypeChange("percentage")}
            className={`px-2.5 py-0.5 transition-colors ${type === "percentage" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
          >
            %
          </button>
        </div>
      </div>
      <input
        type="number"
        min="0"
        step={type === "percentage" ? "0.5" : "1"}
        value={value || ""}
        onChange={(e) => onValueChange(Number(e.target.value))}
        placeholder={type === "percentage" ? "e.g. 2" : "e.g. 50,000"}
        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {type === "percentage" && value > 0 && principal > 0 && (
        <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold">= {fmt(computed)}</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewLoanPage() {
  const router = useRouter();
  const { role } = useRole();

  useEffect(() => {
    if (role === "receptionist") router.replace("/loans");
  }, [role, router]);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected]   = useState<Customer | null>(null);

  const [form, setForm] = useState({
    loanNumber:       generateLoanNumber(),
    customerId:       "",
    // Terms
    principal:        0,
    monthlyRate:      0,
    interestMethod:   "declining" as "flat" | "declining",
    frequency:        "monthly",
    installments:     0,
    penaltyRate:      0,
    // Fees — each has a type (fixed RWF or % of principal) and a value
    applicationFee:     0,
    applicationFeeType: "fixed" as "fixed" | "percentage",
    processingFee:      0,
    processingFeeType:  "fixed" as "fixed" | "percentage",
    managementFeeRate:  0,   // % per month — charged per installment like interest
    // Schedule
    firstPaymentDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })(),
    // Collateral
    collateralValue:  0,
    collateralType:   "",
    collateralDetails:"",
    // Purpose & Notes
    purpose:          "",
    notes:            "",
    branchName:       "",
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    apiFetch("/api/v1/customers?limit=500").then((r) => r.json()).then((j) => {
      setCustomers(j.data ?? []);
    }).catch(() => {});
  }, []);

  const freqDays = FREQ_OPTIONS.find((o) => o.value === form.frequency)?.days ?? 30;
  // Use the same 30-day-month convention as the API so preview matches saved values
  const periodRatePct        = form.monthlyRate       * (freqDays / 30);
  const periodMgmtFeeRatePct = form.managementFeeRate * (freqDays / 30);
  const calc = calcLoan(form.principal, periodRatePct, periodMgmtFeeRatePct, form.installments, form.interestMethod);
  const expectedCompletion = addPeriods(form.firstPaymentDate, form.installments, form.frequency);

  const customerAddress = selected
    ? [selected.village, selected.cell, selected.sector, selected.district, selected.province].filter(Boolean).join(", ")
    : null;

  // ── Document upload state ──────────────────────────────────────────────────
  type UploadedDoc = { type: string; name: string; url: string };
  const [documents, setDocuments]         = useState<UploadedDoc[]>([]);
  const [pendingDocType, setPendingDocType] = useState("national_id");
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [docError, setDocError]             = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = async () => {
    if (!pendingDocFile) return;
    setUploading(true);
    setDocError("");
    try {
      const fd = new FormData();
      fd.append("file", pendingDocFile);
      fd.append("folder", "loan-documents");
      const res  = await apiFetch("/api/v1/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setDocError(json.error || "Upload failed."); return; }
      setDocuments((prev) => [...prev, { type: pendingDocType, name: pendingDocFile.name, url: json.data.url }]);
      setPendingDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setDocError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerId) { setError("Please select a customer."); return; }
    setLoading(true);

    const fees = [];
    if (form.applicationFee > 0) fees.push({ name: "Application Fee", type: form.applicationFeeType, value: form.applicationFee, isRecurring: false });
    if (form.processingFee  > 0) fees.push({ name: "Processing Fee",  type: form.processingFeeType,  value: form.processingFee,  isRecurring: false });

    try {
      const res = await apiFetch("/api/v1/loans", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:             form.customerId,
          purpose:                form.purpose,
          branchName:             form.branchName || undefined,
          amount:                 form.principal,
          annualInterestRate:     form.monthlyRate * 12,
          interestMethod:         form.interestMethod,
          repaymentFrequencyDays: freqDays,
          totalInstallments:      form.installments,
          gracePeriodDays:        0,
          firstPaymentDate:       form.firstPaymentDate,
          penaltyRatePerDay:      form.penaltyRate || 0,
          managementFeeRate:      form.managementFeeRate ? form.managementFeeRate * 12 : 0,
          collateralType:         form.collateralType  || undefined,
          collateralAmount:       form.collateralValue || undefined,
          eligibleCollateral:     form.collateralValue || undefined,
          fees,
          documents: documents.length
            ? documents.map((d) => ({ documentType: d.type, name: d.name, url: d.url }))
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to create loan."); return; }
      router.push("/loans");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link href="/loans">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create New Loan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fill in all sections and submit for approval</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Left column: sections ── */}
          <div className="xl:col-span-2 space-y-4">

            {/* 1. Loan Identity */}
            <Section title="Loan Identity" description="Basic identification details for this loan">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Loan Number"
                  value={form.loanNumber}
                  onChange={(e) => set("loanNumber", e.target.value)}
                  hint="Auto-generated — you may edit if needed"
                />
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Loan Status</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pending Approval</span>
                  </div>
                  <p className="text-[11px] text-gray-400">New loans are always submitted as Pending and require approval before disbursement.</p>
                </div>
              </div>

              <CustomerSearch
                customers={customers}
                value={form.customerId}
                onChange={(c) => {
                  setSelected(c);
                  set("customerId", c?.id ?? "");
                }}
              />

              <Input
                label="Branch Name (optional)"
                placeholder="e.g. Kigali Main Branch"
                value={form.branchName}
                onChange={(e) => set("branchName", e.target.value)}
              />
            </Section>

            {/* 2. Customer Information (auto-filled) */}
            <Section title="Customer Information" description="Auto-filled when a customer is selected above" defaultOpen={true}>
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {selected.names.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">{selected.names}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{selected.nationalId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <InfoField label="Phone"             value={selected.phone} />
                    <InfoField label="Email"             value={selected.email} />
                    <InfoField label="Date of Birth"     value={selected.dateOfBirth?.slice(0, 10)} />
                    <InfoField label="Gender"            value={selected.gender} />
                    <InfoField label="Marital Status"    value={selected.maritalStatus} />
                    <InfoField label="Employment Status" value={selected.employmentStatus} />
                    <InfoField label="Employer"          value={selected.employerName} />
                    <InfoField label="Spouse Name"       value={selected.spouseName} />
                    <InfoField label="Spouse Phone"      value={selected.spousePhone} />
                    <div className="col-span-3">
                      <InfoField label="Address (Village → Province)" value={customerAddress} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700">
                  <User className="w-5 h-5 text-gray-300" />
                  <p className="text-sm text-gray-400">Select a customer above to see their details here.</p>
                </div>
              )}
            </Section>

            {/* 3. Loan Terms */}
            <Section title="Loan Terms" description="Principal, interest and repayment details — totals are calculated automatically">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Principal Amount (RWF)"
                  type="number"
                  min="1"
                  placeholder="e.g. 1,000,000"
                  value={form.principal || ""}
                  onChange={(e) => set("principal", Number(e.target.value))}
                  required
                />
                <Input
                  label="Interest Rate (% / month)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 5"
                  value={form.monthlyRate || ""}
                  onChange={(e) => set("monthlyRate", Number(e.target.value))}
                  required
                />
                <Select
                  label="Interest Type"
                  value={form.interestMethod}
                  onChange={(e) => set("interestMethod", e.target.value as "flat" | "declining")}
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
                  placeholder="e.g. 12"
                  value={form.installments || ""}
                  onChange={(e) => set("installments", Number(e.target.value))}
                  required
                />
                <Select
                  label="Installment Frequency"
                  value={form.frequency}
                  onChange={(e) => set("frequency", e.target.value)}
                  options={FREQ_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <Input
                  label="Penalty Rate (% / day)"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="e.g. 0.33"
                  value={form.penaltyRate || ""}
                  onChange={(e) => set("penaltyRate", parseFloat(e.target.value) || 0)}
                  hint="Supports up to 3 decimal places"
                />
              </div>

              {/* Auto-calculated totals */}
              {calc && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">EMI / Installment Amount</label>
                    <div className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {fmt(calc.emi)}
                    </div>
                    {calc.totalMgmtFee > 0 && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400">
                        incl. mgmt fee {fmt(Math.round(calc.totalMgmtFee / form.installments))}/installment
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Interest</label>
                    <div className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {fmt(calc.totalInterest)}
                    </div>
                    {calc.totalMgmtFee > 0 && (
                      <p className="text-[11px] text-purple-600 dark:text-purple-400">+ {fmt(calc.totalMgmtFee)} mgmt fee</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Repayment</label>
                    <div className="px-3 py-2 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-sm font-bold text-green-700 dark:text-green-400">
                      {fmt(calc.totalRepayable)}
                    </div>
                  </div>
                </div>
              )}

              {/* Fees — toggle between fixed RWF and % of principal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                <FeeInput
                  label="Application Fee"
                  type={form.applicationFeeType}
                  value={form.applicationFee}
                  principal={form.principal}
                  onTypeChange={(t) => set("applicationFeeType", t)}
                  onValueChange={(v) => set("applicationFee", v)}
                />
                <FeeInput
                  label="Processing Fee"
                  type={form.processingFeeType}
                  value={form.processingFee}
                  principal={form.principal}
                  onTypeChange={(t) => set("processingFeeType", t)}
                  onValueChange={(v) => set("processingFee", v)}
                />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Management Fee Rate (% / month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.managementFeeRate || ""}
                    onChange={(e) => set("managementFeeRate", parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 1"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-[11px] text-gray-400">Charged per installment like interest (0 = none)</p>
                </div>
              </div>
            </Section>

            {/* 4. Repayment Schedule */}
            <Section title="Repayment Schedule" description="First payment date — expected completion is calculated automatically">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Payment Date"
                  type="date"
                  value={form.firstPaymentDate}
                  onChange={(e) => set("firstPaymentDate", e.target.value)}
                  required
                />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Expected Completion Date</label>
                  <div className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {expectedCompletion || "—"}
                  </div>
                  <p className="text-[11px] text-gray-400">Auto-calculated from first payment, frequency and installments</p>
                </div>
              </div>
            </Section>

            {/* 5. Collateral & Guarantee */}
            <Section title="Collateral & Guarantee" description="Security and guarantee details for this loan" defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Collateral Value (RWF)"
                  type="number"
                  min="0"
                  value={form.collateralValue || ""}
                  onChange={(e) => set("collateralValue", Number(e.target.value))}
                  placeholder="0"
                />
                <Select
                  label="Guarantee / Collateral Type"
                  value={form.collateralType}
                  onChange={(e) => set("collateralType", e.target.value)}
                  options={COLLATERAL_OPTIONS}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Collateral Details</label>
                <textarea
                  value={form.collateralDetails}
                  onChange={(e) => set("collateralDetails", e.target.value)}
                  rows={3}
                  placeholder="Describe the collateral in detail…"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </Section>

            {/* 6. Purpose & Notes */}
            <Section title="Purpose & Notes" defaultOpen={true}>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Loan Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Business expansion — purchasing equipment"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Additional Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  placeholder="Any additional remarks or conditions…"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </Section>

            {/* 7. Supporting Documents */}
            <Section title="Supporting Documents" description="Upload ID cards, income proof, collateral documents and other supporting files" defaultOpen={true}>
              <div className="space-y-4">
                {/* Add document row */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Document Type</label>
                    <select
                      value={pendingDocType}
                      onChange={(e) => setPendingDocType(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {DOC_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      File <span className="text-gray-400 font-normal">(JPG, PNG, PDF · max 5 MB)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => setPendingDocFile(e.target.files?.[0] ?? null)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 file:mr-3 file:py-0.5 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700 dark:file:bg-green-900/30 dark:file:text-green-400 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDocUpload}
                    disabled={!pendingDocFile || uploading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {uploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>

                {docError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{docError}</p>
                )}

                {/* Uploaded documents list */}
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {documents.length} document{documents.length !== 1 ? "s" : ""} attached
                    </p>
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <FileText className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{doc.name}</p>
                          <p className="text-[10px] text-gray-400">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 dark:text-green-400 hover:underline shrink-0"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700">
                    <Paperclip className="w-5 h-5 text-gray-300 shrink-0" />
                    <p className="text-sm text-gray-400">No documents attached yet. Upload supporting documents above.</p>
                  </div>
                )}
              </div>
            </Section>

            <div className="flex justify-end gap-3 pb-6">
              <Link href="/loans"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" loading={loading}>Submit for Approval</Button>
            </div>
          </div>

          {/* ── Right column: summary ── */}
          <div className="xl:col-span-1">
            <div className="sticky top-6 space-y-4">
              <Card>
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Loan Summary</p>
                </div>
                <CardContent className="space-y-3 py-4">
                  {calc ? (
                    <>
                      {[
                        { label: "Principal",           value: fmt(form.principal),            bold: false },
                        { label: "Interest Rate",       value: `${form.monthlyRate}%/month`,   bold: false },
                        ...(form.managementFeeRate > 0 ? [{ label: "Mgmt Fee Rate", value: `${form.managementFeeRate}%/month`, bold: false }] : []),
                        { label: "Interest Method",     value: form.interestMethod === "declining" ? "Declining" : "Flat", bold: false },
                        { label: "Installment (EMI)",   value: fmt(calc.emi),                  bold: true },
                        { label: "Total Interest",      value: fmt(calc.totalInterest),        bold: false },
                        ...(calc.totalMgmtFee > 0 ? [{ label: "Total Mgmt Fee", value: fmt(calc.totalMgmtFee), bold: false }] : []),
                        { label: "Total Repayable",     value: fmt(calc.totalRepayable),       bold: true },
                      ].map((r) => (
                        <div key={r.label} className={`flex justify-between text-xs ${r.bold ? "border-t border-gray-100 dark:border-gray-800 pt-2 mt-1" : ""}`}>
                          <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
                          <span className={`${r.bold ? "font-bold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"}`}>{r.value}</span>
                        </div>
                      ))}

                      <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-center">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                          {form.installments} × {fmt(calc.emi)}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {FREQ_OPTIONS.find((o) => o.value === form.frequency)?.label} installments
                        </p>
                      </div>

                      {(form.applicationFee > 0 || form.processingFee > 0) && (() => {
                        const feeAmt = (type: "fixed" | "percentage", val: number) =>
                          type === "fixed" ? val : Math.round(form.principal * val / 100);
                        const totalFees =
                          feeAmt(form.applicationFeeType, form.applicationFee) +
                          feeAmt(form.processingFeeType,  form.processingFee);
                        return (
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">One-time Fees</p>
                            {form.applicationFee > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Application{form.applicationFeeType === "percentage" ? ` (${form.applicationFee}%)` : ""}</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(feeAmt(form.applicationFeeType, form.applicationFee))}</span>
                              </div>
                            )}
                            {form.processingFee > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Processing{form.processingFeeType === "percentage" ? ` (${form.processingFee}%)` : ""}</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(feeAmt(form.processingFeeType, form.processingFee))}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs border-t border-gray-100 dark:border-gray-800 pt-1.5 font-semibold">
                              <span className="text-gray-600 dark:text-gray-400">Total One-time Fees</span>
                              <span className="text-gray-900 dark:text-gray-100">{fmt(totalFees)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {expectedCompletion && (
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">First Payment</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{form.firstPaymentDate}</span>
                          </div>
                          <div className="flex justify-between mt-1.5">
                            <span className="text-gray-500">Est. Completion</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{expectedCompletion}</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">Fill in loan details to see summary</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
