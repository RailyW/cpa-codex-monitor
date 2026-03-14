import { NextResponse } from "next/server";
import { refreshAllAccounts } from "@/lib/codex-refresh";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await refreshAllAccounts({ trigger: "api:/api/codex-refresh" });
    return NextResponse.json({
      results,
      triggeredAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
