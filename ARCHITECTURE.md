# GVY 官网维护架构

CI职责追加：纯模拟由独立Ubuntu单worker执行，macOS负责运行包复现、发布器、媒体与浏览器；必需工具门禁只聚合真实任务结果，选中的任务跳过/失败/取消/缺失都会失败。作用范围和检查名仍由verification-plan唯一拥有。

2026-10-29实现候选：verification-plan独占影响分类、检查名称与准确树/候选验证契约；run-verification只执行已校验计划。Node按用户最终要求以.node-version的24.18.0为主，.nvmrc/edgeone.json/package引擎同值并检查实际进程版本。原游戏运行包继续预编译校验/复制，新增流程不写入模拟或前端状态。远端/云端验收未完成，正式仍PR28，详细状态见OPERATIONS顶部。

当前正式发布为PR28/main 119c519（2026-10-28），运行包index-DO2FTLKL；原职责边界保留，完整上线/清理与回滚记录见OPERATIONS/上下文顶部。8个未发布试录已核验后删除，不属于长期兼容媒体。

2026-10-29环境审查：Node22.11是EdgeOne静态构建/兼容CI环境，Node24.19是本地构建/发布器/完整CI/监控环境；线上游戏在浏览器执行，无Node常驻对局服务。官方平台已支持Node24，统一建议待真实预览验证并同步检查名/保护/RSI契约后实施；本次只记录审查结论，详细耗时与方案见OPERATIONS顶部。

本文件定义长期无人值守维护时的状态归属、变更边界和自动防回归原则。它描述当前正式架构，不记录历史流水。

## 单一状态负责人

| 状态 | 唯一写入者 | 只读消费者 | 禁止事项 |
| --- | --- | --- | --- |
| 首屏视频选片 | `index.html` 头部同步脚本 | `hero-video-controller.js` | 控制器再次随机选片或加载后更换已选片源 |
| 首屏播放状态 | `hero-video-controller.js` | 首屏 DOM/CSS | 新增第二个播放恢复定时器 |
| 行动阶段 | 桌面 `cinematic-timelines.js`；手机 `operation-motion.js` 可见性分支 | `operation-motion.js` 视频层 | 同一断点下两个生产者同时写 `data-operation-active` |
| 导航活动项 | `section-navigation.js` | 导航 CSS | 第二个滚动监听绕过现有活动项计算 |
| 相册位置与播放 | `archive-carousel.js` | 节点与播放按钮 | 第二套轮播、全局拖拽补丁或灯箱反向改位置 |
| 相册灯箱 | `archive-lightbox.js` | 对话框 UI | 相册拖拽结束直接触发灯箱 |
| 大乱斗窗口（展开/右下浮窗/结束） | `member-brawl-dialog.js` | 同一个iframe页面 | 首页预载游戏、缩小重开对局、滚动监听模拟fixed浮窗 |
| 大乱斗模拟、对局与轮换 | `fleet-command-brawl.js` 的唯一固定步长RAF | 响应式DOM、HUD、本机战绩 | 独立Runner/interval/伤害定时器、点击/拖动角色、聊天或联网加入 |
| 大乱斗纯规则和源配置 | `member-arena-rules.js`、`member-arena-profile.js` | 唯一模拟 | UI另写一套命中或结算；把Unity世界单位直接当CSS像素 |
| 大乱斗成员与头像快照 | `scripts/lib/rsi-members.mjs`，由每周RSI Member Sync调用 | iframe的`fleet-members.js`数据脚本与战斗渲染 | 浏览器查询RSI、另一套定时器热换正在进行的对局 |

桌面和手机可以采用不同的状态生产方式，但同一媒体条件中只能有一个生产者。消费者不得反向写入生产者状态。

## 第二款游戏的统一数据职责（发布状态见 OPERATIONS）

S12取图修正：只调整ordnance-visuals中S12的UV矩形到原atlas下方圆柱段，图集字节和其他20项不变；不通过重绘素材或修改武器/模拟去除阴影。

鱼雷最终已部署（PR28，2026-10-28，覆盖下方thickness=1.8约定）：用户取消额外加粗，CombatVfx.ordnance恢复原来的双参数/原图比例；WeaponEffects保留共同显示倍率4，弹体与喷焰宽度分开，使明亮长尾焰不受弹体恢复比例影响。没有第二套尺寸/模拟负责人，正式上线状态见OPERATIONS顶部。

鱼雷可辨识度最新追加（2026-10-28，仅本地，覆盖前段3.2/原图比例约定）：WeaponEffects继续独占按Size的世界长度，torpedo倍率4、厚度1.8；CombatVfx.ordnance只应用调用者传入的厚度，默认1保留普通导弹。双层暖金/白热推进和喷口光晕复用原atlas/精灵预算与原时钟，不更换素材或参与模拟判定。

鱼雷显示尺寸追加（2026-10-28，仅本地）：原WeaponEffects.ordnanceVisualLength独占按Size的世界显示长度，torpedo共同倍率从1.6变为3.2，所有船型/NPC相同；CombatVfx沿原图比例应用，普通missile不变。不修改模拟碰撞、速度/制导、伤害或原作尺寸事实，不新增图集/精灵预算或第二套尺寸控制。

R24最新焦点职责（覆盖下方旧的附近/活跃度/BOSS优先描述）：CombatDirector只对全场活跃交火成员等概率随机，再抽其交战目标，不以距离/血量/船长/炮台数量加权。持镜和2.5秒死亡停留由原Director拥有；CameraHandoff只在原Renderer ticker上负责远距拉远→平移→原spectatorSpan推近、途中阵亡减速停留，近距走原构图。转场不消耗抵达后的持镜，死亡仍按真实dt，不新建RAF/interval或修改模拟；重置/自由相机/跟随/销毁清理。engagementFrame按HUD可用空间同时容纳双方/超大舰近侧，spectatorSpan独占有界log缩放及6%推近余量。aim-tracking-rules v2唯一炮台触发容差8°由原Engine使用，成员/NPC一致；不改trackAim观察/角惯性/实际转速、射击方向或资源。原小舰AttackRun先正面交战再判断掠过，脱离可由完成原弯道结束，不另造追击/强制伤害规则。

R24炮位与镜头追加：turret-layouts支持canonical家族alias及明确pilot炮口；fitting可将同一原武器库存分配到多个有总量校验的炮口，不新增火力/库存。默认坐标升级继续只由原upgradeCombat负责。CombatDirector独占真实时间随机持镜，不消费Engine PRNG；spectatorSpan独占自动缩放缓动，原Renderer只应用镜头构图/安全边距，不写战斗。AttackRun的caution窗口属于同目标交战，不在重入时重抽复用旧受击；新受击/近身保持原分支，不加第二层躲避。

R24统一输出追加：fleet-combat-tuning.bossDamage是赏金/挑战BOSS唯一共同武器输出倍率（当前1.25），Engine仅在这两种模式出生时应用一次；PVP/成员/僚机不使用。原挑战耐久及人数曲线仍只由原规则拥有，不再另造赏金/挑战输出参数。NPC出生搜索次数由实际船/石外界范围有界计算，末候选需在所有障碍包围圆外；不得固定尝试耗尽后采用失败点，也不以进场瞬移代替安全出生。

R24并行测试追加：asteroidSafeHeading只在原固定步以真实椭圆/陨石接触约束本步角位移，阻止旋转穿石后多石反推累积；不选路线、不改速度/伤害或建立状态/时钟。shipContact的原投影仅负责快速拒绝，GJK/EPA支持点窄相独占弧形船体接触/分离，原Engine负责质量加权、冲量、1m余量及去重伤害；不得重新将五轴外包络作为真实穿透或用瞬移掩盖误差。

R24试玩反馈追加：arena只保留出生/素材场景/镜头尺度职责，不从最终速度扣除边界回推，避免与追击路线抵消。asteroidContact负责真正最近椭圆表面的物理接触，BOSS/僚机出生需净空，enterUntil只限制原入场武器延迟、不得跳过现有导航/避障。陨石由原createAsteroids一次生成20块、扩大范围与间距；Renderer不再画中心靶环。预览海报取最终视频t=0原生帧无损保存，不能另截近似画面；仍由原预览控制器独占播放。

R24追加：普通来弹精准evasion及其冷却已删除。现有AttackRun独占随机交火/近身或受击应变，低于200m、≤10%舰体的一次紧急脱离沿原Engine时钟保留；不得重新叠每发来弹必躲、固定节奏闪避或第二条位移。原有限转速/惯性负责火控，普通弹体出膛后不跟靶。两款卡片仅播放各9秒离线实战集锦，状态仍由game-card-previews单独拥有，不能在卡片里启动模拟或预载视频。

R24最终职责：地形规划原点是稳定船体中心；真实射击另从各炮口做遮挡。不得再把随船头转动的炮口当作移动路线起点。naturalShieldRecovery为自然回盾唯一规则，defense-balance中的连续尺寸曲线独占等待/恢复时长，使用原Engine时间、每次有效受击重置；源数据不回写、换波补给仍只由spawnNextBoss负责。collisions独占船间法向速度/质量损伤，普通擦碰沿用原窗口限额，高能部分一次接触结算、不被擦碰上限吞掉；不另加伤害时钟或死亡分支。

R24覆盖旧R23的资本舰近身extend/coast要求：capitalNavigation只选接近/随机交火航线，不额外按近距离改船头或后退；near安全由原terrain/traffic及实体碰撞负责。已证实额外near/coast与地形放行逐帧交替可抵消速度，不能再加超时强推/瞬移或第二套位移。随机lane属于原AttackRun，按模拟时间持有并平滑换向，不增加动画时钟/逐帧PRNG。

R24追加后，render加载纹理时生成≤256边长CPU alpha mask，并将同一只读mask及center/nose作为weaponHulls交给Engine；sim/weapon-hull独占图像/世界变换和有界网格射线接触，普通弹体及光束真实触及不透明船体才命中，不能在椭圆提前删弹后只挪火花。模拟不读取纹理或采样GPU；无图headless/不可读alpha才回退原几何。换图替换整张只读表，销毁时仅清理自己的表。render/HullImpact独占WeakMap命中锚点与随船变换；船间物理碰撞/导航仍由原负责人负责。CombatVfx与WeaponEffects共用实际投影点、原图集/预算与单ticker。重置/纹理替换/销毁清理锚点和mask；素材不可读时沿用原坐标回退。

R23的地形导航与实际武器判定分离：绕行放行使用带余量的几何通路并保留未完成路径，避免船头/炮口转动引发逐帧换路；实际弹丸/光束仍只碰原陨石。≥100m大船的理想射程是接近上限，普通受击只改变侧向分量，只有实际近身风险才脱离；不继承小目标速度。导航不写伤害或护盾，不加计时判胜/新循环。

R22单一控制顺序：Engine选地形固定世界绕行点或combat course，之后只作一次traffic安全修正，原加速度/实体碰撞执行。绕行不叠同石排斥，已有曲线躲避不叠第二次横移；不保留第二套旧分离/正弦/计时攻击。驾驶炮用实际可用固定武器的弹速提前量；炮台/光束仍属统一观察惯性，不混进移动控制。

R21.1的traffic-avoidance只在原Engine固定步计算预测交会速度，原加速度负责执行；不写伤害、不增加计时器或每帧随机。共同gameplay层另负责按Size统一鱼雷速度，原始武器/舰表不改。导弹外观通过ordnance-artwork优先型号、再同Size查找，共用原图集与精灵池；原图和机器人参考素材分别标明来源。

R21本地新增`fleet-gameplay-balance.json`独占共同武器/碰撞倍率与船长连续舰体折算；`prepareCombatSpecs`只从未折算的BASE生成，先共同层，再登记`fleet-combat-tuning.json`供挑战NPC出生使用。原始事实/安装/喷口/机动保持，普通碰撞倍率在原限额前应用。旧boss-mode-balance仍只属历史平衡profile，不与reference下R21候选叠加；当前参数以OPERATIONS顶部为准。

- `games/ship-battle/src/data/ship-reference-facts.json` 与武器目录/配装表只存带版本和来源的事实、缺项及冲突；离线读取机器人保留的公开资料，运行时不访问机器人或 NAS。
- `simulation-profile.json`是实战档位唯一选择：当前本地reference先采用原作基础值，停用旧数值平衡覆盖；完整状态以OPERATIONS为准。`weapon-stations.json`只读安装记录区分舰首/载人/遥控炮台；不按船长推断。`weapon-fitting-rules.json`负责已确认的炮手互斥。
- `ship-game-balance.json` / `scripts/ship-stat-model.mjs` 是全舰物理换算的唯一负责人；`weapon-size-balance.json` / 共享型号表负责单炮参数。`generate-defense.mjs` 同时生成成员与 BOSS 基础舰型，不按舰名另补血量或输出。
- `boss-mode-balance.json` 只负责平衡档中基础数据生成后的遭遇难度；reference档不应用人数、额外血量/伤害/抗爆发倍率。引擎在出生时应用人数、赏金/挑战系数，不回写基础舰表。来源更新、统一换算与模式调参不可混为一层。
- 挂点元数据以原模型校准基准生成，不能因真实尺寸跨越行为分类阈值而重排；源尺寸与模型冲突保留原值并标记估计。修改数据后必须验证整条导入/生成链幂等，使用独立种子采样，旧参数统计不挪用。

第二款瞄准由 `aim-tracking-rules.json` 和 `sim/turret-tracking.ts.trackAim` 唯一负责观察、速度估计与角惯性。按fireControl区分主驾驶和载人/遥控炮台；所有成员、BOSS、僚机及profile共用炮台规则，无NPC绕过。持续光束沿实际船头，通过同一观察/角惯性驱动船体转向，保持80%原最大转速；普通舰首炮保持船头方向，PDC独立只拦截。紧急横移仍由原evasion map维护：<200米舰体≤10%一次，实际回到>10%再准备，不由UI/波次或回盾重置。结算排行复用冻结的Engine快照与原排行榜，默认收起、点击本局排行才展开；结算画面始终保留。

龙骨炮适配由`weapon-behavior-rules.json`显式记录，生成层只对对应型号换算弹速/最大蓄力；原始武器事实不变。Engine的WeaponCycle独占蓄力、目标归属与单发预算，trackAim复用于舰体瞄准；WeaponEffects仅观察蓄力状态，满蓄力待发继续显示、失去/更换目标重新蓄力。低速短喷焰与高速长带在CombatVfx内连续混合，不更改飞行AI或另起时钟。

第二款主喷口校准由 `engine-layouts.json` 维护：同系列同外观通过 `aliasOf` 共用一个canonical配置；官方/机器人提供的类型数量与当前PNG二维坐标分别记录。人工标注优先，当前布局版本4，49个人工canonical/39条共享别名；标枪8口/北极星4口，其他未确定的投影不叠加通用双喷焰；`engineLayoutVersion`负责独立升级默认缓存，保留用户自定义/手工校准。来源值、缺项同用途估计及游戏适配分层；开始难度/整体伤害平衡前必须先与用户讨论。

VFX-R18由原BattleRenderer ticker唯一推进：CombatVfx负责共用烘焙图集/有限精灵池，TrailHistory维护8点弹体路径，ExhaustTrail最多20个样本维护真实喷口发射方向及速度继承，TrailRibbon按年龄重采样生成40顶点连续曲线，保留不可见端邻点避免换点闪烁。按实际速度与推力延伸、船口短光与路径焰带衔接；WeaponEffects只读取真实弹丸/光束/事件。无第二套动画或伤害时钟，不消费引擎PRNG或改写模拟；更换舰队/重置清空，销毁显式释放图集与MeshGeometry。屏外剔除/预算只影响视觉，不修改弹丸、火力和画质/帧率。CPU实测与局限见OPERATIONS顶部，不能宣称零开销。

地形挡枪由sim/terrain-navigation.ts共用真实陨石交点与目标船体交点，Engine独占稳定绕行侧和射击门禁；已发弹丸/光束继续实际碰撞。停止发射的尾带在CombatVfx.end中脱离喷口、保留世界几何并按唯一模拟时间渐隐，有界分配/重置销毁；导弹鱼雷视觉长度是世界单位的美术适配，不写回来源物理或命中箱。

## 生命周期规则

- `cinematic-homepage.js` 是唯一运行时入口，通过 `window.__gvyCinematicHomepage` 防止重复初始化。
- 每个控制器必须返回 `cleanup()` 或清理函数，并移除自身事件、计时器、动画帧和 Observer。
- `pagehide` 只由总入口处理：`persisted=true` 表示 BFCache 冻结，保留唯一实例；只有真正离开时清理。缓存返回不会重新执行模块，禁止无条件销毁后再加多套恢复补丁。
- 行动视频仅在跨 760px 宽度断点时清理并重绑该控制器的观察器；不监听地址栏高度变化重建全站。
- 桌面行动的阶段、媒体选中与四条进度从同一动画时间线的 `onUpdate` 同步；不能只从 ScrollTrigger 的滚动回调读取仍在追赶的 scrub 时间。边界容许小幅反向余量，进度本身保持连续，不叠加 CSS transform 缓动、自动吸附或独立防抖计时器。
- GSAP 跨 760px 的 matchMedia 事务保存并按需恢复原滚动位置，防旧触发器清理/刷新时丢失位置；不监听普通滚动或手机地址栏高度，清理时移除事务事件。不得强写阶段状态绕过断点问题。
- 大乱斗仅在首次打开弹窗时加载iframe、Matter、名单和军械图片。窗口采用closed/expanded/docked三态：官网按钮打开居中普通弹窗；大窗口关闭/缩小/Escape/点遮罩均转为固定右下浮窗，解除页面滚动锁并继续原iframe对局；只有右下浮窗关闭才卸载src，触发游戏pagehide清理并保存本机增量。浮窗仅裁切/缩放原视口，不缩放物理角色或重建场地。文档隐藏或手动暂停时取消唯一RAF，同时冻结物理、攻击、投射物、掉落物、冷却、撒花和结算时钟；恢复继续原局。无角色pointer/touch控制，也不建立Runner、interval或伤害setTimeout。方向/尺寸变化仅由ResizeObserver缩放现有角色并重建静态碰撞轮廓，不重开对局、不重置血量或战绩。
- 视口高度变化和宽度/方向变化必须区分。手机地址栏的高度变化不得触发全站重新布局或 ScrollTrigger 全量刷新。
- 新增全局 `scroll`、`resize`、`pointer`、`touch` 监听前，必须证明现有负责人无法承载，并增加自动测试。

## 响应式与 CSS

- 基础样式定义默认桌面；`≤980px` 只调整紧凑布局；`≤760px` 是手机行为；2K 16:9 规则只改变节奏；`prefers-reduced-motion` 只负责稳定降级。
- 同一媒体条件不得重复声明同一选择器来修补前一条规则。
- `!important` 只允许用于无动画降级、GSAP 内联样式复位或已记录的手机稳定边界，不能作为普通优先级竞争工具。
- 修复响应式问题应修改原责任规则，禁止在文件末尾追加“最终覆盖”“再修正版”补丁层。

## 媒体与首开

- 首屏即时播放优先级最高，不能通过延迟视频、改成点击播放或降低既定清晰度换取其他指标。
- 首屏控制器同步读取初始位置，不能等待IntersectionObserver回调才首播；随后由同一个Observer在上下各约一屏的rootMargin内保持播放，完全离开此范围才暂停，返回可见区前提前恢复。边距使用初始化视口高度，不为手机地址栏增加resize或滚动监听。document.visibilitychange仍负责后台暂停，清理时解除。暂停保留同一src、播放进度和当前画面；旧play请求因暂停被中断时不能覆盖后续恢复状态。
- 首屏只请求同步选中的一个片源；行动视频只加载当前阶段及既定预热资源；相册继续使用响应式 WebP 和原生懒加载。
- 首屏文件名、缓存版本、控制器和 `config/production-media.json` 必须由测试保持一致。
- 媒体使用版本化文件名和长缓存；替换内容时必须换文件名或缓存版本，禁止覆盖同 URL 后要求人工清缓存。被替换的行动片原文件通过production-media中的compatibilityOperationAssets明确保留进dist，保证已打开页面及旧缓存继续读取同一字节；不改变新页面的选片清单，也不能在下次部署时顺手删除这些旧URL。
- 视频编码是授权后的离线素材制作步骤，不加入构建、刷新或定时任务；不得把已压缩候选继续作为原片反复转码。保留原始现役素材，逐段核对分辨率、SAR、帧数、帧率、色彩和时长。采用前须完整帧测量并审看原尺寸画面，VMAF/SSIM只支持视觉判断，不能称为数学无损；不达标或减重不足时保留原片。MP4必须保持moov在mdat之前以便边下载边播。
- JS/CSS 与本地大乱斗文档由 `scripts/fingerprint-assets.mjs` 在构建时递归写入内容指纹 URL，`check:dist` 校验每个引用与实际文件相符。源码不再手工维护日期版本；不修改首屏 inline bootstrap 的 CSP 字节或媒体 URL。
- `stalled`/`waiting` 是临时下载/缓冲状态，不能把仍在播放的视频改为海报；确定 media error 或播放拒绝仍使用原海报回退。
- 播放性能探针只存在于E2E测试中：区分首播等待与开始播放后的rebuffer，并记录实际解码首帧、媒体缓存来源及解码/丢帧。开发预览服务提供Range/ETag和当前浏览器缓存规则；本地结果不能冒充公网或EdgeOne缓存命中。

## 相册发布边界

- 相册位置、节点选择和手动暂停仍只归archive-carousel管理。节点点击/键盘及照片拖动后的吸附共用原RAF中的一次可取消导航，最后一次输入优先；不再使用变暗后跳转的两段定时器。手动选图或实际横拖后保持暂停，只有播放按钮恢复自动前进；轻触按住仅临时暂停。
- 节点条横拖只浏览节点，点击才选照片；手机节点条保留原生横滚与页面纵滚，不用第二套touchmove修改scrollLeft。节点触控命中区固定44px，活动标记只在内部变化，当前/总数由同一选择状态更新。原全局pointerup/cancel路由统一结束照片和节点手势，lostcapture/blur/visibility清理残留捕获；灯箱只消费合法短点击。
- 正式双域相册是校准权威，本地运行记录不是权威。
- 只允许 `index.html` 受管理相册区和本批 `assets/gallery/` 文件变化。
- 预览、暂存、提交三个阶段都必须重新校验路径白名单和精确变更集合。
- 非相册文件变化、分支不为 `main`、本地与远端不一致或两个正式域不同步时必须失败关闭。
- 回退和失败恢复共用 `preview-state.mjs` 的 HEAD/内容快照检查；先核对全部文件和备份再写，发现预览后的改动即保留现场并停止覆盖。旧会话没有快照时不能猜测安全。
- 删除相册条目时保留其他首页区域仍引用的图片；发布确认解析相册的实际顺序、身份与内容，不依赖旧数量文案。测试使用独立样本，不依赖正式站保留某一张照片。

## RSI成员的无人值守刷新

- 每周一04:43（上海时间）一次，另可手动运行同一工作流；普通构建/访客访问不抓取RSI。公开成员页为权威，完整分页、总数与唯一handle必须一致。隐藏成员不猜测身份；空名单、截断、异常减少超过50%或头像失败均保留旧快照并报错。
- 昵称、handle、头衔、主组织/附属关系及头像均取当前公开源。头像按URL去重并使用条件GET复核实际内容，即使URL未改也能采用新字节；内容SHA命名，本地托管，保留脱离现役的旧头像至少90天，随真实名单变更清理。无变化不写生产文件，也不提交/部署main。
- 自动更新仅允许`assets/js/fleet-members.js`、`config/rsi-member-source.json`和受约束的`assets/member-avatars/<SHA>.<扩展>`。候选分支显式dispatch原Verify；准确候选SHA上的两项原检查成功且main仍为原基线，再把真实结果/原job链接登记为同名commit status（GitHub不把workflow_dispatch job检查计入保护），由既有保护规则校验后普通快进推送main。并发改动、CI失败、超时均停止，不修改保护、不使用PAT、不强推。
- 自动更新后核对双域普通首页、实际大乱斗文档、指纹快照和所有现役头像的完整SHA。初始接入快照的`bootstrap`标记在首次云端成功读取后删除，用于验收真实候选检查→发布链路；不会伪造成员或改动玩家对局。
- 内部`automation/rsi-members-state`分支只记录一次周检状态，保持该分支源代码树不变；真实状态提交维持仓库活动，避免长期main无变化导致公开仓库60天停用schedule。该分支不发布生产。原Production Monitor只读检查状态，失败或超过10天未成功均走既有事故流程；不另建轮询/通知任务。
- 页面用随部署指纹更新的本地快照，已打开的对局保持原名单，刷新官网后采用新版；不在战斗中重建。本地游戏升级不修改每周同步或发布工作流。

## 离线自动竞技场

- 默认随机巡回，用洗牌袋轮换个人淘汰、团队淘汰、限时击杀赛；每组三种不重复。无尽混战单独置于最后，不进巡回。武器默认随机；切换模式保留当前配装选择。个人淘汰补完原3.2隐藏且未实现的Deathmatch设计，限时击杀赛和巡回为网站扩展。
- 个人淘汰最后一人获胜；团队淘汰双方在场+预备队参与全灭判断，胜队所有成员计胜，双方同时全灭为平局；两者不设60秒截止。限时击杀赛45秒，阵亡者回候场队列，期满决胜；Classic无尽混战持续回收队列，不自动结束。结果为8秒可暂停倒数及同RAF撒花。fast/slow只影响战斗速度，不改变限时赛45秒墙钟时长和结果8秒。上限64角色、96投射物、100粒子、8掉落物；更大名单按下一轮轮换。撒花72片/手机40片，不新增独立循环或计时器。
- 参考包通过REA确认Unity/IL2CPP制品；100HP、速度阈值碰撞伤害/上限下限/1%暴击、部分AI和限时规则、七场景参数来自独立Unity序列化与LLVM调用映射分析。Windows原作未运行，原生Ghidra两次600秒超时；不能表述为完整C#恢复或逐帧一致。Matter/CSS单位转换、Matter关节/渲染适配、自动巡回和64人限制为浏览器适配。技术证据与边界见OPERATIONS。
- 界面使用原官网黑金、正式logo、白圈头像、11px基准无框彩色名字与原武器遮挡层级。命中通过实际接触/扫掠且要求物品Active、世界AABB伤害区合格、相对线速度达到武器阈值；只认Enter，不在持续接触时循环扣血。同一目标对同一具体物品300ms保护，不同武器独立；无全局260ms或出生无敌，无全武器×.46/30封顶。物理伤害按各武器原阈值/倍率/上下限/1%暴击。友伤30%，爆炸attacker/source为空、影响所有阵营，不给原投手计杀。击杀按本次致死attacker归因，无8秒回溯；回血按life kill/divider，每7杀重置。额外击退使用原径向力，不再固定向上踢或随机旋转。
- 开战后桌面标题、战况和操作合并为以56逻辑像素为基准的工具栏，手机为54px标题加48px操作栏；战绩收为展开按钮，底栏退出文档流，把空间留给战场。设置页保留完整规则选择；不得为了缩短界面缩小44px按钮或用整体缩放降低可读性。
- 名称按用户最终截图采用无底色、无边框的彩色文字，以11px字号、轻描边和头像上方5px间距为基准，随实际窗口等比放大。用户明确要求保留武器对名称的自然遮挡，名称继续作为角色子节点，不提升层级或新增文字层。
- 地图始终有全宽实心底边，地形保留Unity原XY及Y=0，不把每张图最低点重新归零。按原相机尺度和实际战场纵横比使用统一等比映射；所有头像、手、武器和地形共用sceneUnit；Classic/本地Royale按本轮初始人数N使用clamp(6+N/15,6,14)，Team为9。人数在开局固定，死亡不改变视野；窄窗裁切远端地形保持武器可辨，宽/矮窗受高度约束，不拉伸箱体或平台。生成场地按相机/6生成点数与幅度并恢复固定长度Bezier切线；固定01/02保留原折角。采样最多256点，绘制与凸条带碰撞共用同一轮廓，并裁剪到底线，避免负端点产生自交多边形和质心偏移。resize会保留贴地间距，避免嵌入新地形；可见暂停窗口也立即更新几何，不推进模拟时钟。
- 战斗中打开战绩时，在场地左上角显示无底色、无边框、点击穿透的紧凑前五名；文字阴影保证可读，保留淘汰/阵亡列，不占布局高度。手机打开排行时暂隐藏同区域的击杀播报，避免叠字。原战绩按钮控制展开，准备界面保留本局完整前十及本浏览器累计战绩；复用既有HUD更新，不新增逻辑循环或远程请求。
- 随机队战先平地；45%概率9/27箱阵、12–19秒后地形，事件保留原已核配置，上限36箱/8区域。Classic首地形90–144秒、显示33–62秒、回平地140–259秒再出现；个人淘汰/限时赛随机地形立即可见。绘制与碰撞共享等比轮廓，跨Matter区域/投放为单位适配，不宣称Unity逐帧一致。
- 战绩仅保存在当前浏览器，按RSI handle归并更名、限制500条及有界去重记录。存储不可用时退化为内存，不阻塞战斗。没有聊天、Twitch、登录、WebSocket、XHR或浏览器抓取RSI。

## 变更门禁

1. 验证干净基线，建立可恢复回滚点。
2. 确认问题的唯一负责人，优先修改原逻辑，不新增旁路。
3. 先补失败用例或契约，再做最小实现。
4. 执行 `npm run verify`、`npm run test:e2e`、`git diff --check`。
5. 对桌面、390×844 手机和受影响的大屏断点进行渲染检查，控制台不得有未解释的 warning/error。
6. 用户明确要求部署后才推送；部署后运行 `npm run monitor:production` 与媒体检查。

禁止以空提交、强推、清缓存、删除测试、放宽白名单或额外 CSS/JavaScript 覆盖层来“让结果看起来通过”。

## 参考武器的浏览器重建

- `member-arena-weapon-profile.js` 是唯一现役兵器几何/动作配置：21份原作无损WebP共81,322字节、原sprite比例、握点/碰撞器/质量/PID、各类投射物独立伤害和骷髅击杀标记。原14份科幻生成图和提示词已移到仓库外退役证据，不进入构建。
- `member-arena-motion.js` 提供PID、路径、坐标和凸分解，`member-arena-actions.js` 按秒采样原CatmullRom/延迟/回位与弓蓄力；`member-arena-rig.js` 连接真实身体、旋转载体、滑动拳和实体武器。固定控制时钟50Hz；Matter每次分为两个10ms内部求解，render单独插值。Matter没有原Box2D滑动电机，软约束/扭矩阻尼/越界投影是显式跨引擎校准，不声称Unity逐帧一致。
- 近战/拳出手首次等待1秒，人格一次U(1,2.9)乘[.175,.55]，近战C=P+W+动画getter，弓/Thrower C=.525+W+U(.75,1.5)，与动画同时计时。整件武器抛出仅P冷却、.55秒解绑，同body角速度×.45，Active恢复、owner为空；.2秒后可伤原投手，拾回同body时移交归属。弓保留.525秒真实蓄力和质量.75/冲量pull×30。法球/炸弹先固定手中，再解绑同body继承速度，爆炸独立按距离伤害和径向击退，不重复叠加通用击退。复杂箭附着/拔出未完整移植。
- 普通已装备武器的原遮挡mask4352仅含身体12、箱8和炸弹/治疗弹8，保留自身/目标，每源collider计1；原始命中≥3则.3秒重试。地形0、边界13、武器6、实体拳0、箭/法球7不加入此query。拳和抛整件武器绕过检测。射程=1.2+itemReach+身体速度世界值×.25，并要求严格大于目标距离。
- 红蓝两队各按初始队大小<12全入场、12–27取floor(n/3)、≥28取floor(n/4)，其余保留DOM但不创建物理手/武器。首次增援等22–37秒，落后方每批2–7人，分侧检查且同一有界时钟推进。为短局增加双方均空时匹配放出预备成员的兜底，避免空场；此项为网页适配。工具栏明确显示预备人数。
- 血条旁显示本次出场和当前浏览器累计的骷髅击杀数；0隐藏，出场击杀死亡后归零，累计按原handle存储。脉冲同RAF可暂停，保留11px基准无框名称和自然武器遮挡；没有新的角色控制、网络请求或常驻计时器。

- 限时击杀赛期满使用Rules.compareMatchScore/rankMatch/classicWinners：击杀多优先，同击杀阵亡少优先，两项相同并列，无淘汰为平局。排行与结算共用规则，不以HP/名单顺序暗选冠军；冻结赛果后增量记账，每个并列者记一次胜局，周期保存不重复增加场次。无尽Classic无冠军结算。

### Arena feedback lifecycle

`member-arena-feedback.js` is loaded only by the lazily opened arena document. It owns no RAF, timer, physics body, network request or combat random source. The existing render loop samples 75ms melee / 175ms projectile trails from measured source child anchors and the real active weapon pose; a single 2D canvas reuses at most 512 trail segments and 96 portrait fragments, capped at two million backing pixels. Damage feedback moves only the avatar visual, not the physical body, hand, weapon, label or HP. Health front/tail transforms use simulation time with native damage/heal durations; retargeting replaces the visible sequence. Pause/background freezes all feedback, resize discards old trail connections, restart/settings/unload remove the surface and portrait references. Reduced motion allocates no drawing surface and settles health immediately.

- 控制链：动画路径和武器瞄准每固定更新使用同一实时目标，动画期间只冻结inverse；目标消失保留最近位置。旋转从Unity武器root对应的sprite origin计算，不能误用Matter compound COM。拳的滑动关节角度跟随arm，取消网页额外fistPID。两次10ms求解均保留50Hz控制力/力矩，避免第二半步被Matter清零。原PID增益和误差上限保留，Matter关节/惯量/转矩校准仍是已知适配，不把gain20、加速度限幅或自定义rail惯量描述为原作代码。
- AI探敌U(1.35,2.35)秒，移动U(1.72,2.65)秒；持武器跳跃、拳92.5%跳跃/7.5%移动动画。跳跃.8秒施力、.975秒解锁，无grounded门；新生重建人格。Classic默认源配置可回收开关在网站选择true，候场按原加权批次和间隔入场，不用固定2.6秒个人复活。候场/预备不参与物理；body线阻尼0/角阻尼.05。

- 飞行物保存发射时的life/team；成员回收复用DOM时递增life并重建碰撞组。旧生命的箭仍给成员累计击杀，但不为新生命回血/增加连杀，也不永久忽略新生命的碰撞。

- 事件外观复用原节点/碰撞和战斗时钟：黑洞有界吸积盘与核心、货箱金属结构/短受击边光、医疗补给十字/治疗区域、跃升标识；最多36箱/8区域，不新建RAF、定时器或粒子系统。低动态固定旋转/脉冲。暴击只在原1%实际计算且通过伤害门禁时提示；回血只显示上限截断后的真实HP增量，16个canvas文字槽合并同一生命短间隔回血、到期回收。独立格挡未证实，不误报物理碰撞为成功格挡。文字提示与事件新外观是用户要求的网页增强，不冒充原包既有提示。

- 角色位置和头像转动/受击/挤压直接写入各自transform，避免逐帧CSS变量继承到名称、手、武器和血条。击杀/事件播报最多4条，显示3.2秒后随模拟时钟淡出1.8秒，设置/重赛清空；没有独立计时器。准备页的简短下拉名称与规则说明独立于对局配置，选项顺序、默认随机配装和玩法不变；桌面原生base-select渐进增强，触屏沿用系统选择器。

- 用户最终取消帧数限制，render恢复每次浏览器RAF绘制；无按卡顿、人数或硬件的pacer、固定30/60档位、rendering状态字段或新设置。50Hz模拟仍独立于浏览器绘制刷新率，原单RAF、暂停/后台冻结和效果预算不变。

R18.5补充：主推进启停由render/ExhaustTrail.mainExhaustActive按实际速度/前后向量及回差控制，不依赖UI/新时钟；按时间间隔的有限斜率Hermite负责尾迹曲线，避免过冲。weapon-fitting-rules可记录用户确认的activeCount/control/anchor及单舰combatVersion，生成器校验原安装排除数与活动数；当前仅Perseus2门pilot S3的明确覆盖，原source安装记录不重写，其他舰不跟随升级。
