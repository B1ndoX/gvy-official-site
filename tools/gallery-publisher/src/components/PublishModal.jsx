import { useState } from "react";
import { Icon } from "../icons.jsx";

export function PublishModal({ session, onClose, onConfirm, busy }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const release = session.release;
  const isDelete = session.type === "delete";
  const rows = [
    ["发布内容", isDelete ? `从相册移除所选 ${session.itemCount} 张` : `向相册末尾追加 ${session.itemCount} 张`],
    ["发布后数量", `${session.resultCount} 张`],
    ["目标分支", release.remoteBranch],
    ["回滚标签", release.tag],
    ["提交说明", release.commitMessage],
    ["部署目标", `EdgeOne · ${release.project}`],
    ["正式域名", "www.gvyvoyagers.vip / gvyvoyagers.vip"],
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title">
        <button className="modal-close" type="button" aria-label="关闭发布确认" onClick={onClose} disabled={busy}><Icon name="close" size={22} /></button>
        <div className="modal-title"><Icon name="lock" size={24} /><div><h2 id="publish-title">确认发布正式网站</h2><p>此操作将推送 main，并触发 EdgeOne 自动部署</p></div></div>
        <dl>{rows.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
        <label className="verification-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span><Icon name="check" size={18} />已检查本地预览与操作范围</span></label>
        <div className="publish-warning"><Icon name="info" size={19} />推送后仍会等待线上部署并复查两个正式域名</div>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>返回检查</button>
          <button className="confirm-publish" type="button" onClick={onConfirm} disabled={!acknowledged || busy}>{busy ? <span className="spinner" /> : null}确认发布正式网站</button>
        </div>
        <p className="modal-security"><Icon name="shield" size={17} />不存储 GitHub 或 EdgeOne 密钥</p>
      </section>
    </div>
  );
}
