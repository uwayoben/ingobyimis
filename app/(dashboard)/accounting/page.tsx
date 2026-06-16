"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, TrendingDown, Package, DollarSign, BarChart3, Trash2,
  CheckCircle2, Clock, Paperclip, ExternalLink, Upload, X, FileText,
  Landmark, ArrowDownToLine, ArrowUpToLine, ArrowRightLeft, ChevronDown,
  CreditCard, Loader2, AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api-fetch";
import { formatDate, cn } from "@/lib/utils";
import { useRole } from "@/components/RoleContext";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(amount);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id:            string;
  type:          "deposit" | "withdrawal" | "disbursement" | "repayment" | "expense";
  amount:        number;
  balanceBefore: number;
  balanceAfter:  number;
  description:   string;
  referenceId:   string | null;
  createdAt:     string;
}

interface Expense {
  id:          string;
  category:    string;
  description: string;
  amount:      number;
  date:        string;
  isPaid:      boolean;
  proofUrl:    string | null;
}

interface LiabilityPayment {
  id:          string;
  liabilityId: string;
  amount:      number;
  principal:   number;
  interest:    number;
  date:        string;
  notes:       string | null;
  createdAt:   string;
}

interface Liability {
  id:                 string;
  lenderName:         string;
  description:        string | null;
  principalAmount:    number;
  startDate:          string;
  dueDate:            string | null;
  balanceOutstanding: number;
  totalPaid:          number;
  status:             "active" | "completed";
  payments:           LiabilityPayment[];
  createdAt:          string;
}

interface Asset {
  id:              string;
  name:            string;
  category:        string;
  purchaseDate:    string;
  purchaseValue:   number;
  currentValue:    number;
  depreciationRate:number;
}

const EXPENSE_CATEGORIES = [
  "Personal Expenses",
  "Administrative Expenses",
  "Non Operating Expenses",
  "Bank Charges",
];
const ASSET_CATEGORIES = ["Furniture","Equipment","Vehicles","Electronics","Buildings","Other"];

// ── Proof Upload Widget ───────────────────────────────────────────────────────

function ProofUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploadError("");
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only JPG, PNG, WebP or PDF allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await apiFetch("/api/v1/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }
      onChange(json.data.url);
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  };

  const isPdf   = value.endsWith(".pdf");
  const hasFile = value.length > 0;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        Proof of Payment <span className="font-normal text-gray-400">(optional · JPG, PNG, PDF · max 5 MB)</span>
      </label>

      {hasFile ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          {isPdf ? (
            <FileText className="w-8 h-8 text-green-600 shrink-0" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="proof" className="w-12 h-12 object-cover rounded-lg border border-green-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-800 dark:text-green-300 truncate">
              {isPdf ? "PDF document attached" : "Image attached"}
            </p>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" /> Preview
            </a>
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}
            className="p-1 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
          >
            <X className="w-4 h-4 text-green-700 dark:text-green-400" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {uploading ? "Uploading…" : "Click to upload proof of payment"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
    </div>
  );
}

// ── Expense Form ──────────────────────────────────────────────────────────────

function ExpenseForm({ onSaved, onClose }: { onSaved: (e: Expense) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({
    category:    "",
    description: "",
    amount:      "",
    date:        "",
    isPaid:      false,
    proofUrl:    "",
  });

  const set = <K extends keyof typeof form>(field: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/expenses", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          amount:   Number(form.amount),
          proofUrl: form.proofUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      onSaved(json.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

      <Select
        label="Category"
        value={form.category}
        onChange={(e) => set("category", e.target.value)}
        options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount (RWF)"
          type="number"
          min={1}
          placeholder="500000"
          value={form.amount}
          onChange={(e) => set("amount", e.target.value)}
          required
        />
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => set("date", e.target.value)}
          required
        />
      </div>
      <Textarea
        label="Description"
        placeholder="Brief description..."
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        required
      />

      {/* Payment Status */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Payment Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("isPaid", false)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors",
              !form.isPaid
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <Clock className="w-4 h-4" /> Unpaid
          </button>
          <button
            type="button"
            onClick={() => set("isPaid", true)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors",
              form.isPaid
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <CheckCircle2 className="w-4 h-4" /> Paid
          </button>
        </div>
      </div>

      {/* Proof upload — always available, required hint if paid */}
      <ProofUpload value={form.proofUrl} onChange={(url) => set("proofUrl", url)} />
      {form.isPaid && !form.proofUrl && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 -mt-2">
          Uploading proof is recommended for paid expenses.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Expense</Button>
      </div>
    </form>
  );
}

// ── Mark Paid Modal ───────────────────────────────────────────────────────────

function MarkPaidModal({
  expense,
  onClose,
  onUpdated,
}: {
  expense: Expense;
  onClose: () => void;
  onUpdated: (e: Expense) => void;
}) {
  const [proofUrl, setProofUrl] = useState(expense.proofUrl ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSave = async () => {
    setError(""); setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/expenses/${expense.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isPaid: true, proofUrl: proofUrl || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to update."); return; }
      onUpdated(json.data);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm space-y-1">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{expense.category}</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">{expense.description}</p>
        <p className="font-bold text-red-600 dark:text-red-400 text-base">{formatCurrency(expense.amount)}</p>
      </div>
      <ProofUpload value={proofUrl} onChange={setProofUrl} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleSave} icon={<CheckCircle2 className="w-4 h-4" />}>
          Mark as Paid
        </Button>
      </div>
    </div>
  );
}

// ── Deposit / Withdrawal Modal ────────────────────────────────────────────────

function DepositModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (balance: number, entry: LedgerEntry) => void;
}) {
  const [type,        setType]        = useState<"deposit" | "withdrawal">("deposit");
  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await apiFetch("/api/v1/account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, amount: Number(amount), description }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      onSaved(json.data.balanceAfter, json.data);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Transaction Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("deposit")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors",
              type === "deposit"
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <ArrowDownToLine className="w-4 h-4" /> Deposit
          </button>
          <button
            type="button"
            onClick={() => setType("withdrawal")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors",
              type === "withdrawal"
                ? "bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <ArrowUpToLine className="w-4 h-4" /> Withdrawal
          </button>
        </div>
      </div>

      <Input
        label="Amount (RWF)"
        type="number"
        min={1}
        placeholder="1000000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input
        label="Description"
        placeholder={type === "deposit" ? "e.g. Capital injection from shareholders" : "e.g. Cash withdrawal for operations"}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={type === "deposit" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpToLine className="w-4 h-4" />}>
          {type === "deposit" ? "Record Deposit" : "Record Withdrawal"}
        </Button>
      </div>
    </form>
  );
}

// ── Asset Form ────────────────────────────────────────────────────────────────

function AssetForm({ onSaved, onClose }: { onSaved: (a: Asset) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({ name: "", category: "", purchaseDate: "", purchaseValue: "", currentValue: "", depreciationRate: "" });

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await apiFetch("/api/v1/assets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          purchaseValue:   Number(form.purchaseValue),
          currentValue:    Number(form.currentValue),
          depreciationRate:Number(form.depreciationRate),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      onSaved(json.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      <Input label="Asset Name" placeholder="e.g. Office Desk" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      <Select
        label="Category"
        value={form.category}
        onChange={(e) => set("category", e.target.value)}
        options={ASSET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} required />
        <Input label="Depreciation Rate (% p.a.)" type="number" min={0} max={100} step={0.01} placeholder="20" value={form.depreciationRate} onChange={(e) => set("depreciationRate", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Purchase Value (RWF)" type="number" min={1} placeholder="500000" value={form.purchaseValue} onChange={(e) => set("purchaseValue", e.target.value)} required />
        <Input label="Current Value (RWF)" type="number" min={0} placeholder="400000" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} required />
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Asset</Button>
      </div>
    </form>
  );
}

// ── Add Liability Form ────────────────────────────────────────────────────────

function AddLiabilityForm({ onSaved, onClose }: { onSaved: (l: Liability) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({ lenderName: "", description: "", principalAmount: "", startDate: "", dueDate: "" });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await apiFetch("/api/v1/liabilities", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, principalAmount: Number(form.principalAmount) }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      onSaved(json.data);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
      <Input label="Lender / Creditor Name" placeholder="e.g. Bank of Kigali" value={form.lenderName} onChange={set("lenderName")} required />
      <Input label="Principal Amount (RWF)" type="number" min={1} placeholder="5000000" value={form.principalAmount} onChange={set("principalAmount")} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Date" type="date" value={form.startDate} onChange={set("startDate")} required />
        <Input label="Due Date (optional)" type="date" value={form.dueDate} onChange={set("dueDate")} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={set("description")}
          rows={2}
          placeholder="e.g. BK business loan for working capital"
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<CreditCard className="w-4 h-4" />}>Record Liability</Button>
      </div>
    </form>
  );
}

// ── Record Payment Form ───────────────────────────────────────────────────────

function RecordPaymentForm({ liability, onSaved, onClose }: { liability: Liability; onSaved: (l: Liability) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({ amount: "", principal: "", interest: "", date: "", notes: "" });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const totalCheck = (Number(form.principal) || 0) + (Number(form.interest) || 0);
  const mismatch   = form.amount && form.principal && form.interest && totalCheck !== Number(form.amount);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await apiFetch(`/api/v1/liabilities/${liability.id}/payments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          amount:    Number(form.amount),
          principal: Number(form.principal || 0),
          interest:  Number(form.interest  || 0),
          date:      form.date,
          notes:     form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      onSaved(json.data.liability);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

      {/* Liability info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm space-y-1.5">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{liability.lenderName}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Outstanding balance</span>
          <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(liability.balanceOutstanding)}</span>
        </div>
      </div>

      <Input label="Total Payment Amount (RWF)" type="number" min={1} placeholder="500000" value={form.amount} onChange={set("amount")} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Principal Portion (RWF)" type="number" min={0} placeholder="400000" value={form.principal} onChange={set("principal")} />
        <Input label="Interest Portion (RWF)"  type="number" min={0} placeholder="100000"  value={form.interest}  onChange={set("interest")}  />
      </div>
      {mismatch && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          Principal + Interest ({formatCurrency(totalCheck)}) does not equal total amount ({formatCurrency(Number(form.amount))})
        </p>
      )}
      <Input label="Payment Date" type="date" value={form.date} onChange={set("date")} required />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={2}
          placeholder="e.g. Instalment 3 of 12"
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
      <p className="text-xs text-gray-400">This payment will automatically be recorded as an expense.</p>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<CheckCircle2 className="w-4 h-4" />}>Record Payment</Button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const { role } = useRole();
  const [tab,              setTab]              = useState<"expenses" | "assets" | "ledger" | "liabilities">("expenses");
  const [expenses,         setExpenses]         = useState<Expense[]>([]);
  const [assets,           setAssets]           = useState<Asset[]>([]);
  const [ledgerEntries,    setLedgerEntries]    = useState<LedgerEntry[]>([]);
  const [liabilities,      setLiabilities]      = useState<Liability[]>([]);
  const [accountBalance,   setAccountBalance]   = useState<number>(0);
  const [loadingExpenses,  setLoadingExpenses]  = useState(true);
  const [loadingAssets,    setLoadingAssets]    = useState(true);
  const [loadingLedger,    setLoadingLedger]    = useState(true);
  const [loadingLiabilities, setLoadingLiabilities] = useState(true);
  const [showExpenseModal,   setShowExpenseModal]   = useState(false);
  const [showAssetModal,     setShowAssetModal]     = useState(false);
  const [showDepositModal,   setShowDepositModal]   = useState(false);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [paymentTarget,      setPaymentTarget]      = useState<Liability | null>(null);
  const [deletingId,         setDeletingId]         = useState<string | null>(null);
  const [deletingAssetId,    setDeletingAssetId]    = useState<string | null>(null);
  const [markPaidExpense,    setMarkPaidExpense]    = useState<Expense | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const isReceptionist    = role === "receptionist";
  const canManageExpenses = ["managing_director", "loan_officer", "receptionist"].includes(role);
  const canManageAssets   = role === "managing_director";
  const canDeposit        = role === "managing_director";
  const canViewBalance    = !isReceptionist;

  const fetchExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const res = await apiFetch("/api/v1/expenses");
      if (res.ok) { const json = await res.json(); setExpenses(json.data ?? []); }
    } finally { setLoadingExpenses(false); }
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const res = await apiFetch("/api/v1/assets");
      if (res.ok) { const json = await res.json(); setAssets(json.data ?? []); }
    } finally { setLoadingAssets(false); }
  }, []);

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const res = await apiFetch("/api/v1/account");
      if (res.ok) {
        const json = await res.json();
        setAccountBalance(json.data.balance ?? 0);
        setLedgerEntries(json.data.entries ?? []);
      }
    } finally { setLoadingLedger(false); }
  }, []);

  const fetchLiabilities = useCallback(async () => {
    setLoadingLiabilities(true);
    try {
      const res = await apiFetch("/api/v1/liabilities");
      if (res.ok) { const json = await res.json(); setLiabilities(json.data ?? []); }
    } finally { setLoadingLiabilities(false); }
  }, []);

  useEffect(() => { fetchExpenses(); },    [fetchExpenses]);
  useEffect(() => { fetchAssets();   },    [fetchAssets]);
  useEffect(() => { fetchLedger();   },    [fetchLedger]);
  useEffect(() => { fetchLiabilities(); }, [fetchLiabilities]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/v1/expenses/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) setExpenses((p) => p.filter((e) => e.id !== id));
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed to delete."); }
    } finally { setDeletingId(null); }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    setDeletingAssetId(id);
    try {
      const res = await apiFetch(`/api/v1/assets/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) setAssets((p) => p.filter((a) => a.id !== id));
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed to delete."); }
    } finally { setDeletingAssetId(null); }
  };

  const paidExpenses   = expenses.filter((e) => e.isPaid);
  const unpaidExpenses = expenses.filter((e) => !e.isPaid);
  const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid      = paidExpenses.reduce((s, e) => s + e.amount, 0);
  const totalUnpaid    = unpaidExpenses.reduce((s, e) => s + e.amount, 0);

  const handleExportExpenses = async (categoryFilter: string | null) => {
    const XLSXStyle = (await import("xlsx-js-style")).default;
    const companyName = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company" : "Company";
    const today = new Date().toLocaleDateString("en-GB");
    const rows = categoryFilter ? expenses.filter((e) => e.category === categoryFilter) : expenses;
    const label = categoryFilter ?? "All Categories";
    const headerRow = ["No.", "Date", "Category", "Description", "Amount (RWF)", "Status"];
    const dataRows = rows.map((e, i) => [
      i + 1,
      new Date(e.date).toLocaleDateString("en-GB"),
      e.category,
      e.description,
      e.amount,
      e.isPaid ? "Paid" : "Unpaid",
    ]);
    const tPaid   = rows.filter((e) => e.isPaid).reduce((s, e) => s + e.amount, 0);
    const tUnpaid = rows.filter((e) => !e.isPaid).reduce((s, e) => s + e.amount, 0);
    const tAll    = rows.reduce((s, e) => s + e.amount, 0);
    const titleRow = [`${companyName} — Expenses: ${label}`, "", "", "", "", ""];
    const dateRow  = [`Generated: ${today}  ·  ${rows.length} records`, "", "", "", "", ""];
    const wsData = [titleRow, dateRow, ["","","","","",""], headerRow, ...dataRows];
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 13 }, { wch: 22 }, { wch: 38 }, { wch: 20 }, { wch: 10 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
    const GREEN = "166534"; const WHITE = "FFFFFF"; const LGRAY = "F3F4F6";
    const BORDER = { style: "thin", color: { rgb: "D1D5DB" } };
    const allBorder = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    const cols = ["A","B","C","D","E","F"];
    const t1 = ws["A1"]; if (t1) t1.s = { font: { bold: true, sz: 16, color: { rgb: WHITE }, name: "Calibri" }, fill: { fgColor: { rgb: GREEN } }, alignment: { horizontal: "center" } };
    const t2 = ws["A2"]; if (t2) t2.s = { font: { sz: 11, color: { rgb: "6B7280" }, name: "Calibri" }, fill: { fgColor: { rgb: "F9FAFB" } }, alignment: { horizontal: "center" } };
    cols.forEach((col) => {
      const cell = ws[`${col}4`];
      if (cell) cell.s = { font: { bold: true, sz: 10, color: { rgb: WHITE }, name: "Calibri" }, fill: { fgColor: { rgb: GREEN } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorder };
    });
    dataRows.forEach((row, ri) => {
      const rowIndex = ri + 5;
      const isAlt = ri % 2 === 1;
      const isPaid = row[5] === "Paid";
      cols.forEach((col, ci) => {
        const cell = ws[`${col}${rowIndex}`];
        if (!cell) return;
        cell.s = {
          font: { sz: 10, name: "Calibri" },
          fill: { fgColor: { rgb: isAlt ? LGRAY : WHITE } },
          alignment: { horizontal: [0, 4].includes(ci) ? "right" : "left", vertical: "center" },
          border: allBorder,
        };
        if (ci === 4) cell.s.font = { ...cell.s.font, bold: true, color: { rgb: "DC2626" } };
        if (ci === 5) cell.s.font = { ...cell.s.font, bold: true, color: { rgb: isPaid ? "166534" : "D97706" } };
      });
    });
    const totals = [["TOTALS", "", "", "Paid", tPaid, ""], ["", "", "", "Unpaid", tUnpaid, ""], ["", "", "", "Total", tAll, ""]];
    XLSXStyle.utils.sheet_add_aoa(ws, totals, { origin: -1 });
    const startTot = dataRows.length + 5;
    [[tPaid, "166534"], [tUnpaid, "D97706"], [tAll, "111827"]].forEach(([amt, color], ti) => {
      const ri = startTot + ti;
      cols.forEach((col, ci) => {
        const cell = ws[`${col}${ri}`];
        if (!cell) return;
        cell.s = { font: { bold: true, sz: 10, name: "Calibri", color: { rgb: ci === 4 ? String(color) : "111827" } }, fill: { fgColor: { rgb: "F0FDF4" } }, alignment: { horizontal: ci === 4 ? "right" : "left" }, border: { ...allBorder, ...(ti === 0 ? { top: { style: "medium" as const, color: { rgb: "16A34A" } } } : {}) } };
      });
    });
    ws["!rows"] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 }, ...dataRows.map(() => ({ hpt: 18 }))];
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Expenses");
    const safeName = label.replace(/\s+/g, "-");
    XLSXStyle.writeFile(wb, `Expenses-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const totalAssetValue    = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalPurchaseValue = assets.reduce((s, a) => s + a.purchaseValue, 0);
  const totalDepreciation  = totalPurchaseValue - totalAssetValue;

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
          <div className="flex gap-3 flex-wrap items-start">
            {/* Account Balance — hidden from receptionist */}
            {canViewBalance && (
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 text-center border border-white/20">
                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                  <Landmark className="w-3.5 h-3.5 text-green-200" />
                  <p className="text-xs text-green-100/80 font-medium">Account Balance</p>
                </div>
                <p className={`text-xl font-extrabold ${accountBalance < 0 ? "text-red-300" : "text-white"}`}>
                  {formatCurrency(accountBalance)}
                </p>
              </div>
            )}
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{expenses.length}</p>
              <p className="text-xs text-green-100/70">Expenses</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{unpaidExpenses.length}</p>
              <p className="text-xs text-green-100/70">Unpaid</p>
            </div>
            {!isReceptionist && (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                <p className="text-lg font-bold">{assets.length}</p>
                <p className="text-xs text-green-100/70">Assets</p>
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3 flex-wrap">
          {tab === "expenses" && canManageExpenses && (
            <button
              onClick={() => setShowExpenseModal(true)}
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          )}
          {tab === "assets" && canManageAssets && (
            <button
              onClick={() => setShowAssetModal(true)}
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          )}
          {tab === "liabilities" && canManageAssets && (
            <button
              onClick={() => setShowLiabilityModal(true)}
              className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Liability
            </button>
          )}
          {canDeposit && (
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" /> Deposit / Withdraw
            </button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {[
          { label: "Expenses",    value: "expenses"    as const, icon: <TrendingDown   className="w-3.5 h-3.5" />, visible: true },
          { label: "Liabilities", value: "liabilities" as const, icon: <CreditCard    className="w-3.5 h-3.5" />, visible: !isReceptionist },
          { label: "Assets",      value: "assets"      as const, icon: <Package        className="w-3.5 h-3.5" />, visible: !isReceptionist },
          { label: "Ledger",      value: "ledger"      as const, icon: <ArrowRightLeft className="w-3.5 h-3.5" />, visible: !isReceptionist },
        ].filter((t) => t.visible).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t.value
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Expenses Tab ── */}
      {tab === "expenses" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Expenses",  value: formatCurrency(totalExpenses), border: "border-l-red-500",    iconBg: "bg-red-500/15 text-red-600 dark:text-red-400",       icon: <TrendingDown    className="w-5 h-5" /> },
              { label: "Paid",            value: formatCurrency(totalPaid),     border: "border-l-emerald-500",iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: <CheckCircle2 className="w-5 h-5" /> },
              { label: "Unpaid",          value: formatCurrency(totalUnpaid),   border: "border-l-amber-500",  iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",   icon: <Clock           className="w-5 h-5" /> },
              { label: "Expense Entries", value: String(expenses.length),       border: "border-l-blue-500",   iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",      icon: <BarChart3        className="w-5 h-5" /> },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn("bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 p-4", stat.border)}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stat.iconBg)}>{stat.icon}</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Expense Records</CardTitle>
                {expenses.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setExportDropdownOpen((o) => !o)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-600 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" /> Export Excel <ChevronDown className="w-3 h-3" />
                    </button>
                    {exportDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setExportDropdownOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[200px]">
                          <button
                            onClick={() => { setExportDropdownOpen(false); handleExportExpenses(null); }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          >
                            All Categories
                          </button>
                          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => { setExportDropdownOpen(false); handleExportExpenses(cat); }}
                              className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              {loadingExpenses ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : expenses.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">No expenses recorded yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      {["Date","Category","Description","Amount","Status","Proof", ...(canManageExpenses ? ["Actions"] : [])].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {expenses.map((expense, i) => (
                      <motion.tr
                        key={expense.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge variant="neutral" className="text-[11px]">{expense.category}</Badge>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300 max-w-[220px] truncate">
                          {expense.description}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-3.5">
                          {expense.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <Clock className="w-3 h-3" /> Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {expense.proofUrl ? (
                            <a
                              href={expense.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 hover:underline"
                            >
                              <Paperclip className="w-3 h-3" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        {canManageExpenses && (
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              {!expense.isPaid && (
                                <button
                                  onClick={() => setMarkPaidExpense(expense)}
                                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                disabled={deletingId === expense.id}
                                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Liabilities Tab ── */}
      {tab === "liabilities" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label:  "Total Borrowed",
                value:  formatCurrency(liabilities.reduce((s, l) => s + l.principalAmount, 0)),
                border: "border-l-blue-500",
                iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                icon:   <CreditCard className="w-5 h-5" />,
              },
              {
                label:  "Outstanding Balance",
                value:  formatCurrency(liabilities.reduce((s, l) => s + l.balanceOutstanding, 0)),
                border: "border-l-red-500",
                iconBg: "bg-red-500/15 text-red-600 dark:text-red-400",
                icon:   <TrendingDown className="w-5 h-5" />,
              },
              {
                label:  "Total Repaid",
                value:  formatCurrency(liabilities.reduce((s, l) => s + l.totalPaid, 0)),
                border: "border-l-emerald-500",
                iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                icon:   <CheckCircle2 className="w-5 h-5" />,
              },
              {
                label:  "Active Liabilities",
                value:  String(liabilities.filter((l) => l.status === "active").length),
                border: "border-l-amber-500",
                iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                icon:   <BarChart3 className="w-5 h-5" />,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn("bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 p-4", stat.border)}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stat.iconBg)}>{stat.icon}</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Liabilities list */}
          {loadingLiabilities ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
          ) : liabilities.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
              <CreditCard className="w-8 h-8 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">No liabilities recorded yet.</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add Liability" to record a company loan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {liabilities.map((lib, i) => {
                const pct = lib.principalAmount > 0
                  ? Math.min(100, Math.round((lib.totalPaid / lib.principalAmount) * 100))
                  : 0;
                return (
                  <motion.div
                    key={lib.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{lib.lenderName}</p>
                          {lib.description && <p className="text-xs text-gray-400 mt-0.5">{lib.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">Started {formatDate(lib.startDate)}{lib.dueDate ? ` · Due ${formatDate(lib.dueDate)}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                          lib.status === "completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {lib.status === "completed" ? "Completed" : "Active"}
                        </span>
                        {lib.status === "active" && (
                          <button
                            onClick={() => setPaymentTarget(lib)}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Record Payment
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Amounts row */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Principal</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(lib.principalAmount)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Total Repaid</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(lib.totalPaid)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Outstanding</p>
                        <p className={cn("text-sm font-bold", lib.balanceOutstanding > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                          {formatCurrency(lib.balanceOutstanding)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Repayment progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Payment history */}
                    {lib.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Payment History</p>
                        <div className="space-y-1.5">
                          {lib.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                              <span className="text-gray-500 dark:text-gray-400">{formatDate(p.date)}</span>
                              <span className="text-gray-600 dark:text-gray-300">
                                Principal: {formatCurrency(p.principal)} · Interest: {formatCurrency(p.interest)}
                              </span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Assets Tab ── */}
      {tab === "assets" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Purchase Value",      value: formatCurrency(totalPurchaseValue), border: "border-l-green-500",  iconBg: "bg-green-500/15 text-green-600 dark:text-green-400",   icon: <Package      className="w-5 h-5" /> },
              { label: "Current Book Value",        value: formatCurrency(totalAssetValue),    border: "border-l-emerald-500",iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: <DollarSign className="w-5 h-5" /> },
              { label: "Accumulated Depreciation",  value: formatCurrency(totalDepreciation),  border: "border-l-amber-500",  iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",   icon: <TrendingDown className="w-5 h-5" /> },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn("bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 p-4", stat.border)}
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stat.iconBg)}>{stat.icon}</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader className="items-center justify-between">
              <CardTitle>Asset Register</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {loadingAssets ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : assets.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">No assets recorded yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      {["Asset Name","Category","Purchase Date","Purchase Value","Current Value","Rate","Depreciation", ...(canManageAssets ? [""] : [])].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {assets.map((asset, i) => (
                      <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{asset.name}</td>
                        <td className="px-6 py-3.5"><Badge variant="neutral" className="text-[11px]">{asset.category}</Badge></td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(asset.purchaseDate)}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(asset.purchaseValue)}</td>
                        <td className="px-6 py-3.5 text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(asset.currentValue)}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{asset.depreciationRate}% p.a.</td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(asset.purchaseValue - asset.currentValue)}</td>
                        {canManageAssets && (
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => handleDeleteAsset(asset.id)}
                              disabled={deletingAssetId === asset.id}
                              className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Ledger Tab ── */}
      {tab === "ledger" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Account Ledger</CardTitle>
                {ledgerEntries.length > 0 && (
                  <button
                    onClick={async () => {
                      const XLSXStyle = (await import("xlsx-js-style")).default;
                      const companyName = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}").companyName ?? "Company" : "Company";
                      const today = new Date().toLocaleDateString("en-GB");
                      const typeLabels: Record<string, string> = {
                        deposit: "Deposit", withdrawal: "Withdrawal",
                        disbursement: "Loan Disbursement", repayment: "Repayment", expense: "Expense Paid",
                      };
                      const headerRow = ["No.", "Date & Time", "Type", "Description", "Reference", "Credit (RWF)", "Debit (RWF)", "Balance Before (RWF)", "Balance After (RWF)"];
                      const dataRows = ledgerEntries.map((e, i) => {
                        const isCredit = e.type === "deposit" || e.type === "repayment";
                        return [
                          i + 1,
                          new Date(e.createdAt).toLocaleString("en-GB"),
                          typeLabels[e.type] ?? e.type,
                          e.description,
                          e.referenceId ?? "",
                          isCredit ? e.amount : "",
                          isCredit ? "" : e.amount,
                          e.balanceBefore,
                          e.balanceAfter,
                        ];
                      });
                      const titleRow = [`${companyName} — Account Ledger Export`, ...Array(8).fill("")];
                      const dateRow  = [`Generated: ${today}  ·  ${ledgerEntries.length} transactions`, ...Array(8).fill("")];
                      const wsData = [titleRow, dateRow, Array(9).fill(""), headerRow, ...dataRows];
                      const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
                      ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
                      ws["!merges"] = [
                        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
                        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
                      ];
                      const GREEN = "166534"; const WHITE = "FFFFFF"; const LGRAY = "F3F4F6";
                      const BORDER = { style: "thin", color: { rgb: "D1D5DB" } };
                      const allBorder = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
                      const cols = ["A","B","C","D","E","F","G","H","I"];
                      const t1 = ws["A1"]; if (t1) t1.s = { font: { bold: true, sz: 16, color: { rgb: WHITE }, name: "Calibri" }, fill: { fgColor: { rgb: GREEN } }, alignment: { horizontal: "center" } };
                      const t2 = ws["A2"]; if (t2) t2.s = { font: { sz: 11, color: { rgb: "6B7280" }, name: "Calibri" }, fill: { fgColor: { rgb: "F9FAFB" } }, alignment: { horizontal: "center" } };
                      cols.forEach((col) => {
                        const cell = ws[`${col}4`];
                        if (cell) cell.s = { font: { bold: true, sz: 10, color: { rgb: WHITE }, name: "Calibri" }, fill: { fgColor: { rgb: GREEN } }, alignment: { horizontal: "center", vertical: "center" }, border: allBorder };
                      });
                      dataRows.forEach((row, ri) => {
                        const rowIndex = ri + 5;
                        const isAlt = ri % 2 === 1;
                        const isCredit = ["Deposit","Repayment"].includes(String(row[2]));
                        cols.forEach((col, ci) => {
                          const cell = ws[`${col}${rowIndex}`];
                          if (!cell) return;
                          cell.s = {
                            font: { sz: 10, name: "Calibri" },
                            fill: { fgColor: { rgb: isAlt ? LGRAY : WHITE } },
                            alignment: { horizontal: [0,5,6,7,8].includes(ci) ? "right" : "left", vertical: "center" },
                            border: allBorder,
                          };
                          // Type label coloring
                          if (ci === 2) cell.s.font = { ...cell.s.font, bold: true, color: { rgb: isCredit ? "166534" : "DC2626" } };
                          // Credit column green
                          if (ci === 5 && row[5] !== "") cell.s.font = { ...cell.s.font, bold: true, color: { rgb: "166534" } };
                          // Debit column red
                          if (ci === 6 && row[6] !== "") cell.s.font = { ...cell.s.font, bold: true, color: { rgb: "DC2626" } };
                        });
                      });
                      ws["!rows"] = [{ hpt: 36 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 }, ...dataRows.map(() => ({ hpt: 18 }))];
                      const wb = XLSXStyle.utils.book_new();
                      XLSXStyle.utils.book_append_sheet(wb, ws, "Ledger");
                      XLSXStyle.writeFile(wb, `Ledger-Export-${new Date().toISOString().slice(0, 10)}.xlsx`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-600 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" /> Export Excel
                  </button>
                )}
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              {loadingLedger ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">Loading…</div>
              ) : ledgerEntries.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">No transactions recorded yet.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                      {["Date","Type","Description","Amount","Balance Before","Balance After"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {ledgerEntries.map((entry, i) => {
                      const isCredit = entry.type === "deposit" || entry.type === "repayment";
                      const typeLabels: Record<string, string> = {
                        deposit: "Deposit", withdrawal: "Withdrawal",
                        disbursement: "Loan Disbursement", repayment: "Repayment", expense: "Expense Paid",
                      };
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-6 py-3.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(entry.createdAt)}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                              isCredit
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {isCredit ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpToLine className="w-3 h-3" />}
                              {typeLabels[entry.type] ?? entry.type}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-700 dark:text-gray-300 max-w-[240px] truncate">
                            {entry.description}
                          </td>
                          <td className={cn("px-6 py-3.5 text-sm font-bold whitespace-nowrap",
                            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {isCredit ? "+" : "−"}{formatCurrency(entry.amount)}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatCurrency(entry.balanceBefore)}
                          </td>
                          <td className={cn("px-6 py-3.5 text-sm font-semibold whitespace-nowrap",
                            entry.balanceAfter < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                          )}>
                            {formatCurrency(entry.balanceAfter)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} title="Record Deposit / Withdrawal" size="sm">
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          onSaved={(balance, entry) => {
            setAccountBalance(balance);
            setLedgerEntries((p) => [entry, ...p]);
            setShowDepositModal(false);
          }}
        />
      </Modal>

      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense" size="sm">
        <ExpenseForm
          onClose={() => setShowExpenseModal(false)}
          onSaved={(expense) => { setExpenses((p) => [expense, ...p]); setShowExpenseModal(false); }}
        />
      </Modal>

      <Modal isOpen={showAssetModal} onClose={() => setShowAssetModal(false)} title="Add Asset" size="md">
        <AssetForm
          onClose={() => setShowAssetModal(false)}
          onSaved={(asset) => { setAssets((p) => [asset, ...p]); setShowAssetModal(false); }}
        />
      </Modal>

      <Modal
        isOpen={!!markPaidExpense}
        onClose={() => setMarkPaidExpense(null)}
        title="Mark Expense as Paid"
        size="sm"
      >
        {markPaidExpense && (
          <MarkPaidModal
            expense={markPaidExpense}
            onClose={() => setMarkPaidExpense(null)}
            onUpdated={(updated) => {
              setExpenses((p) => p.map((e) => e.id === updated.id ? updated : e));
              setMarkPaidExpense(null);
              fetchLedger();
            }}
          />
        )}
      </Modal>

      <Modal isOpen={showLiabilityModal} onClose={() => setShowLiabilityModal(false)} title="Record Company Liability" size="sm">
        <AddLiabilityForm
          onClose={() => setShowLiabilityModal(false)}
          onSaved={(l) => { setLiabilities((p) => [l, ...p]); setShowLiabilityModal(false); }}
        />
      </Modal>

      <Modal isOpen={!!paymentTarget} onClose={() => setPaymentTarget(null)} title="Record Liability Payment" size="sm">
        {paymentTarget && (
          <RecordPaymentForm
            liability={paymentTarget}
            onClose={() => setPaymentTarget(null)}
            onSaved={(updated) => {
              setLiabilities((p) => p.map((l) => l.id === updated.id ? updated : l));
              setPaymentTarget(null);
              fetchExpenses(); // refresh expenses list since a new one was auto-created
            }}
          />
        )}
      </Modal>
    </div>
  );
}
