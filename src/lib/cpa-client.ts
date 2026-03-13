import type {
  AuthFileItem,
  AuthFilesResponse,
  CodexAuthFileContent,
  ApiCallRequest,
  ApiCallResponse,
} from "./types";

const REQUEST_TIMEOUT_MS = 30000;

function getBaseUrl(): string {
  const url = process.env.CPA_BASE_URL?.trim();
  if (!url) throw new Error("CPA_BASE_URL is not set");
  return url.replace(/\/+$/, "");
}

function getManagementKey(): string {
  const key = process.env.CPA_MANAGEMENT_KEY?.trim();
  if (!key) throw new Error("CPA_MANAGEMENT_KEY is not set");
  return key;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function getAuthFiles(): Promise<AuthFileItem[]> {
  const base = getBaseUrl();
  const key = getManagementKey();
  const url = `${base}/v0/management/auth-files`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      message = json.error ?? json.message ?? text;
    } catch {
      // use raw text
    }
    if (res.status === 401) throw new Error(`Management key invalid: ${message}`);
    if (res.status === 403) throw new Error(`Remote management disabled: ${message}`);
    if (res.status === 503) throw new Error(`Core auth manager unavailable: ${message}`);
    throw new Error(`CPA auth-files failed (${res.status}): ${message}`);
  }

  const data = (await res.json()) as AuthFilesResponse;
  return data.files ?? [];
}

export async function downloadAuthFile(name: string): Promise<CodexAuthFileContent> {
  const base = getBaseUrl();
  const key = getManagementKey();
  const url = `${base}/v0/management/auth-files/download?name=${encodeURIComponent(name)}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download auth file failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as CodexAuthFileContent;
  return json;
}

export async function apiCall<T = unknown>(request: ApiCallRequest): Promise<ApiCallResponse<T>> {
  const base = getBaseUrl();
  const key = getManagementKey();
  const url = `${base}/v0/management/api-call`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const raw = await res.json();
  const statusCode = raw.status_code ?? raw.statusCode ?? res.status;
  const header = raw.header ?? raw.headers ?? {};
  let body: unknown = raw.body;
  const bodyText = typeof raw.body === "string" ? raw.body : JSON.stringify(raw.body ?? {});

  if (typeof body === "string" && body.trim()) {
    try {
      body = JSON.parse(body) as T;
    } catch {
      body = raw.body;
    }
  }

  if (!res.ok) {
    let message = bodyText;
    if (body && typeof body === "object" && "error" in body) {
      const err = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message;
      if (err) message = String(err);
    }
    throw new Error(`api-call failed (${statusCode}): ${message}`);
  }

  return {
    statusCode,
    header,
    body: body as T,
    bodyText,
  };
}
