# GVY Official Site

星际远航者（GVY）正式官网。项目是由语义化 HTML、CSS、原生 ES Modules 和 GSAP 组成的静态站；仓库还包含一个只在 macOS 本机运行的 React 相册发布器。蓝图站与维科洛站是独立项目，本仓库只提供同页导航入口，不拥有或部署它们。

## 生产身份

| 项目 | 值 |
| --- | --- |
| 仓库 | `B1ndoX/gvy-official-site` |
| 正式分支 | `main` |
| 正式域名 | `https://www.gvyvoyagers.vip/`、`https://gvyvoyagers.vip/` |
| 托管 | Tencent Cloud EdgeOne Pages / Makers |
| EdgeOne 运行时 | Node `22.11.0`，构建命令 `npm run verify:edgeone`，输出目录 `dist/` |
| 开发、完整 CI 与发布器 | `.node-version` 固定 Node `24.19.0` |

不得把本项目改成 GitHub Pages、容器或服务端应用，也不得从本仓库修改蓝图站、维科洛站、DNS、备案或 EdgeOne 项目设置。

## 首次接手

要求：Git、Node `24.19.0`、npm、Python 3；完整媒体验证还需要 `ffmpeg`，相册发布器在 macOS 上还使用系统 `sips`。

先读 `ARCHITECTURE.md` 的状态归属与防叠加规则，再按 `OPERATIONS.md` 执行验证、发布和回滚。

```bash
git clone https://github.com/B1ndoX/gvy-official-site.git
cd gvy-official-site
npm ci --ignore-scripts
npm run verify
npm run test:e2e
```

本地预览：

```bash
npm run build
python3 -m http.server 8001 --bind 127.0.0.1 --directory dist
```

打开 `http://127.0.0.1:8001/`。不得直接把仓库根目录当正式站点；`dist/` 才是唯一可部署产物。

## 目录边界

- `index.html`、`404.html`、`member-brawl.html`：正式页面入口。
- `assets/`：正式样式、脚本、图片、视频与自托管第三方浏览器资源。
- `config/production-media.json`：正式视频白名单；构建和 EdgeOne 媒体核验共用。
- `scripts/`：构建、语法、产物、线上媒体和长期监控脚本。
- `tests/`：Node 契约、媒体元数据和 Chromium 真实交互回归。
- `tools/gallery-publisher/`：相册发布器；不会进入官网 `dist/`。
- `.github/workflows/`：双 Node 版本 CI 与每 6 小时生产监控。
- `docs/`、`design-qa.md`：历史设计与 QA 证据，不是当前运行手册。

## 验证命令

| 命令 | 作用 |
| --- | --- |
| `npm run verify` | 完整官网、媒体、发布器测试与两套构建；日常修改的最低门禁 |
| `npm run test:e2e` | Chromium 桌面、手机导航、相册、灯箱、大乱斗及手机冷启动反向滚动 |
| `npm run check:dist` | 确认成品无断链，也未泄漏源码、文档或 source map |
| `npm run monitor:production` | 只读检查双域、真实 404、HTTPS、TLS、域名期限和两个独立子站 |
| `npm run check:edgeone` | 只读检查 19 个正式视频的部署、Range 与 EdgeOne 缓存 |
| `npm run gallery:publisher` | 构建并启动本机相册发布器 |

安装了相应 Playwright 引擎时，可用 `GVY_BROWSER_NAME=firefox npm run test:e2e` 或 `GVY_BROWSER_NAME=webkit npm run test:e2e` 复用同一套回归；本机 Google Chrome 可用 `GVY_BROWSER_CHANNEL=chrome npm run test:e2e`。这不能替代 iPhone Safari 和实体设备最终冒烟。

依赖更新必须独立提交并重新执行完整验证。`npm audit`、`npm outdated` 只提供证据，不应自动升级或在审计中顺手改版本。

## 发布与回滚

普通官网发布只允许：经过审查的提交进入 `main` → GitHub Actions 通过 → EdgeOne 自动构建 `dist/`。发布前后步骤、监控和安全回滚见 [OPERATIONS.md](./OPERATIONS.md)。没有站长明确授权时，不得推送、部署、清缓存或修改云端配置。

相册新增/删除必须通过本机发布器；发布器只允许改相册 HTML 片段和 `assets/gallery/` 白名单路径。它以正式官网当前相册为去重基准，并在推送前验证所有非相册文件逐字节不变。具体使用见 [tools/gallery-publisher/README.md](./tools/gallery-publisher/README.md)。

## 长期维护边界

- 首屏必须打开即选择并播放 1 段视频；不得预载三段或为了提速降低现有清晰度。
- 行动视频保持接近视口才赋予当前片源；相册原图只作灯箱回退，列表使用响应式 WebP。
- 手机地址栏高度变化不得触发整页时间线刷新；修复滚动问题时禁止叠加第二套监听或时间线。
- 不存在的页面和资源必须返回仓库内 `404.html` 且使用真实 HTTP 404。`edgeone.json` 保持空 `rewrites`；`edge-functions/[[default]].js` 仅承接静态文件未命中的请求，并把同一份 404 文档以 404 状态返回。EdgeOne 对真实静态文件的优先级高于该兜底函数，所以首页、视频和相册不经过它。不得改成 `/* → /index.html`，也不得维护易失真的全站路径白名单。
- 当前 Git 历史包含大量媒体，`.git` 体积较大。未来如迁移 Git LFS 或重写历史，必须作为独立、可回滚项目处理，不能夹带在普通官网修改中。

## 文档权威顺序

1. 当前代码、测试、Git 与线上只读检查结果。
2. 本文件、`ARCHITECTURE.md` 和 `OPERATIONS.md`。
3. `/Users/bindox/Documents/项目交接文档/舰队官网相关.md` 的当前状态区。
4. `/Users/bindox/Documents/项目交接文档/舰队官网历史记录.md`、`docs/`、`design-qa.md` 中带日期的历史证据。

历史文档中的旧提交、旧数量和本机绝对路径不得直接当作当前事实；接手后必须重新核对。
