# ICP 备案临时文字调整说明

本次修改仅用于 ICP 备案期间降低审核风险，把官网表达临时轻量化为个人非商业资料展示页。备案通过后，如需恢复到备案前官网状态，优先使用 Git 回退本次 ICP 提交；也可以使用下方本地备份包恢复。

## 备案前备份

- 备份包: `/Users/bindox/Documents/Codex/Projects/starcitizen-crawler/local-backups/gvy-official-site-before-icp-text-20260706-204134.zip`
- 备份说明: `/Users/bindox/Documents/Codex/Projects/starcitizen-crawler/local-backups/gvy-official-site-before-icp-text-20260706-204134.txt`
- 备案前提交: `c190c899a8fc3ff098991b0f9c52af970fcb750d`
- 备份用途: ICP 备案前文字轻量化修改前的完整官网状态

## 本次修改范围

- 只修改 `gvy-official-site`
- 不修改 `gvy-lantu-site`
- 不修改 `blueprint-site`
- 不删除图片、视频、脚本资源
- 不改变页面结构、视觉设计和主要交互

## 备案通过后恢复建议

备案通过后，如果要恢复当前正式官网文案，请执行以下之一：

1. 推荐：对本次 ICP 文案提交执行 `git revert <ICP_TEXT_COMMIT>`，然后重新部署。
2. 备用：从上面的本地备份包恢复整个 `gvy-official-site` 目录。

恢复前请先确认线上部署状态和当前 git 分支，避免覆盖备案后新增的有效内容。
