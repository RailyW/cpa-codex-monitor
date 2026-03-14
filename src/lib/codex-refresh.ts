import { apiCall, getAuthFiles } from "./cpa-client";
import { getCodexAccounts, resolveAccountId } from "./codex-quota";

const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";

function extractErrorDetail(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const err = o.error;
  const errStr =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message)
        : "";
  const msg = [errStr, o.message, o.detail].filter(Boolean).map(String).join(" ").trim();
  const code =
    o.code ??
    (err && typeof err === "object" && "code" in err
      ? (err as { code?: string }).code
      : undefined);
  if (msg || code) return [code, msg].filter(Boolean).join(" ").trim() || null;
  return null;
}

const CODEX_HEADERS_BASE: Record<string, string> = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
};

const REFRESH_REQUEST_BODY = JSON.stringify({
  model: "gpt-5",
  instructions: "Reply with ok",
  input: [{ role: "user", content: "hi" }],
  stream: true,
  store: false,
});

export interface RefreshResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface RefreshAllAccountsOptions {
  trigger?: string;
}

function logRefresh(message: string): void {
  console.log(`[Refresh] ${message}`);
}

function buildTriggerLabel(trigger?: string): string {
  const label = trigger?.trim();
  return label ? label : "manual";
}

export async function refreshAllAccounts(
  options: RefreshAllAccountsOptions = {}
): Promise<RefreshResult[]> {
  const trigger = buildTriggerLabel(options.trigger);
  const files = await getAuthFiles();
  const codexFiles = getCodexAccounts(files);
  const results: RefreshResult[] = [];

  logRefresh(
    `开始刷新任务用量计费时间窗口 trigger=${trigger} accounts=${codexFiles.length}`
  );

  if (codexFiles.length === 0) {
    logRefresh(`未找到可刷新的 Codex 账号 trigger=${trigger}`);
    return results;
  }

  for (const file of codexFiles) {
    const authIndex = file.auth_index ?? file.authIndex ?? null;
    logRefresh(`${file.name} 开始执行 trigger=${trigger}`);

    if (!authIndex) {
      const error = "missing auth_index";
      results.push({ name: file.name, success: false, error });
      logRefresh(`${file.name} 失败: ${error}`);
      continue;
    }

    const { accountId } = await resolveAccountId(file);
    if (!accountId) {
      const error = "missing chatgpt_account_id";
      results.push({ name: file.name, success: false, error });
      logRefresh(`${file.name} 失败: ${error}`);
      continue;
    }

    try {
      const res = await apiCall<unknown>({
        authIndex,
        method: "POST",
        url: CODEX_RESPONSES_URL,
        header: {
          ...CODEX_HEADERS_BASE,
          "Chatgpt-Account-Id": accountId,
        },
        data: REFRESH_REQUEST_BODY,
      });

      const statusCode = res.statusCode ?? res.status_code ?? 0;
      const ok = statusCode >= 200 && statusCode < 300;

      if (!ok) {
        const errDetail = extractErrorDetail(res.body);
        const error = errDetail
          ? `HTTP ${statusCode}: ${errDetail}`
          : `HTTP ${statusCode}`;
        results.push({ name: file.name, success: false, error });
        logRefresh(`${file.name} 失败: ${error}`);
        continue;
      }

      results.push({ name: file.name, success: true });
      logRefresh(`${file.name} 成功 status=${statusCode}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ name: file.name, success: false, error });
      logRefresh(`${file.name} 失败: ${error}`);
    }
  }

  const successCount = results.filter((result) => result.success).length;
  logRefresh(
    `刷新完成 trigger=${trigger} success=${successCount}/${results.length}`
  );

  return results;
}
