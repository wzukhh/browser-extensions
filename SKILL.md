# CLAUDE.md

## 推送规范（重要）

本项目同时关联两个远程仓库，**推送时必须同时推送到两个平台**：

```bash
# 1. GitHub（主仓库 origin）
git push origin main

# 2. Gitee（备份仓库 gitee，远端分支为 main）
git push gitee main
```

不需要每次提交都推送，可以一个完整功能优化迭代完成后，统一推送。

## 追踪文件

如果是用户自己手动修改的文件，当修改的地方和设计或计划或任务冲突时，需要确认是否采纳手动修改的内容。
如果不冲突则直接使用。

提交和推送时，需要包含用户手动修改或新增的文件。

## 注意事项：

- GitHub（`origin`）在国内网络环境下可能连接失败，**push 失败可以忽略**，不阻塞工作；
- Gitee（`gitee`）是可靠的备份仓库，**push 失败需要处理**；
- gitee 远端只保留 `main` 一个分支（与 GitHub 统一，默认分支也是 `main`）；
- 本地 `main` 的上游（upstream）是 `origin/main`（GitHub），因此不带参数的 `git push` 只推 GitHub，推 gitee 必须显式使用 `git push gitee main`。
