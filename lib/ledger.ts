// Ledger layout support + 「預期支出」 (expected, not-yet-recorded expenses).
//
// The Notion workspace keeps every spending line on ONE child page titled
// 「花費記錄」 (newest first, grouped under 「YYYY年」 header paragraphs), not one
// page per month. Each line's month comes from its own "M/D" prefix. When no
// ledger page exists we fall back to the legacy one-page-per-month layout.
//
// 「預期支出」 is a sibling child page; each line is
//   <名稱> <金額> [每月|每年|一次] [備註]
// e.g. 「年度家庭儲蓄金 100000 每年 年底存入」. These are reminders only and are
// never added to monthly spending.

import { OTHER_CATEGORY } from "./categorize";
import {
  DAY_LINE_RE,
  blockText,
  fetchAllBlockChildren,
  flattenDays,
  getMonthPagesSummary,
  getRootPageId,
  getTaipeiToday,
  notionFetch,
  parseItemsFromRest,
  sumEntries,
  toRichText,
  type NotionBlock,
} from "./notion";
import type { DayLine, ExpectedExpense, ExpectedFrequency, MonthSummary, NotionSummaryResponse } from "./types";

export const LEDGER_PAGE_TITLE = "花費記錄";
export const EXPECTED_PAGE_TITLE = "預期支出";
const YEAR_HEADER_RE = /^(\d{4})\s*年$/;
export const EXPECTED_FREQUENCIES: ExpectedFrequency[] = ["每月", "每年", "一次"];
const EXPECTED_LINE_RE = /^(.+?)\s+([\d,]+(?:\.\d+)?)(?:\s*(每月|每年|一次))?(?:\s+(.*))?$/;

function splitLines(text: string): string[] {
  return text.split("\n").map((line) => line.trim());
}

async function findChildPageByTitle(parentId: string, title: string): Promise<string | null> {
  const children = await fetchAllBlockChildren(parentId);
  const match = children.find((b) => b.type === "child_page" && b.child_page?.title.trim() === title);
  return match ? match.id : null;
}

// ---------------------------------------------------------------------------
// Ledger (花費記錄)
// ---------------------------------------------------------------------------

// Pure parser: day lines belonging to `year`, plus that year's header block id.
// Lines that appear before any 「YYYY年」 header are treated as `year`.
export function parseLedgerBlocks(
  blocks: NotionBlock[],
  year: number,
): { days: DayLine[]; yearHeaderId: string | null } {
  let currentYear: number | null = null;
  let yearHeaderId: string | null = null;
  const days: DayLine[] = [];
  for (const block of blocks) {
    if (block.type !== "paragraph" || !block.paragraph) continue;
    const header = blockText(block).trim().match(YEAR_HEADER_RE);
    if (header) {
      currentYear = Number(header[1]);
      if (currentYear === year && yearHeaderId === null) yearHeaderId = block.id;
      continue;
    }
    if ((currentYear ?? year) !== year) continue;
    splitLines(blockText(block)).forEach((line, lineIndex) => {
      const match = line.match(DAY_LINE_RE);
      if (!match) return;
      const [, monthStr, dayStr, rest] = match;
      const month = Number(monthStr);
      const day = Number(dayStr);
      if (month < 1 || month > 12 || day < 1 || day > 31) return;
      const items = parseItemsFromRest(rest);
      if (items.length === 0) return;
      days.push({
        blockId: block.id,
        lineIndex,
        month,
        day,
        items: items.map((item) => ({ ...item, category: OTHER_CATEGORY })),
      });
    });
  }
  return { days, yearHeaderId };
}

export function buildLedgerSummary(
  ledgerId: string,
  blocks: NotionBlock[],
  today: { year: number; month: number; day: number },
): NotionSummaryResponse {
  const { days } = parseLedgerBlocks(blocks, today.year);
  const byMonth = new Map<number, DayLine[]>();
  for (const d of days) {
    const list = byMonth.get(d.month) ?? [];
    list.push(d);
    byMonth.set(d.month, list);
  }
  if (!byMonth.has(today.month)) byMonth.set(today.month, []);

  const months: MonthSummary[] = [...byMonth.keys()]
    .sort((a, b) => a - b)
    .map((monthNumber) => {
      const monthDays = byMonth.get(monthNumber)!;
      const entries = flattenDays(monthDays);
      return { monthNumber, label: `${monthNumber}月`, pageId: ledgerId, spent: sumEntries(entries), days: monthDays, entries };
    });

  const current = months.find((m) => m.monthNumber === today.month)!;
  return {
    currentMonth: {
      ...current,
      daysInMonth: new Date(today.year, today.month, 0).getDate(),
      dayOfMonth: today.day,
      pageMissing: false,
    },
    months,
    expected: [],
    expectedPageId: null,
  };
}

export async function getNotionSummary(): Promise<NotionSummaryResponse> {
  const rootPageId = getRootPageId();
  const [ledgerId, expectedPageId] = await Promise.all([
    findChildPageByTitle(rootPageId, LEDGER_PAGE_TITLE),
    findChildPageByTitle(rootPageId, EXPECTED_PAGE_TITLE),
  ]);
  const summary = ledgerId
    ? buildLedgerSummary(ledgerId, await fetchAllBlockChildren(ledgerId), getTaipeiToday())
    : await getMonthPagesSummary(rootPageId);
  summary.expectedPageId = expectedPageId;
  summary.expected = expectedPageId ? parseExpectedBlocks(await fetchAllBlockChildren(expectedPageId)) : [];
  return summary;
}

// Inserts a new day line into the ledger, right under this year's header so
// the newest-first ordering is kept. Returns false when there is no ledger
// page (caller then uses the legacy per-month layout).
export async function createLedgerDayLine(rootPageId: string, lineText: string): Promise<boolean> {
  const ledgerId = await findChildPageByTitle(rootPageId, LEDGER_PAGE_TITLE);
  if (!ledgerId) return false;
  const today = getTaipeiToday();
  const { yearHeaderId } = parseLedgerBlocks(await fetchAllBlockChildren(ledgerId), today.year);
  const paragraph = (text: string) => ({ object: "block", type: "paragraph", paragraph: { rich_text: toRichText(text) } });

  if (yearHeaderId) {
    await notionFetch(`/blocks/${ledgerId}/children`, {
      method: "PATCH",
      body: { children: [paragraph(lineText)], after: yearHeaderId },
    });
  } else {
    // New year: Notion can't insert before the first block, so the new year
    // section is appended at the end of the page.
    await notionFetch(`/blocks/${ledgerId}/children`, {
      method: "PATCH",
      body: { children: [paragraph(`${today.year}年`), paragraph(lineText)] },
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// 預期支出
// ---------------------------------------------------------------------------

export function parseExpectedLine(line: string): Omit<ExpectedExpense, "blockId" | "lineIndex"> | null {
  const match = line.trim().match(EXPECTED_LINE_RE);
  if (!match) return null;
  const [, name, amountStr, freq, note] = match;
  const amount = Number(amountStr.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return {
    name: name.trim(),
    amount,
    frequency: (freq as ExpectedFrequency | undefined) ?? "一次",
    note: (note ?? "").trim(),
  };
}

export function formatExpectedLine(e: { name: string; amount: number; frequency: ExpectedFrequency; note: string }): string {
  return `${e.name} ${e.amount} ${e.frequency}${e.note ? ` ${e.note}` : ""}`;
}

export function parseExpectedBlocks(blocks: NotionBlock[]): ExpectedExpense[] {
  const list: ExpectedExpense[] = [];
  for (const block of blocks) {
    if (block.type !== "paragraph" || !block.paragraph) continue;
    splitLines(blockText(block)).forEach((line, lineIndex) => {
      const parsed = parseExpectedLine(line);
      if (parsed) list.push({ ...parsed, blockId: block.id, lineIndex });
    });
  }
  return list;
}

export class ExpectedConflictError extends Error {}

async function ensureExpectedPage(): Promise<string> {
  const rootPageId = getRootPageId();
  const existing = await findChildPageByTitle(rootPageId, EXPECTED_PAGE_TITLE);
  if (existing) return existing;
  const page = (await notionFetch(`/pages`, {
    method: "POST",
    body: {
      parent: { page_id: rootPageId },
      properties: { title: { title: [{ type: "text", text: { content: EXPECTED_PAGE_TITLE } }] } },
    },
  })) as { id: string };
  return page.id;
}

export async function listExpected(): Promise<ExpectedExpense[]> {
  const pageId = await findChildPageByTitle(getRootPageId(), EXPECTED_PAGE_TITLE);
  return pageId ? parseExpectedBlocks(await fetchAllBlockChildren(pageId)) : [];
}

// Rewrites (or removes) one line of a block. `expectName` guards against a
// stale client copy editing the wrong line.
async function replaceExpectedLine(blockId: string, lineIndex: number, expectName: string, next: string | null) {
  const block = (await notionFetch(`/blocks/${blockId}`)) as NotionBlock;
  const lines = blockText(block).split("\n");
  let index = lineIndex;
  if (parseExpectedLine(lines[index] ?? "")?.name !== expectName) {
    index = lines.findIndex((l) => parseExpectedLine(l)?.name === expectName);
    if (index === -1) throw new ExpectedConflictError("找不到這筆預期支出，可能已在 Notion 被修改，請重新整理後再試。");
  }
  const nextLines = next === null ? lines.filter((_, i) => i !== index) : lines.map((l, i) => (i === index ? next : l));
  const remaining = nextLines.map((l) => l.trim()).filter(Boolean);
  if (remaining.length === 0) {
    await notionFetch(`/blocks/${blockId}`, { method: "DELETE" });
    return;
  }
  await notionFetch(`/blocks/${blockId}`, {
    method: "PATCH",
    body: { paragraph: { rich_text: toRichText(remaining.join("\n")) } },
  });
}

export async function saveExpected(input: {
  blockId: string | null;
  lineIndex: number | null;
  originalName: string | null;
  name: string;
  amount: number;
  frequency: ExpectedFrequency;
  note: string;
}): Promise<void> {
  const text = formatExpectedLine(input);
  if (input.blockId === null || input.lineIndex === null) {
    const pageId = await ensureExpectedPage();
    await notionFetch(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: { children: [{ object: "block", type: "paragraph", paragraph: { rich_text: toRichText(text) } }] },
    });
    return;
  }
  await replaceExpectedLine(input.blockId, input.lineIndex, input.originalName ?? input.name, text);
}

export async function removeExpected(input: { blockId: string; lineIndex: number; name: string }): Promise<void> {
  await replaceExpectedLine(input.blockId, input.lineIndex, input.name, null);
}
