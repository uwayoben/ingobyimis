"use client";
import { useState } from "react";
import { Bell, CheckCheck, BellOff, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Notification } from "@/types";

const TYPE_CONFIG: Record<Notification["type"], { icon: string; bg: string; label: string }> = {
  payment_due: { icon: "💳", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Payment Due" },
  overdue: { icon: "⚠️", bg: "bg-red-100 dark:bg-red-900/30", label: "Overdue" },
  approval_needed: { icon: "✅", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Approval" },
  disbursement: { icon: "💰", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Disbursement" },
  system: { icon: "🔔", bg: "bg-gray-100 dark:bg-gray-800", label: "System" },
};

const TYPE_FILTERS = ["All", "payment_due", "overdue", "approval_needed", "disbursement", "system"] as const;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [typeFilter, setTypeFilter] = useState<string>("All");

  const unread = notifications.filter((n) => !n.isRead).length;

  const filtered = notifications.filter((n) =>
    typeFilter === "All" || n.type === typeFilter
  );

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-900/20"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-green-200 text-sm font-medium mb-0.5">Alerts & Updates</p>
              <h2 className="text-2xl font-bold">Notifications</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 ? (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                <p className="text-lg font-bold">{unread}</p>
                <p className="text-xs text-green-100/70">Unread</p>
              </div>
            ) : (
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-200" />
                <p className="text-sm font-medium text-green-100">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Filter + Mark all */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                typeFilter === f
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {f === "All" ? "All" : TYPE_CONFIG[f as Notification["type"]].label}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BellOff className="w-6 h-6" />}
            title="No notifications"
            description="You're all caught up. New alerts will appear here."
          />
        ) : (
          filtered.map((notif, i) => {
            const cfg = TYPE_CONFIG[notif.type];
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => markRead(notif.id)}
                className={`flex gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${
                  !notif.isRead
                    ? "bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg ${cfg.bg}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${!notif.isRead ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300"}`}>
                      {notif.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="neutral" className="text-[10px]">{cfg.label}</Badge>
                      {!notif.isRead && <div className="w-2 h-2 rounded-full bg-green-500 mt-0.5" />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{notif.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1.5">{timeAgo(notif.createdAt)}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
