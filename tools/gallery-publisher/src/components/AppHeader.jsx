import { Icon } from "../icons.jsx";

export function AppHeader({ repository, onHelp }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <img src="/site-assets/gvy-logo-hq.png" alt="GVY 舰队徽标" />
        <div>
          <h1>GVY 相册发布器</h1>
          <p>GALLERY PUBLISHER · LOCAL</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="connection-pill"><span className="signal-dot" />仅本机&nbsp; 127.0.0.1</div>
        <div className={`connection-pill ${repository?.connected ? "is-connected" : "is-warning"}`}>
          <span className="signal-dot" />{repository?.branch || "检查中"} · {repository?.connected ? "已连接" : "未连接"}
        </div>
        <button className="icon-text-button" type="button" onClick={onHelp}><Icon name="shield" size={18} />安全说明</button>
        <button className="icon-button" type="button" aria-label="帮助" onClick={onHelp}><Icon name="help" size={21} /></button>
      </div>
    </header>
  );
}
