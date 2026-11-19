# Game-Developer-Review

## 本地展示站

公司目录支持名称和别名搜索、评分排序、评价数排序及最近更新排序。详情页提供项目概览、评分分布和按项目、岗位、司龄组合筛选的评价列表。本地样例包含 10 家虚构公司、12 个项目和 20 条虚构评价。

在仓库根目录使用 Node.js 22.23.4 或更高的受支持版本及 npm 运行：

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。使用 `npm run build` 生成静态站点到 `site/dist/`，使用 `npm run preview` 预览构建结果。

默认数据来自 `site/demo/v1/`，结构见[技术方案 §5.6](docs/技术方案.md)。构建产物同时提供 `data/v1/index.json`、`manifest.json`、`taxonomy.json` 和各公司的详情 JSON。对接审核通过的数据时，将环境变量 `REVIEW_DATA_DIR` 指向包含这三份文件及 `companies/` 的绝对目录后重新构建。使用项目子路径时设置 `SITE_BASE`，例如 PowerShell 下运行：

```powershell
$env:SITE_BASE = '/Game-Developer-Review/'
npm run build
```
