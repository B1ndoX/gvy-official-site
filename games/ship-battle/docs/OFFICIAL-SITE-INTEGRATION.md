# 官网接入（2026-10-21）

源码来自已验收分支 feat/ship-battle-20261021 的 5700a86751c3552f1c25b933067fd2daf5e51bda，仅导入 games/ship-battle。官网保留原有玩法、素材来源说明、独立 IndexedDB 和抽舰规则。

官网底部「舰队大乱斗」先打开双游戏选择页，两张实景截图置于各自选择按钮下。只加载选中游戏，切换会卸载当前 iframe；收起/恢复保留同一文档和逻辑尺寸，右下角关闭才结束。

第二款 iframe 为 /games/ship-battle/index.html?embed=1，ready 后通过原有同源 v1 协议发送官网 fleet-members.js 中的当前完整名单一次。名单更新沿用现有每周同步，不加新轮询。第一款统计和第二款本局数据不混用。

## 构建

官网 EdgeOne 保持 Node 22.11 和原安装流程。Node 24 开发环境使用：

```sh
npm --prefix games/ship-battle ci --ignore-scripts
npm run game:ship:build
```

这会生成 runtime/（只有 Vite 编译产物）及 runtime-manifest.json。原 public/ 素材只保存一份。官网每次构建检查全部运行源码/依赖锁/公共资源/运行包 SHA-256，拒绝源码与运行包不一致；CI 在 Node 24 重新构建并校验结果。dist 只包含 public 原始资产、许可证及 runtime，排除源码、文档、测试、独立演示页。

接入所需兼容修改仅在 BattleRenderer.ts：引入 Pixi 官方 CSP 静态实现；关闭生成 blob worker，继续使用浏览器异步 ImageBitmap 解码。官网 CSP 没有放宽，不加 unsafe-eval，不修改模拟引擎或节奏。

两张产品预览位于 /assets/game-previews/，由本地实际运行截图生成 WebP，总计约 99KB。选择页打开才设置图片 src，官网首页不预载任何游戏代码或新游戏素材。
