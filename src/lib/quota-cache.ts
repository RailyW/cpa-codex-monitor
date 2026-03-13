import { fetchAllCodexQuotas } from "./codex-quota";
import type { CodexQuotaResponse } from "./types";

const g = globalThis as unknown as {
  __quotaCache?: CodexQuotaResponse;
  __quotaPollTimer?: ReturnType<typeof setInterval>;
};

export function getCachedQuota(): CodexQuotaResponse | null {
  return g.__quotaCache ?? null;
}

async function poll() {
  try {
    g.__quotaCache = await fetchAllCodexQuotas();
  } catch (err) {
    console.error("[QuotaCache] 轮询失败:", err);
  }
}

export function startQuotaPoller(): void {
  if (g.__quotaPollTimer) return;
  const sec = Math.max(10, parseInt(process.env.QUOTA_CHECK_INTERVAL ?? "300", 10));
  poll();
  g.__quotaPollTimer = setInterval(poll, sec * 1000);
  console.log(`[QuotaCache] 已启动 间隔=${sec}s`);
}
