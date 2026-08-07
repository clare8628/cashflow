import type { Entry } from "./types";

export const OTHER_CATEGORY = "其它";
export const OTHER_COLOR_VAR = "var(--cat-other)";

interface CategoryDef {
  name: string;
  colorVar: string;
  keywords: string[];
}

// Keyword lists are heuristic and editable — add/remove keywords here as
// spending habits show up miscategorized.
const CATEGORIES: CategoryDef[] = [
  {
    name: "飲食",
    colorVar: "var(--cat-1)",
    keywords: [
      "咖啡", "早餐", "午餐", "晚餐", "消夜", "宵夜", "飲料", "便當", "餐廳", "餐飲",
      "麥當勞", "星巴克", "小吃", "火鍋", "燒烤", "甜點", "飯", "麵", "超商",
      "便利商店", "7-11", "全家", "萊爾富", "啤酒", "酒",
    ],
  },
  {
    name: "交通",
    colorVar: "var(--cat-2)",
    keywords: [
      "加油", "機車", "停車", "捷運", "公車", "計程車", "uber", "高鐵", "火車",
      "油錢", "停車費", "悠遊卡", "過路費",
    ],
  },
  {
    name: "採買日用",
    colorVar: "var(--cat-3)",
    keywords: [
      "全聯", "家樂福", "超市", "大賣場", "好市多", "costco", "日用品", "衛生紙",
      "洗衣精", "屈臣氏", "康是美",
    ],
  },
  {
    name: "3C用品",
    colorVar: "var(--cat-4)",
    keywords: ["手機殼", "手機", "耳機", "充電器", "電腦", "3c", "保護貼", "滑鼠", "鍵盤"],
  },
  {
    name: "醫療保健",
    colorVar: "var(--cat-5)",
    keywords: ["藥", "診所", "醫院", "掛號", "牙醫", "健檢", "眼鏡"],
  },
  {
    name: "娛樂旅遊",
    colorVar: "var(--cat-6)",
    keywords: ["電影", "唱歌", "ktv", "遊戲", "旅遊", "門票", "住宿", "飯店", "機票"],
  },
  {
    name: "服飾",
    colorVar: "var(--cat-7)",
    keywords: ["衣服", "鞋", "包", "服飾", "outlet", "襪子"],
  },
];

export function categorize(description: string): string {
  const lower = description.toLowerCase();
  for (const category of CATEGORIES) {
    if (category.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      return category.name;
    }
  }
  return OTHER_CATEGORY;
}

export function colorForCategory(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.colorVar ?? OTHER_COLOR_VAR;
}

export interface CategoryGroup {
  name: string;
  total: number;
  entries: Entry[];
}

export function groupByCategory(entries: Entry[]): CategoryGroup[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) {
    const name = categorize(entry.description);
    const list = map.get(name);
    if (list) {
      list.push(entry);
    } else {
      map.set(name, [entry]);
    }
  }
  return Array.from(map.entries())
    .map(([name, groupEntries]) => ({
      name,
      total: groupEntries.reduce((sum, e) => sum + e.amount, 0),
      entries: [...groupEntries].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.total - a.total);
}
