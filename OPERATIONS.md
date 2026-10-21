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

相册交互变更还须验证：节点条外松手/取消/失焦后无幽灵拖动；手机按住时照片不推进，原生横滚不误选且不抢页面纵滚；节点点击立即反馈、快速连续选取最后一次生效、照片拖动松手吸附且不打开灯箱。手动横拖或选图后保持暂停，播放按钮才恢复；首尾循环、键盘左右/Home/End及reduced-motion走同一位置负责人。不得修改照片身份/顺序、上传发布器白名单或灯箱代码来补相册拖拽状态。

发布相册时使用 `GVY相册发布器.app`，不要手工改相册编号或批量 Git 命令。发布器必须位于干净 `main`，只允许暂存 `index.html` 与 `assets/gallery/` 白名单路径。

发布产物必须由 `npm run build` 生成：JS/CSS 和大乱斗文档的 URL 由内容指纹自动产生并由 `check:dist` 校验，不能跳过构建直接上传源码，也不用手动递增 vXX。视频版本策略不变。部署后除普通重载外，还要检查“离开首页 → 浏览器后退 → 操作相册”，验证缓存返回路径。

发布器如提示“预览后文件被其他操作改变 / Git 基线已改变 / 旧预览缺少安全快照”，不会覆盖现场。先保存当前差异与 `.runtime/<会话>/index.html.before-preview`、`removed-assets/`；人工核对其他修改后再处理会话。禁止为解锁直接删除备份、伪造快照或 reset 工作区。预览期间不要并行编辑同一工作区；这是并发改动保护，不是根据历史上传缓存阻断照片。

## 4. 监控与告警

- `Production Monitor` 每 6 小时检查双域首页、未知页面/静态资源的真实 404、HTTP→HTTPS、主站 TLS、域名期限；证书剩余不足 21 天只进入续签观察，低于 14 天仍未换证才算主站事故。蓝图与维科洛作为独立子站只告警，不把其维护故障算作主站事故；媒体检查即使其他检查失败也必须继续执行。
- `check-edgeone-media` 检查19个现役MP4及清单明确保留的旧兼容片：存在、Range `206`、一年 immutable 浏览器缓存以及预热后的 EdgeOne 命中。
- `test:e2e`中的`video-playback.spec.js`在1920/390/2560宽度记录实际首帧、播放后缓冲、解码/丢帧和同片冷热重开；校验现有清晰度、首屏即播、完全离屏超过一屏距离后暂停、仍在屏外时提前恢复、可见边缘持续推进、行动区首屏暂停和返回不重载。通过`npm run test:e2e -- --output=/绝对路径`把JSON附件和截图留在仓库外。此为既有验收流程，不新增定时任务；本地5秒首帧门禁仅适用于未限速开发服务，不是公网承诺。
- 浏览器测试使用单worker，避免其他测试的视频下载/解码影响首帧与缓冲测量；失败同样附带已取得的指标及最后快照，不只保留成功样本。并行运行压力测试属于另一种测量条件，应单列结果。
- 视频素材换版还须保存逐段编码命令、原片/候选hash、完整帧画质指标、原尺寸画面对照和同条件限速播放结果到仓库外的验收目录。检查全部19段的原分辨率/帧数/30fps/色彩及faststart，验证新文件名的Range和热缓存；不能用本地结果代替公网/真机验收，也不能以提高或降低文件体积下限证明画质。原片留作回退，production-media白名单中的现役与明确兼容版本进入dist；check:dist逐字节验证旧兼容地址，check:edgeone同时核验其Range/长缓存。当前8条兼容片仅用于旧页面，不会被新页面预载；发布包因此保留原片字节，不能把发布包总大小当成单页下载量。
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

### 每周RSI成员自动同步

- 原生GitHub工作流`RSI Member Sync`每周一北京时间04:43执行；需要提前更新时在Actions中对main手动运行同一流程。`npm run sync:members`仅本地获取候选数据，不提交、不发布；没有浏览器轮询、NAS常驻服务或额外Codex定时任务。
- 一次完整公开成员查询，只有超过首32人时继续官网分页；头像URL去重后条件GET核验字节。名单、改名、头衔或头像变化会生成快照和内容SHA头像；相同输入不产生生产提交。抓取有界重试、空/错页/重复/分页不齐、超过50%的异常缩减、头像损坏等均拒绝覆盖；真实大规模退队需核实后人工按普通发布流程更新快照，不应放宽保护掩盖异常。
- 变化先进入本次临时候选分支，使用GITHUB_TOKEN显式dispatch原Verify（此事件可正常触发后续检查），两项准确SHA检查通过且main无并发变化，再将真实结果及原job证据链接登记为同名commit status，经过原保护规则校验后普通快进；GITHUB_TOKEN的普通push不触发递归Actions。EdgeOne仍通过原Git集成部署，随后检查双域页面/快照/头像完整SHA。失败保留运行日志和旧有效数据；main已更新而边缘传播验证失败时记录发布失败，不能称未提交。
- GitHub明确不把workflow_dispatch job checks计入受保护分支，首次真实验收39424375289因此被GH006拒绝。结果适配器必须先验证原Verify路径、同一候选SHA、Actions App、两项success、原job链接和数据白名单，才能登记对应成功状态；失败、缺检查、不同SHA、假链接或main并发变化均不报告成功。它不删除原检查或放宽保护，禁止改成固定绿色状态。官方依据：https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated 。
- 只用每次运行的短期GITHUB_TOKEN，工作流具有contents/actions/statuses写权限，分别用于受约束的数据提交、触发原检查和登记已完成的真实CI结果；不新增长期密钥、不调整分支保护。临时候选仅在远端tip仍为本任务候选时清理，禁止删其他分支。main并发变化时停止，重新运行须从新main重新获取和检查，不能重放过期候选。
- 内部状态分支`automation/rsi-members-state`每周写`config/rsi-members-status.json`，不修改其源代码树、不合入main；有真实检查时间、成功/失败、生产SHA和run链接，防止公开仓库长期无main改动导致schedule停用。原生产监控新增第10项：末次检查失败或超过10天未成功即报事故；恢复沿用原单一Issue。状态分支不是网站生产分支；独立分支可能有平台自动预览，不等于重复发布生产。
- 查看Actions运行及状态记录时核对确切SHA，不以“任务成功创建”当同步成功。生产快照记录updatedAt，表示上次实际内容变更，周检时间在内部状态分支；不要为更新时间强制部署。头像90天留存随真实内容更新清理，仅操作SHA命名白名单。

### 每月复查

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

## 9. 离线大乱斗维护

- `member-brawl.html` 和 `assets/member-arena.css` 负责响应式布局；开战后压缩标题为桌面56px单行/手机102px双行工具栏，战绩按需展开，不再占常驻底栏。`fleet-command-brawl.js` 只维护唯一模拟；`member-arena-rules.js` 为可独立验证的碰撞、配装、地形与存储规则，`member-arena-profile.js` 为地图参考配置，`member-arena-weapon-profile.js` 为唯一现役武器/手/弹体配置；Motion/Actions/Rig分开负责路径、原出手调度和实体关节。不要把角色交互、弹幕、直播接口或浏览器抓取成员加回来。
- 首次打开弹窗才请求游戏及军械。大窗口关闭/缩小/Escape转为右下fixed浮窗、释放页面滚动锁并继续同一iframe，恢复不重开局；浮窗预览只裁切/缩放已有视口，不能让手机变成高大的全屏小窗。右下浮窗关闭才移除src卸载和保存增量。文档隐藏/手动暂停冻结同一局的物理、飞行物、拾取、冷却、结算和撒花；尺寸改变只重建静态地形和调整角色坐标。自动巡回仍使用同一个战斗时钟，没有常驻后台任务。大名单上限64人，按局轮换；不能为了全员同屏取消此限制。镜像配装在选定的本轮成员池内生成，保证双方对称。
- 用户最新要求改用原作武器和独立手：21份透明原图无损WebP共81,322字节，文件带内容SHA，source与完整哈希见 `docs/arena-artwork.md`。旧14生成图/提示词退役至仓库外证据，不进入构建。按原world尺寸和真实握点绘制，武器、手、头像、碰撞器与地图共用单位；新增资源不得被首页提前预载。
- 参考版本为官方免费 Intro Fighters 3.2，ZIP SHA256 `0d943e7e9d5194f5ed994f97ca121438a8cc41ea1639a6743505ee222fe56c1c`。REA成功检查和提取了Unity/IL2CPP制品；原生概览和Damage反编译各600秒超时。数值来自独立Unity序列化/IL2CPP注册映射和LLVM指令分析，不能说成REA完整恢复C#或原作运行验证。七场景采用权威配置生成控制点，固定地图保留折角，生成地图恢复Bezier切线后有界采样，绘制/碰撞共用轮廓；伤害世界单位映射为CSS像素，巨人尺寸不改变换算基准。地图、AI、碰撞不会与Unity逐帧相同。
- 本批证据保存在仓库外 `/Users/bindox/Documents/Codex/Previews/gvy-introfighters-20261021`，含REA证据包、参考配置/调用身份、失败记录、浏览器验证及素材原稿；`evidence/reference-final-summary.md` 明确真实性边界。以后更新数值须保留对应新制品和证据，不能从展示名或旧缓存网格猜测规则。
- `tests/member-arena-rules.test.js` 覆盖阈值伤害、暴击、连续碰撞、地形生成、镜像与存储失败回退；`tests/e2e/arena-upgrade.spec.js` 覆盖真实接触/投射物、原友伤倍率、结算续局、手机弹窗、手动暂停、resize、减弱动态及无联网交互；`arena-window.spec.js`检查居中非全屏、右下跟滚动、保持虚拟视口/原局和真正卸载；`arena-map.spec.js`检查场景时钟、真实破箱、区域接触、七图底线碰撞和大屏/宽屏等比映射。修改后执行既有完整 `npm run verify`、`npm run test:e2e` 与 `git diff --check`，再用实际桌面/手机视口检查武器透明边缘和可读性。自动检查是Chromium证据，不能替代实体Safari验收。

- 2026-10-21最新规则覆盖早期45/60秒短局方案：随机巡回个人淘汰/团队淘汰/限时击杀赛，无尽置底且不入随机，武器默认随机。个人最后一人、团队含预备全灭，无时限；限时45秒，结果8秒。原作3.2 Deathmatch有菜单设计但按钮隐藏且入口强退Classic，Begin明示未实现；不得把网页个人淘汰和限时赛流程说成已恢复的原作可运行代码。
- 地图证据沿用Previews/gvy-arena-maps-20261021/map-recheck-report.md与map-reconstruction-spec.json。Classic已恢复原90–144/33–62/140–259秒的地形周期。控制/伤害本轮证据在Previews/gvy-arena-native-combat-20261021的damage-native-evidence、modes-native-evidence、deathmatch-native-evidence、rotation-native-evidence JSON/MD；制品hash重新核实，未运行Windows原版。
- 战绩在战斗中为左上透明前五名，只读且点击穿透，不改变战场尺寸；手机打开时避免与击杀播报叠字。准备界面仍能查看完整前十和累计战绩。核验战绩展开后暂停/重赛等按钮仍可点击，收起后播报恢复；暂停时改变窗口宽度也须立即重建画面几何而不推进时钟。

- 2026-10-21武器复核证据在 `Previews/gvy-arena-weapons-20261021/`：`weapon-implementation-compact.json`、`original-attack-timing-spec.json`、`attack-linecast-and-reach-spec.json`、`projectiles-explosives-healing-spec.json`，原图21个RGBA逐字节匹配，原生调度/层mask/握点均有指令和序列化来源。Windows程序未执行，不能表述为完整源码复制。新的Motion/Actions/Rig单测与 `arena-weapons.spec.js` 检查原冷却、遮挡、实际抛出/同体拾取、人数等比和预备队；所有测试只服务本地质量验证，不增加线上命令/定时任务。

- 同分判定复核见外部 `winner-and-tie-evidence.json` 和报告：原Classic无限时，原榜SQL只按总击杀且UI用行序号，不能声称原作以HP/死亡裁限时冠军。当前网页限时击杀赛明确采用击杀降序、阵亡升序的共享规则，严格同分并列名次/共同获胜、零淘汰平局；此为网页适配。核验第一名与结算一致、HP不会改冠军、并列者胜局各记一次，结果倒数与暂停保持不变。

- 大乱斗反馈维护：出手时间逻辑仍在Actions/runtime，Feedback不得新增攻击冷却或全局慢放；单canvas预算为96头像碎屑、512短尾线段、200万backing像素，所有动画由原RAF推动。改动后检查真实命中、连续伤害/治疗双层血条、暂停/重赛/缩小/关闭、reduced-motion及64人负载；低配设备可减少视觉预算，不以改变出手频率掩盖问题。左侧骷髅为本次出场连续淘汰，右侧绿色为当前浏览器累计淘汰，零值隐藏。

- 本轮武器链核对与修复：实时目标角度统一、root/COM区分、去除第二个fist PID、保留两半步驱动力；原投掷归属、300ms具体武器保护、Active/有效伤害区/Enter门禁、线速度伤害、友伤和分段回血同步校准。单测覆盖原点近距方向与完整施力，浏览器覆盖运动目标/投掷拾回/暂停缩放/自然结算/限时同分。仍需区分原Unity控制器与Matter关节、惯量、驱动校准；没有完整原Windows运行对照，不能声称战斗全部逆向或逐帧等价。

- 事件新外观复用原节点、碰撞体和模拟时钟：黑洞核心/吸积盘、金属货箱/受击边光、医疗十字/治疗环与跃升标识。货箱会堆叠、阻挡和破碎，不将全部箱体误称为必掉奖励的宝箱。暴击提示来自通过伤害门禁后的真实暴击，回血显示实际HP增量；16槽文字池合并同一生命的连续治疗，暂停冻结、重赛/真正关闭销毁，减弱动态不分配canvas。独立格挡判定未证实，不增加虚假格挡提示。
- 击杀/事件播报最多4条，停留3.2秒后用同一模拟时钟淡出1.8秒并移除；暂停/后台冻结，打开设置和重赛立即清空，不使用额外定时器或CSS动画。
- 准备页压紧为短标题、双列设置与简短模式名，下方随选择解释规则。桌面支持的浏览器以原生 `base-select` 优化弹出选项，触屏保留系统选择器；不引入自制键盘/焦点状态机。依据 https://developer.chrome.com/blog/a-customizable-select 。核验4K、2K、超宽、宽矮、手机竖横屏的控件边界、选项可达和同局缩放；大屏仍为居中弹窗，右下缩小/恢复/真正关闭语义不变。
- 每帧位置、头像转动/挤压/受击写入各自节点transform，避免变量向整个角色子树继承；静态时钟标签仅在文字变化时写入。不得以降低50Hz模拟或原出手频率通过性能检查；64人满配无敌压力与正常32人应分开记录，本机帧间隔不是实体Safari或低配设备保证。
- 用户最终取消全部限帧方案：按设备和浏览器正常requestAnimationFrame绘制，不按卡顿、硬件或在场人数自动降帧，也不保留固定30/60上限或帧数档位设置。此前实验pacer及其测试已移除，不能再当作当前功能。保持50Hz模拟、原画面效果和战斗规则；现有有界资源预算、单RAF与暂停/后台清理继续有效。性能诊断保留在外部证据目录，实验结果不等于正式启用。
