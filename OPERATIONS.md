# GVY 官网长期运行手册

## 运行时边界

- EdgeOne 正式静态构建固定使用平台官方推荐、预装的 Node `22.11.0`，只执行 `npm run verify:site`；这是部署平台兼容性边界，不代表开发主版本。
- 相册发布器、定时监控和完整开发验证统一使用 `.node-version` 中的 Node `24.19.0`（当前官方 Active LTS），执行 `npm run verify`。不跟随尚未进入 LTS 的 Current 版本。
- 两条链路由 GitHub Actions 分别验证。不得让 EdgeOne 执行 Vite 8，也不得把发布器构建加入 EdgeOne 正式部署命令。

## 发布门禁

- 普通官网修改必须先运行 `npm run verify`。
- EdgeOne 自身还会运行 `npm run verify:site`；验证失败时不得生成新生产部署。
- 相册发布器继续在本机运行完整验证、限制相册白名单并推送 `main`。主分支保护不得启用管理员强制，否则会破坏既有一键发布。
- GitHub Actions 的 `Verify / Site on EdgeOne Node 22.11` 与 `Verify / Full runtime and publisher on Node 24 LTS` 是长期健康证据。前者在 Linux 上验证官网，后者在真实 macOS 运行环境验证完整官网、浏览器交互和发布器，避免 `/usr/bin/sips` 被 Linux 误判为故障。
- macOS CI 的系统 ffmpeg 可能缺少 `libwebp`；工作流会自动切换到带 WebP 编码器的 `ffmpeg@7`。不得把该环境差异误判为 Node 故障，也不得因此跳过发布器图片处理测试。

## 监控

- `Production Monitor` 每 6 小时检查两个官网域名、蓝图站、维科洛站、HTTP 强制 HTTPS、四个 TLS 证书、域名到期和全部 19 个正式视频的 Range/EdgeOne 缓存。
- 连续检查失败会创建或更新唯一的 GitHub Issue；恢复后自动关闭。
- `scripts/check-edgeone-media.mjs` 允许有限重试，用于吸收 CDN 多节点瞬时冷缓存和网络抖动；持续失败仍会以非零状态退出。

## 回滚和灾备

- v76 治理前远端标签：`backup-production-before-durability-v76-20260818-154738-CST`。
- v75 完整 Git bundle：`/Users/bindox/Documents/Codex/Projects/starcitizen-crawler/backups/gvy-production-v75-before-durability-20260818T154738CST/gvy-official-site-v75.bundle`。
- Git bundle SHA-256：`f3ce08eb1339ec05de3759230267fb569d39a7a51862c861cf4699b4db130d89`。
- 本机备份可以防误改，但不能防整台磁盘损坏；应由站长把该目录再复制到独立磁盘或受控云盘。不得上传到公开附件或把同仓库标签称为独立灾备。

## 每月维护

1. 查看最近一次 `Verify` 和 `Production Monitor` 是否成功。
2. 确认证书剩余时间大于 21 天、域名剩余时间大于 180 天。
3. 运行 `npm audit` 与 `npm outdated`，依赖更新必须单独提交并完成浏览器回归。
4. 检查离线备份是否能够通过 `git bundle verify`。
5. GitHub 公共仓库若连续 60 天没有活动，定时工作流可能被平台自动停用；必须重新启用并手动运行一次。
