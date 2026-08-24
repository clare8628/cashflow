"use client";

const formatNT = (n: number) => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;

interface Props {
  label: string;
  spent: number;
  budget: number;
}

export default function OverspendBanner({ label, spent, budget }: Props) {
  if (budget <= 0 || spent <= budget) return null;

  const over = spent - budget;
  const pct = Math.round((spent / budget) * 100);

  return (
    <div className="rounded-sm border border-status-critical/40 bg-status-critical/15 px-6 py-4">
      <p className="font-serif text-base font-semibold tracking-wide text-status-critical">
        {label} 已超出預算
      </p>
      <p className="mt-1 text-sm text-status-critical">
        超支 {formatNT(over)}（已花費預算的 {pct}%）
      </p>
    </div>
  );
}
