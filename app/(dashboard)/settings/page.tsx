"use client";
import { useState, useEffect } from "react";
import { Save, User, Bell, Shield, Building2, Moon, CheckCircle2, AlertCircle, Zap, Hand, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useRole } from "@/components/RoleContext";

const SETTING_TABS = [
  { id: "profile",      label: "Profile",      icon: User      },
  { id: "security",     label: "Security",     icon: Shield    },
  { id: "appearance",   label: "Appearance",   icon: Moon      },
  { id: "notifications",label: "Notifications",icon: Bell      },
  { id: "company",      label: "Company",      icon: Building2 },
];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium",
      type === "success"
        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
    )}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const [stored,  setStored]  = useState<ReturnType<typeof getStoredUser>>(null);
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const s = getStoredUser();
    setStored(s);
    setName(s?.name ?? "");
    setPhone(s?.phone ?? "");
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const res  = await apiFetch("/api/v1/users/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Failed to save." }); return; }

      // Update name in localStorage so navbar reflects the change immediately
      const stored = getStoredUser();
      if (stored) localStorage.setItem("user", JSON.stringify({ ...stored, name: json.data.name, phone: json.data.phone }));

      setMsg({ type: "success", text: "Profile updated successfully." });
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {msg && <Alert type={msg.type} message={msg.text} />}

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
              {name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stored?.email}</p>
            </div>
          </div>

          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your full name"
          />
          <Input
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250 7XX XXX XXX"
          />
          <Input
            label="Email"
            type="email"
            value={stored?.email ?? ""}
            disabled
            className="opacity-60 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 -mt-3">Email cannot be changed. Contact your administrator.</p>

          <div className="flex justify-end">
            <Button type="submit" loading={loading} icon={<Save className="w-4 h-4" />}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword !== form.confirmPassword) {
      setMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res  = await apiFetch("/api/v1/users/me", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Failed to update password." }); return; }
      setMsg({ type: "success", text: "Password changed successfully." });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {msg && <Alert type={msg.type} message={msg.text} />}
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={form.currentPassword}
              onChange={(e) => set("currentPassword", e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              placeholder="At least 6 characters"
              value={form.newPassword}
              onChange={(e) => set("newPassword", e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" loading={loading}>Update Password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Company Tab ───────────────────────────────────────────────────────────────

type AdditionalInterestMode = "manual" | "auto";

function AdditionalInterestModeCard({ role }: { role: string }) {
  const isSuperAdmin = role === "super_admin";
  const [companies, setCompanies]     = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId]     = useState("");
  const [mode, setMode]               = useState<AdditionalInterestMode | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg]                 = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Resolve which company we're editing
  useEffect(() => {
    if (isSuperAdmin) {
      apiFetch("/api/v1/companies")
        .then((r) => r.json())
        .then((json) => {
          const list = (json.data ?? []) as { id: string; name: string }[];
          setCompanies(list);
          setCompanyId((prev) => prev || list[0]?.id || "");
        })
        .catch(() => {});
    } else {
      const stored = getStoredUser();
      setCompanyId(stored?.companyId ?? "");
    }
  }, [isSuperAdmin]);

  // Load the selected company's current setting
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setMsg(null);
    const qs = isSuperAdmin ? `?companyId=${companyId}` : "";
    apiFetch(`/api/v1/company/settings${qs}`)
      .then((r) => r.json())
      .then((json) => setMode(json.data?.additionalInterestMode ?? "manual"))
      .catch(() => setMsg({ type: "error", text: "Failed to load company settings." }))
      .finally(() => setLoading(false));
  }, [companyId, isSuperAdmin]);

  const applyModeChange = async (next: AdditionalInterestMode) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiFetch("/api/v1/company/settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ additionalInterestMode: next, ...(isSuperAdmin ? { companyId } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: json.error ?? "Failed to update." }); return; }
      setMode(next);
      setMsg({ type: "success", text: `Additional interest is now applied ${next === "auto" ? "automatically" : "manually"}.` });
    } catch {
      setMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const requestModeChange = (next: AdditionalInterestMode) => {
    if (next === mode) return;
    if (next === "auto") { setConfirmOpen(true); return; }
    applyModeChange(next);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Additional Interest on Overdue Loans</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Controls how additional interest accrues once a loan falls behind on payments. This does not
          change the loan&apos;s regular interest rate — it only decides who applies the extra monthly
          charge while a loan is overdue.
        </p>

        {isSuperAdmin && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {msg && <Alert type={msg.type} message={msg.text} />}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "manual" as const, label: "Manual",   icon: Hand, desc: "Staff add additional interest themselves via “Add Charge” on a loan. Nothing is applied automatically." },
              { value: "auto"   as const, label: "Auto",     icon: Zap,  desc: "The system charges additional interest automatically for every full 30-day cycle a loan stays overdue, using that loan’s own rate." },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => requestModeChange(opt.value)}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all disabled:opacity-60",
                  mode === opt.value
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <opt.icon className={cn("w-4 h-4", mode === opt.value ? "text-green-600 dark:text-green-400" : "text-gray-400")} />
                  <span className={cn("text-sm font-semibold", mode === opt.value ? "text-green-700 dark:text-green-400" : "text-gray-700 dark:text-gray-300")}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Enable Auto Additional Interest?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This changes how customers are charged.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              From now on, every loan that crosses a new 30-day overdue threshold will automatically be
              charged additional interest at its own rate, with no staff action required. Staff can still
              add manual charges on top at any time. You can switch back to manual at any point.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyModeChange("auto")}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enable Auto Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const { theme, setTheme } = useTheme();
  const { role } = useRole();
  const canManageCompany = ["managing_director", "super_admin"].includes(role);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar */}
        <div className="sm:w-48 shrink-0">
          <nav className="space-y-0.5">
            {SETTING_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  tab === t.id
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {tab === "profile" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProfileTab />
            </motion.div>
          )}

          {tab === "security" && <SecurityTab />}

          {tab === "appearance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Light",  value: "light",  preview: "bg-white border-gray-200" },
                        { label: "Dark",   value: "dark",   preview: "bg-gray-900 border-gray-700" },
                        { label: "System", value: "system", preview: "bg-gradient-to-br from-white to-gray-900 border-gray-400" },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTheme(t.value as "light" | "dark" | "system")}
                          className={cn(
                            "rounded-xl border-2 p-3 text-center transition-all",
                            theme === t.value
                              ? "border-green-500 ring-1 ring-green-500/30"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          )}
                        >
                          <div className={cn("h-16 rounded-lg mb-2 border", t.preview)} />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {tab === "notifications" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Payment Due Reminders",    description: "Get notified 3 days before a payment is due",         enabled: true  },
                    { label: "Overdue Alerts",           description: "Immediate notification when a payment becomes overdue", enabled: true  },
                    { label: "Loan Approval Requests",   description: "When a new loan needs your approval",                  enabled: true  },
                    { label: "Disbursement Confirmations",description: "When a loan is successfully disbursed",               enabled: false },
                    { label: "Monthly Reports",          description: "Receive monthly financial summary reports",            enabled: true  },
                    { label: "System Maintenance",       description: "Scheduled maintenance and system updates",             enabled: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                      <ToggleSwitch defaultOn={item.enabled} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {tab === "company" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {canManageCompany ? (
                <AdditionalInterestModeCard role={role} />
              ) : (
                <Card>
                  <CardHeader><CardTitle>Company Settings</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Company details are managed by your managing director or the Super Admin. Contact them to update company information.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className={cn("rounded-full transition-colors relative shrink-0", on ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600")}
      style={{ width: 40, height: 22 }}
    >
      <span
        className="absolute top-0.5 bg-white rounded-full shadow transition-all"
        style={{ width: 18, height: 18, top: 2, left: on ? "calc(100% - 20px)" : 2 }}
      />
    </button>
  );
}
