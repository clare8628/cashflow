import { NextResponse } from "next/server";
import {
  EXPECTED_FREQUENCIES,
  ExpectedConflictError,
  listExpected,
  removeExpected,
  saveExpected,
} from "@/lib/ledger";
import type { ExpectedFrequency } from "@/lib/types";

class ValidationError extends Error {}

function validate(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new ValidationError("名稱不可為空");
  if (/\n/.test(name)) throw new ValidationError("名稱不可換行");
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("金額必須為正數");
  const frequency = body.frequency as ExpectedFrequency;
  if (!EXPECTED_FREQUENCIES.includes(frequency)) throw new ValidationError("頻率必須是 每月 / 每年 / 一次");
  const note = typeof body.note === "string" ? body.note.replace(/\s*\n\s*/g, " ").trim() : "";
  return { name: name.replace(/\s+/g, ""), amount: Math.round(amount), frequency, note };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "未知錯誤";
  const status = error instanceof ValidationError ? 400 : error instanceof ExpectedConflictError ? 409 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    return NextResponse.json({ expected: await listExpected() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fields = validate(body);
    const blockId = typeof body.blockId === "string" ? body.blockId : null;
    const lineIndex = typeof body.lineIndex === "number" ? body.lineIndex : null;
    const originalName = typeof body.originalName === "string" ? body.originalName : null;
    await saveExpected({ ...fields, blockId, lineIndex, originalName });
    return NextResponse.json({ expected: await listExpected() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.blockId !== "string" || typeof body.lineIndex !== "number" || typeof body.name !== "string") {
      throw new ValidationError("缺少 blockId / lineIndex / name");
    }
    await removeExpected({ blockId: body.blockId, lineIndex: body.lineIndex, name: body.name });
    return NextResponse.json({ expected: await listExpected() });
  } catch (error) {
    return errorResponse(error);
  }
}
