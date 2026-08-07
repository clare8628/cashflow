"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Entry } from "@/lib/types";
import { colorForCategory, groupByCategory } from "@/lib/categorize";
import CategoryIcon from "./CategoryIcon";

interface Props {
  label: string;
  entries: Entry[];
}

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

export default function CategoryBreakdown({ label, entries }: Props) {
  const groups = useMemo(() => groupByCategory(entries), [entries]);
  const total = useMemo(() => groups.reduce((sum, g) => sum + g.total, 0), [groups]);
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (name: string) => {
    setSelected((prev) => (prev === name ? null : name));
  };

  const selectedGroup = groups.find((g) => g.name === selected) ?? null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{label} 花費分類</h2>

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">本月尚無花費資料。</p>
      ) : (
        <div className="mt-4 flex flex-col gap-6 sm:flex-row">
          <div className="h-64 w-full shrink-0 sm:w-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groups}
                  dataKey="total"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={groups.length > 1 ? 2 : 0}
                  stroke="var(--background)"
                  strokeWidth={2}
                  onClick={(entry) => toggle(entry.name as string)}
                  className="cursor-pointer outline-none"
                >
                  {groups.map((g) => (
                    <Cell
                      key={g.name}
                      fill={colorForCategory(g.name)}
                      opacity={selected && selected !== g.name ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatNT(Number(value)), name]}
                  contentStyle={{ fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1">
            <ul className="flex flex-col gap-1.5">
              {groups.map((g) => {
                const pct = total > 0 ? Math.round((g.total / total) * 100) : 0;
                const isSelected = selected === g.name;
                return (
                  <li key={g.name}>
                    <button
                      type="button"
                      onClick={() => toggle(g.name)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: colorForCategory(g.name) }}
                        >
                          <CategoryIcon name={g.name} className="h-3.5 w-3.5 text-white" />
                        </span>
                        {g.name}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {formatNT(g.total)}（{pct}%）
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedGroup ? (
              <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: colorForCategory(selectedGroup.name) }}
                  >
                    <CategoryIcon name={selectedGroup.name} className="h-3 w-3 text-white" />
                  </span>
                  {selectedGroup.name} 花費明細
                </p>
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
                  {selectedGroup.entries.map((e, i) => (
                    <li
                      key={`${e.month}-${e.day}-${e.description}-${i}`}
                      className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="truncate">
                        {e.month}/{e.day} {e.description}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatNT(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                點選圖表或類別查看花費項目明細。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
