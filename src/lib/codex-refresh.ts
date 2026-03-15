import { apiCall, getAuthFiles } from "./cpa-client";
import { getCodexAccounts, resolveAccountId } from "./codex-quota";

const CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const MANAGEMENT_API_PATH = "/v0/management/api-call";
const BODY_PREVIEW_LIMIT = 240;

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

function logRefresh(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.log(`[Refresh] ${message} ${JSON.stringify(details)}`);
    return;
  }
  console.log(`[Refresh] ${message}`);
}

function buildTriggerLabel(trigger?: string): string {
  const label = trigger?.trim();
  return label ? label : "manual";
}

function maskValue(value: string | null | undefined, head: number = 4, tail: number = 4): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= head + tail) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

function previewText(value: string, maxLength: number = BODY_PREVIEW_LIMIT): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...(truncated)`;
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "chatgpt-account-id") {
      sanitized[key] = maskValue(value) ?? "<empty>";
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function buildResponseSummary(bodyText: string, contentType: string | null): Record<string, unknown> {
  return {
    contentType,
    bodyLength: bodyText.length,
    containsResponseCreated: bodyText.includes("response.created"),
    containsResponseCompleted: bodyText.includes("response.completed"),
    containsUsageLimitReached: bodyText.includes("usage_limit_reached"),
    bodyHead: previewText(bodyText.slice(0, BODY_PREVIEW_LIMIT)),
    bodyTail:
      bodyText.length > BODY_PREVIEW_LIMIT
        ? previewText(bodyText.slice(-BODY_PREVIEW_LIMIT))
        : null,
  };
}

export async function refreshAllAccounts(
  options: RefreshAllAccountsOptions = {}
): Promise<RefreshResult[]> {
  const trigger = buildTriggerLabel(options.trigger);
  const files = await getAuthFiles();
  const codexFiles = getCodexAccounts(files);
  const results: RefreshResult[] = [];

  logRefresh("refresh job started", {
    trigger,
    accounts: codexFiles.length,
    managementPath: MANAGEMENT_API_PATH,
    upstreamUrl: CODEX_RESPONSES_URL,
  });

  if (codexFiles.length === 0) {
    logRefresh("no codex accounts found", { trigger });
    return results;
  }

  for (const file of codexFiles) {
    const authIndex = file.auth_index ?? file.authIndex ?? null;
    logRefresh("account picked", {
      trigger,
      account: file.name,
      authIndex: maskValue(authIndex),
      provider: file.provider,
      email: file.email ?? null,
    });

    if (!authIndex) {
      const error = "missing auth_index";
      results.push({ name: file.name, success: false, error });
      logRefresh("account skipped", {
        trigger,
        account: file.name,
        error,
      });
      continue;
    }

    const { accountId } = await resolveAccountId(file);
    if (!accountId) {
      const error = "missing chatgpt_account_id";
      results.push({ name: file.name, success: false, error });
      logRefresh("account skipped", {
        trigger,
        account: file.name,
        authIndex: maskValue(authIndex),
        error,
      });
      continue;
    }

    const headers = {
      ...CODEX_HEADERS_BASE,
      "Chatgpt-Account-Id": accountId,
    };
    const requestPayload = {
      authIndex,
      method: "POST" as const,
      url: CODEX_RESPONSES_URL,
      header: headers,
      data: REFRESH_REQUEST_BODY,
    };

    logRefresh("request prepared", {
      trigger,
      account: file.name,
      authIndex: maskValue(authIndex),
      accountId: maskValue(accountId),
      managementPath: MANAGEMENT_API_PATH,
      upstreamMethod: requestPayload.method,
      upstreamUrl: requestPayload.url,
      headers: sanitizeHeaders(requestPayload.header),
      bodyPreview: previewText(requestPayload.data),
    });

    const startedAt = Date.now();

    try {
      const res = await apiCall<unknown>(requestPayload);
      const durationMs = Date.now() - startedAt;
      const statusCode = res.statusCode ?? res.status_code ?? 0;
      const ok = statusCode >= 200 && statusCode < 300;
      const bodyText = String(res.bodyText ?? "");
      const contentTypeValue =
        res.header?.["content-type"] ??
        res.header?.["Content-Type"] ??
        res.headers?.["content-type"] ??
        res.headers?.["Content-Type"] ??
        null;
      const contentType = Array.isArray(contentTypeValue)
        ? contentTypeValue.join("; ")
        : contentTypeValue;

      logRefresh("response received", {
        trigger,
        account: file.name,
        authIndex: maskValue(authIndex),
        accountId: maskValue(accountId),
        statusCode,
        durationMs,
        ...buildResponseSummary(bodyText, contentType),
      });

      if (!ok) {
        const errDetail = extractErrorDetail(res.body);
        const error = errDetail
          ? `HTTP ${statusCode}: ${errDetail}`
          : `HTTP ${statusCode}`;
        results.push({ name: file.name, success: false, error });
        logRefresh("request failed", {
          trigger,
          account: file.name,
          authIndex: maskValue(authIndex),
          accountId: maskValue(accountId),
          statusCode,
          durationMs,
          error,
        });
        continue;
      }

      results.push({ name: file.name, success: true });
      logRefresh("request succeeded", {
        trigger,
        account: file.name,
        authIndex: maskValue(authIndex),
        accountId: maskValue(accountId),
        statusCode,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const error = err instanceof Error ? err.message : String(err);
      results.push({ name: file.name, success: false, error });
      logRefresh("request threw", {
        trigger,
        account: file.name,
        authIndex: maskValue(authIndex),
        accountId: maskValue(accountId),
        durationMs,
        error,
      });
    }
  }

  const successCount = results.filter((result) => result.success).length;
  logRefresh("refresh job finished", {
    trigger,
    success: `${successCount}/${results.length}`,
  });

  return results;
}
