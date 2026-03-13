import cron from "node-cron";
import { refreshAllAccounts } from "@/lib/codex-refresh";

export function startScheduler(): void {
  const enabled = process.env.CRON_ENABLED?.toLowerCase() === "true";
  if (!enabled) {
    console.log("[CRON] Cron disabled (CRON_ENABLED is not true)");
    return;
  }
  const schedule = process.env.CRON_SCHEDULE ?? "0 0 * * *";
  if (!cron.validate(schedule)) {
    console.error("[CRON] Invalid CRON_SCHEDULE:", schedule);
    return;
  }
  cron.schedule(schedule, async () => {
    console.log(`[CRON] 开始执行定时刷新: ${new Date().toISOString()}`);
    try {
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
  });
  console.log(`[CRON] 已注册定时任务: ${schedule}`);
}
