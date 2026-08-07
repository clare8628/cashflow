"use client";

interface Props {
  label: string;
  spent: number;
  budget: number;
  dayOfMonth: number;
  daysInMonth: number;
  pageMissing: boolean;
}

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

export default function MonthProgress({ label, spent, budget, dayOfMonth, daysInMonth, pageMissing }: Props) {
  const spentRatio = budget > 0 ? spent / budget : 0;
  const dateRatio = daysInMonth > 0 ? dayOfMonth / daysInMonth : 0;
  const spentPct = Math.round(spentRatio * 100);
  const datePct = Math.round(dateRatio * 100);

  const barColor = spentRatio > 1 ? "bg-red-500" : spentRatio >= 0.7 ? "bg-amber-500" : "bg-emerald-500";

  const diff = spentRatio - dateRatio;
  let suggestion: string;
  if (spentRatio > 1) {
    suggestion = "已超過本月預算，建議接下來節約花費。";
  } else if (diff > 0.15) {
    suggestion = "花費速度比日期進度快，建議放慢花費力道。";
  } else if (diff < -0.15) {
    suggestion = "花費速度比日期進度慢，可以放心增加花費。";
  } else {
    suggestion = "花費步調與日期進度大致相符。";
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{label} 花費進度</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          第 {dayOfMonth} / {daysInMonth} 天
        </span>
      </div>

      {pageMissing && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          尚未在 Notion 建立本月頁面，目前花費以 0 計算。
        </p>
      )}

      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>花費進度</span>
          <span>
            {formatNT(spent)} / {formatNT(budget)}（{spentPct}%）
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(spentRatio, 1) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>日期進度</span>
          <span>{datePct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ width: `${dateRatio * 100}%` }} />
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">{suggestion}</p>
    </div>
  );
}
