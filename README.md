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
| M2 | 提交链路（Worker + D1 + 私有暂存仓） | 未开始 |
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
│  └─ aggregate.mjs            # 生成展示端 JSON
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

## 协作

分支、提交信息、PR 与审核要求见[协作规范](docs/协作规范.md)。日常开发从 `dev` 拉 `feat/site-*`、`feat/survey-*`、`feat/admin-*` 等短命分支，合回 `dev` 后再随里程碑合入 `main`。
