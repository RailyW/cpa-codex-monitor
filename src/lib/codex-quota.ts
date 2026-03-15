import { getAuthFiles, apiCall } from "./cpa-client";
import type {
  AuthFileItem,
  CodexUsagePayload,
  CodexUsageWindow,
  CodexRateLimitInfo,
  QuotaWindow,
  CodexAccountQuota,
  CodexQuotaResponse,
} from "./types";
import {
  FIVE_HOUR_SECONDS,
  WEEK_SECONDS,
  WINDOW_LABELS,
} from "./types";

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_REQUEST_HEADERS: Record<string, string> = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
};

function normNum(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

function formatResetLabel(resetAt: string | number | null | undefined): string {
  if (resetAt === undefined || resetAt === null) return "-";
  let date: Date;
  if (typeof resetAt === "number") {
    date = new Date(resetAt <= 1e12 ? resetAt * 1000 : resetAt);
  } else {
    if (!String(resetAt).trim()) return "-";
    date = new Date(resetAt);
  }
  if (Number.isNaN(date.getTime())) return "-";
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return "已重置";
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (day >= 1) return `${day}d ${hour % 24}h`;
  if (hour >= 1) return `${hour}h ${min % 60}m`;
  if (min >= 1) return `${min}m`;
  return `${sec}s`;
}

function getWindowSeconds(w?: CodexUsageWindow | null): number | null {
  if (!w) return null;
  return normNum(w.limit_window_seconds ?? w.limitWindowSeconds);
}

function pickClassifiedWindows(
  limitInfo?: CodexRateLimitInfo | null
): { fiveHour: CodexUsageWindow | null; weekly: CodexUsageWindow | null } {
  const primary = limitInfo?.primary_window ?? limitInfo?.primaryWindow ?? null;
  const secondary = limitInfo?.secondary_window ?? limitInfo?.secondaryWindow ?? null;
  let fiveHour: CodexUsageWindow | null = null;
  let weekly: CodexUsageWindow | null = null;
  for (const w of [primary, secondary]) {
    if (!w) continue;
    const sec = getWindowSeconds(w);
    if (sec === FIVE_HOUR_SECONDS) fiveHour = w;
    else if (sec === WEEK_SECONDS) weekly = w;
  }
  if (!fiveHour) fiveHour = primary && primary !== weekly ? primary : null;
  if (!weekly) weekly = secondary && secondary !== fiveHour ? secondary : null;
  return { fiveHour, weekly };
}

function resetAtToIso(resetRaw: string | number | null | undefined): string | null {
  if (resetRaw === undefined || resetRaw === null) return null;
  if (typeof resetRaw === "number") {
    const ms = resetRaw <= 1e12 ? resetRaw * 1000 : resetRaw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return normStr(resetRaw);
}

function addWindow(
  list: QuotaWindow[],
  id: string,
  label: string,
  window: CodexUsageWindow | null | undefined,
  limitReached?: boolean,
  allowed?: boolean
): void {
  if (!window) return;
  const resetRaw = window.reset_at ?? window.resetAt ?? window.resets_at ?? window.resetsAt;
  const resetLabel = formatResetLabel(resetRaw ?? null);
  const usedRaw = normNum(window.used_percent ?? window.usedPercent);
  const isLimitReached = limitReached === true || allowed === false;
  const usedPercent = usedRaw ?? (isLimitReached && resetLabel !== "-" ? 100 : null);
  const remainingPercent = usedPercent !== null ? Math.max(0, Math.min(100, 100 - usedPercent)) : null;
  list.push({
    id,
    label,
    usedPercent,
    remainingPercent,
    resetAt: resetAtToIso(resetRaw),
    resetLabel,
  });
}

function buildWindowsFromRateLimit(
  rateLimit: CodexRateLimitInfo | undefined | null,
  prefix: string
): QuotaWindow[] {
  const list: QuotaWindow[] = [];
  if (!rateLimit) return list;
  const { fiveHour, weekly } = pickClassifiedWindows(rateLimit);
  const limitReached = rateLimit.limit_reached ?? rateLimit.limitReached;
  const allowed = rateLimit.allowed;
  addWindow(list, `${prefix}five-hour`, WINDOW_LABELS["five-hour"] ?? "5小时限额", fiveHour, limitReached, allowed);
  addWindow(list, `${prefix}weekly`, WINDOW_LABELS.weekly ?? "周限额", weekly, limitReached, allowed);
  return list;
}

export function parseUsagePayload(payload: CodexUsagePayload): QuotaWindow[] {
  const windows: QuotaWindow[] = [];
  const rateLimit = payload.rate_limit ?? payload.rateLimit;
  windows.push(...buildWindowsFromRateLimit(rateLimit, ""));

  const codeReview = payload.code_review_rate_limit ?? payload.codeReviewRateLimit;
  windows.push(
    ...buildWindowsFromRateLimit(codeReview, "code-review-").map((w) => ({
      ...w,
      id: w.id,
      label: w.id.includes("five-hour") ? (WINDOW_LABELS["code-review-five-hour"] ?? "代码审查 5小时限额") : (WINDOW_LABELS["code-review-weekly"] ?? "代码审查 周限额"),
    }))
  );

  const additional = payload.additional_rate_limits ?? payload.additionalRateLimits ?? [];
  if (Array.isArray(additional)) {
    additional.forEach((item, idx) => {
      const info = item?.rate_limit ?? item?.rateLimit;
      if (!info) return;
      const name = normStr(item.limit_name ?? item.limitName ?? item.metered_feature ?? item.meteredFeature) ?? `extra-${idx + 1}`;
      const { fiveHour, weekly } = pickClassifiedWindows(info);
      const limitReached = info.limit_reached ?? info.limitReached;
      const allowed = info.allowed;
      addWindow(windows, `extra-${idx}-5h`, `${name} 5h`, fiveHour, limitReached, allowed);
      addWindow(windows, `extra-${idx}-w`, `${name} 周`, weekly, limitReached, allowed);
    });
  }
  return windows;
}

function planTypeFromPayload(payload: CodexUsagePayload): string | null {
  const pt = normStr(payload.plan_type ?? payload.planType);
  if (!pt) return null;
  const lower = pt.toLowerCase();
  if (["plus", "team", "free"].includes(lower)) return lower;
  return pt;
}

export function getCodexAccounts(files: AuthFileItem[]): AuthFileItem[] {
  return files.filter((f) => {
    if (f.disabled === true) return false;
    if (f.provider === "codex") return true;
    if (f.name.startsWith("codex-")) return true;
    return false;
  });
}

function extractAccountId(file: AuthFileItem): string | null {
  return (
    normStr(file.chatgpt_account_id ?? file.chatgptAccountId) ??
    normStr(file.id_token?.chatgpt_account_id ?? file.idToken?.chatgptAccountId) ??
    normStr(file.account_id ?? file.accountId)
  );
}

function extractPlanType(file: AuthFileItem): string | null {
  const planType =
    normStr(file.plan_type ?? file.planType) ??
    normStr(file.id_token?.plan_type ?? file.idToken?.planType);
  return planType?.toLowerCase() ?? null;
}

export async function resolveAccountId(file: AuthFileItem): Promise<{ accountId: string | null; planType: string | null; email: string | null }> {
  const accountId = extractAccountId(file);
  const planType = extractPlanType(file);
  const normalizedPlanType =
    planType && ["plus", "team", "free"].includes(planType) ? planType : null;
  const email = normStr(file.email) ?? null;
  return { accountId, planType: normalizedPlanType, email };
}

export async function fetchQuotaForAccount(file: AuthFileItem): Promise<CodexAccountQuota> {
  const queriedAt = new Date().toISOString();
  const authIndex = file.auth_index ?? file.authIndex ?? null;
  if (!authIndex) {
    return {
      name: file.name,
      email: file.email ?? null,
      planType: null,
      status: "error",
      error: "missing auth_index",
      windows: [],
      fiveHourWindow: null,
      weeklyWindow: null,
      codeReviewFiveHourWindow: null,
      codeReviewWeeklyWindow: null,
      lastRefresh: file.last_refresh ?? null,
      queriedAt,
    };
  }

  const { accountId, planType, email } = await resolveAccountId(file);
  if (!accountId) {
    return {
      name: file.name,
      email: file.email ?? email ?? null,
      planType,
      status: "error",
      error: "missing chatgpt_account_id",
      windows: [],
      fiveHourWindow: null,
      weeklyWindow: null,
      codeReviewFiveHourWindow: null,
      codeReviewWeeklyWindow: null,
      lastRefresh: file.last_refresh ?? null,
      queriedAt,
    };
  }

  try {
    const res = await apiCall<CodexUsagePayload>({
      authIndex,
      method: "GET",
      url: CODEX_USAGE_URL,
      header: {
        ...CODEX_REQUEST_HEADERS,
        "Chatgpt-Account-Id": accountId,
      },
    });
    const body = res.body ?? (res.bodyText ? (JSON.parse(res.bodyText) as CodexUsagePayload) : null);
    if (!body || typeof body !== "object") {
      return {
        name: file.name,
        email: file.email ?? email ?? null,
        planType: (body ? planTypeFromPayload(body) : null) ?? planType,
        status: "error",
        error: "empty usage response",
        windows: [],
        fiveHourWindow: null,
        weeklyWindow: null,
        codeReviewFiveHourWindow: null,
        codeReviewWeeklyWindow: null,
        lastRefresh: file.last_refresh ?? null,
        queriedAt,
      };
    }
    const windows = parseUsagePayload(body);
    const fiveHourWindow = windows.find((w) => w.id === "five-hour") ?? null;
    const weeklyWindow = windows.find((w) => w.id === "weekly") ?? null;
    const codeReviewFiveHourWindow = windows.find((w) => w.id === "code-review-five-hour") ?? null;
    const codeReviewWeeklyWindow = windows.find((w) => w.id === "code-review-weekly") ?? null;
    return {
      name: file.name,
      email: file.email ?? email ?? null,
      planType: planTypeFromPayload(body) ?? planType,
      status: "success",
      windows,
      fiveHourWindow,
      weeklyWindow,
      codeReviewFiveHourWindow,
      codeReviewWeeklyWindow,
      lastRefresh: file.last_refresh ?? null,
      queriedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: file.name,
      email: file.email ?? email ?? null,
      planType,
      status: "error",
      error: message,
      windows: [],
      fiveHourWindow: null,
      weeklyWindow: null,
      codeReviewFiveHourWindow: null,
      codeReviewWeeklyWindow: null,
      lastRefresh: file.last_refresh ?? null,
      queriedAt,
    };
  }
}

const BATCH_SIZE = 5;

export async function fetchAllCodexQuotas(): Promise<CodexQuotaResponse> {
  const queriedAt = new Date().toISOString();
  try {
    const files = await getAuthFiles();
    const codexFiles = getCodexAccounts(files);
    if (codexFiles.length === 0) {
      return { accounts: [], totalAccounts: 0, queriedAt };
    }
    const results: CodexAccountQuota[] = [];
    for (let i = 0; i < codexFiles.length; i += BATCH_SIZE) {
      const batch = codexFiles.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((f) => fetchQuotaForAccount(f)));
      for (const s of settled) {
        if (s.status === "fulfilled") results.push(s.value);
        else
          results.push({
            name: "unknown",
            email: null,
            planType: null,
            status: "error",
            error: s.reason?.message ?? String(s.reason),
            windows: [],
            fiveHourWindow: null,
            weeklyWindow: null,
            codeReviewFiveHourWindow: null,
            codeReviewWeeklyWindow: null,
            lastRefresh: null,
            queriedAt,
          });
      }
    }
    return { accounts: results, totalAccounts: results.length, queriedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      accounts: [],
      totalAccounts: 0,
      queriedAt,
      error: message,
    };
  }
}
