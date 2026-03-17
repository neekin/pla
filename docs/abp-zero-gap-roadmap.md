# ABP.Net Zero 对标追平路线图（4 周）

> 目标：在当前 `gigpayday_remake` 基础上，优先补齐 ABP.Net Zero 的关键平台能力（P0/P1），形成可上线企业底座。

## 0. 当前基线（已具备）

- 多租户基础解析（header/domain/subdomain）
- JWT 登录、RBAC（角色+权限）
- 配置中心、插件机制、SSE 通知
- 任务中心（已数据库化）
- 管理台 CRUD 基础框架（含可复用列表组件）

---

## 1. 4 周里程碑

## Week 1（P0）：身份安全与租户设置分层

### 1.1 身份安全增强（Auth Hardening）

**后端**
- 新增实体：`auth_login_attempts`、`auth_security_policies`
- 新增能力：
  - 密码复杂度策略（最小长度、字符类别）
  - 账号锁定（失败 N 次锁定 M 分钟）
  - 首次登录强制改密（可选）
- API：
  - `GET /auth/security-policy`
  - `PATCH /auth/security-policy`
  - 登录流程返回 `requiresPasswordReset`

**前端**
- 管理端新增“安全策略”页
- 登录页支持“需重置密码”流程

**验收标准**
- 连续错误登录触发锁定
- 策略修改实时生效
- 弱密码可被拒绝

---

### 1.2 设置系统三层继承（Host/Tenant/User）

**后端**
- 新增实体：`platform_settings`
  - `scopeType`: `host|tenant|user`
  - `scopeId`
  - `key`
  - `value` (json)
- 解析规则：`user > tenant > host > default`
- API：
  - `GET /system/settings?scope=effective`
  - `PUT /system/settings/:key`
  - `DELETE /system/settings/:key`

**前端**
- 配置中心增加“作用域切换器”（Host/Tenant/User）
- 设置项展示“来源层级”

**验收标准**
- 同一 key 在三层可覆盖且回退正确
- 切换租户后生效值正确

---

## Week 2（P0）：订阅计费与租户商业化

### 2.1 Edition/Subscription 体系

**后端**
- 新增实体：
  - `editions`
  - `tenant_subscriptions`
  - `subscription_events`
- 关键字段：
  - plan、trialStartAt、trialEndAt、status、quota
- API：
  - `GET /billing/editions`
  - `POST /billing/subscriptions/assign`
  - `POST /billing/subscriptions/renew`
  - `GET /billing/subscriptions/:tenantId`

**前端**
- 新增“版本与订阅”管理页
- 租户详情展示：试用中/已过期/有效期

**验收标准**
- 试用到期自动转状态
- 续费后状态与到期日更新

---

### 2.2 配额与超限策略

**后端**
- `quota_enforcement` 中间件（按租户 + 能力点）
- 超限策略：拒绝/降级（开关）

**前端**
- 列表显示“配额使用率”
- 超限提示条

**验收标准**
- 超限请求可被精确拦截
- 审计日志记录超限原因

---

## Week 3（P1）：审计深度与后台任务能力

### 3.1 实体变更审计（Entity History）

**后端**
- 新增实体：`entity_change_logs`
- 记录：实体名、主键、字段变更 diff、操作人、租户
- 提供装饰器/拦截器接入（更新与删除）
- API：`GET /system/entity-audits`

**前端**
- 审计页增加“实体变更”Tab
- 支持按实体名、操作人、时间过滤

**验收标准**
- 对用户权限变更可展示字段级 diff

---

### 3.2 任务中心增强（接近 Hangfire 体验）

**后端**
- 任务状态扩展：`failed`、`retrying`
- 字段扩展：`retryCount`、`maxRetry`、`lastError`
- 增加“重试策略”和“死信队列”
- API：
  - `POST /tasks/:id/retry`
  - `GET /tasks/failed`

**前端**
- 任务列表支持按状态过滤
- 失败任务手动重试按钮
- 错误详情抽屉

**验收标准**
- 失败任务可自动重试并最终归档
- 手动重试可追踪历史

---

## Week 4（P1）：可观测性 + 发布就绪

### 4.1 可观测性

**后端**
- 指标：Prometheus（请求耗时、任务队列长度、失败率）
- 追踪：OpenTelemetry 基础链路（HTTP + DB）
- 日志：结构化 JSON（requestId、tenantId、userId）

**前端**
- 管理台新增“运行健康”卡片（基础指标）

**验收标准**
- 能追踪一条请求到 DB 查询
- 能观测到 5xx 与慢请求趋势

---

### 4.2 发布与质量门禁

**流水线门禁建议**
- `server build`、`client build`、`e2e`
- DB migration 检查
- OpenAPI 变更检查（可选）

**交付标准**
- 关键路径 e2e 覆盖：登录、租户切换、权限修改、订阅到期、任务失败重试
- README + 运维手册补齐

---

## 2. 推荐优先实现顺序（按收益/风险）

1. 身份安全策略 + 登录锁定（Week 1）
2. 设置三层继承（Week 1）
3. 订阅与版本（Week 2）
4. 配额拦截（Week 2）
5. 任务失败重试（Week 3）
6. 实体变更审计（Week 3）
7. 可观测性（Week 4）

---

## 3. 建议拆分的 Epic

- Epic A：Security & Identity
- Epic B：Settings Hierarchy
- Epic C：Billing & Subscription
- Epic D：Task Reliability
- Epic E：Audit & Compliance
- Epic F：Observability & Release

---

## 4. 每个 Epic 的统一验收模板

- 功能验收：
  - [ ] API 可用且权限正确
  - [ ] 管理台可操作
  - [ ] 审计日志可追踪
- 质量验收：
  - [ ] 单测/集成测试通过
  - [ ] e2e 覆盖关键路径
  - [ ] 构建通过且无新增 blocker
- 运维验收：
  - [ ] 有监控指标
  - [ ] 有故障排查手册

---

## 5. 你现在可以立刻做的两件事

1. 先落 Week 1 的数据表与 API（安全策略 + 设置继承）
2. 同步把前端 `AdminConfig` 扩展为“Settings Scope 管理页”

> 这样一周后你就会在“企业级平台感知”上明显接近 ABP.Net Zero。
