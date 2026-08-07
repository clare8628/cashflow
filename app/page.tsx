"use client";

import { useCallback, useEffect, useState } from "react";
import MonthProgress from "@/components/MonthProgress";
import SurplusHistory from "@/components/SurplusHistory";
import type { NotionSummaryResponse } from "@/lib/types";

const BUDGET_STORAGE_KEY = "cashflow_budget";
const DEFAULT_BUDGET = 30000;

export default function Home() {
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [data, setData] = useState<NotionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount
      if (!Number.isNaN(parsed)) setBudget(parsed);
    }
    setBudgetLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notion", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "讀取失敗");
      setData(json as NotionSummaryResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, [refresh]);

  const handleBudgetChange = (value: number) => {
    setBudget(value);
    window.localStorage.setItem(BUDGET_STORAGE_KEY, String(value));
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">退休金流管理</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">資料來源：Notion「退休每月金流管理」</p>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex flex-col text-sm text-zinc-600 dark:text-zinc-400">
              每月預算上限
              <input
                type="number"
                value={budgetLoaded ? budget : ""}
                onChange={(e) => handleBudgetChange(Number(e.target.value))}
                className="mt-1 w-32 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <button
              onClick={refresh}
              disabled={loading}
              className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {loading ? "更新中…" : "重新整理"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            讀取 Notion 資料失敗：{error}
          </div>
        )}

        {data && (
          <>
            <MonthProgress
              label={data.currentMonth.label}
              spent={data.currentMonth.spent}
              budget={budget}
              dayOfMonth={data.currentMonth.dayOfMonth}
              daysInMonth={data.currentMonth.daysInMonth}
              pageMissing={data.currentMonth.pageMissing}
            />
            <SurplusHistory months={data.months} budget={budget} />
          </>
        )}

        {!data && loading && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
            正在讀取 Notion 資料…
          </div>
        )}
      </main>
    </div>
  );
}
