"use client";
import { useState } from "react";
import { UserPlus, Edit2, Trash2, Search, UserCog, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { USERS } from "@/lib/mock-data";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
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
            value === r.value ? `border-green-500 bg-green-50 dark:bg-green-900/10` : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
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

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole | "">("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); onClose(); }, 1200);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      {/* Steps */}
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
            <Input label="Phone" placeholder="+250 788 000 000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
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

function EditRoleModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);
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
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onClose(); }, 800); }}>Save Changes</Button>
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");

  const filtered = USERS.filter((u) => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (filterRole === "all" || u.role === filterRole);
  });

  const roleCounts = USERS.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {} as Record<string, number>);

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
      <div className="relative overflow-hidden bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold shrink-0">IF</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">Ingobyi Finance Ltd</h3>
            <p className="text-green-100/80 text-sm">KG 12 Ave, Kigali, Rwanda · info@ingobyi.rw</p>
          </div>
          <div className="flex gap-3">
            {[{ label: "Members", v: USERS.length }, { label: "Active Loans", v: 342 }, { label: "Customers", v: 512 }].map((s) => (
              <div key={s.label} className="bg-white/15 rounded-xl px-4 py-2 text-center">
                <p className="text-lg font-bold">{s.v}</p>
                <p className="text-xs text-green-100/70">{s.label}</p>
              </div>
            ))}
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                {["Member", "Role", "Permissions", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 first:pl-6 last:pr-6">{h}</th>
                ))}
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
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-gray-900" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
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
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-xs text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={() => setEditUser(user)}>Edit Role</Button>
                        <button className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <UserCog className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No members found</p>
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Team Member" size="md">
        <CreateUserModal onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit Role & Permissions" size="md">
        {editUser && <EditRoleModal user={editUser} onClose={() => setEditUser(null)} />}
      </Modal>
    </div>
  );
}
