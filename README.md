# CPA Codex Monitor

基于 [CLIProxyAPI](https://help.router-for.me/) 管理 API 的 Codex 账号额度监控站。展示 CPA 上已登录的 Codex 账号列表、5 小时/周限额、重置时间，并支持按配置时间自动刷新各账号（触发 5h 计费窗口或仅查用量）。

## 功能

- **额度看板**：展示所有 Codex 账号的 5h/周限额、剩余百分比、重置倒计时与具体时间
- **服务端缓存**：按间隔轮询 CPA 查询额度，前端直接读缓存，打开即渲染
- **定时刷新**（可选）：在指定时刻对每个账号执行刷新（quota-check 或 chat-completion 模式）

## 环境要求

- Node.js 18+
- 已运行并开启远程管理的 CLIProxyAPI（CPA）服务

## 配置

复制 `.env.example` 为 `.env.local`，按需修改：

| 变量 | 必填 | 说明 |
|------|------|------|
| `CPA_BASE_URL` | 是 | CPA 服务地址，如 `http://localhost:8317` |
| `CPA_MANAGEMENT_KEY` | 是 | CPA 管理密钥 |
| `QUOTA_CHECK_INTERVAL` | 否 | 额度轮询间隔（秒），默认 300 |
| `CRON_ENABLED` | 否 | 是否启用定时刷新，`true` 时生效 |
| `CRON_TIMEZONE` | 否 | 时区，默认 `Asia/Shanghai` |
| `CRON_TIMES` | 否 | 每日执行时刻，如 `06:00,11:00` |
| `REFRESH_MODE` | 否 | `quota-check` 或 `chat-completion` |
| `PORT` | 否 | 本服务端口，默认 3000 |

## 部署

### 开发

```bash
npm install
npm run dev
```

此模式下**不会**执行定时任务与额度轮询，额度接口会实时请求 CPA。

### 生产（推荐）

定时任务与额度轮询仅在自定义入口 `server.ts` 下运行：

```bash
npm install
npm run build
npm run start
```

- 使用 `tsx server.ts` 启动，会先启动额度轮询（`QUOTA_CHECK_INTERVAL`），再启动 CRON（若 `CRON_ENABLED=true`），最后启动 Next 应用
- 如需仅跑 Next 不跑定时/轮询，可用：`npm run start:no-cron`（即 `next start`）

## 技术栈

- Next.js 14、React 18、TypeScript
- Radix UI Themes
- 额度与刷新逻辑见 `src/lib/`，定时逻辑见 `src/cron/scheduler.ts`

## License

MIT
