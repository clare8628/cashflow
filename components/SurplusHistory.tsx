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
    <div className="rounded-sm border border-border bg-card p-8">
      <h2 className="font-serif text-base font-semibold tracking-wide text-foreground">每月結餘 ／ 透支歷史</h2>

      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted)" }} />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value, name) => [formatNT(Number(value)), name === "surplus" ? "當月結餘/透支" : "累積結餘/透支"]}
              contentStyle={{ fontSize: 13, borderRadius: 2 }}
            />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="surplus" name="surplus" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.surplus >= 0 ? "var(--status-good)" : "var(--status-critical)"} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="cumulative" name="cumulative" stroke="var(--accent)" strokeWidth={2} dot />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-5 text-sm text-secondary">{summary}</p>
    </div>
  );
}
