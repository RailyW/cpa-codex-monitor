import { getAuthFiles, apiCall } from "./cpa-client";
import { getCodexAccounts, resolveAccountId } from "./codex-quota";

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

function extractErrorDetail(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const err = o.error;
  const errStr = typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "";
  const msg = [errStr, o.message, o.detail].filter(Boolean).map(String).join(" ").trim();
  const code = o.code ?? (err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined);
  if (msg || code) return [code, msg].filter(Boolean).join(" ").trim() || null;
  return null;
}

const CODEX_HEADERS_BASE: Record<string, string> = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
};

export interface RefreshResult {
  name: string;
  success: boolean;
  error?: string;
}

export async function refreshAllAccounts(): Promise<RefreshResult[]> {
  const mode = (process.env.REFRESH_MODE ?? "quota-check").toLowerCase();
  const useQuotaCheck = mode !== "chat-completion";
  const files = await getAuthFiles();
  const codexFiles = getCodexAccounts(files);
  const results: RefreshResult[] = [];

  for (const file of codexFiles) {
    const authIndex = file.auth_index ?? file.authIndex ?? null;
    if (!authIndex) {
      results.push({ name: file.name, success: false, error: "missing auth_index" });
      continue;
    }
    const { accountId } = await resolveAccountId(file);
    if (!accountId) {
      results.push({ name: file.name, success: false, error: "missing chatgpt_account_id" });
      continue;
    }
    try {
      if (useQuotaCheck) {
        await apiCall({
          authIndex,
          method: "GET",
          url: CODEX_USAGE_URL,
          header: {
            ...CODEX_HEADERS_BASE,
            "Chatgpt-Account-Id": accountId,
          },
        });
      } else {
        const requestBody = JSON.stringify({
          model: "gpt-5",
          instructions: "Reply with ok",
          input: [{ role: "user", content: "hi" }],
          stream: true,
          store: false,
        });
        const res = await apiCall<unknown>({
          authIndex,
          method: "POST",
          url: CODEX_RESPONSES_URL,
          header: {
            ...CODEX_HEADERS_BASE,
            "Chatgpt-Account-Id": accountId,
          },
          data: requestBody,
        });
        const statusCode = res.statusCode ?? res.status_code ?? 0;
        const ok = statusCode >= 200 && statusCode < 300;
        if (!ok) {
          const errDetail = extractErrorDetail(res.body);
          results.push({ name: file.name, success: false, error: errDetail ? `HTTP ${statusCode}: ${errDetail}` : `HTTP ${statusCode}` });
        } else {
          results.push({ name: file.name, success: true });
        }
        continue;
      }
      results.push({ name: file.name, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: file.name, success: false, error: message });
    }
  }
  return results;
}
