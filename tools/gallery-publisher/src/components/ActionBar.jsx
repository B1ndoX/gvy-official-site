import { Icon } from "../icons.jsx";

export function ActionBar({ photoCount, session, busy, onPreview, onClear, onPublish }) {
  const canPreview = photoCount > 0 && !session?.published && !busy;
  const canClear = !busy
    && Boolean(photoCount || session)
    && (!session?.commitSha || session?.published);
  const publishReady = Boolean(session?.verified && session?.publishAllowed && !session?.published && !busy);
  const publishLabel = session?.published ? "已发布正式网站" : "发布正式网站";
  const helper = session?.published
    ? session.deploymentVerified ? "正式网站已发布并完成线上复查" : "代码已推送，线上复查需要人工确认"
    : session?.verified
      ? session.publishAllowed ? "本地预览已验收，可进入发布确认" : "检测到预览前已有本地改动，正式发布保持锁定"
      : "完成预览验收后解锁";
  const helperDetail = session?.published
    ? "点击“开始下一批”继续"
    : session?.verified ? "发布前仍会再次运行完整验证" : "请先生成并检查预览";

  return (
    <div className="action-bar">
      <button className="primary-action" type="button" onClick={onPreview} disabled={!canPreview}>
        {busy ? <span className="spinner" /> : <Icon name={session ? "refresh" : "play"} size={22} />}
        {busy ? "正在处理" : session ? "重新生成预览" : "生成本地预览"}
      </button>
      <button className="secondary-action" type="button" onClick={onClear} disabled={!canClear}><Icon name="trash" size={20} />{session?.published ? "开始下一批" : "清空本批"}</button>
      <div className="publish-divider" />
      <button className="publish-action" type="button" onClick={onPublish} disabled={!publishReady}><Icon name="lock" size={21} />{publishLabel}</button>
      <div className="publish-helper"><strong>{helper}</strong><span>{helperDetail}</span></div>
      <div className="security-note"><Icon name="shield" size={25} /><span>不会保存<br />GitHub 或 EdgeOne 密钥</span></div>
    </div>
  );
}
