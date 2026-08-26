# GVY 官网生产运行手册

本手册供没有历史上下文的新维护者执行验证、发布、监控、故障定位和回滚。架构与首次安装见 `README.md`。

## 1. 运行时边界

- EdgeOne 固定 Node `22.11.0`：`npm ci --ignore-scripts --omit=dev` → `npm run verify:edgeone` → 发布 `dist/`。此链路不运行 Vite 发布器，也不要求 EdgeOne 容器具有 `ffmpeg` 元数据能力。
- 本机、完整 GitHub CI、监控和相册发布器固定 `.node-version` 的 Node `24.19.0`：`npm ci --ignore-scripts` → `npm run verify`。
- CI 的 Linux 站点任务完整检查官网；macOS 任务检查官网、`sips`/WebP 相册处理、发布器和 Chromium 交互。不得把两套 Node 版本混成故障，也不得让 EdgeOne 安装全部开发依赖。

## 2. 修改前门禁

```bash
git fetch origin
git status --short --branch
git rev-list --left-right --count main...origin/main
npm ci --ignore-scripts
npm run verify
npm run test:e2e
```

工作区有未知修改、`main` 与 `origin/main` 不一致或基线验证失败时，先查明原因，不得覆盖、自动提交或用 `reset --hard` 清理。

涉及页面、资源或构建的改动还必须检查：

```bash
npm run build
npm run check:dist
git diff --check
```

## 3. 正式发布

只有站长明确授权“部署/发布”后才能执行。

1. 为当前生产提交建立带日期的回滚标签。
2. 在独立分支完成修改和验证；确认差异只含授权文件。
3. 使用普通提交合入或推送 `main`，禁止强推。
4. 等待 GitHub `Verify` 的 Node 22.11 和 Node 24 两个任务成功。
5. 等待 EdgeOne 完成异步部署，不要因短暂 502/Cache Miss 连续重复推送。
6. 执行：

```bash
npm run monitor:production
npm run check:edgeone
```

7. 浏览器复查桌面和手机：首屏只加载并播放一个匹配档位的视频；六项导航可达；相册暂停、节点、拖拽和灯箱正常；页面无横向溢出、控制台错误或手机反向滚动闪屏。
8. 访问一个随机不存在页面和一个不存在的静态资源，确认返回真实 HTTP `404`，HTML 使用仓库内 `404.html` 且带 `noindex`，静态资源不得回退首页 `text/html`。

发布相册时使用 `GVY相册发布器.app`，不要手工改相册编号或批量 Git 命令。发布器必须位于干净 `main`，只允许暂存 `index.html` 与 `assets/gallery/` 白名单路径。

## 4. 监控与告警

- `Production Monitor` 每 6 小时检查双域首页、未知页面/静态资源的真实 404、HTTP→HTTPS、主站 TLS、域名期限；蓝图与维科洛作为独立子站只告警，不把其维护故障算作主站事故。
- `check-edgeone-media` 检查全部 19 个正式 MP4：存在、Range `206`、一年 immutable 浏览器缓存以及预热后的 EdgeOne 命中。
- 监控连续失败会维护唯一 GitHub Issue，恢复后自动关闭。GitHub 公共仓库长时间无活动可能停用定时任务，每月需确认工作流仍启用。
- EdgeOne 部署切换期间允许有限重试；重试耗尽才是事故。不得通过跳过监控或扩大无限重试掩盖持续故障。

## 5. 故障定位

按最小范围定位，禁止同时改首页、相册、监控和加载策略。

| 现象 | 先检查 | 禁止做法 |
| --- | --- | --- |
| 页面无样式/图片全失效 | 缺失资源是否返回 `200 text/html`；`dist` 是否完整；EdgeOne 的 `/*` 兜底函数是否仍只处理静态未命中请求 | 重复空提交、改 DNS、把首页 fallback 当资源成功 |
| 手机刚打开反向滚动闪屏 | 视口高度变量、是否触发全局 refresh、手机 `will-change` 与海报/视频过渡 | 新增第二套滚动监听、改桌面时间线、降低视频清晰度 |
| 首屏先播一段又切片 | 同步 bootstrap 与控制器是否共用同一 10 分钟选择记录 | 同时预载三段或异步二次随机 |
| 相册拖拽后误开大图 | 短点、长按、横拖阈值及 touch 方向锁 | 叠加浏览器 click 兜底、恢复拖拽条 |
| 发布器按钮锁定 | 是否干净 `main`、是否已有预览会话、正式相册是否已含该图 | 绕过门禁、删除未知文件、因历史缓存阻止官网不存在的照片 |
| 视频线上卡住 | Range、Cache-Control、EO-Cache-Status 和正式白名单 | 换名覆盖旧缓存 URL、降低现有清晰度、一次加载全部视频 |

## 6. 安全回滚

先确认回滚目标：

```bash
git log --oneline --decorate --graph -20
git log <rollback-tag>..main --oneline
```

从新到旧用 `git revert <commit>` 生成可审计的回滚提交，重新执行全部门禁后普通推送 `main`。不得 `git reset --hard`、`git checkout --` 覆盖用户改动或强推历史。若只需恢复单项行为，先完整回到确认过的基线，再只重做该单项；不要在故障版本上继续层层补丁。

历史关键治理标签包括 `backup-production-before-durability-v76-20260818-154738-CST`。本机离线 bundle 仅是机器相关灾备线索，不能代替远端标签或独立存储；每月应验证仍可读取并复制到独立介质。商业交接审计前的远端保护点是 `backup-production-before-commercial-handoff-20260826-151513-CST`，对应基线 `208c3b7`。

## 7. 每月维护

1. 查看最近的 `Verify` 和 `Production Monitor`。
2. 确认证书剩余超过 21 天、域名超过 180 天。
3. 运行 `npm audit` 与 `npm outdated`；无安全问题时不要顺手升级。
4. 抽查真实 404、备案链接、蓝图/维科洛/RSI 链接。
5. 运行 `npm ci --ignore-scripts && npm run verify && npm run test:e2e`。
6. 检查备份标签与离线副本可恢复性。
7. 记录当前任务、完成项、卡点、下一步和不可重复踩坑到唯一外部交接文档。

## 8. 已治理的平台差异与当前技术债

- EdgeOne 该历史项目即使没有显式 rewrite，仍曾把不存在页面和资源回退为首页 `200 text/html`。空 `rewrites` 和移除全局 middleware 的隔离预览都证明无法改变托管层行为；最终使用单个 `edge-functions/[[default]].js`，依靠平台“静态文件优先于函数”的规则，只给未命中路径返回真实 404。不要再重复清缓存、空提交、删除 middleware 或增加路径白名单；每次相关部署仍由定时监控核对双域真实 404。
- Git 媒体历史使 `.git` 体积较大。Git LFS/历史迁移收益明确但风险高，必须独立备份、演练和授权，不能混入普通修复。
- Safari、Edge、Firefox 的最终实体设备冒烟测试需要相应浏览器/设备；自动门禁当前以 Chromium 和 macOS 运行环境为主。
