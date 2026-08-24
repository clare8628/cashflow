"use client";

interface Tab {
  monthNumber: number;
  label: string;
  spent: number;
}

interface Props {
  tabs: Tab[];
  selected: number;
  onSelect: (monthNumber: number) => void;
  budget: number;
}

export default function MonthTabs({ tabs, selected, onSelect, budget }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isSelected = tab.monthNumber === selected;
        const overBudget = budget > 0 && tab.spent > budget;
        return (
          <button
            key={tab.monthNumber}
            type="button"
            onClick={() => onSelect(tab.monthNumber)}
            aria-pressed={isSelected}
            className={`relative rounded-full border px-4 py-1.5 text-sm tracking-wide transition-colors ${
              isSelected
                ? "border-accent bg-accent text-white"
                : "border-border bg-card text-secondary hover:border-accent/50"
            }`}
          >
            {tab.label}
            {overBudget && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-status-critical"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
