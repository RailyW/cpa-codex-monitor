/** CPA auth-files list response. */
export interface AuthFilesResponse {
  files: AuthFileItem[];
}

export interface CodexIdTokenInfo {
  chatgpt_account_id?: string;
  chatgptAccountId?: string;
  plan_type?: string;
  planType?: string;
  chatgpt_subscription_active_start?: string | number | null;
  chatgptSubscriptionActiveStart?: string | number | null;
  chatgpt_subscription_active_until?: string | number | null;
  chatgptSubscriptionActiveUntil?: string | number | null;
}

export interface AuthFileItem {
  id: string;
  name: string;
  provider: string;
  label?: string;
  status: string;
  status_message: string;
  disabled: boolean;
  unavailable: boolean;
  runtime_only: boolean;
  source: string;
  path?: string;
  size?: number;
  modtime?: string;
  email?: string;
  account_type?: string;
  account?: string;
  created_at?: string;
  updated_at?: string;
  last_refresh?: string;
  auth_index?: string;
  authIndex?: string;
  plan_type?: string;
  planType?: string;
  account_id?: string;
  accountId?: string;
  chatgpt_account_id?: string;
  chatgptAccountId?: string;
  id_token?: CodexIdTokenInfo;
  idToken?: CodexIdTokenInfo;
}

export interface CodexAuthFileContent {
  type?: string;
  email?: string;
  access_token?: string;
  refresh_token?: string;
  chatgpt_account_id?: string;
  chatgptAccountId?: string;
  account_id?: string;
  accountId?: string;
  plan_type?: string;
  planType?: string;
  last_refresh?: string;
  lastRefreshedAt?: string;
}

export interface ApiCallRequest {
  authIndex: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
}

export interface ApiCallResponse<T = unknown> {
  status_code?: number;
  statusCode?: number;
  header?: Record<string, string[] | string>;
  headers?: Record<string, string[] | string>;
  body?: T;
  bodyText?: string;
}

export interface CodexUsageWindow {
  limit_window_seconds?: number;
  limitWindowSeconds?: number;
  used_percent?: number;
  usedPercent?: number;
  /** ISO 8601 string or Unix timestamp in seconds. */
  reset_at?: string | number;
  resetAt?: string | number;
  resets_at?: string | number;
  resetsAt?: string | number;
  reset_after_seconds?: number;
  resetAfterSeconds?: number;
}

export interface CodexRateLimitInfo {
  limit_reached?: boolean;
  limitReached?: boolean;
  allowed?: boolean;
  primary_window?: CodexUsageWindow;
  primaryWindow?: CodexUsageWindow;
  secondary_window?: CodexUsageWindow;
  secondaryWindow?: CodexUsageWindow;
}

export interface CodexAdditionalRateLimit {
  limit_name?: string;
  limitName?: string;
  metered_feature?: string;
  meteredFeature?: string;
  rate_limit?: CodexRateLimitInfo;
  rateLimit?: CodexRateLimitInfo;
}

export interface CodexUsagePayload {
  plan_type?: string;
  planType?: string;
  rate_limit?: CodexRateLimitInfo;
  rateLimit?: CodexRateLimitInfo;
  code_review_rate_limit?: CodexRateLimitInfo;
  codeReviewRateLimit?: CodexRateLimitInfo;
  additional_rate_limits?: CodexAdditionalRateLimit[];
  additionalRateLimits?: CodexAdditionalRateLimit[];
}

/** A parsed quota window. */
export interface QuotaWindow {
  id: string;
  label: string;
  usedPercent: number | null;
  remainingPercent: number | null;
  resetAt: string | null;
  resetLabel: string;
}

export interface CodexAccountQuota {
  name: string;
  email: string | null;
  planType: string | null;
  status: "success" | "loading" | "error";
  error?: string;
  windows: QuotaWindow[];
  fiveHourWindow: QuotaWindow | null;
  weeklyWindow: QuotaWindow | null;
  codeReviewFiveHourWindow: QuotaWindow | null;
  codeReviewWeeklyWindow: QuotaWindow | null;
  lastRefresh: string | null;
  queriedAt: string;
}

export interface CodexQuotaResponse {
  accounts: CodexAccountQuota[];
  totalAccounts: number;
  queriedAt: string;
  error?: string;
}

export interface CodexRefreshResponse {
  results: { name: string; success: boolean; error?: string }[];
  triggeredAt: string;
}

export const FIVE_HOUR_SECONDS = 18000;
export const WEEK_SECONDS = 604800;

export const WINDOW_LABELS: Record<string, string> = {
  "five-hour": "5小时限额",
  weekly: "周限额",
  "code-review-five-hour": "代码审查 5小时限额",
  "code-review-weekly": "代码审查 周限额",
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  plus: "Plus",
  team: "Team",
  free: "Free",
};
