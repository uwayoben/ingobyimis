"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Shield, Building2, BarChart3, Users, Globe, Settings2, UserPlus, Loader2, ChevronDown, Bell, Send, ClipboardList, CheckCircle, XCircle, AlertCircle, LogIn, Search, ChevronLeft, ChevronRight, Trash2, TriangleAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api-fetch";

// ── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: "active" | "suspended" | "trial";
  employeeCount: number;
  activeLoans: number;
  totalPortfolio: number;
  createdAt: string;
}

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  loan_officer: "Loan Officer",
  receptionist: "Receptionist",
  shareholder: "Shareholder",
};

const ROLE_COLORS: Record<string, string> = {
  managing_director: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  loan_officer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  receptionist: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  shareholder: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const COMPANY_GRADIENTS = [
  "from-green-500 to-emerald-600",
  "from-blue-500 to-cyan-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
];

// ── Add Company Form ─────────────────────────────────────────────────────────

function AddCompanyForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    adminName: "", adminEmail: "", adminPhone: "", adminPassword: "",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to create company."); return; }
      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Company Details</p>
        <div className="space-y-3">
          <Input label="Company Name" placeholder="MFI Company Ltd" required value={form.name} onChange={set("name")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" placeholder="info@company.rw" required value={form.email} onChange={set("email")} />
            <Input label="Phone" placeholder="+250788000000" required value={form.phone} onChange={set("phone")} />
          </div>
          <Input label="Address" placeholder="KG 12 Ave, Kigali, Rwanda" required value={form.address} onChange={set("address")} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Managing Director Account</p>
        <div className="space-y-3">
          <Input label="Full Name" placeholder="Jean Pierre Habimana" required value={form.adminName} onChange={set("adminName")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" placeholder="director@company.rw" required value={form.adminEmail} onChange={set("adminEmail")} />
            <Input label="Phone" placeholder="+250788000000" required value={form.adminPhone} onChange={set("adminPhone")} />
          </div>
          <Input label="Password" type="password" placeholder="Min 8 characters" required value={form.adminPassword} onChange={set("adminPassword")} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<Building2 className="w-4 h-4" />}>Create Company</Button>
      </div>
    </form>
  );
}

// ── Manage Users Modal ────────────────────────────────────────────────────────

function ManageUsersModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/users?companyId=${company.id}`);
      if (!res.ok) return;
      const json = await res.json();
      setUsers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Delete this user and all their loans/payments? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/v1/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to delete user.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div className="flex flex-col max-h-[80vh]">
      {/* Company header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {company.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{company.name}</p>
          <p className="text-xs text-gray-500">{company.email}</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add User
          <ChevronDown className={`w-3 h-3 transition-transform ${showAddForm ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Add user form (collapsible) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-gray-800"
          >
            <AddUserForm
              companyId={company.id}
              onCreated={() => { fetchUsers(); setShowAddForm(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No users yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={deletingId === user.id}
                    className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    title="Delete user"
                  >
                    {deletingId === user.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-right">
        {users.length} user{users.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function AddUserForm({ companyId, onCreated }: { companyId: string; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "loan_officer", phone: "" });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to create user."); return; }
      setForm({ name: "", email: "", password: "", role: "loan_officer", phone: "" });
      onCreated();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full Name" placeholder="Alice Mukamana" required value={form.name} onChange={set("name")} />
        <Input label="Email" type="email" placeholder="alice@company.rw" required value={form.email} onChange={set("email")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Password" type="password" placeholder="Min 8 characters" required value={form.password} onChange={set("password")} />
        <Input label="Phone" placeholder="+250788000000" value={form.phone} onChange={set("phone")} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Role</label>
        <select
          value={form.role}
          onChange={set("role")}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={loading} icon={<UserPlus className="w-3.5 h-3.5" />}>
          Create User
        </Button>
      </div>
    </form>
  );
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

type AuditAction = "login_attempt" | "login_success" | "login_failed" | "otp_verified" | "otp_failed";

interface AuditLogEntry {
  id: string;
  action: AuditAction;
  userEmail: string;
  userName?: string;
  companyName?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  createdAt: string;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  login_attempt: "Login Attempt",
  login_success: "Login Success",
  login_failed: "Login Failed",
  otp_verified: "OTP Verified",
  otp_failed: "OTP Failed",
};

const ACTION_META: Record<AuditAction, { color: string; icon: React.ReactNode }> = {
  login_attempt:  { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    icon: <LogIn className="w-3 h-3" /> },
  login_success:  { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="w-3 h-3" /> },
  login_failed:   { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         icon: <XCircle className="w-3 h-3" /> },
  otp_verified:   { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle className="w-3 h-3" /> },
  otp_failed:     { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <AlertCircle className="w-3 h-3" /> },
};

function AuditLogsPanel({ companies }: { companies: Company[] }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (companyFilter) params.set("companyId", companyFilter);
      const res = await apiFetch(`/api/v1/audit-logs?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setLogs(json.data?.logs ?? []);
      setMeta(json.data?.meta ?? { total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, companyFilter]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLogs]);

  useEffect(() => { setPage(1); }, [search, actionFilter, companyFilter]);

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString("en-RW", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
  }

  const ACTION_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "All Actions" },
    { value: "login_attempt", label: "Login Attempt" },
    { value: "login_failed", label: "Login Failed" },
    { value: "otp_verified", label: "OTP Verified" },
    { value: "otp_failed", label: "OTP Failed" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or company…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "Loading…" : `${meta.total.toLocaleString()} event${meta.total !== 1 ? "s" : ""}`}
          </p>
          <p className="text-xs text-gray-400">Page {page} of {meta.pages}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3 uppercase tracking-wider">Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">User</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden md:table-cell">Company</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Action</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">IP</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {logs.map((log) => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.login_attempt;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(log.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]">{log.userName ?? "—"}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{log.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-600 dark:text-gray-300">{log.companyName ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                          {meta.icon}
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs font-mono text-gray-500">{log.ipAddress ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{log.details ?? "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="text-xs text-gray-400">{page} / {meta.pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              disabled={page === meta.pages}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded-lg transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Send Notification Modal (super admin) ─────────────────────────────────────

const NOTIF_TYPE_OPTIONS = [
  { value: "system",           label: "System" },
  { value: "payment_due",      label: "Payment Due" },
  { value: "overdue",          label: "Overdue" },
  { value: "approval_needed",  label: "Approval Needed" },
  { value: "disbursement",     label: "Disbursement" },
];

function SendNotificationModal({ companies, onClose }: { companies: Company[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ type: "system", title: "", message: "", targetCompanyId: "all" });

  const set = (f: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to send."); return; }
      setSuccess(form.targetCompanyId === "all"
        ? `Notification sent to all ${companies.length} companies.`
        : "Notification sent successfully.");
      setTimeout(onClose, 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">{success}</p>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Send to</label>
        <select
          value={form.targetCompanyId}
          onChange={set("targetCompanyId")}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Type</label>
        <select
          value={form.type}
          onChange={set("type")}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {NOTIF_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <Input label="Title" placeholder="e.g. System maintenance scheduled" required value={form.title} onChange={set("title")} />

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Message</label>
        <textarea
          value={form.message}
          onChange={set("message")}
          required
          rows={3}
          placeholder="Write your notification message here…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<Send className="w-4 h-4" />}>
          Send Notification
        </Button>
      </div>
    </form>
  );
}

// ── Delete Company Confirmation Modal ────────────────────────────────────────

function DeleteCompanyModal({ company, onClose, onDeleted }: {
  company: Company;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameMatch = confirm.trim() === company.name.trim();

  const handleDelete = async () => {
    if (!nameMatch) return;
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/companies/${company.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to delete company."); return; }
      onDeleted();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">This action cannot be undone</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
            Permanently deletes <span className="font-semibold">{company.name}</span> and all its data:
            {" "}<span className="font-semibold">{company.employeeCount}</span> staff,
            {" "}<span className="font-semibold">{company.activeLoans}</span> loans,
            all customers, payments, and records.
          </p>
        </div>
      </div>

      {/* Confirm by name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Type <span className="font-bold text-gray-900 dark:text-gray-100">{company.name}</span> to confirm
        </label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={company.name}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!nameMatch || loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {loading ? "Deleting…" : "Delete Permanently"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [showSendNotif, setShowSendNotif] = useState(false);
  const [activeTab, setActiveTab] = useState<"companies" | "audit">("companies");

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/companies");
      if (!res.ok) return;
      const json = await res.json();
      setCompanies(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const totalPortfolio = companies.reduce((s, c) => s + c.totalPortfolio, 0);
  const totalLoans = companies.reduce((s, c) => s + c.activeLoans, 0);
  const totalStaff = companies.reduce((s, c) => s + c.employeeCount, 0);
  const activeCount = companies.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-800 via-green-700 to-emerald-700 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-green-200 text-sm font-medium mb-1">System Administration</p>
              <h2 className="text-2xl font-bold">Super Admin Panel</h2>
              <p className="text-green-100/80 text-sm mt-1">Manage all lending companies and their users</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{companies.length}</p>
              <p className="text-xs text-green-100/70">Companies</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">{activeCount}</p>
              <p className="text-xs text-green-100/70">Active</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-lg font-bold">RWF {(totalPortfolio / 1_000_000_000).toFixed(1)}B</p>
              <p className="text-xs text-green-100/70">Total Portfolio</p>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex gap-3 flex-wrap">
          <button
            onClick={() => setShowAddCompany(true)}
            className="bg-white text-green-700 hover:bg-green-50 shadow-sm text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Company
          </button>
          <button
            onClick={() => setShowSendNotif(true)}
            className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-colors border border-white/30"
          >
            <Bell className="w-4 h-4" /> Send Notification
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: companies.length.toString(), icon: <Building2 className="w-5 h-5" />, border: "border-l-green-500", iconBg: "bg-green-500/15 text-green-600 dark:text-green-400" },
          { label: "Active Loans", value: totalLoans.toLocaleString(), icon: <BarChart3 className="w-5 h-5" />, border: "border-l-emerald-500", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
          { label: "Combined Portfolio", value: `RWF ${(totalPortfolio / 1_000_000_000).toFixed(1)}B`, icon: <Globe className="w-5 h-5" />, border: "border-l-blue-500", iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
          { label: "Total Staff", value: totalStaff.toString(), icon: <Users className="w-5 h-5" />, border: "border-l-violet-500", iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-4 ${stat.border} p-4`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.iconBg}`}>
              {stat.icon}
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {[
          { id: "companies" as const, label: "Companies", icon: <Building2 className="w-3.5 h-3.5" /> },
          { id: "audit" as const, label: "Audit Logs", icon: <ClipboardList className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Companies Grid */}
      {activeTab === "companies" && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {companies.map((company, i) => (
              <CompanyCard
                key={company.id}
                company={company}
                gradient={COMPANY_GRADIENTS[i % COMPANY_GRADIENTS.length]}
                onManageUsers={() => setSelectedCompany(company)}
                onDelete={() => setDeleteTarget(company)}
              />
            ))}
          </div>
        )
      )}

      {/* Audit Logs */}
      {activeTab === "audit" && <AuditLogsPanel companies={companies} />}

      {/* Modals */}
      <Modal isOpen={showAddCompany} onClose={() => setShowAddCompany(false)} title="Create New Company" size="md">
        <AddCompanyForm onClose={() => setShowAddCompany(false)} onCreated={fetchCompanies} />
      </Modal>

      <Modal
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={`Users — ${selectedCompany?.name ?? ""}`}
        size="lg"
      >
        {selectedCompany && <ManageUsersModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
      </Modal>

      <Modal isOpen={showSendNotif} onClose={() => setShowSendNotif(false)} title="Send Notification" size="sm">
        <SendNotificationModal companies={companies} onClose={() => setShowSendNotif(false)} />
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Company" size="sm">
        {deleteTarget && (
          <DeleteCompanyModal
            company={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { fetchCompanies(); setDeleteTarget(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

function CompanyCard({ company, gradient, onManageUsers, onDelete }: { company: Company; gradient: string; onManageUsers: () => void; onDelete: () => void }) {
  const initials = company.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-all duration-300 group"
    >
      <div className={`bg-gradient-to-r ${gradient} p-5`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{company.name}</h3>
              <p className="text-xs text-white/70">{company.email}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
            company.status === "active" ? "bg-white/20 text-white" :
            company.status === "suspended" ? "bg-red-500/30 text-white" : "bg-amber-500/30 text-white"
          }`}>
            {company.status}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Active Loans", value: company.activeLoans },
            { label: "Staff", value: company.employeeCount },
            { label: "Portfolio", value: `RWF ${(company.totalPortfolio / 1_000_000).toFixed(0)}M` },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl py-2.5">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-1">
          <Building2 className="w-3 h-3 shrink-0" />
          {company.address}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onManageUsers}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Manage Users
          </button>
          <button className="flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 rounded-xl transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-colors"
            title="Delete company"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
