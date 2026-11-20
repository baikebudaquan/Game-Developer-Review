# 开发清单

> 依据 [docs/技术方案.md](docs/技术方案.md) 的里程碑拆分。完成项需同时通过 `npm run data:validate`。

## M0 数据契约

- [x] `schema/review.schema.json`、`company.schema.json`、`taxonomy.schema.json`
- [x] `data/taxonomy.json` 枚举字典
- [x] 10 家公司、12 个项目、20 条样例评价迁移到 `data/`
- [x] `scripts/validate.mjs`：结构、枚举、引用完整性、敏感字段与正则扫描
- [x] `scripts/aggregate.mjs`：生成 `index.json`、`manifest.json`、`taxonomy.json`、`companies/{id}.json`
- [ ] 用 ajv 替换手写校验（当前为零依赖实现，避免新增安装依赖）
- [ ] 生成 TypeScript 类型并与 `site/src/lib/data.ts` 对齐

## M1 展示站

- [x] 公司目录：搜索、评分 / 评价数 / 最近更新排序
- [x] 公司详情：项目概览、评分分布、画像统计、评价筛选
- [x] 小样本保护：评价数 < 3 不展示分画像统计，画像分格 < 3 隐藏
- [x] 数据源切换到聚合产物 `site/public/data/v1`
- [ ] `/about` 页面：匿名承诺、免责声明、删除 / 申诉入口
- [ ] `/data` 页面：接口说明与下载入口
- [ ] CSP、`X-Content-Type-Options`、`Referrer-Policy` 响应头

## M2 提交链路

- [x] 问卷页 `survey/`：原生表单 + JS 增强、本地暂存、超时 / 重试 / 兜底
- [x] `POST /api/submit` Pages Function：大小 / 长度校验、蜜罐、PoW、限流、幂等
- [x] D1 表结构与 `pending` 写入
- [x] 审核状态机（`pending` → `approved` / `rejected`）与 `audit_log` 表
- [x] 零依赖测试脚本 `scripts/test-m2.mjs`
- [x] 复用 D1 `goodcompany` 并执行迁移
- [x] 创建 `gdr-survey` / `gdr-admin` 两个 Pages 项目并绑定 D1
- [x] 问卷页部署到 Cloudflare Pages（`gdr-survey.pages.dev`）
- [ ] 接入自定义域名（免费版不能单独托管子域，方案待定）
- [ ] 填写问卷兜底收件邮箱
- [ ] PoW 挑战改为服务端签发（当前由客户端生成，仅防脚本误提交）
- [ ] 客户端 PoW 难度与服务端 `POW_DIFFICULTY` 联动
- [ ] 备用境外提交端点（Deno Deploy / Fly.io / Vercel）
- [ ] D1 导出备份与过期数据清理任务（`ipHash`、已发布提交）

## M3 审核控制台

- [x] `admin/` 静态 SPA 与管理员登录（PAT、sessionStorage、服务端权限校验）
- [x] 控制台 Pages Functions API：登录校验、待审列表、通过、拒绝、审计
- [x] 待审列表、详情、公司 / 项目匹配、脱敏编辑
- [x] 通过：Git Data API 单次原子提交到公开仓，并标记 D1 为 `approved`
- [x] 拒绝：标记 D1 为 `rejected` 并记录原因
- [x] 审计日志写入 D1 `audit_log`
- [ ] GitHub OAuth Device Flow 登录（替代手动粘贴 PAT）
- [ ] 控制台部署后与真实 token 联调（`gdr-admin.pages.dev`）
- [ ] 批量通过（仅限已匹配公司且无敏感词命中）
- [ ] 敏感词 / 正则扫描（手机号、身份证、邮箱、常见人名）
- [ ] 相似文本重复提示（余弦 / 编辑距离）
- [ ] 修订已发布评价（`revision + 1`，保留历史）
- [ ] 删除 / 申诉请求处理队列
- [ ] 大仓库时改用分页 / 增量读取待审列表

## M4 发布管线

- [x] `data-validate.yml`
- [x] `site-deploy.yml`
- [ ] 开启 Pages 并验证首次部署
- [ ] 配置 `main` / `dev` 分支保护与 CODEOWNERS 实际权限

## M5 上线加固

- [ ] 自定义域名、HTTPS、`CNAME`
- [ ] 备用境外提交端点与客户端切换
- [ ] 隐私说明、免责声明、审核红线文本
- [ ] 电信 / 联通 / 移动 / 广电多网络实测
- [ ] 清理任务：D1、`ipHash`、`rejected` 过期数据

## 技术债与待决问题

- [ ] 统一合并策略：squash 或 merge commit 二选一
- [ ] 确认公司名是否使用真名、项目名是否展示
- [ ] 确认画像统计最小样本阈值（当前为 3）
- [ ] 确认审核时效承诺
