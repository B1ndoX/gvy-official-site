# STARJUMP 素材与 REA 证据

2026-10-21，按用户要求使用 REA 处理 STARJUMP 图片；在用户后续明确允许非商业打包后，将公开 PNG 接入独立本地工程。未登录、绕过认证或获取账号内容，未修改官网。

## 实际取得

- 入口 https://www.starjumpfleetviewer.com/ 当前跳转至 https://hangar.link/ 。
- 已发布 Flutter Web 客户端：`/releases/20260929083919-746fcbb/main.dart.js`，SHA-256 `56fa4bf7ba5d81bbdbd5c1a86af6a4d0d32e64e91cf38e4e6d930f9322224c91`。
- 公共清单 https://hangar.link/ships.json ，315 个舰型分组，快照 `21221c52-be9d-4ffc-ac64-3a830df6ba70`，名为 `Ships284`，创建于 2026-10-17。清单名称与实际分组数不同，以实际记录为准。
- 清单 SHA-256 `6eb95f9cd8cce2ee225ca63fa7ed1d5a046587004435c60d73b1059782b39943`，REA 实际 GET 为 200，响应为 JSON，记录了完整 1,024,546 字节。
- 客户端的图片映射包含 top_s / top_l / 部分 top_xl 等视角档位，通过舰型 slug、变体 slug、档位和 hash 组成 CDN PNG 地址。实际使用 12 张 top_s（宽 1000px）和 148 张 top_xs（宽 500px），合计 160 种，原始图片共 37,280,032 字节。仅在参战时按需加载所分配舰型，避免一开始解码整个图库。
- 每张图从 REA 受控浏览器网络捕获的二进制响应直接提取，SHA-256 与尺寸均经过自动测试。不是截图截取，也不是 AI 重新生成。

## REA 记录

| Evidence ID | 范围与限制 |
| --- | --- |
| `ev_8c06b44c5becfa7f94bd706bda3ec5ef07c12ee335c0c07bdcbbc44a3ec2e972` | 完整发布包静态分析，45 秒达到资源时间限制；保留部分解析结果，不能宣称全站代码已分析完整。 |
| `ev_89430ca8062a014fbcce1eaf6d8686bd261060012174af17776644bbf430c1da` | 对真实公共 ships.json 的受控浏览器 GET，200 与完整响应字节均已记录。 |
| `ev_f491e4acb4ce1f95f9b7505879040cc830242e05d39f79fea57cb16007f1cef2` | 12 张真实图片的 GET、200 与二进制响应；REA 完成捕获，因 MCP 展示预算较小而导出完整证据到本地再提取，没有重新猜测或替换图片。 |
| `ev_1ae512babb9885bd7b7ad2bdf4c02826ebd3c5d45f659bf8a10d23522ed7c3cb` | 扩展 148 张透明 PNG 的真实 GET 200、响应字节及 SHA-256；完整证据经本地导出提取，全部校验通过。 |
| `ev_d546eb652f66f6e2906630de1d90deefc742f76a3890e0ee73d04eb925a7d0df` | 本地 12 图核对页截图，用于核对名称、朝向、外形；不是第三方站点行为证据。 |

本次原始 REA 导出位于 `/tmp/gvy-ship-research/starjump-evidence-sprites.json` 、`starjump-evidence-gallery.json` 和 `starjump-evidence-expanded.json`，属于临时分析文件。持久可交付的逐图 URL、PNG 尺寸、SHA-256 和网络事务号保存在本目录 `starjump-sources.json`；原始 PNG 已在 public 中。

## 校准状态

首批 160 张按原始俯视图核对，舰首朝左，`noseDegrees=-90`；相对于引擎朝右的 world heading，精灵转角为 `heading + π/2 - noseDegrees`。图片不拉伸，横向原图宽映射长度，另一维依比例计算。世界坐标以米为单位，Javelin 480 m 和 Arrow 16 m 的长度比为 30:1。

本轮舰型变体明确：Hornet 是 **F7C Hornet Mk II / f7c-mkii**；Vanguard 是 Warden；Constellation 是 Andromeda；Idris 是 P。不会把 Mk I、其他改型或不同船涂装误标成目标舰。

首批 12 型喷口与炮塔是按图目测的初步位置；扩展 148 型是按尺寸分级的模拟模板，**仍待精确核对**。图库没有提供可以直接等同实机三维武器挂点的字段。界面提供可点击校准、独立炮塔朝向与射界编辑，全部初始 `calibrated:false`。展示长度来自公共图库快照，仍可能与最新实机版本不同；没有宣称已匹配最新官方平衡表。

## 权利与用途记录

舰船原始 IP 属 Cloud Imperium Games，具体渲染图来源为 STARJUMP。公开可下载、`official:true` 字段、非商业用途及技术捕获成功，都不单独证明图片可自由再发布。未查到对本项目明确适用的 STARJUMP 渲染图库再发布许可。

本轮根据用户在本会话明确允许非商业打包的要求纳入素材，状态统一记录为 `user-directed-noncommercial`，没有误标成 CC0、原创或已获作者正式许可。保留来源并不替代许可。后续可记录获得的许可或通过图库工具替换图片，不需要重新开发游戏。

其他素材：星云为内置 Image Gen 原创背景；两份参考项目源码和商业游戏美术未纳入本工程。依赖库许可证随 npm 包提供。

## 完整目录与当前战斗池

已通过 REA 取得 315 个公开分组的全部默认俯视 PNG，以及完整 JSON（391 个变体的元数据）。完整元数据保存在 starjump-full-catalog.json；默认图、名称 CSV、原始 JSON 与哈希清单另存 `/Users/bindox/Downloads/StarJump_Full_Catalog_315/`。此处“完整图片”指每分组默认变体俯视图，没有另外批量下载 391 个变体的所有涂装与各视角。

追加证据：`ev_16b708439cd57059ea84f63ed9b1a97338c32cb8fc5a7ce7850467d9cb866c46`（孟加拉与奥丁武装图），`ev_1bbb30517df6002135598ddda9a2c293b923cc3e09be1c12f0dee3a1e7023455`（补齐其余 153 项默认图）。315 个分组均有真实 GET 200、PNG 字节与 SHA-256 记录；完整 REA 导出在临时研究目录 starjump-evidence-full.json。

战斗图库使用 224 条：217 个可抽签成员舰型/改型/涂装条目、5 型 BOSS、2 个暂缓条目（Endeavor Master Set 与 Syulen）。地面车、悬浮摩托、模块、道具、特效、角色、站点、愚人节与 fan-concept 条目不进入游戏；奥丁武装/未武装展示变体采用 canonical Odin 归并。不是把目录 `fake` 字段直接当作“虚构舰船”：Bengal、Retribution、Pegasus 虽被原站标记为 true，仍纳入真实舰型。分类记录见 catalog-classification.json。

王船 Kingship 确实是 CIG 世界观舰型，但当前公开清单 315 分组及全部 391 变体中均未找到其名称或对应素材。因此这里只能断言本快照未收录，不能声称 STARJUMP 的全部历史或非公开素材都没有。用户随后取消王船，目前没有用替代图冒充它。

首批独立 160 图副本仍保留在 `/Users/bindox/Downloads/StarCitizen_STARJUMP_160_PNG/`；它们均带透明通道，附名称、来源、尺寸与 SHA-256 对照表。原 160 文件中有 156 组不同图片字节，部分任务改型共用原站同一图，不伪造差异。所有飞船与 BOSS 均使用图库正常尺寸比例；此前拳手 1.45× 及后续 2× 放大均已撤销。


## 环境素材与本轮参考捕获

已从完整目录的默认图副本接入 `asteroid`，500×406 透明 PNG，原始 SHA-256 `bf56e718a5ed45a5b29e85e5f5c0d8dcf0eabb303dc3c8bde75204544eeed201`。来源、哈希与证据保存在 `public/assets/environment/manifest.json`，使用上述完整目录的 `ev_1bbb30517df6002135598ddda9a2c293b923cc3e09be1c12f0dee3a1e7023455`。该图不加入舰船 224 条计数。`asteroid-field` 是多物体场景图，未拿来做单体碰撞；`meteor` 是战斗机名称，不是陨石。

按用户要求再次用 REA 捕获 Battle Starfleet 移动源码（证据 `ev_ee674363575eb197efdc743ef4b97b578c95e5e5269031c9aa925a580eeee4ec`）、Star Wars Simulator 公开源码（`ev_8b83e60db669ee7e36e18293ea4b1963163d2bbbd77c8812fbd8eded96b17f68`）及本地只读副本运行（`ev_d4312bd9b650c9091ca38e547eb96444a8f5c6d7de290092b02830bca1c64010`）。研究结论是固定步长、分离模拟与渲染、前向推进/转向惯性、预测弹道和避障适合网页；Unity 引擎代码不移植，未明确授权的网页源码只参考思路，不直接复制。
