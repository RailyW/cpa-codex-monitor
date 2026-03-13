import { getAuthFiles, apiCall } from "./cpa-client";
import { getCodexAccounts, resolveAccountId } from "./codex-quota";
import type { AuthFileItem } from "./types";

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
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
        await apiCall({
          authIndex,
          method: "POST",
          url: CHAT_COMPLETIONS_URL,
          header: {
            ...CODEX_HEADERS_BASE,
            "Chatgpt-Account-Id": accountId,
          },
          data: JSON.stringify({
            model: "gpt-4.1-nano",
            max_tokens: 1,
            messages: [{ role: "user" as const, content: "hi" }],
          }),
        });
      }
      results.push({ name: file.name, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: file.name, success: false, error: message });
    }
  }
  return results;
}
