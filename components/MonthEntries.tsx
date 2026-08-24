"use client";

import { useState } from "react";
import type { DayLine } from "@/lib/types";

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

export interface SaveDayInput {
  monthNumber: number;
  day: number;
  items: { description: string; amount: number }[];
  blockId: string | null;
  lineIndex: number | null;
}

export interface DeleteDayInput {
  monthNumber: number;
  day: number;
  blockId: string;
  lineIndex: number;
}

interface Props {
  monthNumber: number;
  days: DayLine[];
  onSave: (input: SaveDayInput) => Promise<void>;
  onDelete: (input: DeleteDayInput) => Promise<void>;
}

export default function MonthEntries({ monthNumber, days, onSave, onDelete }: Props) {
  const sorted = [...days].sort((a, b) => a.day - b.day || a.lineIndex - b.lineIndex);
  const [addingNewDay, setAddingNewDay] = useState(false);

  return (
    <div className="rounded-sm border border-border bg-card p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-base font-semibold tracking-wide text-foreground">
          {monthNumber} 月明細（可編輯）
        </h2>
        <button
          type="button"
          onClick={() => setAddingNewDay((v) => !v)}
          className="text-xs tracking-wide text-accent hover:underline"
        >
          {addingNewDay ? "取消" : "＋ 新增一天"}
        </button>
      </div>

      {sorted.length === 0 && !addingNewDay && (
        <p className="mt-4 text-sm text-secondary">本月尚無資料，點選右上角新增。</p>
      )}

      <ul className="mt-5 flex flex-col gap-4">
        {sorted.map((d) => (
          <DayRow key={`${d.blockId}:${d.lineIndex}`} monthNumber={monthNumber} day={d} onSave={onSave} onDelete={onDelete} />
        ))}
      </ul>

      {addingNewDay && (
        <div className="mt-5 border-t border-border pt-4">
          <NewDayForm monthNumber={monthNumber} onSave={onSave} onDone={() => setAddingNewDay(false)} />
        </div>
      )}
    </div>
  );
}

function DayRow({
  monthNumber,
  day,
  onSave,
  onDelete,
}: {
  monthNumber: number;
  day: DayLine;
  onSave: (input: SaveDayInput) => Promise<void>;
  onDelete: (input: DeleteDayInput) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const commitItems = async (items: { description: string; amount: number }[]) => {
    setPending(true);
    setError(null);
    try {
      if (items.length === 0) {
        await onDelete({ monthNumber, day: day.day, blockId: day.blockId, lineIndex: day.lineIndex });
      } else {
        await onSave({ monthNumber, day: day.day, items, blockId: day.blockId, lineIndex: day.lineIndex });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setPending(false);
    }
  };

  const removeItem = (index: number) => {
    const items = day.items.filter((_, i) => i !== index).map(({ description, amount }) => ({ description, amount }));
    void commitItems(items);
  };

  const updateItem = (index: number, next: { description: string; amount: number }) => {
    const items = day.items.map((it, i) => (i === index ? next : { description: it.description, amount: it.amount }));
    setEditingIndex(null);
    void commitItems(items);
  };

  const addItem = (next: { description: string; amount: number }) => {
    const items = [...day.items.map(({ description, amount }) => ({ description, amount })), next];
    setAddingItem(false);
    void commitItems(items);
  };

  return (
    <li className={`border-b border-border pb-3 last:border-b-0 ${pending ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
          {monthNumber}/{day.day}
        </span>

        {day.items.map((item, index) =>
          editingIndex === index ? (
            <ItemForm
              key={index}
              initial={item}
              disabled={pending}
              onCancel={() => setEditingIndex(null)}
              onSubmit={(next) => updateItem(index, next)}
            />
          ) : (
            <span
              key={index}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
            >
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditingIndex(index)}
                className="tracking-wide"
              >
                {item.description} {formatNT(item.amount)}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeItem(index)}
                aria-label="刪除項目"
                className="text-muted hover:text-status-critical"
              >
                ×
              </button>
            </span>
          ),
        )}

        {addingItem ? (
          <ItemForm disabled={pending} onCancel={() => setAddingItem(false)} onSubmit={addItem} />
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setAddingItem(true)}
            className="text-xs text-accent hover:underline"
          >
            ＋ 新增項目
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => void commitItems([])}
          className="ml-auto text-xs text-muted hover:text-status-critical"
        >
          刪除整天
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-status-critical">{error}</p>}
    </li>
  );
}

function ItemForm({
  initial,
  disabled,
  onCancel,
  onSubmit,
}: {
  initial?: { description: string; amount: number };
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (item: { description: string; amount: number }) => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");

  const submit = () => {
    const trimmed = description.trim();
    const parsed = Number(amount);
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) return;
    onSubmit({ description: trimmed, amount: Math.round(parsed) });
  };

  return (
    <span className="flex items-center gap-1.5">
      <input
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="描述"
        disabled={disabled}
        className="w-20 rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="金額"
        disabled={disabled}
        className="w-16 rounded-sm border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      <button type="button" disabled={disabled} onClick={submit} className="text-xs text-accent hover:underline">
        確定
      </button>
      <button type="button" disabled={disabled} onClick={onCancel} className="text-xs text-muted hover:underline">
        取消
      </button>
    </span>
  );
}

function NewDayForm({
  monthNumber,
  onSave,
  onDone,
}: {
  monthNumber: number;
  onSave: (input: SaveDayInput) => Promise<void>;
  onDone: () => void;
}) {
  const [day, setDay] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const dayNum = Number(day);
    const parsedAmount = Number(amount);
    const trimmedDesc = description.trim();
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      setError("請輸入有效日期");
      return;
    }
    if (!trimmedDesc || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("請輸入描述與金額");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({
        monthNumber,
        day: dayNum,
        items: [{ description: trimmedDesc, amount: Math.round(parsedAmount) }],
        blockId: null,
        lineIndex: null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-secondary">{monthNumber}/</span>
      <input
        value={day}
        onChange={(e) => setDay(e.target.value)}
        placeholder="日"
        disabled={pending}
        className="w-14 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="描述"
        disabled={pending}
        className="w-24 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="金額"
        disabled={pending}
        className="w-20 rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      <button type="button" disabled={pending} onClick={() => void submit()} className="text-xs text-accent hover:underline">
        {pending ? "新增中…" : "新增"}
      </button>
      {error && <span className="text-xs text-status-critical">{error}</span>}
    </div>
  );
}
