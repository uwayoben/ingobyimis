"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, FileText, CreditCard, BarChart3, Settings,
  Building2, LogOut, Shield, ChevronLeft, ChevronRight,
  Bell, BookOpen, Package, TrendingUp, AlertTriangle, X, Receipt, Calculator,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import type { UserRole } from "@/types";
import { useRole } from "@/components/RoleContext";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

const ALL_NAV_ITEMS = [
  {
    group: "Overview",
    items: [
      { href: "/admin",     label: "Admin Panel", icon: Shield,          roles: ["super_admin"] },
      { href: "/dashboard", label: "Dashboard",   icon: LayoutDashboard, roles: ["managing_director", "loan_officer", "receptionist", "shareholder"] },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/customers",       label: "Customers",       icon: Users,          roles: ["super_admin", "managing_director", "loan_officer", "receptionist"] },
      { href: "/loans",           label: "Loans",           icon: FileText,       roles: ["managing_director", "loan_officer", "receptionist"] },
      { href: "/loan-calculator", label: "Loan Calculator", icon: Calculator,     roles: ["managing_director", "loan_officer"] },
      { href: "/payments",        label: "Payments",        icon: CreditCard,     roles: ["managing_director", "loan_officer"] },
      { href: "/penalties",       label: "Penalties",       icon: AlertTriangle,  roles: ["managing_director", "loan_officer"] },
    ],
  },
  {
    group: "Finance",
    items: [
      { href: "/reports",    label: "Reports",    icon: BarChart3, roles: ["managing_director", "loan_officer", "shareholder"] },
      { href: "/accounting", label: "Accounting", icon: BookOpen,  roles: ["managing_director", "loan_officer"] },
      { href: "/accounting", label: "Expenses",   icon: Receipt,   roles: ["receptionist"] },
      { href: "/assets",     label: "Assets",     icon: Package,   roles: ["managing_director"] },
    ],
  },
  {
    group: "Management",
    items: [
      { href: "/company",       label: "Manage Users",  icon: Building2, roles: ["managing_director"] },
      { href: "/notifications", label: "Notifications", icon: Bell,      roles: ["managing_director", "loan_officer", "receptionist"] },
    ],
  },
  {
    group: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "managing_director", "loan_officer", "receptionist", "shareholder"] },
    ],
  },
];

const ROLE_ICONS: Record<UserRole, React.FC<{ className?: string }>> = {
  super_admin: Shield,
  managing_director: TrendingUp,
  loan_officer: FileText,
  receptionist: Users,
  shareholder: BarChart3,
};

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { role } = useRole();
  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => { setStoredUser(getStoredUser()); }, []);

  const RoleIcon = ROLE_ICONS[role] ?? Shield;

  const companyName = storedUser?.role === "super_admin"
    ? "NDF Platform"
    : (storedUser?.companyName ?? "");

  const companySubtitle = storedUser?.role === "super_admin"
    ? "System Administration"
    : "NDF Platform";

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    localStorage.removeItem("user");
    // Hard navigation clears all React state (RoleContext, cached user data, etc.)
    window.location.href = "/login";
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 248 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full overflow-hidden bg-[#052e16] text-white"
      style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.25)" }}
    >
      {/* Mobile close button */}
      {onMobileClose && (
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 z-10 lg:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Logo Header */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0 shadow-lg">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="font-bold text-sm text-white leading-none">{companyName}</p>
              <p className="text-[10px] text-green-300/70 mt-0.5">{companySubtitle}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {ALL_NAV_ITEMS.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.group}>
              {!collapsed && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  {group.group}
                </p>
              )}
              {collapsed && <div className="py-1" />}
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                      isActive
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-900/40"
                        : "text-white/55 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-white/55 group-hover:text-white")} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="whitespace-nowrap overflow-hidden font-medium text-[13px]"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && !collapsed && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className={cn("w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors", collapsed && "justify-center")}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-xs font-bold shrink-0 shadow">
            {(storedUser?.name ?? "U")[0]}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-xs font-semibold text-white truncate">{storedUser?.name ?? "User"}</p>
                <p className="text-[10px] text-white/40 truncate">{storedUser?.email ?? ""}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && <LogOut className="w-3.5 h-3.5 text-white/50 hover:text-white shrink-0" />}
        </button>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute top-[72px] -right-3 w-6 h-6 rounded-full bg-green-700 border-2 border-[#052e16] flex items-center justify-center text-white z-20 hover:bg-green-600 transition-colors shadow-md"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
