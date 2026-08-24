import { NextResponse } from "next/server";
import { categorizeSummary } from "@/lib/ai-categorize";
import { getNotionSummary } from "@/lib/notion";

export async function GET() {
  try {
    const summary = await categorizeSummary(await getNotionSummary());
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
