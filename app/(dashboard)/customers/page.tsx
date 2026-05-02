"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Filter, User, Users, TrendingUp, CreditCard, UserCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomerForm } from "@/components/customers/CustomerForm";
import Link from "next/link";
import type { Customer } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

function formatCurrency(n: number) {
  return "RWF " + n.toLocaleString();
}

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active Loans", value: "active" },
  { label: "No Loans", value: "none" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      const res = await apiFetch(`/api/v1/customers?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setCustomers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCustomers, search]);

  const filtered = customers.filter((c) => {
    if (filter === "active") return (c.activeLoans ?? 0) > 0;
    if (filter === "none") return (c.activeLoans ?? 0) === 0;
    return true;
  });

  const activeCount = customers.filter((c) => (c.activeLoans ?? 0) > 0).length;
  const totalOutstanding = customers.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0);
  const employedCount = customers.filter((c) => c.employmentStatus && c.employmentStatus !== "Unemployed").length;
  const employedPct = customers.length > 0 ? Math.round((employedCount / customers.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-green-200 text-sm font-medium mb-1">Customer Management</p>
            <h2 className="text-xl sm:text-2xl font-bold">Customers</h2>
            <p className="text-green-100/80 text-sm mt-1">Manage borrowers and track loan portfolios</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{customers.length}</p>
              <p className="text-xs text-green-100/70">Registered</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">{activeCount}</p>
              <p className="text-xs text-green-100/70">Borrowers</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-base sm:text-lg font-bold">RWF {(totalOutstanding / 1_000_000).toFixed(1)}M</p>
              <p className="text-xs text-green-100/70">Outstanding</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: customers.length.toString(), icon: <Users className="w-5 h-5" />, color: "bg-green-500/15 text-green-600 dark:text-green-400", border: "border-l-green-500" },
          { label: "Active Borrowers", value: activeCount.toString(), icon: <UserCheck className="w-5 h-5" />, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
          { label: "Outstanding Balance", value: `RWF ${(totalOutstanding / 1_000_000).toFixed(1)}M`, icon: <CreditCard className="w-5 h-5" />, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
          { label: "Employed", value: customers.length > 0 ? `${employedPct}%` : "—", icon: <TrendingUp className="w-5 h-5" />, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${stat.border} p-4`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, national ID..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filter === f.value
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "Loading…" : `${filtered.length} customer${filtered.length !== 1 ? "s" : ""}`}
          </p>
          <Button variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>Export</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<User className="w-6 h-6" />}
            title="No customers found"
            description="Try adjusting your search or add a new customer."
            action={<Button size="sm" onClick={() => setShowModal(true)}>Add Customer</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-6 py-3 uppercase tracking-wider">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wider hidden md:table-cell">National ID</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Location</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wider hidden sm:table-cell">Loans</th>
                  <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wider">Outstanding</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                <AnimatePresence>
                  {filtered.map((customer, i) => (
                    <CustomerRow key={customer.id} customer={customer} index={i} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Customer" size="lg">
        <CustomerForm
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchCustomers(); }}
        />
      </Modal>
    </div>
  );
}

function CustomerRow({ customer, index }: { customer: Customer; index: number }) {
  const initials = customer.names.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const gradients = [
    "from-green-500 to-emerald-600",
    "from-blue-500 to-cyan-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
  ];
  const gradient = gradients[index % gradients.length];

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      <td className="px-6 py-3.5">
        <Link href={`/customers/${customer.id}`} className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{customer.names}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md">{customer.nationalId}</span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <p className="text-xs text-gray-700 dark:text-gray-300">{customer.district}</p>
        <p className="text-[11px] text-gray-400">{customer.province}</p>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{customer.totalLoans}</span>
          <span className="text-xs text-gray-400">total</span>
          {(customer.activeLoans ?? 0) > 0 && (
            <Badge variant="success" className="ml-1 text-[10px]">{customer.activeLoans} active</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className={`text-sm font-semibold ${(customer.outstandingBalance ?? 0) > 0 ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
          {(customer.outstandingBalance ?? 0) > 0 ? formatCurrency(customer.outstandingBalance!) : "—"}
        </span>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <Badge variant={customer.isActive ? "success" : "neutral"} className="text-[10px]">
          {customer.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
    </motion.tr>
  );
}
