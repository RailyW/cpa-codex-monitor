# CPA Codex Monitor

基于 [CLIProxyAPI](https://help.router-for.me/) 管理 API 的 Codex 账号额度监控站。项目现在聚焦两件事：

1. 自动查询并展示 Codex 账号额度。
2. 在 `CRON_TIMES` 指定时刻，对每个 Codex 账号发起一次极简请求，用于刷新任务用量计费时间窗口。

## 功能

- 额度看板：展示各账号的 5 小时 / 周限额、剩余比例、重置时间和倒计时。
- 服务端缓存：后台按间隔轮询 CPA 获取额度，前端直接读取缓存。
- 定时刷新：`CRON_ENABLED=true` 时，按 `CRON_TIMES` 触发刷新任务用量计费时间窗口。
- PM2 可观测日志：定时触发、单账号执行成功/失败、整批汇总都会输出到 `console.log`。

## 环境要求

- Node.js 18+
- 已运行并开启远程管理的 CLIProxyAPI（CPA）服务

## 配置

复制 `.env.example` 为 `.env.local`，然后按需修改：

| 变量 | 必填 | 说明 |
|------|------|------|
| `CPA_BASE_URL` | 是 | CPA 服务地址，例如 `http://localhost:8317` |
| `CPA_MANAGEMENT_KEY` | 是 | CPA 管理密钥 |
| `QUOTA_CHECK_INTERVAL` | 否 | 额度轮询间隔，单位秒，默认 `300` |
| `CRON_ENABLED` | 否 | 是否启用定时刷新，`true` 时生效 |
| `CRON_TIMEZONE` | 否 | IANA 时区名称，默认 `Asia/Shanghai` |
| `CRON_TIMES` | 否 | 每日执行时刻，例如 `06:00,11:00` |
| `PORT` | 否 | 服务端口，默认 `3000` |

说明：

- `CRON_TIMES` 对应的任务只有一种语义：刷新任务用量计费时间窗口。
- 项目不再支持 `REFRESH_MODE` 配置。

## 启动

### 开发模式

```bash
npm install
npm run dev
```

开发模式下不会启动额度轮询和定时刷新，请求额度接口时会实时访问 CPA。

### 生产模式

```bash
npm install
npm run build
npm run start
```

`npm run start` 实际运行的是 `tsx server.ts`，启动顺序如下：

1. 启动额度轮询。
2. 启动定时刷新调度器。
3. 启动 Next.js 服务。

如果只想启动 Next.js，而不运行轮询和 CRON，可使用：

```bash
npm run start:no-cron
```

## 代码结构

- `server.ts`：生产入口，负责同时启动 Next、额度轮询和定时任务。
- `src/lib/codex-quota.ts`：额度查询与解析逻辑。
- `src/lib/quota-cache.ts`：额度缓存与后台轮询。
- `src/lib/codex-refresh.ts`：定时刷新任务用量计费时间窗口的执行逻辑。
- `src/cron/scheduler.ts`：`CRON_TIMES` 调度与日志输出。

## License

MIT
