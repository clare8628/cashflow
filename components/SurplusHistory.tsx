"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthSummary } from "@/lib/types";

interface Props {
  months: MonthSummary[];
  budget: number;
}

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

export default function SurplusHistory({ months, budget }: Props) {
  const data = months.reduce<{ label: string; surplus: number; cumulative: number }[]>((acc, m) => {
    const surplus = budget - m.spent;
    const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    return [...acc, { label: m.label, surplus, cumulative: prevCumulative + surplus }];
  }, []);

  const finalCumulative = data.length > 0 ? data[data.length - 1].cumulative : 0;
  const summary =
    data.length === 0
      ? "尚無歷史月份資料。"
      : finalCumulative > 0
        ? `累積結餘 ${formatNT(finalCumulative)}，可以考慮規劃一趟旅遊。`
        : finalCumulative < 0
          ? `累積透支 ${formatNT(Math.abs(finalCumulative))}，建議接下來節約花費。`
          : "累積結餘剛好打平。";

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">每月結餘 / 透支歷史</h2>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value, name) => [formatNT(Number(value)), name === "surplus" ? "當月結餘/透支" : "累積結餘/透支"]}
            />
            <ReferenceLine y={0} stroke="#71717a" />
            <Bar dataKey="surplus" name="surplus" radius={[4, 4, 4, 4]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.surplus >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="cumulative" name="cumulative" stroke="#3b82f6" strokeWidth={2} dot />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">{summary}</p>
    </div>
  );
}
