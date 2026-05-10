"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertCircle, ArrowUpRight, DollarSign, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api-fetch";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type ActivityType = "payment" | "loan_pending" | "disbursement" | "overdue";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  amount: number;
  date: string;
  link: string;
}

const ICONS: Record<ActivityType, React.ReactNode> = {
  payment:      <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  loan_pending: <Clock        className="w-4 h-4 text-amber-500" />,
  disbursement: <DollarSign   className="w-4 h-4 text-green-500" />,
  overdue:      <AlertCircle  className="w-4 h-4 text-red-500" />,
};

const BG: Record<ActivityType, string> = {
  payment:      "bg-emerald-50 dark:bg-emerald-900/20",
  loan_pending: "bg-amber-50 dark:bg-amber-900/20",
  disbursement: "bg-green-50 dark:bg-green-900/20",
  overdue:      "bg-red-50 dark:bg-red-900/20",
};

function fmt(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    apiFetch("/api/v1/activity")
      .then((r) => r.json())
      .then((json) => { if (json.data) setActivities(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <Link
          href="/payments"
          className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
        >
          View all <ArrowUpRight className="w-3 h-3" />
        </Link>
      </CardHeader>

      <CardContent className="px-0 py-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {activities.map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={activity.link}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className={`p-1.5 rounded-full ${BG[activity.type]}`}>
                    {ICONS[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(activity.date)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {fmt(activity.amount)}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
