import { refreshAllAccounts } from "@/lib/codex-refresh";

const CHECK_INTERVAL_MS = 60 * 1000;
const WORLD_TIME_API = "https://worldtimeapi.org/api/timezone";

/** 将 "6:00" / "06:00" 规范为 "HH:mm" */
function normalizeTime(s: string): string | null {
  const t = s.trim().replace(/\s/g, "");
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = m[1].padStart(2, "0");
  const min = m[2];
  return `${h}:${min}`;
}

/** 解析 CRON_TIMES 环境变量："06:00, 11:00" => ["06:00", "11:00"] */
function parseCronTimes(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return ["06:00", "11:00"];
  return envValue
    .split(/[,，\s]+/)
    .map((s) => normalizeTime(s))
    .filter((s): s is string => s !== null);
}

/** 通过 WorldTimeAPI 获取指定时区当前时间（联网授时），失败时回退到本机时间 */
async function getCurrentTimeInZone(timezone: string): Promise<{ hour: number; minute: number; key: string }> {
  const url = `${WORLD_TIME_API}/${encodeURIComponent(timezone)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { datetime?: string };
    const dt = data?.datetime;
    if (!dt) throw new Error("No datetime");
    const match = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) throw new Error("Invalid datetime format");
    const [, y, mo, d, h, min] = match;
    const hour = parseInt(h, 10);
    const minute = parseInt(min, 10);
    const key = `${y}-${mo}-${d} ${h}:${min}`;
    return { hour, minute, key };
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const date = new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { hour, minute, key };
  }
}

/** 判断当前时刻是否匹配时间列表中的某一项（只精确到分钟） */
function timeMatches(hour: number, minute: number, times: string[]): boolean {
  const now = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return times.includes(now);
}

export function startScheduler(): void {
  const enabled = process.env.CRON_ENABLED?.toLowerCase() === "true";
  if (!enabled) {
    console.log("[CRON] 定时任务已关闭 (CRON_ENABLED 未设为 true)");
    return;
  }

  const timezone = process.env.CRON_TIMEZONE?.trim() || "Asia/Shanghai";
  const times = parseCronTimes(process.env.CRON_TIMES);
  if (times.length === 0) {
    console.error("[CRON] CRON_TIMES 解析后为空，请检查配置");
    return;
  }

  let lastRunKey: string | null = null;

  const tick = async () => {
    try {
      const { hour, minute, key } = await getCurrentTimeInZone(timezone);
      if (!timeMatches(hour, minute, times)) return;
      if (lastRunKey === key) return;
      lastRunKey = key;

      console.log(`[CRON] 开始执行定时刷新 (${timezone} ${key}): ${new Date().toISOString()}`);
      const results = await refreshAllAccounts();
      const success = results.filter((r) => r.success).length;
      const total = results.length;
      results.forEach((r) => {
        if (r.success) console.log(`[CRON] 刷新账号 ${r.name} → 成功`);
        else console.log(`[CRON] 刷新账号 ${r.name} → 失败: ${r.error}`);
      });
      console.log(`[CRON] 完成: 成功 ${success}/${total}`);
    } catch (err) {
      console.error("[CRON] 刷新失败:", err);
    }
  };

  tick();
  const intervalId = setInterval(tick, CHECK_INTERVAL_MS);
  const log = `时区=${timezone}, 时间=[${times.join(", ")}], 使用网络授时(WorldTimeAPI)，失败时回退本机时间`;
  console.log("[CRON] 已启动定时任务:", log);
}
