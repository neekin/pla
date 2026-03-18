# GigPayday Platform

企业级多租户 SaaS 平台底座，对标 ABP.Net Zero 核心能力，基于 **NestJS 11 + React 19 + Ant Design 6** 构建。

[![CI Quality Gates](https://github.com/your-org/gigpayday_remake/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/gigpayday_remake/actions/workflows/ci.yml)

---

## 功能概览

| 模块 | 能力 |
|------|------|
| **身份安全** | JWT 登录、RBAC（角色+权限）、账号锁定、密码策略、首次登录改密 |
| **多租户** | Header / Domain / Subdomain 解析、租户生命周期管理 |
| **设置系统** | Host / Tenant / User 三层继承，`user > tenant > host > default` |
| **订阅计费** | Edition 版本管理、试用期、配额执行（拒绝/降级）、超限审计 |
| **任务中心** | 持久化队列、自动重试（failed → retrying → done/failed）、死信、手动重试 |
| **审计合规** | HTTP 请求审计、实体字段级变更 diff |
| **可观测性** | Prometheus 指标 (`/system/metrics`)、requestId 链路追踪、结构化 JSON 日志 |
| **插件机制** | 内置 + 外部插件加载，事件驱动钩子 |
| **通知推送** | SSE 实时通知流 |
| **数据库工程化** | SQL 迁移体系（up/down）、回滚演练 gate、数据修复脚本、发布前自动校验 |
| **流程编排** | 统一事件总线、工作流模板（重试/补偿）、运行轨迹查询 |
| **权限进阶** | RBAC + ABAC 策略入口（租户范围、字段脱敏策略） |

---

## 快速开始

### 前置要求

- **Node.js** ≥ 22
- **pnpm** ≥ 10
- **PostgreSQL** 14+

### 安装

```bash
pnpm install
```

### 开发模式

```bash
# 启动后端（NestJS，端口 3000，PostgreSQL 模式）
pnpm --filter server run start:dev

# 启动前端（Vite，端口 5173）
pnpm --filter client run dev
```

> 开发模式下后端会自动反向代理前端请求，访问 `http://localhost:3000` 即可。

### 生产构建

```bash
pnpm --filter server run build   # dist/
pnpm --filter client run build   # client/dist/
```

### 生产启动

```bash
# 设置环境变量后启动
NODE_ENV=production \
  DB_HOST=localhost DB_PORT=5432 \
  DB_USERNAME=postgres DB_PASSWORD=secret DB_NAME=gigpayday \
  JWT_SECRET=your-secret \
  node server/dist/main
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | `production` 时启用 JSON 日志 |
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_TYPE` | `postgres` | 固定为 `postgres` |
| `DB_HOST` | `127.0.0.1` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `DB_USERNAME` | `postgres` | 数据库用户名 |
| `DB_PASSWORD` | `postgres` | 数据库密码 |
| `DB_NAME` | `gigpayday` | 数据库名 |
| `DB_SYNCHRONIZE` | `true` | TypeORM auto-sync（生产建议关闭，使用迁移） |
| `JWT_SECRET` | `dev-secret-change-me` | **生产必须修改** |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS 允许来源 |
| `OTEL_ENABLED` | `false` | 是否启用 OpenTelemetry 追踪 |
| `OTEL_SERVICE_NAME` | `gigpayday-server` | OTEL 服务名 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP traces 上报地址 |
| `OTEL_EXPORTER_OTLP_HEADERS` | - | OTLP 请求头（`k=v,k2=v2`） |

---

## API 一览

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/login` | 登录，返回 JWT |
| `GET` | `/auth/profile` | 当前用户信息 |
| `GET` | `/auth/security-policy` | 读取安全策略 |
| `PATCH` | `/auth/security-policy` | 更新安全策略 |

### 任务中心

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/tasks` | 任务列表 |
| `POST` | `/tasks/dispatch` | 派发任务（受配额控制） |
| `GET` | `/tasks/stats` | 各状态计数 |
| `GET` | `/tasks/failed` | 失败任务列表 |
| `POST` | `/tasks/:id/retry` | 手动重试失败任务 |

### 系统

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/system/health` | 公开 | 健康检查 |
| `GET` | `/system/metrics` | `system:read` | Prometheus 指标 |
| `GET` | `/system/audits` | `audit:read` | HTTP 请求审计日志 |
| `GET` | `/system/entity-audits` | `audit:read` | 实体变更审计 |
| `GET` | `/system/workflows/templates` | `system:read` | 工作流模板列表 |
| `GET` | `/system/workflows/runs` | `system:read` | 工作流执行记录 |
| `GET` | `/system/workflows/events` | `system:read` | 事件总线近期事件 |
| `POST` | `/system/workflows/run` | `task:dispatch` | 触发工作流执行 |

### 计费

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/billing/editions` | 版本列表 |
| `POST` | `/billing/subscriptions/assign` | 分配订阅 |
| `POST` | `/billing/subscriptions/renew` | 续费 |
| `GET` | `/billing/subscriptions/:tenantId` | 查询租户订阅 |

---

## 可观测性

### Prometheus 接入

`GET /system/metrics` 返回标准 Prometheus 文本格式，需要 `system:read` 权限。

**内置指标：**

| 指标 | 类型 | 说明 |
|------|------|------|
| `http_requests_total` | Counter | HTTP 请求总数（method / path / status 标签） |
| `http_request_duration_ms` | Histogram | 请求耗时分布（ms） |
| `task_queue_length` | Gauge | 各状态任务数量 |
| `task_failures_total` | Counter | 任务失败总数 |
| `process_*`, `nodejs_*` | - | Node.js 默认运行时指标 |

**Prometheus 配置示例：**

```yaml
scrape_configs:
  - job_name: gigpayday
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /system/metrics
    bearer_token: <your-jwt-token>
```

  仓库已提供开箱即用的监控模板：

  - `ops/monitoring/prometheus.yml`
  - `ops/monitoring/alerts.yml`
  - `ops/monitoring/grafana-dashboard.json`

  可直接用于：

  - Prometheus 抓取与规则加载
  - 5xx、慢请求、失败任务增长告警
  - Grafana 面板导入（服务概览）

### 结构化日志

生产环境（`NODE_ENV=production`）输出 JSON 格式日志：

```json
{"timestamp":"2026-03-18T10:00:00.000Z","level":"log","context":"HttpRequest","message":"{\"requestId\":\"...\",\"method\":\"POST\",\"path\":\"/tasks/dispatch\",\"status\":201,\"durationMs\":12,\"tenantId\":\"tenant-1\",\"userId\":\"user-1\"}"}
```

每条 HTTP 请求都携带 `requestId`（优先使用客户端传入的 `X-Request-Id` 头，否则自动生成 UUID），同时通过 `X-Request-Id` 响应头返回给客户端，便于全链路追踪。

---

## 运行测试

```bash
# E2E 测试（需要 PostgreSQL）
pnpm --filter server run test:e2e

# 单元测试
pnpm --filter server test
```

---

## 项目结构

```
gigpayday_remake/
├── client/               # React 19 + Vite + Ant Design 前端
│   └── src/
│       ├── pages/        # 各管理页面
│       ├── components/   # 公共组件（ConsoleLayout、CRUD 表格等）
│       ├── router/       # 路由 + 认证守卫
│       └── lib/api.ts    # 统一 API 客户端
├── server/               # NestJS 11 后端
│   └── src/
│       ├── auth/         # JWT 登录、安全策略、锁定
│       ├── billing/      # Edition / 订阅 / 配额中间件
│       ├── database/     # TypeORM 实体 + 数据库模块
│       ├── iam/          # 用户访问管理
│       ├── notifications/# SSE 推送
│       ├── platform-config/ # 配置中心 + 三层设置
│       ├── plugins/      # 插件加载机制
│       ├── system/       # 审计 + 指标 + 健康检查
│       ├── tasks/        # 任务队列
│       ├── tenant/       # 多租户解析
│       └── trpc/         # tRPC 适配（可选）
├── docs/
│   └── abp-zero-gap-roadmap.md  # 4 周里程碑路线图
└── .github/workflows/ci.yml     # CI 质量门禁
```

---

## CI/CD

`.github/workflows/ci.yml` 在每次 push/PR 时自动执行：

0. **DB Gate** — 生产模式下禁止 `DB_SYNCHRONIZE=true`
1. **API Contract Gate** — 导出完整 OpenAPI，并仅在 breaking changes 时阻断
1. **Server Build** — `nest build`
2. **Client Build** — `tsc -b && vite build`
3. **E2E Tests** — PostgreSQL 模式

完整生产部署和故障排查参考 [docs/operations-manual.md](docs/operations-manual.md)。

本地可手动执行：

- `pnpm --filter server run gate:db`
- `pnpm --filter server run gate:openapi`
- `pnpm --filter server run gate:migrations`
- `pnpm --filter server run gate:contracts`
- `pnpm --filter server run gate:perf`
- `pnpm --filter server run gate:ops`
- `pnpm --filter server run gen:module -- <module-name> [--crud]`

数据库迁移与数据修复命令：

- `pnpm --filter server run migrate:status`
- `pnpm --filter server run migrate:up`
- `pnpm --filter server run migrate:down`
- `pnpm --filter server run datafix:tasks -- --apply`

`gen:module` 现支持全链路 CRUD 脚手架（后端 + 前端）：

- 仅后端模块：`pnpm --filter server run gen:module -- orders --crud`
- 全链路 CRUD：`pnpm --filter server run gen:module -- orders --fullstack`
- 自定义权限与路由：`pnpm --filter server run gen:module -- orders --fullstack --permission=order:manage --api-path=orders --route=/admin/orders --page-title=订单管理 --menu-label=订单管理`

全链路模式会自动完成：

- 生成 Nest 模块（controller/service/dto）并注入 `AppModule`
- 更新 `ServeStatic` 排除路径与开发代理后端前缀
- 生成前端管理页（基于 `CrudPage`）
- 注入路由、控制台菜单和 `client/src/lib/api.ts` 请求函数

插件生态增强：

- SDK 入口：`server/src/plugins/sdk/plugin-sdk.ts`
- 兼容矩阵：`server/src/plugins/compatibility-matrix.ts`
- 插件兼容性 API：`GET /system/plugins/compatibility`
- 插件市场目录 API：`GET /system/plugins/marketplace`
- 外部插件支持签名校验（配置 `PLATFORM_PLUGIN_PUBLIC_KEY`）

`gate:openapi` 使用：
- 基线文件：`server/openapi/openapi.baseline.json`
- 当前产物：`server/openapi/openapi.generated.json`
- 仅当检测到破坏性变更（如删除路径/方法、增加必填参数、移除响应码）才失败。
- 报告文件：`server/openapi/openapi.breaking-report.json`、`server/openapi/openapi.breaking-report.md`
- 在 `pull_request` 场景下，CI 会自动把 breaking 报告回帖到 PR（自动更新同一条评论）。

---

## 默认管理账号

种子数据在首次启动时自动创建：

| 用户名 | 密码 | 角色 | 租户 |
|--------|------|------|------|
| `admin` | `admin123` | `super-admin` | host |
| `tenant1-admin` | `admin123` | `admin` | tenant-1 |

> **生产环境请第一时间修改默认密码！**

---

## 许可证

UNLICENSED — 企业内部使用
