"use client";
import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, Mail, MapPin, Briefcase, CreditCard, TrendingUp, User, Heart, Building2, Loader2, Calculator, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RoleGate } from "@/components/RoleContext";
import { generateSchedule, FREQUENCY_DAYS } from "@/lib/loan-schedule";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Loan calculator state
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcPrincipal, setCalcPrincipal] = useState("500000");
  const [calcRate, setCalcRate] = useState("24");
  const [calcMethod, setCalcMethod] = useState<"flat" | "declining">("declining");
  const [calcFrequency, setCalcFrequency] = useState<"monthly" | "weekly" | "biweekly" | "daily">("monthly");
  const [calcInstallments, setCalcInstallments] = useState("12");
  const [calcFirstDate, setCalcFirstDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });

  const calcSchedule = useMemo(() => {
    const principal = parseInt(calcPrincipal) || 0;
    const rate = parseFloat(calcRate) || 0;
    const installments = parseInt(calcInstallments) || 1;
    const freqDays = FREQUENCY_DAYS[calcFrequency] ?? 30;
    if (principal <= 0 || installments <= 0) return [];
    return generateSchedule(principal, rate, calcMethod, installments, new Date(calcFirstDate), freqDays);
  }, [calcPrincipal, calcRate, calcMethod, calcFrequency, calcInstallments, calcFirstDate]);

  const calcSummary = useMemo(() => {
    if (!calcSchedule.length) return null;
    const totalInterest = calcSchedule.reduce((s, r) => s + r.interestDue, 0);
    const totalRepayable = calcSchedule.reduce((s, r) => s + r.totalDue, 0);
    const emi = calcSchedule[0]?.totalDue ?? 0;
    return { totalInterest, totalRepayable, emi };
  }, [calcSchedule]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/v1/customers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Failed to delete customer.");
        return;
      }
      router.push("/customers");
    } catch {
      alert("Failed to delete customer.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    apiFetch(`/api/v1/customers/${id}`)
      .then((r) => r.json())
      .then((json) => setCustomer(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p className="text-sm">Customer not found.</p>
        <Link href="/customers" className="text-green-600 text-sm underline mt-2 inline-block">Back to Customers</Link>
      </div>
    );
  }

  const initials = customer.names.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const loans = customer.loans ?? [];
  const payments = customer.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customer.names}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Customer since {formatDate(customer.createdAt)} · {customer.district}, {customer.province}
          </p>
        </div>
        <Badge variant={customer.isActive ? "success" : "neutral"}>{customer.isActive ? "Active" : "Inactive"}</Badge>
        <Button size="sm" onClick={() => router.push(`/loans/new?customerId=${customer.id}`)}>Create Loan</Button>
        <RoleGate roles={["super_admin", "managing_director"]}>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </RoleGate>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl font-bold text-green-600 dark:text-green-400 mb-3">
                  {initials}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{customer.names}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{customer.employmentStatus}</p>
                <p className="text-xs text-gray-400 mt-0.5">{customer.gender} · {customer.maritalStatus}</p>
              </div>

              {/* Personal */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Personal
                </p>
                {[
                  { icon: <CreditCard className="w-3.5 h-3.5" />, label: "National ID", value: customer.nationalId },
                  { icon: <Phone className="w-3.5 h-3.5" />, label: "Phone", value: customer.phone },
                  { icon: <Mail className="w-3.5 h-3.5" />, label: "Email", value: customer.email || "—" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 text-xs">
                    <span className="text-gray-400 mt-0.5 shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-gray-400 text-[10px]">{item.label}</p>
                      <p className="text-gray-700 dark:text-gray-300">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <MapPin className="w-3 h-3" /> Location
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Province", customer.province],
                  ["District", customer.district],
                  ["Sector", customer.sector],
                  ["Cell", customer.cell],
                  ["Village", customer.village],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employment */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Briefcase className="w-3 h-3" /> Employment
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Status", customer.employmentStatus],
                  ["Employer", customer.employerName || "—"],
                  ["NDFSP Relationship", customer.relationshipWithNdfsp || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">{label}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Spouse (if married) */}
          {customer.maritalStatus === "Married" && (customer.spouseName || customer.spousePhone) && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Heart className="w-3 h-3" /> Spouse Information
                </p>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["Name", customer.spouseName || "—"],
                    ["Phone", customer.spousePhone || "—"],
                    ["National ID", customer.spouseIdNumber || "—"],
                    ["Property Regime", customer.maritalPropertyRegime || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-gray-400 shrink-0">{label}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Loan Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Loans", value: loans.length, color: "text-gray-900 dark:text-gray-100" },
              { label: "Active Loans", value: loans.filter((l: any) => ["active","overdue"].includes(l.status)).length, color: "text-green-600 dark:text-green-400" },
              { label: "Outstanding", value: formatCurrency(loans.filter((l: any) => ["active","overdue"].includes(l.status)).reduce((s: number, l: any) => s + l.outstandingBalance, 0)), color: "text-red-600 dark:text-red-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Loan History */}
          <Card>
            <CardHeader className="items-center justify-between">
              <CardTitle>Loan History</CardTitle>
              <Badge variant="neutral">{loans.length} loans</Badge>
            </CardHeader>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {loans.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No loans yet</div>
              ) : loans.map((loan: any) => (
                <Link key={loan.id} href={`/loans/${loan.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <TrendingUp className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(loan.amount)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{loan.purpose} · {loan.installments} months</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[loan.status as keyof typeof STATUS_COLORS] ?? ""}`}>
                      {STATUS_LABELS[loan.status as keyof typeof STATUS_LABELS] ?? loan.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(loan.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Repayment Records */}
          <Card>
            <CardHeader><CardTitle>Repayment Records</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    {["Date", "Amount", "Principal", "Interest", "Penalty", "Method"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-6 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {payments.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-sm text-gray-400">No payments recorded</td></tr>
                  ) : payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-2 text-xs text-gray-700 dark:text-gray-300">{formatDate(p.date)}</td>
                      <td className="px-6 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(p.amount)}</td>
                      <td className="px-6 py-2 text-xs text-gray-600 dark:text-gray-400">{formatCurrency(p.principal)}</td>
                      <td className="px-6 py-2 text-xs text-gray-600 dark:text-gray-400">{formatCurrency(p.interest)}</td>
                      <td className="px-6 py-2 text-xs text-red-600 dark:text-red-400">{p.penalty > 0 ? formatCurrency(p.penalty) : "—"}</td>
                      <td className="px-6 py-2 text-xs">
                        <Badge variant="neutral">{p.method.replace("_", " ")}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {/* Loan Calculator */}
          <Card>
            <button
              type="button"
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              onClick={() => setCalcOpen((o) => !o)}
            >
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Loan Calculator</span>
                <span className="text-xs text-gray-400">— estimate repayments for this customer</span>
              </div>
              {calcOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {calcOpen && (
              <div className="px-6 pb-6 space-y-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                {/* Inputs grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Principal (RWF)</label>
                    <input
                      type="number"
                      min={0}
                      value={calcPrincipal}
                      onChange={(e) => setCalcPrincipal(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Annual Rate (%)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={calcRate}
                      onChange={(e) => setCalcRate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Installments</label>
                    <input
                      type="number"
                      min={1}
                      value={calcInstallments}
                      onChange={(e) => setCalcInstallments(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Interest Method</label>
                    <select
                      value={calcMethod}
                      onChange={(e) => setCalcMethod(e.target.value as "flat" | "declining")}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="declining">Declining Balance</option>
                      <option value="flat">Flat Rate</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Frequency</label>
                    <select
                      value={calcFrequency}
                      onChange={(e) => setCalcFrequency(e.target.value as typeof calcFrequency)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">First Payment Date</label>
                    <input
                      type="date"
                      value={calcFirstDate}
                      onChange={(e) => setCalcFirstDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Summary */}
                {calcSummary && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Installment (EMI)", value: formatCurrency(calcSummary.emi), color: "text-green-600 dark:text-green-400" },
                      { label: "Total Interest", value: formatCurrency(calcSummary.totalInterest), color: "text-amber-600 dark:text-amber-400" },
                      { label: "Total Repayable", value: formatCurrency(calcSummary.totalRepayable), color: "text-blue-600 dark:text-blue-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                        <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Amortization table */}
                {calcSchedule.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800">
                          {["#", "Due Date", "Principal", "Interest", "Total Due"].map((h) => (
                            <th key={h} className="text-left font-semibold text-gray-500 px-4 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {calcSchedule.map((row) => (
                          <tr key={row.installmentNo} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-2 text-gray-400 font-medium">{row.installmentNo}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatDate(row.dueDate.toISOString())}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{formatCurrency(row.principalDue)}</td>
                            <td className="px-4 py-2 text-amber-600 dark:text-amber-400">{formatCurrency(row.interestDue)}</td>
                            <td className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.totalDue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Delete Customer</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Are you sure you want to delete <span className="font-semibold">{customer.names}</span>? All associated data will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
