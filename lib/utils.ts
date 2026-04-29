import { clsx, type ClassValue } from "clsx";
import type { UserRole, LoanStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-RW", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  managing_director: "Managing Director",
  loan_officer: "Loan Officer",
  receptionist: "Receptionist",
  shareholder: "Shareholder",
};

export const STATUS_LABELS: Record<LoanStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  disbursed: "Disbursed",
  active: "Active",
  completed: "Completed",
  rejected: "Rejected",
  overdue: "Overdue",
  written_off: "Written Off",
};

export const STATUS_COLORS: Record<LoanStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  disbursed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  written_off: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};
