import { OTHER_CATEGORY } from "./categorize";
import { createLedgerDayLine } from "./ledger";
export { getNotionSummary } from "./ledger";
import type { CurrentMonthSummary, DayLine, Entry, MonthSummary, NotionSummaryResponse } from "./types";

const NOTION_VERSION = "2022-06-28";
const MONTH_TITLE_RE = /^(\d{1,2})\s*月$/;
// A day line: "8/7 <item>" or "8/7 <item1>、<item2>、<item3>" (items may also be
// separated by plain commas). Each item's amount doesn't require a space
// before it, e.g. "啤酒530". The leading month number is parsed but never
// used — every line's month comes from the page it lives on (see
// parseBlockLines), so a stray/incorrect "M/" in the text is harmless.
export const DAY_LINE_RE = /^(\d{1,2})\/(\d{1,2})\s+(.+)$/;
const ITEM_RE = /^(.+?)\s*([\d,]+(?:\.\d+)?)$/;
// Characters that split one day-line into multiple items — a description
// containing one of these would fragment into phantom items on the next
// read, so the write path rejects them outright (see app/api/notion/day).
export const FORBIDDEN_DESCRIPTION_CHARS = /[、,，]/;
const RICH_TEXT_CHUNK = 2000;

export class DayLineConflictError extends Error {}

interface NotionRichText {
  plain_text: string;
}

export interface NotionBlock {
  id: string;
  type: string;
  child_page?: { title: string };
  paragraph?: { rich_text: NotionRichText[] };
  has_children?: boolean;
}

function getToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("缺少環境變數 NOTION_TOKEN，請在 .env.local 或部署平台設定");
  }
  return token;
}

export function getRootPageId(): string {
  const id = process.env.NOTION_ROOT_PAGE_ID;
  if (!id) {
    throw new Error("缺少環境變數 NOTION_ROOT_PAGE_ID，請在 .env.local 或部署平台設定");
  }
  return id;
}

export async function notionFetch(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Notion-Version": NOTION_VERSION,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API 錯誤 (${res.status}): ${body}`);
  }
  return res.json();
}

export async function fetchAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
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

export function blockText(block: NotionBlock): string {
  return (block.paragraph?.rich_text ?? []).map((t) => t.plain_text).join("");
}

export function parseItemsFromRest(rest: string): { description: string; amount: number }[] {
  const items: { description: string; amount: number }[] = [];
  for (const raw of rest.split(/[、,，]/)) {
    const item = raw.trim();
    if (!item) continue;
    const match = item.match(ITEM_RE);
    if (!match) continue;
    const [, description, amountStr] = match;
    const amount = Number(amountStr.replace(/,/g, ""));
    if (Number.isNaN(amount)) continue;
    items.push({ description: description.trim(), amount });
  }
  return items;
}

function parsedDayOf(line: string): number | null {
  const match = line.trim().match(DAY_LINE_RE);
  return match ? Number(match[2]) : null;
}

// Parses one paragraph block's own text (never joined with sibling blocks)
// into its day lines, keeping each line's offset within the block so an
// edit can later address exactly this line without touching the rest of
// the block's content.
function parseBlockLines(block: NotionBlock, monthNumber: number): DayLine[] {
  const lines = blockText(block).split(/\r?\n/);
  const dayLines: DayLine[] = [];
  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;
    const match = line.match(DAY_LINE_RE);
    if (!match) return;
    const [, , dayStr, rest] = match;
    const items = parseItemsFromRest(rest);
    if (items.length === 0) return;
    dayLines.push({
      blockId: block.id,
      lineIndex,
      month: monthNumber,
      day: Number(dayStr),
      items: items.map((item) => ({ ...item, category: OTHER_CATEGORY })),
    });
  });
  return dayLines;
}

export function flattenDays(days: DayLine[]): Entry[] {
  return days.flatMap((day) =>
    day.items.map((item) => ({
      month: day.month,
      day: day.day,
      description: item.description,
      amount: item.amount,
      category: item.category,
    })),
  );
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

async function fetchMonthDays(pageId: string, monthNumber: number): Promise<DayLine[]> {
  const blocks = await fetchAllBlockChildren(pageId);
  const days: DayLine[] = [];
  for (const block of blocks) {
    if (block.type !== "paragraph" || !block.paragraph) continue;
    days.push(...parseBlockLines(block, monthNumber));
  }
  return days;
}

export function sumEntries(entries: Entry[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

export function getTaipeiToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export async function getMonthPagesSummary(rootPageId: string): Promise<NotionSummaryResponse> {
  const monthPages = await findMonthPages(rootPageId);
  const today = getTaipeiToday();

  const months: MonthSummary[] = [];
  for (const page of monthPages) {
    const days = await fetchMonthDays(page.id, page.monthNumber);
    const entries = flattenDays(days);
    months.push({
      monthNumber: page.monthNumber,
      label: page.label,
      pageId: page.id,
      spent: sumEntries(entries),
      days,
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
      pageId: null,
      spent: 0,
      days: [],
      entries: [],
      daysInMonth,
      dayOfMonth: today.day,
      pageMissing: true,
    };
  }

  return { currentMonth, months, expected: [], expectedPageId: null };
}

// ---------------------------------------------------------------------------
// Write-back: rewriting the raw paragraph-block text so edits made in the
// app round-trip correctly through the same regexes used to read it.
// ---------------------------------------------------------------------------

export function toRichText(text: string): { type: "text"; text: { content: string } }[] {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_CHUNK) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + RICH_TEXT_CHUNK) } });
  }
  return chunks.length > 0 ? chunks : [{ type: "text", text: { content: "" } }];
}

// Always insert an explicit space between description and amount. Bare
// concatenation (`${description}${amount}`) would be silently corrupted by
// ITEM_RE on the next read whenever a description ends in a digit — e.g.
// "7-11" + 100 → "7-11100" reparses as description "7-", amount 11100.
function formatItem(item: { description: string; amount: number }): string {
  return `${item.description} ${item.amount}`;
}

function formatDayLine(month: number, day: number, items: { description: string; amount: number }[]): string {
  return `${month}/${day} ${items.map(formatItem).join("、")}`;
}

async function createDayLine(monthNumber: number, day: number, lineText: string): Promise<void> {
  const rootPageId = getRootPageId();
  if (await createLedgerDayLine(rootPageId, lineText)) return;
  const monthPages = await findMonthPages(rootPageId);
  const existing = monthPages.find((p) => p.monthNumber === monthNumber);
  const newBlock = { object: "block", type: "paragraph", paragraph: { rich_text: toRichText(lineText) } };

  if (existing) {
    await notionFetch(`/blocks/${existing.id}/children`, {
      method: "PATCH",
      body: { children: [newBlock] },
    });
    return;
  }

  // Page-parented pages only support a single "title" property, and the
  // create call accepts nested children directly — no separate append call
  // needed for the first line.
  await notionFetch(`/pages`, {
    method: "POST",
    body: {
      parent: { page_id: rootPageId },
      properties: { title: { title: [{ type: "text", text: { content: `${monthNumber}月` } }] } },
      children: [newBlock],
    },
  });
}

function resolveLineIndex(lines: string[], day: number, hintIndex: number | null): number {
  if (hintIndex !== null && hintIndex >= 0 && hintIndex < lines.length && parsedDayOf(lines[hintIndex]) === day) {
    return hintIndex;
  }
  // The hint may be stale (a concurrent edit elsewhere shifted line
  // offsets) — fall back to searching by parsed day before giving up, so we
  // never risk editing the wrong sibling line.
  const fallback = lines.findIndex((line) => parsedDayOf(line) === day);
  if (fallback === -1) {
    throw new DayLineConflictError("找不到對應的日期資料，可能已被其他地方變更，請重新整理後再試。");
  }
  return fallback;
}

// Replaces (or removes, when newLineText is null) one line within a block,
// re-fetching the block fresh first so a stale client-held copy can't
// clobber a concurrent edit. Archives the block if it ends up empty.
async function updateDayLineInBlock(
  blockId: string,
  day: number,
  hintIndex: number | null,
  newLineText: string | null,
): Promise<void> {
  const block = (await notionFetch(`/blocks/${blockId}`)) as NotionBlock;
  const lines = blockText(block).split(/\r?\n/);
  const targetIndex = resolveLineIndex(lines, day, hintIndex);

  const nextLines =
    newLineText === null
      ? lines.filter((_, i) => i !== targetIndex)
      : lines.map((line, i) => (i === targetIndex ? newLineText : line));

  const remaining = nextLines.map((line) => line.trim()).filter(Boolean);

  if (remaining.length === 0) {
    // Notion's block DELETE endpoint archives the block (soft delete).
    await notionFetch(`/blocks/${blockId}`, { method: "DELETE" });
    return;
  }

  await notionFetch(`/blocks/${blockId}`, {
    method: "PATCH",
    body: { paragraph: { rich_text: toRichText(remaining.join("\n")) } },
  });
}

export async function saveDayLine(input: {
  monthNumber: number;
  day: number;
  items: { description: string; amount: number }[];
  blockId: string | null;
  lineIndex: number | null;
}): Promise<void> {
  const { monthNumber, day, items, blockId, lineIndex } = input;
  const lineText = formatDayLine(monthNumber, day, items);

  if (blockId === null) {
    await createDayLine(monthNumber, day, lineText);
    return;
  }

  await updateDayLineInBlock(blockId, day, lineIndex, lineText);
}

export async function removeDayLine(input: {
  monthNumber: number;
  day: number;
  blockId: string;
  lineIndex: number;
}): Promise<void> {
  await updateDayLineInBlock(input.blockId, input.day, input.lineIndex, null);
}
