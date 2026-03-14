import { refreshAllAccounts } from "@/lib/codex-refresh";

const CHECK_INTERVAL_MS = 30 * 1000;
const WORLD_TIME_API = "https://worldtimeapi.org/api/timezone";

function normalizeTime(value: string): string | null {
  const trimmed = value.trim().replace(/\s/g, "");
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseCronTimes(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return ["06:00", "11:00"];

  return envValue
    .split(/[,\s，]+/)
    .map((value) => normalizeTime(value))
    .filter((value): value is string => value !== null);
}

async function getCurrentTimeInZone(
  timezone: string
): Promise<{ hour: number; minute: number; key: string; source: string }> {
  const url = `${WORLD_TIME_API}/${encodeURIComponent(timezone)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { datetime?: string };
    const datetime = data.datetime;
    if (!datetime) throw new Error("No datetime");

    const match = datetime.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );
    if (!match) throw new Error("Invalid datetime format");

    const [, year, month, day, hour, minute] = match;
    return {
      hour: Number.parseInt(hour, 10),
      minute: Number.parseInt(minute, 10),
      key: `${year}-${month}-${day} ${hour}:${minute}`,
      source: "WorldTimeAPI",
    };
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "00";
    const day = parts.find((part) => part.type === "day")?.value ?? "00";
    const hour = Number.parseInt(
      parts.find((part) => part.type === "hour")?.value ?? "0",
      10
    );
    const minute = Number.parseInt(
      parts.find((part) => part.type === "minute")?.value ?? "0",
      10
    );

    return {
      hour,
      minute,
      key: `${year}-${month}-${day} ${String(hour).padStart(2, "0")}:${String(
        minute
      ).padStart(2, "0")}`,
      source: "Intl",
    };
  }
}

function timeMatches(hour: number, minute: number, times: string[]): boolean {
  const current = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;
  return times.includes(current);
}

export function startScheduler(): void {
  const enabled = process.env.CRON_ENABLED?.toLowerCase() === "true";
  if (!enabled) {
    console.log("[CRON] 定时刷新已关闭 (CRON_ENABLED 未设为 true)");
    return;
  }

  const timezone = process.env.CRON_TIMEZONE?.trim() || "Asia/Shanghai";
  const times = parseCronTimes(process.env.CRON_TIMES);
  if (times.length === 0) {
    console.error("[CRON] CRON_TIMES 解析后为空，请检查配置");
    return;
  }

  let lastRunKey: string | null = null;
  const timesLabel = `[${times.join(", ")}]`;

  const tick = async () => {
    try {
      const { hour, minute, key, source } = await getCurrentTimeInZone(timezone);
      const current = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;

      if (!timeMatches(hour, minute, times)) return;
      if (lastRunKey === key) return;

      lastRunKey = key;
      console.log(
        `[CRON] 命中计划时刻，开始刷新任务用量计费时间窗口 time=${key} timezone=${timezone} source=${source}`
      );

      const results = await refreshAllAccounts({
        trigger: `cron:${timezone}:${key}`,
      });
      const successCount = results.filter((result) => result.success).length;

      console.log(
        `[CRON] 本次执行完成 time=${key} current=${current} success=${successCount}/${results.length}`
      );
    } catch (err) {
      console.error("[CRON] tick 异常:", err);
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);

  console.log(
    `[CRON] 已启动 timezone=${timezone} times=${timesLabel} interval=${CHECK_INTERVAL_MS / 1000}s`
  );
}
