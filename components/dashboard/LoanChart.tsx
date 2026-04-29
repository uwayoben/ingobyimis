"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useTheme } from "@/components/ThemeProvider";
import { apiFetch } from "@/lib/api-fetch";

interface ChartRow { month: string; disbursed: number; collected: number; }

function formatM(value: number) {
  return `${(value / 1_000_000).toFixed(0)}M`;
}

export function LoanChart() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const gridColor = dark ? "#1f2937" : "#f3f4f6";
  const textColor = dark ? "#6b7280" : "#9ca3af";

  const [data, setData] = useState<ChartRow[]>([]);

  useEffect(() => {
    const year = new Date().getFullYear();
    apiFetch(`/api/v1/reports/summary?from=${year}-01-01&to=${year}-12-31`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.chartData) setData(json.data.chartData);
      })
      .catch(() => {});
  }, []);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Loan Portfolio Trend</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-sm text-gray-400 dark:text-gray-500">
            No data for this year yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="disbursed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatM} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`RWF ${formatM(Number(v))}`, ""]}
                contentStyle={{ background: dark ? "#111827" : "#fff", border: `1px solid ${dark ? "#1f2937" : "#e5e7eb"}`, borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="disbursed" name="Disbursed" stroke="#16a34a" fill="url(#disbursed)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" fill="url(#collected)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
