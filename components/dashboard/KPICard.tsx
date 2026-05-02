"use client";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  accent?: "green" | "emerald" | "amber" | "red" | "blue" | "violet";
  index?: number;
  subtitle?: string;
}

const accentConfig = {
  green: {
    icon: "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400",
    border: "border-l-green-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-green-500/5",
  },
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    border: "border-l-emerald-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-emerald-500/5",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    border: "border-l-amber-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-amber-500/5",
  },
  red: {
    icon: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    border: "border-l-red-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-red-500/5",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    border: "border-l-blue-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-blue-500/5",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    border: "border-l-violet-500",
    value: "text-gray-900 dark:text-white",
    glow: "after:from-violet-500/5",
  },
};

export function KPICard({ title, value, change, icon, accent = "green", index = 0, subtitle }: KPICardProps) {
  const cfg = accentConfig[accent];
  const isPositive = change !== undefined && change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 overflow-hidden group",
        "hover:shadow-lg hover:shadow-gray-100/80 dark:hover:shadow-black/20 transition-all duration-300",
        "border-l-4",
        cfg.border
      )}
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top left, rgba(22,163,74,0.04) 0%, transparent 70%)" }}
      />

      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl", cfg.icon)}>
          <div className="w-5 h-5">{icon}</div>
        </div>

        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
            isPositive
              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div>
        <p className={cn("text-2xl font-bold tracking-tight mb-0.5", cfg.value)}>{value}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
