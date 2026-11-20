# Game-Developer-Review

游戏行业匿名评价平台。整体链路：匿名问卷提交 → 人工审核 → 写入公开仓数据 → 静态站点展示。

- 技术方案：[docs/技术方案.md](docs/技术方案.md)
- 协作规范：[docs/协作规范.md](docs/协作规范.md)
- 开发清单：[TODO.md](TODO.md)

## 当前进度

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 数据契约、示例数据、校验与聚合脚本 | 已完成 |
| M1 | 展示站骨架（列表 / 详情 / 筛选） | 已完成（使用虚构样例数据） |
| M2 | 提交链路（Worker + D1 + 私有暂存仓） | 代码骨架完成，待 Cloudflare 部署 |
| M3 | 审核控制台 | 未开始 |
| M4 | 发布管线 | 部分完成（CI 已就位） |
| M5 | 上线加固 | 未开始 |

## 目录结构

```text
Game-Developer-Review/
├─ .github/
│  ├─ workflows/
│  │  ├─ data-validate.yml     # 数据校验
│  │  └─ site-deploy.yml       # 聚合 + 构建 + Pages 部署
│  ├─ CODEOWNERS
│  └─ pull_request_template.md
├─ data/                       # 唯一数据源（人工维护 + 控制台写入）
│  ├─ taxonomy.json            # 岗位 / 司龄 / 在职状态 / 城市 / 标签枚举
│  ├─ companies/{companyId}.json
│  └─ reviews/{companyId}/{reviewId}.json
├─ schema/                     # 数据契约（review / company / taxonomy）
├─ scripts/
│  ├─ validate.mjs             # 校验 schema、引用完整性、敏感信息
│  ├─ aggregate.mjs            # 生成展示端 JSON
│  └─ test-m2.mjs              # 提交链路纯逻辑测试
├─ survey/                     # 问卷静态页 + D1 迁移
│  ├─ index.html
│  ├─ app.js
│  ├─ style.css
│  └─ migrations/
├─ functions/api/submit.js     # Cloudflare Pages Function
├─ worker/                     # D1 → 私有仓 Cron Worker
├─ site/                       # Astro 展示站源码
│  ├─ src/
│  └─ public/                  # 生成数据写入 public/data/v1
├─ public/                     # 预留：仓库根静态资源
└─ docs/
```

## 本地开发

需要 Node.js 22.23.4 或更高的受支持版本（Astro 的 engines 要求）。

```sh
npm ci
npm run dev
```

`npm run dev` 会先执行数据聚合，再启动 Astro 开发服务器。其他命令：

| 命令 | 作用 |
| --- | --- |
| `npm run data:validate` | 校验 `data/` 与 `schema/` |
| `npm run data:build` | 聚合 `data/` → `site/public/data/v1/` |
| `npm run build` | 校验 + 聚合 + 构建到 `site/dist/` |
| `npm run preview` | 预览构建结果 |
| `npm run test:m2` | 提交链路的校验、PoW、哈希测试 |

`site/public/data/v1/` 是生成物，不入库；修改 `data/` 后重新构建即可。

部署在仓库子路径时设置 `SITE_BASE`，例如 PowerShell：

```powershell
$env:SITE_BASE = '/Game-Developer-Review/'
npm run build
```

## 数据流

```text
data/companies + data/reviews + data/taxonomy.json
        │  scripts/validate.mjs（CI 与构建前）
        ▼
scripts/aggregate.mjs
        │  生成 index.json / manifest.json / taxonomy.json / companies/*.json
        ▼
site/public/data/v1 ──► Astro 构建 ──► site/dist ──► GitHub Pages
```

展示端只依赖 `/data/v1/*.json`，字段定义见[技术方案 §5](docs/技术方案.md)。公司列表与详情在构建期生成，搜索、排序、筛选在浏览器内完成，不请求后端。

## 数据维护

- 公司元数据与项目列表：`data/companies/{companyId}.json`
- 单条已审核评价：`data/reviews/{companyId}/{reviewId}.json`
- 枚举字典：`data/taxonomy.json`

新增或修改数据后至少运行 `npm run data:validate`。公开数据不得出现姓名、联系方式、IP、UA、审核人等字段，校验脚本会拦截。

## M2 提交链路（骨架）

已实现：

- `survey/`：原生表单 + JS 增强，15 秒总预算、5 秒单次超时、3 秒慢网提示、取消等待、本地草稿保留 7 天、复制 / 邮件兜底
- `POST /api/submit`：urlencoded 与 JSON 双通道、16 KB 限制、字段校验、蜜罐、PoW、IP 哈希限流、24 小时内容去重、幂等写入
- D1 `submissions` 表：`pending_sync` / `synced` / `failed`，含重试退避字段
- Cron Worker：每 2 分钟把待同步提交写入私有仓，指数退避，最多 8 次

本地逻辑验证：

```sh
npm run test:m2
```

部署步骤：

1. 创建私有仓 `Game-Developer-Review-staging`，并准备仅有该仓 `Contents: Read and write` 权限的 fine-grained PAT。
2. 创建 D1 并执行迁移：

```sh
npx wrangler d1 create game-developer-review
npx wrangler d1 execute game-developer-review --remote --file survey/migrations/0001_submissions.sql
```

3. 把返回的 `database_id` 填入 [worker/wrangler.toml](worker/wrangler.toml)。
4. 创建 Cloudflare Pages 项目，构建根目录为仓库根，静态目录为 `survey`，Functions 使用根目录 `functions/`；绑定 D1 变量 `DB`。
5. 配置 Pages 环境变量：`IP_SALT`（密钥）、`ALLOWED_ORIGINS`（问卷域名）、`POW_DIFFICULTY=3`。
6. 部署问卷：

```sh
npx wrangler pages deploy survey --project-name <PAGES_PROJECT>
```

7. 配置并部署 Worker：

```sh
npx wrangler secret put GITHUB_TOKEN -c worker/wrangler.toml
npx wrangler deploy -c worker/wrangler.toml
```

8. 把 [survey/index.html](survey/index.html) 中的 `data-fallback-email` 与 `mailto:` 占位地址替换为真实收件地址。

## 协作

分支、提交信息、PR 与审核要求见[协作规范](docs/协作规范.md)。日常开发从 `dev` 拉 `feat/site-*`、`feat/survey-*`、`feat/admin-*` 等短命分支，合回 `dev` 后再随里程碑合入 `main`。
