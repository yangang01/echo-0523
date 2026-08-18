# 0523 回音星核 GitHub Pages 公开部署设计

## 目标

在 GitHub 账号 `yangang01` 下创建公开仓库 `qixi-0523-echo-core`，完整推送当前七夕 H5 源码，并提供可从外部访问的 GitHub Pages 链接。现有 Sites 私密部署必须继续可用，八幕交互、粒子动画和移动端布局不得改变。

## 选择的方案

为 GitHub Pages 增加一套独立的静态 Vite 构建入口，而不替换现有 vinext / Sites 构建。

- Sites 继续使用现有 `vite.config.ts`、应用路由和 Cloudflare Worker 输出。
- GitHub Pages 使用独立 HTML 入口、React 客户端入口和专用 Vite 配置。
- 静态入口直接复用 `EchoExperience`、全局样式和现有公共资源，不复制业务组件。
- Pages 构建设置仓库子路径 `/qixi-0523-echo-core/`，确保脚本、样式、图标和分享图片均能正确加载。
- `main` 分支推送后，由 GitHub Actions 构建静态产物并通过官方 Pages artifact 流程发布。

## 仓库与访问级别

- 仓库：`https://github.com/yangang01/qixi-0523-echo-core`
- 可见性：Public
- Pages：Public
- 预期地址：`https://yangang01.github.io/qixi-0523-echo-core/`
- 当前源码包含私人表白文案；公开仓库与 Pages 均会公开这些内容，这是用户明确选择。

## 文件边界

新增文件应限制在：

- GitHub Pages HTML 与客户端挂载入口
- GitHub Pages 专用 Vite 配置
- `.github/workflows/` Pages 部署工作流
- 针对构建配置、子路径和工作流的回归测试

现有场景、文案、状态管理、Canvas 粒子渲染和 Sites 配置不因本次部署修改。

## 数据流

1. 开发者推送 `main`。
2. GitHub Actions 安装锁定依赖并运行测试。
3. 专用 Vite 配置把客户端应用构建为静态目录。
4. 官方 Pages Action 上传静态 artifact。
5. GitHub Pages 发布到仓库子路径 URL。

## 错误处理

- 测试或静态构建失败时不得发布。
- 工作流只从 `main` 部署，并使用 GitHub 官方 Pages 权限与并发控制。
- 静态构建必须在本地验证入口 HTML、JS/CSS 资源路径和关键公共资源。
- 创建仓库前先检查同名仓库，避免覆盖已有项目。

## 验收标准

- 现有 55 项测试全部通过。
- Pages 专用回归测试先失败、实现后通过。
- 静态构建成功，产物包含 `index.html`、脚本、样式和公共资源。
- 构建产物中的资源 URL 使用 `/qixi-0523-echo-core/` 前缀。
- 现有 vinext / Sites 生产构建继续成功。
- 公开仓库创建成功并包含完整提交历史。
- GitHub Pages 工作流成功，外部 URL 返回页面且八幕交互可启动。

## 非目标

- 不改变 H5 视觉、文案或交互。
- 不删除或替换现有 Sites 私密链接。
- 不增加自定义域名、统计、数据库或登录系统。
