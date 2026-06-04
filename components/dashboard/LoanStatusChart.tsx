"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useTheme } from "@/components/ThemeProvider";
import { apiFetch } from "@/lib/api-fetch";

const STATUS_COLORS: Record<string, string> = {
  active:      "#16a34a",
  overdue:     "#dc2626",
  pending:     "#d97706",
  approved:    "#3b82f6",
  disbursed:   "#8b5cf6",
  completed:   "#6b7280",
  rejected:    "#9ca3af",
  written_off: "#374151",
};

const STATUS_LABELS: Record<string, string> = {
  active:      "Active",
  overdue:     "Overdue",
  pending:     "Pending",
  approved:    "Approved",
  disbursed:   "Disbursed",
  completed:   "Completed",
  rejected:    "Rejected",
  written_off: "Written Off",
};

export function LoanStatusChart() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    apiFetch("/api/v1/loans?limit=100")
      .then((r) => r.json())
      .then((json) => {
        const loans: any[] = json.data ?? [];
        const counts: Record<string, number> = {};
        loans.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
        const chartData = Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([status, value]) => ({
            name:  STATUS_LABELS[status] ?? status,
            value,
            color: STATUS_COLORS[status] ?? "#9ca3af",
          }))
          .sort((a, b) => b.value - a.value);
        setData(chartData);
      })
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Status Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No loan data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [`${value} loan${value !== 1 ? "s" : ""}`]}
                contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
