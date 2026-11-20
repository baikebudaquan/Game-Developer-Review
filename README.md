# Game-Developer-Review

游戏行业匿名评价平台：匿名问卷提交 → 人工审核 → 写入公开数据 → 静态站点展示。

- 问卷：https://gdr-survey.pages.dev
- 展示站：https://gdr-site.pages.dev
- 审核 API：https://gdr-admin.pages.dev

## 管理控制台怎么用

### 启动

1. 安装 Node.js 18+（推荐 22）
2. 双击仓库根目录的 `start-admin.cmd`
3. 浏览器会自动打开 `http://127.0.0.1:8787`；没有自动打开就手动访问

控制台只监听本机，不需要部署，也不把任何密钥写进仓库。

### 登录

粘贴自己的 GitHub PAT：

- 需要 `bkbdq/Game-Developer-Review` 的 Contents 读写权限
- 优先用 fine-grained token；如果登录返回 403，改用 classic token 并勾选 `repo`
- token 只存在当前标签页的 `sessionStorage`，关闭标签页即失效

### 审核

1. 左侧选择一条待审提交
2. 核对公司、项目、正文、标签和画像；公司名会优先按提交里的 `companyId` 预选
3. 「通过并发布」：写入公开仓 `main`，并把 D1 标记为 `approved`
4. 「拒绝」：填写原因，标记 D1 为 `rejected`，不写公开仓

新公司需要手动填一次 ID 和 slug（形如 `c_xxx`），之后同一公司会自动匹配。

### 更新展示站

- 本机 `.secrets/cloudflare.env` 配置了 `CLOUDFLARE_API_TOKEN` 时，通过审核后会自动构建并部署展示站
- 没有配置时只完成审核，可点工具栏的「更新展示站」手动触发
- 自动部署从 `origin/main` 拉最新数据，不会使用本地未提交的修改

可选配置（文件在仓库外）：

```ini
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
GIT_PROXY=http://127.0.0.1:7897
```

`GIT_PROXY` 只在拉取 GitHub 需要代理时填写。

## 文档

- [开发与部署](docs/开发与部署.md)
- [技术方案](docs/技术方案.md)
- [协作规范](docs/协作规范.md)
- [开发清单](TODO.md)
