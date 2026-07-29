import { Icon } from "../icons.jsx";

export function HelpModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button className="modal-close" type="button" aria-label="关闭安全说明" onClick={onClose}><Icon name="close" size={22} /></button>
        <div className="modal-title"><Icon name="shield" size={25} /><div><h2 id="help-title">本机发布安全说明</h2><p>发布器只在当前电脑上运行</p></div></div>
        <ul>
          <li>只监听 <code>127.0.0.1</code>，不会成为线上管理后台。</li>
          <li>不保存 GitHub、EdgeOne 密钥，复用本机现有 Git 登录。</li>
          <li>预览失败会恢复原页面并删除本批生成文件。</li>
          <li>正式发布前必须工作区干净、完整验证通过并再次确认。</li>
          <li>发布会先建立回滚标签，再推送 main 并复查两个正式域名。</li>
        </ul>
        <button className="primary-action compact" type="button" onClick={onClose}>我知道了</button>
      </section>
    </div>
  );
}
