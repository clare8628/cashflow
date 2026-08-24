import { NextResponse } from "next/server";
import { categorizeSummary } from "@/lib/ai-categorize";
import {
  DayLineConflictError,
  FORBIDDEN_DESCRIPTION_CHARS,
  getNotionSummary,
  removeDayLine,
  saveDayLine,
} from "@/lib/notion";

class ValidationError extends Error {}

interface ItemInput {
  description: string;
  amount: number;
}

function validateItems(raw: unknown): ItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError("項目不可為空");
  }
  return raw.map((entry) => {
    if (typeof entry !== "object" || entry === null) throw new ValidationError("項目格式錯誤");
    const { description, amount } = entry as Record<string, unknown>;
    if (typeof description !== "string" || !description.trim()) {
      throw new ValidationError("項目描述不可為空");
    }
    if (FORBIDDEN_DESCRIPTION_CHARS.test(description)) {
      throw new ValidationError("項目描述不可包含「、」「,」「，」");
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError("金額必須為正數");
    }
    return { description: description.trim(), amount: Math.round(amount) };
  });
}

function validateMonthDay(monthNumber: unknown, day: unknown): { monthNumber: number; day: number } {
  const m = Number(monthNumber);
  const d = Number(day);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new ValidationError("月份格式錯誤");
  if (!Number.isInteger(d) || d < 1 || d > 31) throw new ValidationError("日期格式錯誤");
  return { monthNumber: m, day: d };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      monthNumber?: unknown;
      day?: unknown;
      blockId?: string | null;
      lineIndex?: number | null;
      items?: unknown;
    };
    const { monthNumber, day } = validateMonthDay(body.monthNumber, body.day);
    const items = validateItems(body.items);
    const blockId = body.blockId ?? null;
    const lineIndex = body.lineIndex ?? null;
    if ((blockId === null) !== (lineIndex === null)) {
      throw new ValidationError("blockId 與 lineIndex 必須同時提供或同時省略");
    }

    await saveDayLine({ monthNumber, day, items, blockId, lineIndex });

    const summary = await categorizeSummary(await getNotionSummary());
    return NextResponse.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      monthNumber?: unknown;
      day?: unknown;
      blockId?: unknown;
      lineIndex?: unknown;
    };
    const { monthNumber, day } = validateMonthDay(body.monthNumber, body.day);
    const blockId = body.blockId;
    const lineIndex = Number(body.lineIndex);
    if (typeof blockId !== "string" || !blockId || !Number.isInteger(lineIndex)) {
      throw new ValidationError("缺少必要欄位");
    }

    await removeDayLine({ monthNumber, day, blockId, lineIndex });

    const summary = await categorizeSummary(await getNotionSummary());
    return NextResponse.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DayLineConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "未知錯誤";
  return NextResponse.json({ error: message }, { status: 500 });
}
