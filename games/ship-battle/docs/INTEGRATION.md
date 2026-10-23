# 交给官网 Codex 的接入接口

本次只提供独立游戏。不要用本 Worktree 的旧首页覆盖官网正在开发的版本，也不要替换第一款游戏或公共弹窗。本分支仅新增 `games/ship-battle/`；官网方可只取这一目录或对应提交，再自行修改游戏选择界面及官网构建流水线。

## 构建与目录契约

```sh
npm --prefix games/ship-battle ci
npm --prefix games/ship-battle run build
```

输出：`games/ship-battle/dist/`。把里面的 `index.html`、`favicon.svg`、`embed-example.html`、`popup-preview.html` 与整个 `assets/` 复制到官网发布目录的 `games/ship-battle/`。不要覆盖官网根 `index.html`。

- 独立路径：`/games/ship-battle/`
- 弹窗路径：`/games/ship-battle/?embed=1`
- 同源演示：`/games/ship-battle/embed-example.html`
- 无后端、外部 CDN、API key、运行时第三方字体或跨域图片请求。
- 必须用 HTTP(S) 服务器，不能直接双击 `file://` 运行。
- 根路径和刷新均由 `index.html` 加载；不需要修改官网现有路由或配置单页应用通配回退。

## iframe

```html
<iframe
  id="ship-battle"
  src="/games/ship-battle/?embed=1"
  title="星际飞船大乱斗"
  allow="fullscreen"
  style="display:block;width:100%;height:100%;border:0"
></iframe>
```

只读检查了官网现有弹窗：常规 960×600、大屏最高约 2640×1584，以及 340×212 停靠预览。新游戏按 iframe 实际视口响应，已检查 4K、2K、1080p、上述弹窗与手机。战场占满可用宽度，成员榜透明悬浮右侧，工具栏按视口宽高重排。340×212 是紧凑预览，展开弹窗后更适合操作。建议常规弹窗至少 960×600，手机使用全部可用视口。`?embed=1` 会为父弹窗右上关闭/最小化按钮预留空间，不要求修改公共组件。若官网有 `sandbox` 策略，游戏需要 `allow-scripts allow-same-origin allow-downloads`；同源且可信的本模块不要求 sandbox。全屏需要父页面权限与 `allow="fullscreen"`。

未来官网底部打开游戏选择界面，再分别进入成员游戏和飞船游戏。此选择界面由官网任务实现，本模块未提前添加。

## 通信协议 v1

仅接受 `event.origin === location.origin` 且 `event.source === window.parent` 的命令。父页面也应检查来源与 iframe 的 `contentWindow`。发送目标必须为 `location.origin`，不用 `*`。

父 → 子：

```js
const frame = document.querySelector('#ship-battle');
function shipCommand(command, value) {
  frame.contentWindow.postMessage({
    source: 'gvy.ship-battle', version: 1,
    type: 'command', command,
    ...(value === undefined ? {} : { value })
  }, location.origin);
}

// 弹窗关闭/切换游戏时暂停；重新显示时可继续。
shipCommand('pause');
shipCommand('resume');
shipCommand('reset');
shipCommand('set-speed', 2); // 只接受 1 / 2 / 4
shipCommand('set-mode', 'bounty'); // bounty / brawl / challenge / teams / random
```

开始战斗由玩家在游戏内点击。`reset` 保留模式、当前成员与舰船分配并回到待命状态，不清除图库或编队。重复的 pause/resume 是幂等的；非法命令和速度被忽略。父页面隐藏弹窗不一定触发子页面的 `document.hidden`，因此应主动发送 pause。

子 → 父：

```js
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message?.source !== 'gvy.ship-battle' || message.version !== 1) return;
  if (message.type === 'ready') console.log('资源就绪', message.payload);
  if (message.type === 'state') console.log('战况', message.payload);
  if (message.type === 'result') console.log('胜者', message.payload);
});
```

| 事件 | payload |
| --- | --- |
| `ready` | `{ path, ships: 224, memberPool: 217, assets: 224, members: 32, modes: ["bounty","brawl","challenge","teams"], defaultModePolicy: "random", protocol: 1 }` |
| `state` | `{ phase, mode, outcome, wave, waves, alive, total, time, destroyed, memberAlive, memberTotal, redAlive, blueAlive, collisionDeaths, bossAlive, escortsAlive }`，时间取整到秒，状态或秒数变化时发送 |
| `result` | `{ mode, outcome, wave, memberAlive, redAlive, blueAlive, collisionDeaths, winner, standings, duration, total }`，每局仅一次 |

phase 为 `ready` / `running` / `paused` / `finished`。时间、速度、生命值与护盾均由子页面持有，不需要官网共享组件或全局变量。

## 素材与数据交接

`public/assets/ships/manifest.json` 是公开图库，`src/data/ships.json` 是舰船及战斗参数。所有图片加载使用 Vite BASE_URL，对同源子路径有效。用户导入的图片和校准值仅存在当前浏览器 IndexedDB，**不会自动进入部署包**；需要在素材管理器导出 JSON 素材包，或将审核后的图和配置写入公开清单后重新构建。

来源记录保留在 README、`docs/STARJUMP.md` 与 `docs/starjump-sources.json`。2026-10-23 按用户要求移除游戏底部的来源文字和素材说明入口，不要自行恢复到游戏画面。非商业使用要求和第三方授权现状见 `STARJUMP.md`；精确挂点核对仍是待办，不应在官网宣称已做到实机级数据复原。

## 官网成员名单接口

内置 32 人快照只是独立试玩数据，正式接入可以在收到 `ready` 后传官网最新成员数组。成员每人一船，从217 个成员舰型条目中等概率抽签，舰船上显示 `name` 原文。`handle` 必须唯一；2–100 人；名字和 handle 最长 80 字符；头像必须是 HTTP(S) 同源地址。建议传绝对 URL，防止相对路径按 iframe 所在目录解析。

```js
frame.contentWindow.postMessage({
  source: 'gvy.ship-battle', version: 1, type: 'command',
  command: 'set-members',
  members: window.__gvyFleetRoster.members.map(member => ({
    handle: member.handle,
    name: member.name,
    avatar: new URL(member.avatar, document.baseURI).href
  }))
}, location.origin);
```

传入成功后重置当前局并随机分配，子页面回复 `members-accepted: { count }`；非法名单回复 `error: { message }`，保持原名单。它不改写原成员对象，也不读写第一款游戏战绩。父页面不要在每次 state 事件重复传名单，否则会重置战斗。

`result.payload.standings` 是按击杀降序排列的全体参战者，每行含 `member: {handle,name,avatar}`、`specId`、`shipName`、`kills`、`alive`。成员大乱斗的获胜者由最后一艘存活船确定，可能不是击杀榜第一。合作模式成功时 `outcome: "players"`、`winner: null`，请显示舰队胜利；失败时 `outcome: "boss"`，winner 可能是 NPC。

## BOSS 与统计约定

准备阶段只创建成员，`alive/total` 初始为成员数。赏金模式开始后加入随机 BOSS，再于第 1.5 秒起（内部模拟第 2 秒）分批加入 20 艘僚机，所以 `total` 随入场增加；最多 100 名成员 +21 敌船。挑战每轮一艘 BOSS，历史击毁单位保留在总统计内，wave 为当前 1–5 轮。成员大乱斗无 NPC。

`standings` 含已入场的所有单位，官网只展示成员时过滤 `!row.npc`；npc 为 `boss` / `escort`，NPC 没有 member 头像。合作成员互不寻敌或友伤；敌方舰队也不互伤。赏金击毁 BOSS 即胜利，僚机不必清完；挑战最后一艘 BOSS 被击毁后胜利。

当前 BOSS 的防御和输出与模式、开局人数有关。赏金采用 32 人基准并有独立防御/输出系数，复仇没有额外双倍舰体；挑战采用每轮固定火力预算与单独输出系数，避免连续五关按单次赏金的难度累乘。不要在父页面硬编码血量或胜利条件。完整规则见 BALANCE.md。

焦点默认开启，开战前全景、交火后自动观战；滚轮/拖动会关闭焦点。父页面不需要实现镜头逻辑。所有布局、模拟与镜头都位于 iframe 内；本次未写入官网或第一款游戏。

## 官网窗口约定与实测

2026-10-21 只读打开线上弹窗、收起与恢复，并检查官网 JS/CSS：常规外框 960×600、内部 958×598；大屏外框最大 2640×1584，受 70vw/78dvh 约束；短屏使用视口减 32px。手机常规 iframe 可能只有 292px 内宽，已处理。

缩到右下角时，官网保留展开时 iframe 的宽高，仅在父级 transform 和裁切。游戏暴露 `.arena-stage`（与 `.battlefield` 同一元素），现有裁切查询可找到战场。`?embed=1` 为父页右上两个 44 单位窗口按钮留位。滚轮使用 iframe 的逻辑坐标，世界缩放范围不随预览 CSS scale 改变。

`popup-preview.html` 在本模块自己的 public 目录中模拟这些约定；不替换官网组件。收起可继续本局，恢复不重置；若官网希望暂停，使用已有 pause/resume 命令。切换游戏或关闭时应 pause 或卸载 iframe。

通信仍为 v1。`state.time`、`result.duration` 和击杀时间是当前 1×显示秒数；引擎内部秒数乘 0.75 得到显示秒数。约 5 秒导播使用现实时间。素材管理普通入口已删除，开发校准地址为 `/games/ship-battle/?assets=1`。


## 团队与环境结果

`set-mode: teams` 切换红蓝模式并回到待命，成员按名单交替分队，随机舰型仍等概率抽取。`state` 额外含 `redAlive` / `blueAlive` / `collisionDeaths`，`result` 也含这三项。团队胜负 `outcome: red|blue|draw`，`winner:null`；不要把团队获胜当个人榜第一获胜。基础 `standings` 行不带 team 字段；若父页只需展示两队结果直接使用 outcome 与存活数，若未来要整队名单，应另加可选字段并做兼容测试。

四种模式均含不同大小的陨石；环境死亡计入 destroyed，但不计入玩家 kills。`recentKills` 位于游戏内部快照，陨石击毁的 killerName 为「陨石撞击」。父页不要用击杀总和等于击毁数作为通用校验。

接入前请先读完整外部 AI 交接文档、TESTING.md 与 ASSET-AUDIT.md。更新时一并替换 index.html、哈希 JS/CSS、素材清单与图片目录；避免旧缓存使图片挂点和脚本版本混用。建议 HTML/manifest 不长缓存，带哈希 JS/CSS 可长期缓存。不要清除官网其他游戏的存储。

默认快照的 result/standings 中头像可能是相对于游戏目录的路径；父页若展示头像，请用 `new URL(row.member.avatar, frame.src).href`。父页传入名单时推荐绝对同源 URL，避免默认相对路径被官网根目录误解。空头像地址会拒绝接收。


## 2026-10-23 BOSS 人数难度与工具栏

赏金猎人和挑战模式以开局阵容锁定难度。32 人保留原基准，护盾、舰体与护盾恢复按人数 / 32 缩放，武器伤害按 sqrt(人数 / 32) 缓慢增长。挑战模式保留各关预算与阵容火力估算，但全程使用开局阵容，不再根据存活人数降低后续关难度。人数不含 BOSS/僚机；重置后重新锁定。普通成员、僚机数值和原受击保护保持原规则。

顶部搜索、参战成员和排行保持右上位置，根据完整文字的实际宽度依次收起排行文字、成员文字、搜索框；搜索占位文字不截断。统计确实无法并排时才换行，并保留 6px 恢复余量。
