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

控制台用 GitHub PAT 登录。按自己的身份选一种令牌：

#### 仓库主人（管理员）：fine-grained token

1. 打开 https://github.com/settings/tokens?type=beta
2. 点 **Generate new token**
3. Name 填 `gdr-admin`，Expiration 选 30–90 天
4. Resource owner 选 `bkbdq`
5. Repository access 选 **Only select repositories** → `Game-Developer-Review`
6. Permissions → Repository permissions → **Contents** 选 **Read and write**
   （`Metadata` 会自动变成 Read-only，正常）
7. 点 **Generate token**，复制 `github_pat_...`

#### 仓库协作者：classic token

GitHub 的细粒度令牌不支持写别人的个人仓库，协作者请用 classic：

1. 打开 https://github.com/settings/tokens
2. 点 **Generate new token (classic)**
3. Note 填 `gdr-admin`，Expiration 选 30 天
4. Scopes 只勾 **`repo`**
5. 点 **Generate token**，复制 `ghp_...`

两种 token 都只存在当前标签页的 `sessionStorage`，关闭标签页即失效；不要写进文件或提交到仓库。登录返回 403 时，先确认 token 对 `bkbdq/Game-Developer-Review` 有 Contents 写权限；仍不行就换另一种令牌。

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
