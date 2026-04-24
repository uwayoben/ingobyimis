"use client";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertCircle, ArrowUpRight, DollarSign } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PAYMENTS, LOANS } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/mock-data";
import Link from "next/link";

const RECENT_ACTIVITIES = [
  ...PAYMENTS.slice(0, 3).map((p) => ({
    id: p.id, type: "payment" as const, title: `Payment received from ${p.customerName}`,
    amount: p.amount, date: p.date, link: `/payments`,
  })),
  ...LOANS.filter((l) => l.status === "pending").slice(0, 2).map((l) => ({
    id: l.id, type: "loan_pending" as const, title: `Loan application by ${l.customerName}`,
    amount: l.amount, date: l.createdAt, link: `/loans/${l.id}`,
  })),
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

const icons = {
  payment: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  loan_pending: <Clock className="w-4 h-4 text-amber-500" />,
  overdue: <AlertCircle className="w-4 h-4 text-red-500" />,
  disbursement: <DollarSign className="w-4 h-4 text-green-500" />,
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader className="items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Link href="/payments" className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1">
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {RECENT_ACTIVITIES.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                {icons[activity.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{activity.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(activity.date)}</p>
              </div>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {formatCurrency(activity.amount)}
              </span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
