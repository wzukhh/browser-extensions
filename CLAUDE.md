# CLAUDE.md

## 推送规范（重要）

本项目同时关联两个远程仓库，**每次提交后必须同时推送到两个平台**：

```bash
# 1. GitHub（主仓库 origin）
git push origin main

# 2. Gitee（备份仓库 gitee，远端分支为 main）
git push gitee main
```

注意事项：

- GitHub（`origin`）在国内网络环境下可能连接失败，**push 失败可以忽略**，不阻塞工作；
- Gitee（`gitee`）是可靠的备份仓库，**push 失败需要处理**；
- gitee 远端只保留 `main` 一个分支（与 GitHub 统一，默认分支也是 `main`）；
- 本地 `main` 的上游（upstream）是 `origin/main`（GitHub），因此不带参数的 `git push` 只推 GitHub，推 gitee 必须显式使用 `git push gitee main`。
