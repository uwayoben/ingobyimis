"use client";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, Plus, Search, ArrowDownUp, Loader2,
  ReceiptText, ShieldAlert, CheckCircle2, Clock, CreditCard,
  TrendingDown, History,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import type { Loan } from "@/types";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

const statusConfig: Record<string, { variant: "danger" | "warning" | "info" | "success" | "neutral"; label: string }> = {
  active:      { variant: "success", label: "Active" },
  overdue:     { variant: "danger",  label: "Overdue" },
  disbursed:   { variant: "info",    label: "Disbursed" },
  pending:     { variant: "warning", label: "Pending" },
  completed:   { variant: "neutral", label: "Completed" },
  rejected:    { variant: "danger",  label: "Rejected" },
  written_off: { variant: "danger",  label: "Written Off" },
};

const methodConfig: Record<string, { variant: "success" | "info" | "neutral"; label: string }> = {
  cash:          { variant: "success", label: "Cash" },
  bank_transfer: { variant: "info",    label: "Bank Transfer" },
  mobile_money:  { variant: "neutral", label: "Mobile Money" },
};

interface ActivePenalty {
  id: string;
  customerName: string;
  customerId: string;
  penaltyAmount: number;
  status: string;
  daysOverdue: number;
  balanceOutstanding: number;
  nextPaymentDate: string | null;
  loanClass: string;
}

interface PenaltyHistoryEntry {
  id: string;
  loanId: string;
  reference: string;
  customerName: string;
  penaltyAmount: number;
  date: string;
  method: string;
  recordedByName: string;
  notes: string | null;
}

interface Summary {
  totalPenaltyAccrued: number;
  totalPenaltyCollected: number;
  loansWithPenalties: number;
}

function AddPenaltyForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/loans?status=active&limit=100")
      .then((r) => r.json())
      .then((j) => {
        const active: Loan[] = j.data ?? [];
        // Also fetch overdue loans
        return apiFetch("/api/v1/loans?status=overdue&limit=100")
          .then((r) => r.json())
          .then((j2) => setActiveLoans([...active, ...(j2.data ?? [])]));
      });
  }, []);

  const selectedLoan = activeLoans.find((l) => l.id === loanId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loanId || !amount) { setError("Loan and amount are required."); return; }
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) { setError("Enter a valid penalty amount."); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId, amount: parsed, reason: reason || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to add penalty."); return; }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      <Select
        label="Select Loan (active or overdue)"
        options={[
          { value: "", label: "— Select loan —" },
          ...activeLoans.map((l) => ({
            value: l.id,
            label: `${l.customerName} — ${l.id.slice(0, 10).toUpperCase()} (${formatCurrency(l.balanceOutstanding)} outstanding)`,
          })),
        ]}
        value={loanId}
        onChange={(e) => setLoanId(e.target.value)}
        required
      />

      {selectedLoan && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p>Customer: <strong>{selectedLoan.customerName}</strong></p>
          <p>Outstanding balance: <strong>{formatCurrency(selectedLoan.balanceOutstanding)}</strong></p>
          {selectedLoan.penaltyAmount > 0 && (
            <p>Existing penalty: <strong>{formatCurrency(selectedLoan.penaltyAmount)}</strong></p>
          )}
          {selectedLoan.daysOverdue > 0 && (
            <p>Days overdue: <strong>{selectedLoan.daysOverdue}</strong></p>
          )}
        </div>
      )}

      <Input
        label="Penalty Amount (RWF)"
        type="number"
        min="1"
        placeholder="e.g. 5000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <Textarea
        label="Reason (optional)"
        placeholder="Late payment penalty, default penalty..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading}>Add Penalty</Button>
      </div>
    </form>
  );
}

type ActiveTab = "active" | "history";

export default function PenaltiesPage() {
  const [summary, setSummary] = useState<Summary>({ totalPenaltyAccrued: 0, totalPenaltyCollected: 0, loansWithPenalties: 0 });
  const [activePenalties, setActivePenalties] = useState<ActivePenalty[]>([]);
  const [penaltyHistory, setPenaltyHistory] = useState<PenaltyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>("active");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/penalties");
      if (!res.ok) return;
      const json = await res.json();
      setSummary(json.data?.summary ?? { totalPenaltyAccrued: 0, totalPenaltyCollected: 0, loansWithPenalties: 0 });
      setActivePenalties(json.data?.activePenalties ?? []);
      setPenaltyHistory(json.data?.penaltyHistory ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredActive = activePenalties.filter((p) =>
    !search || p.customerName.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHistory = penaltyHistory.filter((p) =>
    !search || p.customerName.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase())
  );

  const summaryCards = [
    {
      label: "Total Accrued",
      value: formatCurrency(summary.totalPenaltyAccrued),
      sub: "Outstanding unpaid penalties",
      icon: <AlertTriangle className="w-5 h-5" />,
      border: "border-l-red-500",
      iconBg: "bg-red-500/15 text-red-600 dark:text-red-400",
    },
    {
      label: "Total Collected",
      value: formatCurrency(summary.totalPenaltyCollected),
      sub: "All-time penalty revenue",
      icon: <CheckCircle2 className="w-5 h-5" />,
      border: "border-l-emerald-500",
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Loans with Penalties",
      value: summary.loansWithPenalties.toString(),
      sub: "Loans carrying a balance",
      icon: <ShieldAlert className="w-5 h-5" />,
      border: "border-l-amber-500",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header Banner ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-red-900 via-red-800 to-rose-800 rounded-2xl p-6 text-white shadow-lg"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-red-300 text-sm font-medium mb-1">Collections</p>
            <h2 className="text-xl sm:text-2xl font-bold">Penalties</h2>
            <p className="text-red-100/80 text-sm mt-1">
              {summary.loansWithPenalties} loan{summary.loansWithPenalties !== 1 ? "s" : ""} with unpaid penalties
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">RWF {(summary.totalPenaltyAccrued / 1_000).toFixed(0)}K</p>
              <p className="text-xs text-red-100/70">Accrued</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">RWF {(summary.totalPenaltyCollected / 1_000).toFixed(0)}K</p>
              <p className="text-xs text-red-100/70">Collected</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-red-700 hover:bg-red-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Penalty
          </button>
        </div>
      </motion.div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${card.border} p-4 hover:shadow-md transition-all`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.iconBg}`}>
              {card.icon}
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs + Search ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setTab("active")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "active"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Active Penalties
            {activePenalties.length > 0 && (
              <span className="ml-1 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full px-1.5 py-0.5 font-bold">
                {activePenalties.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "history"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Collection History
          </button>
        </div>

        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "active" ? "Search by customer or loan…" : "Search by customer or reference…"}
            className="w-full sm:w-64 pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* ── Active Penalties Table ─────────────────────────────────────── */}
      {tab === "active" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {filteredActive.length} loan{filteredActive.length !== 1 ? "s" : ""} with outstanding penalties
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ) : filteredActive.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="No outstanding penalties"
              description="All active loans are penalty-free."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    {["Customer", "Loan ID", "Status", "Penalty Accrued", "Days Overdue", "Outstanding Balance", "Loan Class", "Action"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredActive.map((row, i) => {
                    const sc = statusConfig[row.status] ?? { variant: "neutral" as const, label: row.status };
                    const isHighRisk = row.daysOverdue > 30 || row.loanClass !== "Normal";
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="pl-6 pr-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-700 dark:text-red-400 text-xs font-bold shrink-0">
                              {row.customerName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{row.customerName}</p>
                              {isHighRisk && (
                                <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> High risk
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                            {row.id.slice(0, 12).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(row.penaltyAmount)}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {row.daysOverdue > 0 ? (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${row.daysOverdue > 30 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                              {row.daysOverdue}d
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 dark:text-gray-300 font-semibold">
                          {formatCurrency(row.balanceOutstanding)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                            row.loanClass === "Normal" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            row.loanClass === "Watch" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            row.loanClass === "Substandard" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            row.loanClass === "Doubtful" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-gray-800 text-gray-100 dark:bg-gray-700"
                          }`}>
                            {row.loanClass}
                          </span>
                        </td>
                        <td className="px-4 pr-6 py-3.5">
                          <button
                            onClick={() => setShowModal(true)}
                            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add More
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Penalty Collection History ─────────────────────────────────── */}
      {tab === "history" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {filteredHistory.length} penalty payment{filteredHistory.length !== 1 ? "s" : ""} collected
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-6 h-6" />}
              title="No penalty payments yet"
              description="Penalty collections will appear here once payments are recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    {["Reference", "Customer", "Penalty Collected", "Date", "Method", "Recorded By"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 first:pl-6 last:pr-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredHistory.map((entry, i) => {
                    const m = methodConfig[entry.method] ?? { variant: "neutral" as const, label: entry.method };
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="pl-6 pr-4 py-3.5">
                          <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                            {entry.reference}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.customerName}</p>
                          <p className="text-xs font-mono text-gray-400">{entry.loanId.slice(0, 12).toUpperCase()}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(entry.penaltyAmount)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>
                        </td>
                        <td className="px-4 pr-6 py-3.5 text-xs text-gray-500 dark:text-gray-400">{entry.recordedByName}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add Penalty Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Penalty to Loan" size="md">
        <AddPenaltyForm
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData(); }}
        />
      </Modal>
    </div>
  );
}
