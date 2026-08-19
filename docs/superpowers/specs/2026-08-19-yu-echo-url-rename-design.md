# YU Echo 免费访问链接改名设计

## 目标

把 GitHub Pages 项目地址从 `https://yangang01.github.io/qixi-0523-echo-core/` 改为更简洁且能呼应 Y、U 双星主题的 `https://yangang01.github.io/yu-echo/`，继续使用免费的 `github.io` 项目站点，不引入独立域名。

## 改名范围

- GitHub 仓库从 `qixi-0523-echo-core` 重命名为 `yu-echo`。
- Vite GitHub Pages 构建基路径从 `/qixi-0523-echo-core/` 改为 `/yu-echo/`。
- Pages 构建校验脚本和测试中的仓库路径同步改为 `/yu-echo/`。
- 本地 `origin` 远程地址更新为 `https://github.com/yangang01/yu-echo.git`。
- GitHub Actions 继续从 `main` 分支构建并部署，不更改部署架构。

## 链接与兼容性

- 新的唯一分享地址为 `https://yangang01.github.io/yu-echo/`。
- 旧的 GitHub Pages 项目地址不会自动重定向；本次不创建旧地址跳转仓库。
- 仓库源码链接会由 GitHub 自动重定向一段时间，但本地 remote 仍主动更新，避免后续混淆。
- 页面内 JS、CSS、字体、音乐和其他公共资源必须全部使用 `/yu-echo/` 基路径生成，不能残留旧前缀。

## 执行与验证

1. 先用测试锁定所有 Pages 路径必须使用 `/yu-echo/`，确认旧实现失败。
2. 修改 Vite 配置、构建验证脚本和测试，运行完整测试、lint、Pages 构建及产物验证。
3. 通过 GitHub 仓库设置或 GitHub CLI 完成仓库重命名，并更新本地 remote。
4. 推送或触发 Pages 部署，等待工作流成功。
5. 检查新地址返回最新 HTML，HTML 引用新路径下的 JS/CSS，关键音乐资源可访问，仓库 `main` 指向最新提交。
6. 确认工作区干净，最终只向用户交付新链接。

## 验收标准

- `https://yangang01.github.io/yu-echo/` 可直接访问。
- 页面交互、声音和八幕流程与改名前一致。
- HTML 和构建产物中不存在 `/qixi-0523-echo-core/` 资源前缀。
- GitHub 仓库名称、Pages 部署地址和本地 `origin` 全部使用 `yu-echo`。
