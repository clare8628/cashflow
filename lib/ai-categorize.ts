import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CATEGORY_NAMES, keywordCategorize, OTHER_CATEGORY } from "./categorize";
import type { Entry, NotionSummaryResponse } from "./types";

const KV_KEY_PREFIX = "cat:";
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BATCH_SIZE = 40;
const VALID_CATEGORIES = new Set([...CATEGORY_NAMES, OTHER_CATEGORY]);

const SYSTEM_PROMPT = `你是記帳 App 的消費分類助手。你會收到一批消費項目的描述，請把每一項分類到最合適的類別。

可用類別：${CATEGORY_NAMES.join("、")}。
只有在所有類別都明顯不合適時，才使用「${OTHER_CATEGORY}」，不要因為不確定就隨便丟進「${OTHER_CATEGORY}」——請根據常識積極歸類，包含間接、隱含的情況，例如：
- 食材、調味料（如橄欖油、醬油）、聚餐、外食、伙食費 → 飲食
- 租車、計程車費、停車費、任何交通工具相關花費 → 交通
- 生活雜物、日用品採買（即使描述籠統如「雜物」「日用品」） → 採買日用
- 洗牙、看診、健檢、藥品、保健食品 → 醫療保健
只有像是禮金、罰款、稅金、捐款這類真的無法歸入任何消費類別的項目，才使用「${OTHER_CATEGORY}」。

只能輸出一個 JSON 陣列，格式為 [{"i":0,"c":"飲食"},{"i":1,"c":"交通"}]，i 是項目編號、c 是類別名稱，不要輸出任何其他文字或說明。`;

function kvKey(description: string): string {
  return `${KV_KEY_PREFIX}${description}`;
}

function normalizeCategory(value: unknown): string {
  return typeof value === "string" && VALID_CATEGORIES.has(value) ? value : OTHER_CATEGORY;
}

async function readCachedCategories(
  kv: KVNamespace,
  descriptions: string[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (let i = 0; i < descriptions.length; i += 100) {
    const batch = descriptions.slice(i, i + 100);
    const results = await kv.get(batch.map(kvKey));
    for (const desc of batch) {
      const value = results.get(kvKey(desc));
      if (value) resolved.set(desc, normalizeCategory(value));
    }
  }
  return resolved;
}

async function classifyWithAI(ai: Ai, descriptions: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
    const batch = descriptions.slice(i, i + BATCH_SIZE);
    const itemList = batch.map((desc, idx) => `${idx}. ${desc}`).join("\n");

    try {
      const result = await ai.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `消費項目：\n${itemList}` },
        ],
        temperature: 0,
      });

      // Different Workers AI models shape their output differently: some
      // return { response }, others return an OpenAI-style
      // { choices: [{ message: { content } }] } payload.
      const r = result as {
        response?: unknown;
        choices?: { message?: { content?: unknown } }[];
      };
      const content = typeof r.response === "string" ? r.response : r.choices?.[0]?.message?.content;
      const raw = typeof content === "string" ? content : JSON.stringify(content ?? "");
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error(`AI 回應找不到 JSON 陣列: ${raw.slice(0, 200)}`);

      const parsed = JSON.parse(match[0]) as { i?: number; c?: string }[];
      for (const item of parsed) {
        if (typeof item.i !== "number" || !batch[item.i]) continue;
        resolved.set(batch[item.i], normalizeCategory(item.c));
      }

      // Anything the model skipped falls back to the keyword heuristic.
      for (const desc of batch) {
        if (!resolved.has(desc)) resolved.set(desc, keywordCategorize(desc));
      }
    } catch (error) {
      console.warn("AI 分類批次失敗，改用關鍵字備援：", error);
      for (const desc of batch) resolved.set(desc, keywordCategorize(desc));
    }
  }

  return resolved;
}

/**
 * Resolves a `category` for every entry across the summary, using a cached
 * category per unique description where available and falling back to a
 * batched AI classification call for anything new. Falls back to the
 * keyword heuristic entirely if Workers AI/KV bindings aren't reachable
 * (e.g. local `next dev` without a Cloudflare context).
 */
export async function categorizeSummary(
  summary: NotionSummaryResponse,
): Promise<NotionSummaryResponse> {
  const allEntries = summary.months.flatMap((m) => m.entries);
  const uniqueDescriptions = [...new Set(allEntries.map((e) => e.description))];
  if (uniqueDescriptions.length === 0) return summary;

  let env: CloudflareEnv | null = null;
  try {
    env = getCloudflareContext({ async: false }).env;
  } catch {
    env = null;
  }

  const categoryByDescription = new Map<string, string>();

  if (env?.AI && env?.CATEGORY_CACHE) {
    const cached = await readCachedCategories(env.CATEGORY_CACHE, uniqueDescriptions);
    const uncached = uniqueDescriptions.filter((d) => !cached.has(d));
    const classified = uncached.length > 0 ? await classifyWithAI(env.AI, uncached) : new Map();

    for (const [desc, category] of cached) categoryByDescription.set(desc, category);
    for (const [desc, category] of classified) categoryByDescription.set(desc, category);

    if (classified.size > 0) {
      const kv = env.CATEGORY_CACHE;
      await Promise.all(
        [...classified].map(([desc, category]) => kv.put(kvKey(desc), category)),
      );
    }
  } else {
    console.warn("Workers AI/KV binding 不可用，改用關鍵字分類。");
    for (const desc of uniqueDescriptions) {
      categoryByDescription.set(desc, keywordCategorize(desc));
    }
  }

  const applyCategory = (entry: Entry): Entry => ({
    ...entry,
    category: categoryByDescription.get(entry.description) ?? OTHER_CATEGORY,
  });

  const months = summary.months.map((m) => ({ ...m, entries: m.entries.map(applyCategory) }));
  const currentMonth = summary.currentMonth.pageMissing
    ? summary.currentMonth
    : {
        ...summary.currentMonth,
        entries:
          months.find((m) => m.monthNumber === summary.currentMonth.monthNumber)?.entries ??
          summary.currentMonth.entries.map(applyCategory),
      };

  return { currentMonth, months };
}
