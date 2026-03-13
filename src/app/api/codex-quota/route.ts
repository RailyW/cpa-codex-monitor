import { NextResponse } from "next/server";
import { getCachedQuota } from "@/lib/quota-cache";
import { fetchAllCodexQuotas } from "@/lib/codex-quota";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cached = getCachedQuota();
    const data = cached ?? (await fetchAllCodexQuotas());
    if (data.error && data.accounts.length === 0) {
      const msg = data.error.toLowerCase();
      if (msg.includes("management key") || msg.includes("invalid")) {
        return NextResponse.json({ error: data.error }, { status: 502 });
      }
      return NextResponse.json({ error: data.error }, { status: 503 });
    }
    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
