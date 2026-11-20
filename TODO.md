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
- [x] D1 表结构与 `pending_sync` 写入
- [x] Cron Worker：同步到私有仓、指数退避、失败重试
- [x] 零依赖测试脚本 `scripts/test-m2.mjs`
- [ ] 新建私有暂存仓 `Game-Developer-Review-staging`
- [ ] 在 Cloudflare 创建 D1、执行迁移并绑定 Pages 项目
- [ ] 问卷页部署到 Cloudflare Pages 并绑定自定义域名
- [ ] PoW 挑战改为服务端签发（当前由客户端生成，仅防脚本误提交）
- [ ] 客户端 PoW 难度与服务端 `POW_DIFFICULTY` 联动
- [ ] 备用境外提交端点（Deno Deploy / Fly.io / Vercel）
- [ ] 同步失败告警（邮件或 webhook）
- [ ] 过期数据清理任务（D1、`ipHash`、`rejected`）

## M3 审核控制台

- [ ] `admin/` 静态 SPA 与管理员登录（Device Flow 或 PAT）
- [ ] 待审列表、详情、公司 / 项目匹配、脱敏编辑
- [ ] 通过：Git Data API 单次原子提交到公开仓
- [ ] 拒绝：移入 `rejected/` 并记录原因
- [ ] 审计日志 `audit/{yyyy}-{mm}.jsonl`

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
