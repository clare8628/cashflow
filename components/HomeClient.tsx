"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import MonthEntries, { type DeleteDayInput, type SaveDayInput } from "@/components/MonthEntries";
import MonthProgress from "@/components/MonthProgress";
import MonthTabs from "@/components/MonthTabs";
import OverspendBanner from "@/components/OverspendBanner";
import SurplusHistory from "@/components/SurplusHistory";
import type { NotionSummaryResponse } from "@/lib/types";

const BUDGET_STORAGE_KEY = "cashflow_budget";
const DEFAULT_BUDGET = 30000;

export default function HomeClient() {
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [data, setData] = useState<NotionSummaryResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
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
      const json = (await res.json()) as NotionSummaryResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "讀取失敗");
      setData(json);
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

  useEffect(() => {
    if (data && selectedMonth === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default month selection once data first loads
      setSelectedMonth(data.currentMonth.monthNumber);
    }
  }, [data, selectedMonth]);

  const handleBudgetChange = (value: number) => {
    setBudget(value);
    window.localStorage.setItem(BUDGET_STORAGE_KEY, String(value));
  };

  const saveDay = useCallback(async (input: SaveDayInput) => {
    const res = await fetch("/api/notion/day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as NotionSummaryResponse & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "儲存失敗");
    setData(json);
  }, []);

  const deleteDay = useCallback(async (input: DeleteDayInput) => {
    const res = await fetch("/api/notion/day", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as NotionSummaryResponse & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "刪除失敗");
    setData(json);
  }, []);

  // The live current month may not have a Notion page yet (pageMissing) —
  // surface it as a selectable/creatable tab alongside the real months.
  const monthsWithCurrentGap = useMemo(() => {
    if (!data) return [];
    const list = [...data.months];
    if (data.currentMonth.pageMissing && !list.some((m) => m.monthNumber === data.currentMonth.monthNumber)) {
      list.push(data.currentMonth);
    }
    return list.sort((a, b) => a.monthNumber - b.monthNumber);
  }, [data]);

  const selectedMonthSummary = useMemo(
    () => monthsWithCurrentGap.find((m) => m.monthNumber === selectedMonth) ?? null,
    [monthsWithCurrentGap, selectedMonth],
  );

  const isCurrent = !!data && selectedMonthSummary?.monthNumber === data.currentMonth.monthNumber;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-10">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-6 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-8 w-[3px] shrink-0 bg-accent" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-wide text-foreground">
                退休金流管理
              </h1>
              <p className="mt-1.5 text-sm text-secondary">資料來源・Notion「退休每月金流管理」</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex flex-col text-xs tracking-wide text-secondary">
              每月預算上限
              <input
                type="number"
                value={budgetLoaded ? budget : ""}
                onChange={(e) => handleBudgetChange(Number(e.target.value))}
                className="mt-1.5 w-32 rounded-sm border border-border bg-card px-3 py-1.5 text-foreground focus:border-accent focus:outline-none"
              />
            </label>
            <button
              onClick={refresh}
              disabled={loading}
              className="h-9 rounded-sm bg-accent px-4 text-sm font-medium tracking-wide text-white transition-opacity disabled:opacity-50"
            >
              {loading ? "更新中…" : "重新整理"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-sm border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            讀取 Notion 資料失敗：{error}
          </div>
        )}

        {data && selectedMonthSummary && (
          <>
            <OverspendBanner label={selectedMonthSummary.label} spent={selectedMonthSummary.spent} budget={budget} />

            <MonthTabs
              tabs={monthsWithCurrentGap.map((m) => ({ monthNumber: m.monthNumber, label: m.label, spent: m.spent }))}
              selected={selectedMonthSummary.monthNumber}
              onSelect={setSelectedMonth}
              budget={budget}
            />

            <MonthProgress
              label={selectedMonthSummary.label}
              spent={selectedMonthSummary.spent}
              budget={budget}
              dayOfMonth={isCurrent ? data.currentMonth.dayOfMonth : undefined}
              daysInMonth={isCurrent ? data.currentMonth.daysInMonth : undefined}
              pageMissing={isCurrent && data.currentMonth.pageMissing}
            />
            <CategoryBreakdown label={selectedMonthSummary.label} entries={selectedMonthSummary.entries} />
            <MonthEntries
              monthNumber={selectedMonthSummary.monthNumber}
              days={selectedMonthSummary.days}
              onSave={saveDay}
              onDelete={deleteDay}
            />
            <SurplusHistory months={data.months} budget={budget} />
          </>
        )}

        {!data && loading && (
          <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-secondary">
            正在讀取 Notion 資料…
          </div>
        )}
      </main>
    </div>
  );
}
