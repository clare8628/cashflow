export interface Entry {
  month: number;
  day: number;
  description: string;
  amount: number;
}

export interface MonthSummary {
  monthNumber: number;
  label: string;
  spent: number;
  entries: Entry[];
}

export interface CurrentMonthSummary extends MonthSummary {
  daysInMonth: number;
  dayOfMonth: number;
  pageMissing: boolean;
}

export interface NotionSummaryResponse {
  currentMonth: CurrentMonthSummary;
  months: MonthSummary[];
}
