import { OTHER_CATEGORY } from "./categorize";
import type { CurrentMonthSummary, Entry, MonthSummary, NotionSummaryResponse } from "./types";

const NOTION_VERSION = "2022-06-28";
const MONTH_TITLE_RE = /^(\d{1,2})\s*月$/;
// A day line: "8/7 <item>" or "8/7 <item1>、<item2>、<item3>" (items may also be
// separated by plain commas). Each item's amount doesn't require a space
// before it, e.g. "啤酒530".
const DAY_LINE_RE = /^(\d{1,2})\/(\d{1,2})\s+(.+)$/;
const ITEM_RE = /^(.+?)\s*([\d,]+(?:\.\d+)?)$/;

interface NotionBlock {
  id: string;
  type: string;
  child_page?: { title: string };
  paragraph?: { rich_text: { plain_text: string }[] };
  has_children?: boolean;
}

function getToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("缺少環境變數 NOTION_TOKEN，請在 .env.local 或部署平台設定");
  }
  return token;
}

function getRootPageId(): string {
  const id = process.env.NOTION_ROOT_PAGE_ID;
  if (!id) {
    throw new Error("缺少環境變數 NOTION_ROOT_PAGE_ID，請在 .env.local 或部署平台設定");
  }
  return id;
}

async function notionFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Notion-Version": NOTION_VERSION,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API 錯誤 (${res.status}): ${body}`);
  }
  return res.json();
}

async function fetchAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const data = (await notionFetch(`/blocks/${blockId}/children?${qs.toString()}`)) as {
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);
  return blocks;
}

function parseEntriesFromText(text: string, monthNumber: number): Entry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: Entry[] = [];
  for (const line of lines) {
    const dayMatch = line.match(DAY_LINE_RE);
    if (!dayMatch) continue;
    const [, , dayStr, rest] = dayMatch;
    const items = rest
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const item of items) {
      const itemMatch = item.match(ITEM_RE);
      if (!itemMatch) continue;
      const [, description, amountStr] = itemMatch;
      const amount = Number(amountStr.replace(/,/g, ""));
      if (Number.isNaN(amount)) continue;
      entries.push({
        month: monthNumber,
        day: Number(dayStr),
        description: description.trim(),
        amount,
        // Resolved later by categorizeSummary() once entries are assembled.
        category: OTHER_CATEGORY,
      });
    }
  }
  return entries;
}

async function findMonthPages(rootPageId: string): Promise<{ id: string; monthNumber: number; label: string }[]> {
  const children = await fetchAllBlockChildren(rootPageId);
  const monthPages: { id: string; monthNumber: number; label: string }[] = [];
  for (const block of children) {
    if (block.type !== "child_page" || !block.child_page) continue;
    const title = block.child_page.title;
    const match = title.match(MONTH_TITLE_RE);
    if (!match) continue;
    monthPages.push({ id: block.id, monthNumber: Number(match[1]), label: title });
  }
  return monthPages.sort((a, b) => a.monthNumber - b.monthNumber);
}

async function fetchMonthEntries(pageId: string, monthNumber: number): Promise<Entry[]> {
  const blocks = await fetchAllBlockChildren(pageId);
  const text = blocks
    .filter((b) => b.type === "paragraph" && b.paragraph)
    .map((b) => b.paragraph!.rich_text.map((t) => t.plain_text).join(""))
    .join("\n");
  return parseEntriesFromText(text, monthNumber);
}

function sumEntries(entries: Entry[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function getTaipeiToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export async function getNotionSummary(): Promise<NotionSummaryResponse> {
  const rootPageId = getRootPageId();
  const monthPages = await findMonthPages(rootPageId);
  const today = getTaipeiToday();

  const months: MonthSummary[] = [];
  for (const page of monthPages) {
    const entries = await fetchMonthEntries(page.id, page.monthNumber);
    months.push({
      monthNumber: page.monthNumber,
      label: page.label,
      spent: sumEntries(entries),
      entries,
    });
  }

  const currentPage = monthPages.find((p) => p.monthNumber === today.month);
  const daysInMonth = new Date(today.year, today.month, 0).getDate();

  let currentMonth: CurrentMonthSummary;
  if (currentPage) {
    const existing = months.find((m) => m.monthNumber === currentPage.monthNumber)!;
    currentMonth = {
      ...existing,
      daysInMonth,
      dayOfMonth: today.day,
      pageMissing: false,
    };
  } else {
    currentMonth = {
      monthNumber: today.month,
      label: `${today.month}月`,
      spent: 0,
      entries: [],
      daysInMonth,
      dayOfMonth: today.day,
      pageMissing: true,
    };
  }

  return { currentMonth, months };
}
