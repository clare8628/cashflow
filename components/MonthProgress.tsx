"use client";

interface Props {
  label: string;
  spent: number;
  budget: number;
  dayOfMonth?: number;
  daysInMonth?: number;
  pageMissing: boolean;
}

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

export default function MonthProgress({ label, spent, budget, dayOfMonth, daysInMonth, pageMissing }: Props) {
  const spentRatio = budget > 0 ? spent / budget : 0;
  const spentPct = Math.round(spentRatio * 100);
  const hasDateProgress = dayOfMonth !== undefined && daysInMonth !== undefined && daysInMonth > 0;
  const dateRatio = hasDateProgress ? dayOfMonth / daysInMonth : null;
  const datePct = dateRatio !== null ? Math.round(dateRatio * 100) : null;

  const statusVar = spentRatio > 1 ? "--status-critical" : spentRatio >= 0.7 ? "--status-warn" : "--status-good";
  const statusColor = `var(${statusVar})`;

  let suggestion: string;
  if (spentRatio > 1) {
    suggestion = "已超過預算，建議接下來節約花費。";
  } else if (dateRatio !== null) {
    const diff = spentRatio - dateRatio;
    if (diff > 0.15) {
      suggestion = "花費速度比日期進度快，建議放慢花費力道。";
    } else if (diff < -0.15) {
      suggestion = "花費速度比日期進度慢，可以放心增加花費。";
    } else {
      suggestion = "花費步調與日期進度大致相符。";
    }
  } else {
    suggestion = spentRatio >= 1 ? "本月已達預算上限。" : "本月花費在預算範圍內。";
  }

  return (
    <div className="rounded-sm border border-border bg-card p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-base font-semibold tracking-wide text-foreground">{label} 花費進度</h2>
        {hasDateProgress && (
          <span className="text-xs tracking-wide text-muted">
            第 {dayOfMonth} ／ {daysInMonth} 天
          </span>
        )}
      </div>

      {pageMissing && (
        <p className="mt-3 rounded-sm border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          尚未在 Notion 建立本月頁面，目前花費以 0 計算。
        </p>
      )}

      <div className="mt-6 flex items-end gap-4">
        <span className="font-serif text-4xl font-bold tabular-nums leading-none" style={{ color: statusColor }}>
          {spentPct}%
        </span>
        <div className="pb-0.5 text-sm text-secondary">
          <div>花費進度</div>
          <div className="tabular-nums">
            {formatNT(spent)} ／ {formatNT(budget)}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(spentRatio, 1) * 100}%`, backgroundColor: statusColor }}
          />
        </div>
      </div>

      {hasDateProgress && (
        <div className="mt-5">
          <div className="flex justify-between text-xs tracking-wide text-secondary">
            <span>日期進度</span>
            <span className="tabular-nums">{datePct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-muted" style={{ width: `${(dateRatio ?? 0) * 100}%` }} />
          </div>
        </div>
      )}

      <p className="mt-5 text-sm text-secondary">{suggestion}</p>
    </div>
  );
}
