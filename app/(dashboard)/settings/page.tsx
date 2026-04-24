"use client";
import { useState } from "react";
import { Save, User, Bell, Shield, Building2, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CURRENT_USER } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const SETTING_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "company", label: "Company", icon: Building2 },
  { id: "appearance", label: "Appearance", icon: Moon },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

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
              <Card>
                <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-2xl font-bold text-white">
                      {CURRENT_USER.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{CURRENT_USER.name}</p>
                      <Button variant="outline" size="sm" className="mt-1.5">Change Photo</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name" defaultValue={CURRENT_USER.name.split(" ")[0]} />
                    <Input label="Last Name" defaultValue={CURRENT_USER.name.split(" ").slice(1).join(" ")} />
                  </div>
                  <Input label="Email" type="email" defaultValue={CURRENT_USER.email} />
                  <Input label="Phone" defaultValue={CURRENT_USER.phone} />
                  <div className="flex justify-end">
                    <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSave}>Save Changes</Button>
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
                    { label: "Payment Due Reminders", description: "Get notified 3 days before a payment is due", enabled: true },
                    { label: "Overdue Alerts", description: "Immediate notification when a payment becomes overdue", enabled: true },
                    { label: "Loan Approval Requests", description: "When a new loan needs your approval", enabled: true },
                    { label: "Disbursement Confirmations", description: "When a loan is successfully disbursed", enabled: false },
                    { label: "Monthly Reports", description: "Receive monthly financial summary reports", enabled: true },
                    { label: "System Maintenance", description: "Scheduled maintenance and system updates", enabled: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                      <ToggleSwitch defaultOn={item.enabled} />
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSave}>Save Preferences</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {tab === "security" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Input label="Current Password" type="password" placeholder="••••••••" />
                  <Input label="New Password" type="password" placeholder="••••••••" />
                  <Input label="Confirm New Password" type="password" placeholder="••••••••" />
                  <div className="flex justify-end">
                    <Button loading={saving} onClick={handleSave}>Update Password</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Two-Factor Authentication</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">Enable 2FA for additional security</p>
                      <p className="text-xs text-gray-500 mt-0.5">Use an authenticator app or SMS</p>
                    </div>
                    <Button variant="outline" size="sm">Enable 2FA</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {tab === "company" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Company Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Input label="Company Name" defaultValue="Ingobyi Finance Ltd" />
                  <Input label="Company Email" type="email" defaultValue="info@ingobyi.rw" />
                  <Input label="Phone" defaultValue="+250 788 000 001" />
                  <Input label="Address" defaultValue="KG 12 Ave, Kigali, Rwanda" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Default Interest Rate (%)" type="number" defaultValue="2.5" />
                    <Input label="Late Payment Penalty (%)" type="number" defaultValue="1" />
                  </div>
                  <div className="flex justify-end">
                    <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSave}>Save Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {tab === "appearance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Light", value: "light", preview: "bg-white border-gray-200" },
                        { label: "Dark", value: "dark", preview: "bg-gray-900 border-gray-700" },
                        { label: "System", value: "system", preview: "bg-gradient-to-br from-white to-gray-900 border-gray-400" },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTheme(t.value)}
                          className={cn(
                            "rounded-xl border-2 p-3 text-center transition-all",
                            theme === t.value ? "border-green-500 ring-1 ring-green-500/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
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
      className={cn("w-10 h-5.5 rounded-full transition-colors relative shrink-0", on ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600")}
      style={{ height: "22px" }}
    >
      <span className={cn("absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")}
        style={{ width: "18px", height: "18px", top: "2px", left: on ? "calc(100% - 20px)" : "2px" }}
      />
    </button>
  );
}
