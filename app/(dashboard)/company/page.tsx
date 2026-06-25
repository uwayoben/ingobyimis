"use client";
import { useState, useEffect, useCallback } from "react";
import { UserPlus, Edit2, Trash2, Search, UserCog, CheckCircle2, Loader2, AlertCircle, UserX, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import type { User, UserRole } from "@/types";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; colorClass: string }[] = [
  { value: "managing_director", label: "Managing Director", description: "Full access — approve loans, reports, team management", colorClass: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" },
  { value: "loan_officer", label: "Loan Officer", description: "Create & manage loans, view customers, record payments", colorClass: "border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" },
  { value: "receptionist", label: "Receptionist", description: "Register customers, record payments, basic loan view", colorClass: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400" },
  { value: "shareholder", label: "Shareholder", description: "Read-only access to reports and portfolio metrics", colorClass: "border-violet-200 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400" },
];

const ROLE_PERMS: Record<UserRole, string[]> = {
  super_admin: ["All permissions"],
  managing_director: ["Dashboard", "Customers", "Loans (approve)", "Payments", "Reports", "Accounting", "Company"],
  loan_officer: ["Dashboard", "Customers", "Loans (create)", "Payments", "Notifications"],
  receptionist: ["Dashboard", "Customers", "Payments", "Notifications"],
  shareholder: ["Dashboard (read-only)", "Reports (read-only)"],
};

const roleBadge: Record<string, "info" | "success" | "warning" | "neutral" | "default"> = {
  managing_director: "info", loan_officer: "success", receptionist: "warning", shareholder: "neutral", super_admin: "default",
};

function RoleSelector({ value, onChange }: { value: UserRole | ""; onChange: (r: UserRole) => void }) {
  return (
    <div className="space-y-2.5">
      {ROLE_OPTIONS.map((r) => (
        <label
          key={r.value}
          className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            value === r.value ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <input type="radio" name="role" value={r.value} checked={value === r.value} onChange={() => onChange(r.value)} className="mt-0.5 accent-green-600" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${value === r.value ? "text-green-800 dark:text-green-300" : "text-gray-900 dark:text-gray-100"}`}>{r.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.description}</p>
            {value === r.value && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 flex flex-wrap gap-1">
                {ROLE_PERMS[r.value].map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-2.5 h-2.5" />{p}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: User) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    if (!role) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          phone: form.phone,
          password: form.password,
          role,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create user");
      onCreated(json.data);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center gap-3 mb-6">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? "text-green-700 dark:text-green-400" : "text-gray-400"}`}>
              {s === 1 ? "Personal Info" : "Assign Role"}
            </span>
            {s < 2 && <div className={`w-10 h-px ${step > s ? "bg-green-400" : "bg-gray-200 dark:bg-gray-700"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" placeholder="Alice" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
              <Input label="Last Name" placeholder="Mukamana" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
            </div>
            <Input label="Work Email" type="email" placeholder="alice@ingobyi.rw" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            <Input label="Phone" placeholder="+250 788 000 000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">Continue →</Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mb-2">
              <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
                {form.firstName[0]}{form.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{form.firstName} {form.lastName}</p>
                <p className="text-xs text-gray-500">{form.email}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Select Role & Permissions</p>
            <RoleSelector value={role} onChange={setRole} />
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </div>
            )}
            <div className="flex justify-between gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button type="submit" loading={loading} disabled={!role} icon={<UserPlus className="w-4 h-4" />}>Create Account</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function EditRoleModal({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: (u: User) => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update role");
      onUpdated(json.data);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
        <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">{user.name[0]}</div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change Role</p>
      <RoleSelector value={role} onChange={setRole} />
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  );
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

export default function CompanyPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");

  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUser>>(null);
  useEffect(() => { setStoredUser(getStoredUser()); }, []);

  const companyName = storedUser?.companyName ?? "My Company";
  const companyInitials = companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this team member? They will no longer be able to log in, but all their loans, payments, and records will be preserved.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/v1/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to deactivate user. Please try again.");
        return;
      }
      const json = await res.json();
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...json.data } : u));
    } finally {
      setDeletingId(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to reactivate user. Please try again.");
        return;
      }
      const json = await res.json();
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...json.data } : u));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (filterRole === "all" || u.role === filterRole);
  });

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Company Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage team members and their access permissions</p>
        </div>
        <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Add Team Member</Button>
      </div>

      {/* Company header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-900 to-green-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center text-lg sm:text-xl font-bold shrink-0">{companyInitials}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg">{companyName}</h3>
            <p className="text-green-100/70 text-xs sm:text-sm truncate">{storedUser?.email ?? ""}</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2 text-center shrink-0">
            <p className="text-base sm:text-lg font-bold">{users.length}</p>
            <p className="text-xs text-green-100/70">Members</p>
          </div>
        </div>
      </div>

      {/* Role summary tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setFilterRole(filterRole === r.value ? "all" : r.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm ${filterRole === r.value ? r.colorClass : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"}`}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{roleCounts[r.value] || 0}</p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-0.5">{r.label}</p>
          </button>
        ))}
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {filterRole !== "all" && (
              <button onClick={() => setFilterRole("all")} className="text-xs text-green-600 dark:text-green-400 hover:underline">Clear filter</button>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading team members…</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 pl-6 pr-4 py-3">Member</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 hidden lg:table-cell">Permissions</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 hidden md:table-cell">Joined</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                <AnimatePresence>
                  {filtered.map((user, i) => (
                    <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
                      <td className="pl-6 pr-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${user.isActive !== false ? "bg-green-400" : "bg-gray-300"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                            {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={roleBadge[user.role] || "neutral"}>{ROLE_LABELS[user.role]}</Badge>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ROLE_PERMS[user.role].slice(0, 3).map((p) => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{p}</span>
                          ))}
                          {ROLE_PERMS[user.role].length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400">+{ROLE_PERMS[user.role].length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? "bg-green-400" : "bg-gray-300"}`} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">{user.isActive !== false ? "Active" : "Inactive"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => setEditUser(user)}>Edit Role</Button>
                          {user.isActive !== false ? (
                            <button
                              disabled={deletingId === user.id}
                              onClick={() => handleDeactivate(user.id)}
                              title="Deactivate user"
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                            >
                              {deletingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button
                              disabled={deletingId === user.id}
                              onClick={() => handleReactivate(user.id)}
                              title="Reactivate user"
                              className="p-1.5 rounded-lg text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40"
                            >
                              {deletingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-14 text-center">
              <UserCog className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{search ? "No members match your search" : "No team members yet"}</p>
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Team Member" size="md">
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={(u) => setUsers((prev) => [u, ...prev])} />
      </Modal>
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit Role & Permissions" size="md">
        {editUser && (
          <EditRoleModal
            user={editUser}
            onClose={() => setEditUser(null)}
            onUpdated={(updated) => {
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
              setEditUser(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
