# GigPayday 运维手册

本文档用于生产环境部署、监控接入、故障排查与发布门禁执行。

## 1. 部署基线

## 1.1 运行要求

- Node.js 22+
- PostgreSQL 14+
- 反向代理（Nginx/Ingress）
- 可选：OpenTelemetry Collector、Prometheus、Grafana

## 1.2 必需环境变量

- `NODE_ENV=production`
- `PORT=3000`
- `DB_TYPE=postgres`
- `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME`
- `JWT_SECRET`（必须替换默认值）
- `FRONTEND_ORIGIN`（管理台域名）

## 1.3 可观测性变量（可选）

- `OTEL_ENABLED=true`
- `OTEL_SERVICE_NAME=gigpayday-server`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces`
- `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>`

## 1.4 启动命令

```bash
pnpm install --frozen-lockfile
pnpm --filter server run build
pnpm --filter client run build

NODE_ENV=production \
DB_TYPE=postgres \
DB_HOST=127.0.0.1 DB_PORT=5432 \
DB_USERNAME=postgres DB_PASSWORD=secret DB_NAME=gigpayday \
JWT_SECRET=change-me \
node server/dist/main
```

---

## 2. 监控与追踪

## 2.1 健康检查

- `GET /system/health`（公开）
- 预期：`{"status":"ok", ...}`

## 2.2 Prometheus 指标

- `GET /system/metrics`（需要 `system:read` 权限）
- 核心指标：
  - `http_requests_total`
  - `http_request_duration_ms`
  - `task_queue_length`
  - `task_failures_total`

建议告警：
- 5 分钟内 `5xx` 比例 > 2%
- `p95` 响应时间 > 1000ms
- `task_queue_length{status="failed"}` 持续上升

仓库监控资产位置：
- `ops/monitoring/prometheus.yml`
- `ops/monitoring/alerts.yml`
- `ops/monitoring/grafana-dashboard.json`

接入步骤（建议）：
1. 复制 `ops/monitoring/prometheus.yml` 到 Prometheus 配置目录并按环境修改 target/token。
2. 确认 `alerts.yml` 已被 `rule_files` 引入并通过 `promtool check rules` 校验。
3. 在 Grafana 执行 `Dashboards -> Import`，导入 `grafana-dashboard.json`。
4. 将告警路由到 Alertmanager 并验证 5xx 与慢请求测试告警。

## 2.3 链路追踪（OpenTelemetry）

启用后会自动采集 HTTP + 数据库（TypeORM）调用链路并上报到 OTLP 端点。

排查建议：
1. 在入口请求中记录/传递 `X-Request-Id`
2. 在追踪平台按 URL + 时间窗口筛选
3. 观察 DB span 的耗时和 error 标签

## 2.4 结构化日志

生产环境输出 JSON 日志，包含：
- `requestId`
- `tenantId`
- `userId`
- `method/path/status/durationMs`

日志平台中建议按 `requestId` 建索引。

---

## 3. 发布门禁（必须通过）

本项目 CI 工作流：`.github/workflows/ci.yml`

门禁步骤：
0. `pnpm --filter server run gate:db`
1. `pnpm --filter server run gate:migrations`
2. `pnpm --filter server run gate:openapi`
3. `pnpm --filter server run gate:contracts`
4. `pnpm --filter server run gate:perf`
5. `pnpm --filter server run gate:ops`
6. `pnpm --filter server run build`
7. `pnpm --filter client run build`
8. `pnpm --filter server run test:e2e`

本地发布前同样执行以上步骤。

说明：
- `gate:db` 会在生产模式阻止 `DB_SYNCHRONIZE=true`。
- `gate:migrations` 会在 PostgreSQL 上执行完整 up/down 回滚演练。
- `gate:openapi` 会导出完整 OpenAPI，并仅在 breaking changes 时失败。
- `gate:contracts` 会校验消费者契约路径不缺失。
- `gate:perf` 会校验性能基线与回归数据集存在且格式正确。
- `gate:ops` 会校验 SLO / 值班 / 自动化处置文件齐备。
- `gate:openapi` 会生成报告：
  - `server/openapi/openapi.breaking-report.json`
  - `server/openapi/openapi.breaking-report.md`
- `pull_request` 流程会将该报告自动回帖到 PR（同一条 bot 评论会被更新）。
- 当接口变更为预期行为时，请更新 baseline：
  `cp server/openapi/openapi.generated.json server/openapi/openapi.baseline.json`

---

## 4. 故障处理 Runbook

## 4.0 编排与事件排查

流程编排与事件总线排查入口：

- `GET /system/workflows/templates`
- `GET /system/workflows/runs`
- `GET /system/workflows/events`
- `POST /system/workflows/run`

建议排查路径：
1. 查看 `runs` 中失败步骤与重试次数。
2. 对照 `events` 中补偿事件是否触发。
3. 用相同 payload 进行一次手动重放验证。

## 4.1 登录失败率突增

检查项：
- 是否触发安全策略（锁定阈值过低）
- `/system/audits` 中 `statusCode=401/403` 明细
- 是否有租户切换 header 配置异常

处理：
- 审核并临时放宽 `maxFailedAttempts` / `lockoutMinutes`
- 检查网关是否错误剥离认证头

## 4.2 任务大量失败

检查项：
- `/tasks/failed` 的 `lastError` 聚类
- `task_failures_total` 是否持续上升
- 插件目录是否有异常脚本更新

处理：
- 使用 `POST /tasks/:id/retry` 小批量回放
- 若为外部依赖故障，先关闭任务入口或改为降级策略

## 4.3 指标拉取失败

检查项：
- 调用账号是否有 `system:read`
- 网关是否放行 `/system/metrics`
- 服务日志是否有权限拒绝

处理：
- 使用专用监控账号并最小权限授权
- 调整抓取鉴权配置
- 检查 `ops/monitoring/prometheus.yml` 中 `targets` 与 `bearer_token_file` 是否匹配当前环境

## 4.4 OTEL 无数据

检查项：
- `OTEL_ENABLED=true` 是否生效
- `OTEL_EXPORTER_OTLP_ENDPOINT` 可达性
- Collector 是否接收 HTTP OTLP (`4318`)

处理：
- 先在预发环境确认 OTEL exporter 端点可达并抓包验证上报
- 修复网络和认证后重启服务

---

## 5. 备份与恢复

- PostgreSQL 建议每天全量备份 + WAL 增量
- `server/data/`（本地文件模式）纳入快照策略
- 恢复后优先验证：
  1. 登录
  2. 租户解析
  3. 权限修改
  4. 订阅状态
  5. 任务重试

---

## 6. 变更记录建议

每次发布记录：
- Git 提交范围
- 数据库变更（DDL/DML）
- 影响模块
- 回滚方案
- 验收结果（build/client/e2e）

---

## 7. SLO 与值班闭环

SLO 定义文件：`ops/slo/slo-definitions.yml`

值班流程：`ops/oncall/rotation.md`

自动化处置编排：`ops/runbook/auto-remediation.yml`

闭环要求：
1. 告警触发后自动执行采集与通知动作。
2. 值班人员接手后必须绑定事件工单。
3. 复盘产出必须包含可执行修复项并进入发布门禁。

---

## 8. 金丝雀 / 灰度发布模板

目标：在不扩大故障面的前提下验证新版本稳定性。

### 8.1 发布前检查（必须全部通过）

1. 所有门禁通过：`gate:db`、`gate:migrations`、`gate:openapi`、`gate:contracts`、`gate:perf`、`gate:ops`。
2. 变更已标注影响范围（租户、接口、任务、插件）。
3. 已准备回滚版本与数据库回滚方案（含数据修复脚本）。
4. 值班人员与响应群组已确认在线。

### 8.2 灰度步骤（建议）

1. 先发布到 5% 流量（或 1 个低风险租户），观察 15 分钟。
2. 指标稳定后扩大到 25%，观察 30 分钟。
3. 指标继续稳定后全量发布。

观测指标（至少包含）：
- 5xx 比例
- p95 延迟
- 任务失败率
- 关键业务成功率（登录、任务重试、订阅查询）

### 8.3 回滚触发条件（任一满足即回滚）

1. 5 分钟窗口内 5xx 比例超过基线阈值并持续两个窗口。
2. p95 延迟显著劣化且无快速缓解。
3. 关键路径连续失败（登录/订阅/任务）且影响扩大。
4. 安全或权限异常（越权、租户隔离风险）被确认。

### 8.4 回滚执行步骤

1. 将流量切回上一稳定版本。
2. 运行数据库回滚演练中已验证的 down 方案。
3. 若涉及任务状态漂移，执行 `pnpm --filter server run datafix:tasks`。
4. 在 30 分钟内完成事件复盘记录并同步后续修复计划。
