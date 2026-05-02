"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, Search, ChevronDown, X, LogOut, Settings, User, Loader2, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { timeAgo, ROLE_LABELS } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useRole } from "@/components/RoleContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import Link from "next/link";
import type { Notification } from "@/types";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

const notifTypeColor: Record<string, string> = {
  payment_due:     "bg-blue-100 dark:bg-blue-900/40 text-blue-600",
  overdue:         "bg-red-100 dark:bg-red-900/40 text-red-600",
  approval_needed: "bg-amber-100 dark:bg-amber-900/40 text-amber-600",
  disbursement:    "bg-green-100 dark:bg-green-900/40 text-green-600",
  system:          "bg-gray-100 dark:bg-gray-800 text-gray-500",
};

const notifEmoji: Record<string, string> = {
  payment_due: "💳", overdue: "⚠️", approval_needed: "✅", disbursement: "💰", system: "🔔",
};

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { role } = useRole();

  const [notifOpen, setNotifOpen]   = useState(false);
  const [userOpen, setUserOpen]     = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => {
    setStoredUser(getStoredUser());
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (role === "super_admin") return;
    try {
      const res = await apiFetch("/api/v1/notifications");
      const json = await res.json();
      if (json.data?.notifications) setNotifications(json.data.notifications);
    } catch {}
  }, [role]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unread = notifications.filter((n) => !n.isRead).length;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("user");
      // Hard navigation clears all React state (RoleContext, cached user data, etc.)
      window.location.href = "/login";
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await apiFetch("/api/v1/notifications/mark-all", { method: "POST" });
  };

  const initials = storedUser?.name
    ? storedUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <header className="h-14 flex items-center gap-2 px-3 sm:px-5 border-b border-gray-100 dark:border-gray-800/80 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm shrink-0 sticky top-0 z-30">
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Search */}
      <div className="flex-1 flex items-center">
        <AnimatePresence mode="wait">
          {searchOpen ? (
            <motion.div
              key="open"
              initial={{ width: 120, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 120, opacity: 0 }}
              className="relative flex items-center"
            >
              <Search className="absolute left-3 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                placeholder="Search customers, loans, payments..."
                className="w-full pl-9 pr-4 py-1.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
              <button onClick={() => setSearchOpen(false)} className="absolute right-2.5 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="closed"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Quick search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-400">⌘K</kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Role badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 mr-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-700 dark:text-green-400">{ROLE_LABELS[role]}</span>
        </div>

        <ThemeToggle />

        {/* Notifications bell (not for super_admin) */}
        {role !== "super_admin" && (
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }}
              className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold leading-none border-2 border-white dark:border-gray-950"
                >
                  {unread}
                </motion.span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-[340px] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl z-40 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Notifications</p>
                        {unread > 0 && <p className="text-xs text-green-600 dark:text-green-400">{unread} unread</p>}
                      </div>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-xs text-gray-400">No notifications</div>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${!n.isRead ? "bg-green-50/40 dark:bg-green-900/5" : ""}`}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${notifTypeColor[n.type]}`}>
                                {notifEmoji[n.type]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-1.5">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug flex-1">{n.title}</p>
                                  {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
                      <Link
                        href="/notifications"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* User Avatar + Dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-none">
                {storedUser?.name?.split(" ")[0] ?? "Account"}
              </p>
            </div>
            <ChevronDown className={`w-3 h-3 text-gray-400 hidden sm:block transition-transform ${userOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {userOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl z-40 overflow-hidden"
                >
                  {/* Account info */}
                  <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {storedUser?.name ?? "User"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {storedUser?.email ?? ""}
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          {ROLE_LABELS[role]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-2">
                    <Link
                      href="/settings"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      Account Settings
                    </Link>

                    <div className="h-px bg-gray-100 dark:bg-gray-800 my-1.5" />

                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60"
                    >
                      {loggingOut
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LogOut className="w-4 h-4" />
                      }
                      {loggingOut ? "Logging out…" : "Log out"}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
