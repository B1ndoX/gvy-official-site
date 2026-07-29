import { Icon } from "../icons.jsx";

export function StatusStrip({ gallery, repository }) {
  return (
    <section className="status-strip" aria-label="官网相册状态">
      <div><Icon name="image" /><span>官网相册</span><strong>{gallery?.count ?? "—"}</strong><span>张</span></div>
      <div><Icon name="layers" /><span>排列方式</span><strong>按当前顺序</strong></div>
      <div><Icon name="branch" /><span>origin/main</span><span>{repository?.connected ? "已连接" : "未连接"}</span><i className={repository?.connected ? "ok" : "warn"} /></div>
    </section>
  );
}
