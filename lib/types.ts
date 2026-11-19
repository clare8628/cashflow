export interface Entry {
  month: number;
  day: number;
  description: string;
  amount: number;
  category: string;
}

export interface EntryItem {
  description: string;
  amount: number;
  category: string;
}

// One Notion paragraph block can contain multiple newline-separated day
// lines (Notion allows soft line breaks within a block), so a DayLine is
// addressed by its block plus its line offset within that block's text —
// not by the block alone.
export interface DayLine {
  blockId: string;
  lineIndex: number;
  month: number;
  day: number;
  items: EntryItem[];
}

export interface MonthSummary {
  monthNumber: number;
  label: string;
  pageId: string | null;
  spent: number;
  days: DayLine[];
  entries: Entry[];
}

export interface CurrentMonthSummary extends MonthSummary {
  daysInMonth: number;
  dayOfMonth: number;
  pageMissing: boolean;
}

export type ExpectedFrequency = "每月" | "每年" | "一次";

// A reminder for a cost that is NOT in the spending ledger (e.g. 年度家庭儲蓄金).
export interface ExpectedExpense {
  blockId: string;
  lineIndex: number;
  name: string;
  amount: number;
  frequency: ExpectedFrequency;
  note: string;
}

export interface NotionSummaryResponse {
  currentMonth: CurrentMonthSummary;
  months: MonthSummary[];
  expected: ExpectedExpense[];
  expectedPageId: string | null;
}
