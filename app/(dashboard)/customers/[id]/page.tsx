"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, Mail, MapPin, Briefcase, CreditCard, TrendingUp, User, Heart, Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/customers/${id}`)
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
        </div>
      </div>
    </div>
  );
}
