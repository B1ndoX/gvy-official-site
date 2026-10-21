# GVY arena artwork

The restored weapon profile uses the original IntroFighters 3.2 transparent sprites, their original aspect ratios and measured grip geometry. RSI portraits remain the website's local member snapshot. The original holding hand and unarmed fist are separate images; the hand is a foreground layer over the weapon grip. No generated repaint or synthesized technology gun replaces the original weapon silhouette.

The data entry point is [member-arena-weapon-profile.js](../assets/js/member-arena-weapon-profile.js), exposed as `globalThis.GVYArenaWeaponProfile`. This is an inert, deeply frozen local data object: it performs no fetch, polling, storage access or animation. The arena consumes this profile through its fixed-clock action controller and physical hand/weapon rig.

## Source and geometry

Source: [IntroFighters by Lexone](https://lexone.itch.io/introfighters), official `IntroFighters_3_2.zip` release. Package SHA256:

`0d943e7e9d5194f5ed994f97ca121438a8cc41ea1639a6743505ee222fe56c1c`

The Sprite, texture, prefab, collider and serialized animation data were parsed from the official Unity package. Relevant source container `IntroFighters_Data/sharedassets0.assets` SHA256:

`e89be9876093b0f5c51048f4a68dcc0392670552becfc8520e4efad5addf204c`

Mapped native evidence independently establishes grip behavior, PID controls, animation timing, projectile damage and the kill counter pulse. This is static package/native evidence, not a claim of recorded Windows game execution.

Coordinates are original Unity world units: positive X points right and positive Y points up. Physical anchors and all weapon colliders are expressed in the weapon root's local coordinates. Child transforms and collider offsets have already been applied, while editor-only prefab placement translation has been removed. Simple SpriteRenderer sizes use `Sprite.rect / pixelsPerUnit`, not the unrelated serialized `SpriteRenderer.m_Size` field. All exported source sprites retain centered pivots and their complete texture rectangle; the holding hand is 128 × 128, rather than the tightly cropped 110 × 86 extraction.

`bodyDiameter: 1.12` is the website's common reference diameter for RSI avatars. It is a deliberate integration convention, **not** an original universal avatar size. Relative weapon and hand dimensions remain measured source values. `handRotation` uses radians; `holdAngle` and `forwardAngle` use degrees. Original animation fields retain `speed`, `delay`, `points`, `idleTransitionSpeed`, `idleTransitionDelay` and `setItemActivePosition`; time values are seconds. No animation field was renamed into a browser timing approximation.

| Weapon | Sprite path ID | Width × height (Unity units) | Physical anchor X, Y |
| --- | ---: | --- | --- |
| 长剑 / Sword | 166 | 0.700000 × 2.844444 | 0, -0.950 |
| 短剑 / ShortSword | 180 | 0.527083 × 2.044444 | 0, -0.700 |
| 长枪 / Spear | 129 | 0.193359 × 3.300000 | 0, -1.000 |
| 三齿叉 / Pitchfork | 159 | 0.500547 × 2.980000 | 0, -0.800 |
| 战斧 / Axe | 151 | 0.542222 × 1.431019 | -0.100, -0.450 |
| 钉头锤 / MorningStar | 130 | 0.570000 × 2.353548 | 0, -0.825 |
| 弓 / Shortbow | 154 | 0.455547 × 2.380000 | 0.120, 0 |
| 特殊剑 / SpecialSword | 157 | 0.510000 × 2.212881 | 0, -0.714 |
| 魔法剑 / MagicSword | 177 | 0.510000 × 2.212881 | 0, -0.714 |
| 炸弹 / Bomb | 187 | 0.580000 × 0.773333 | 0, 0 |
| 拳头 / Fist_02 | 126 | 0.568889 × 0.568889 | Local sprite/circle origin |

Each item retains its own hand placement and physical anchor. For example, the bow's drawn hand is at `(0.075, -0.15)`, distinct from its physical anchor `(0.12, 0)`. `handSprite` selects the original fist for the bomb and the original holding hand for ordinary held weapons. Source variants and their weights are preserved for the special sword, spear, axe and morning star.

The fire and stronger fire weapons have no held item SpriteRenderer in the source: their `sprite`, `width` and `height` are `null`. They use the original magic hand and separate particle throwables, not invented firearm images. Held bow, fire, stronger fire and bomb item statistics have `collisionDamage: false`; actual arrow/fireball/bomb projectile statistics are stored independently under `projectiles`. The arrow's actual horizontal capsule collider is retained as capsule data rather than an invented rectangle. `null` also explicitly marks item-only PID/angle/cooldown fields that do not exist on `SI_Fist`, and ammo fields that do not exist on the original item type. Fist rotation/movement comes from the separately measured hand controller. The physical fist radius is 0.2; its 0.35 pickup cast radius is a different source value.

The kill badge's original `KillCountIcon` is Sprite 145. Both the current-kill badge and total-kill badge UI Image components resolve to it. The source threshold gradients, leader and total colors are retained. The counter punch has amplitude 0.25, duration 0.3 seconds, vibrato 10 and elasticity 0.

## Lossless exports

All 21 original resource exports are lossless WebP, with no resizing, recoloring, padding removal or alpha trimming. Every exported file was decoded and its complete RGBA byte buffer compared to the source PNG; all 21 are exactly equal, including RGB values under transparent pixels. Total original image bytes: **81,322**. Filenames contain the first 12 characters of their actual WebP SHA256; full hashes are recorded below.

| Source sprite | File | Pixels | Bytes | SHA256 |
| --- | --- | --- | ---: | --- |
| Fist_02 (Sprite 126) | [original-fist-02-6bd7dc68acd8.webp](../assets/arena/original-fist-02-6bd7dc68acd8.webp) | 128 × 128 | 3784 | `6bd7dc68acd8abcb0a9223bc64e9495e32cd5bd2455fa799991825371d188b72` |
| HoldingHand_02 (Sprite 146) | [original-holdinghand-02-547a835457f2.webp](../assets/arena/original-holdinghand-02-547a835457f2.webp) | 128 × 128 | 3778 | `547a835457f295a25b44edea50ada46845e48f6f4aa1a214e698c471dae04af3` |
| GRAB_01 (Sprite 190) | [original-grab-01-8cf3c587105d.webp](../assets/arena/original-grab-01-8cf3c587105d.webp) | 256 × 256 | 3714 | `8cf3c587105ddc40adbd504f1a93a6f33d756aa5dfe2ef5cd7e0f9dfeea43a9c` |
| KillCountIcon (Sprite 145) | [original-killcounticon-eb47ba871255.webp](../assets/arena/original-killcounticon-eb47ba871255.webp) | 128 × 128 | 2928 | `eb47ba871255d9db88a496b48f9bd7e818ecb1570272e2f4ba265b27cdc90910` |
| Sword (Sprite 166) | [original-sword-dc095e71cca5.webp](../assets/arena/original-sword-dc095e71cca5.webp) | 63 × 256 | 3982 | `dc095e71cca5cef794adfc1bb49c25585605ce03309dcfe3ae1dcaba63da7d91` |
| ShortSword (Sprite 180) | [original-shortsword-d8a376eae9df.webp](../assets/arena/original-shortsword-d8a376eae9df.webp) | 66 × 256 | 3492 | `d8a376eae9df77302b2494bc1a76ff3fa46b3534b64a8ea0105d55ba8ee50808` |
| SpecialSword (Sprite 157) | [original-specialsword-670ddbe427b2.webp](../assets/arena/original-specialsword-670ddbe427b2.webp) | 59 × 256 | 5026 | `670ddbe427b2ead0c5530b9f75d48be18e043561d9db1b2072895fa4547d536f` |
| SpecialSword2 (Sprite 179) | [original-specialsword2-17da99be65bc.webp](../assets/arena/original-specialsword2-17da99be65bc.webp) | 59 × 256 | 4660 | `17da99be65bca21f86cb8766d86081408d601690559af1e295bc69746ffbc4c5` |
| SpecialSword3 (Sprite 135) | [original-specialsword3-8c5bbf787532.webp](../assets/arena/original-specialsword3-8c5bbf787532.webp) | 59 × 256 | 3994 | `8c5bbf78753261987e29f9ef31a85a2d1c3874651588a8a7e8b13ab60461981f` |
| MagicSword (Sprite 177) | [original-magicsword-073b1f7d45e9.webp](../assets/arena/original-magicsword-073b1f7d45e9.webp) | 59 × 256 | 3860 | `073b1f7d45e99c498c50117a64e91721c9151ef363ef64354e00c9cf27f53618` |
| Spear (Sprite 129) | [original-spear-44fa109a2ce7.webp](../assets/arena/original-spear-44fa109a2ce7.webp) | 15 × 256 | 2030 | `44fa109a2ce76bea95abb3cad4bbbfd67b0ed099bc2f00e3f17897e346f34c4c` |
| SpearShiny (Sprite 160) | [original-spearshiny-17c3033c078e.webp](../assets/arena/original-spearshiny-17c3033c078e.webp) | 15 × 256 | 2688 | `17c3033c078e1e3bd5cd13e5326afdac627cfddf855e4479c2e2617ac3ea6d64` |
| Pitchfork (Sprite 159) | [original-pitchfork-667484768b9f.webp](../assets/arena/original-pitchfork-667484768b9f.webp) | 43 × 256 | 3408 | `667484768b9f2d1c9e5b7dbb0ee6499d99669e13fd222167b9ac65a0b937a80c` |
| Axe (Sprite 151) | [original-axe-35dc90f25fd4.webp](../assets/arena/original-axe-35dc90f25fd4.webp) | 97 × 256 | 5962 | `35dc90f25fd4456c24db04306126e722af78d5e0733997e4ace84427d276df76` |
| AxeShiny (Sprite 176) | [original-axeshiny-c4119b8530e8.webp](../assets/arena/original-axeshiny-c4119b8530e8.webp) | 97 × 256 | 5146 | `c4119b8530e8a297050390a8dc07099b9c401b3687082d6989c098ae8f7fa393` |
| MorningStar (Sprite 130) | [original-morningstar-7979c43502f3.webp](../assets/arena/original-morningstar-7979c43502f3.webp) | 62 × 256 | 3206 | `7979c43502f354d1b19177d37eb68be5d48a66bd9491097615ce396c4a4e77ea` |
| MorningStar2 (Sprite 171) | [original-morningstar2-ff665b7ddc37.webp](../assets/arena/original-morningstar2-ff665b7ddc37.webp) | 62 × 256 | 3344 | `ff665b7ddc37e7bffbdd0c25b1bc46196db39910067cee033709ebe01e10f898` |
| Shortbow (Sprite 154) | [original-shortbow-81fe93c26ec6.webp](../assets/arena/original-shortbow-81fe93c26ec6.webp) | 49 × 256 | 4976 | `81fe93c26ec61fdbc9e753f4809d8140454edcd38571f635ae17d1eadd8e1df1` |
| Arrow (Sprite 149) | [original-arrow-07bdb3d21d66.webp](../assets/arena/original-arrow-07bdb3d21d66.webp) | 256 × 26 | 3098 | `07bdb3d21d6646c880920c41363ecd73323c09d439ca19b3b8af843fa5fd60d3` |
| Bomb (Sprite 187) | [original-bomb-b456f224e198.webp](../assets/arena/original-bomb-b456f224e198.webp) | 87 × 116 | 2740 | `b456f224e1987c3fd23d97be92e2017673fe07529c9b6fb7ca47900a2794c05a` |
| HealBomb (Sprite 128) | [original-healbomb-7dccf59cd27a.webp](../assets/arena/original-healbomb-7dccf59cd27a.webp) | 87 × 116 | 5506 | `7dccf59cd27aa6398d577ad500f6407b60ea4a634f2435ee67264def005b6a04` |

## Retired assets

The earlier 14 generated science-fiction sprites (276,848 bytes) and generation receipts are retained in the external `Previews/gvy-arena-weapons-20261021/retired-generated-assets/` evidence directory. They are no longer referenced or included in the website build. This switch follows the later request to restore the original recognizable weapon system and proportions.

## Source feedback and browser adaptation

`member-arena-feedback.js` uses sharedassets0 TrailRenderer 827–837: source local child anchors, low-alpha white 75ms melee trails and 175ms white arrow / orange fire / purple superfire trails. Native `Item.Active` gates held trails. Damage follows the recovered nearest-even `clamp(round(damage*.25),1,40)` count and avatar-only shake duration/strength clamps (`*.00525`, 10–375ms / .01–.32 world units). Health uses 250ms damage front, 700ms delay + 1s damage tail, 500ms healing highlight and 1.25s delay + 1s healing front; repeated changes cancel the previous sequence.

Canvas portrait crops, tapered line segments, local shake random paths and final fragment alpha fade are browser adaptations, not pixel-equivalent Unity shaders or DOTween internals. Source fragments retain 5s lifetime, 3–5 world units/s speed and .125–.225 size; a shared recycling budget prevents per-actor Unity particle limits from becoming browser DOM/CPU growth. New visual randomness is isolated from combat randomness. Victory confetti, badge layout and attack cadence are unchanged.
