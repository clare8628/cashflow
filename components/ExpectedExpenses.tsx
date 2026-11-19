"use client";

import { useState } from "react";
import type { ExpectedExpense, ExpectedFrequency } from "@/lib/types";

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
const FREQUENCIES: ExpectedFrequency[] = ["每月", "每年", "一次"];

export interface ExpectedInput {
  blockId: string | null;
  lineIndex: number | null;
  originalName: string | null;
  name: string;
  amount: number;
  frequency: ExpectedFrequency;
  note: string;
}

interface Props {
  items: ExpectedExpense[];
  onSave: (input: ExpectedInput) => Promise<void>;
  onDelete: (item: ExpectedExpense) => Promise<void>;
}

// Monthly-equivalent cost, so yearly items can be compared to the monthly budget.
function perMonth(e: ExpectedExpense): number | null {
  if (e.frequency === "每月") return e.amount;
  if (e.frequency === "每年") return e.amount / 12;
  return null;
}

export default function ExpectedExpenses({ items, onSave, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthlyTotal = items.reduce((sum, e) => sum + (perMonth(e) ?? 0), 0);
  const yearlyTotal = items.reduce(
    (sum, e) => sum + (e.frequency === "每月" ? e.amount * 12 : e.frequency === "每年" ? e.amount : 0),
    0,
  );
  const oneOffTotal = items.reduce((sum, e) => sum + (e.frequency === "一次" ? e.amount : 0), 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setPendingKey(key);
    setError(null);
    try {
      await fn();
      setEditingKey(null);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <section className="rounded-sm border border-status-warn/40 bg-status-warn/5 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold tracking-wide text-foreground">
            預期支出提醒（未列入每月花費）
          </h2>
          <p className="mt-1 text-xs text-secondary">記下還沒發生、但要預留的錢。存在 Notion「預期支出」頁，網頁與 Notion 都能編輯。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setEditingKey(null);
          }}
          className="shrink-0 text-xs tracking-wide text-accent hover:underline"
        >
          {adding ? "取消" : "＋ 新增"}
        </button>
      </div>

      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="平均每月需預留" value={formatNT(monthlyTotal)} />
          <Stat label="每年合計" value={formatNT(yearlyTotal)} />
          <Stat label="一次性合計" value={formatNT(oneOffTotal)} />
        </div>
      )}

      {items.length === 0 && !adding && <p className="mt-4 text-sm text-secondary">目前沒有預期支出，點右上角新增。</p>}

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {items.map((item) => {
          const key = `${item.blockId}:${item.lineIndex}`;
          const busy = pendingKey === key;
          if (editingKey === key) {
            return (
              <li key={key} className="py-3">
                <ExpectedForm
                  initial={item}
                  disabled={busy}
                  onCancel={() => setEditingKey(null)}
                  onSubmit={(v) =>
                    run(key, () =>
                      onSave({ ...v, blockId: item.blockId, lineIndex: item.lineIndex, originalName: item.name }),
                    )
                  }
                />
              </li>
            );
          }
          const monthly = perMonth(item);
          return (
            <li key={key} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 ${busy ? "opacity-50" : ""}`}>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-secondary">
                {item.frequency}
              </span>
              <span className="text-sm font-medium text-foreground">{item.name}</span>
              <span className="text-sm tabular-nums text-foreground">{formatNT(item.amount)}</span>
              {monthly !== null && item.frequency === "每年" && (
                <span className="text-xs tabular-nums text-muted">≈ 每月 {formatNT(monthly)}</span>
              )}
              {item.note && <span className="text-xs text-secondary">・{item.note}</span>}
              <span className="ml-auto flex gap-3 text-xs">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingKey(key);
                    setAdding(false);
                  }}
                  className="text-accent hover:underline"
                >
                  編輯
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`刪除「${item.name}」？`)) void run(key, () => onDelete(item));
                  }}
                  className="text-status-critical hover:underline"
                >
                  刪除
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="mt-2 border-t border-border pt-4">
          <ExpectedForm
            disabled={pendingKey === "new"}
            onCancel={() => setAdding(false)}
            onSubmit={(v) => run("new", () => onSave({ ...v, blockId: null, lineIndex: null, originalName: null }))}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-status-critical">{error}</p>}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-2 py-2">
      <div className="text-[11px] tracking-wide text-secondary">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function ExpectedForm({
  initial,
  disabled,
  onCancel,
  onSubmit,
}: {
  initial?: ExpectedExpense;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (v: { name: string; amount: number; frequency: ExpectedFrequency; note: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState<ExpectedFrequency>(initial?.frequency ?? "每年");
  const [note, setNote] = useState(initial?.note ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const input =
    "rounded-sm border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(amount.replace(/,/g, ""));
        if (!name.trim()) return setFormError("請輸入名稱");
        if (!Number.isFinite(n) || n <= 0) return setFormError("金額必須為正數");
        setFormError(null);
        onSubmit({ name: name.trim(), amount: n, frequency, note: note.trim() });
      }}
    >
      <input className={`${input} w-40`} placeholder="名稱，如 年度家庭儲蓄金" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={`${input} w-28`} placeholder="金額" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={input} value={frequency} onChange={(e) => setFrequency(e.target.value as ExpectedFrequency)}>
        {FREQUENCIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <input className={`${input} min-w-0 flex-1`} placeholder="備註（選填，如 年底存入）" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" disabled={disabled} className="h-8 rounded-sm bg-accent px-3 text-xs text-white disabled:opacity-50">
        {disabled ? "儲存中…" : "儲存"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-secondary hover:underline">
        取消
      </button>
      {formError && <p className="w-full text-xs text-status-critical">{formError}</p>}
    </form>
  );
}
