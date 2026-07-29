import { Icon } from "../icons.jsx";
import { formatPhotoNumber } from "../utils.js";

export function StatusStrip({ gallery, repository }) {
  return (
    <section className="status-strip" aria-label="官网相册状态">
      <div><Icon name="image" /><span>官网相册</span><strong>{gallery?.count ?? "—"}</strong><span>张</span></div>
      <div><Icon name="layers" /><span>当前最新批次</span><strong>{gallery ? `${formatPhotoNumber(gallery.latestStart)}–${formatPhotoNumber(gallery.latestEnd)}` : "—"}</strong></div>
      <div><Icon name="branch" /><span>origin/main</span><span>{repository?.connected ? "已连接" : "未连接"}</span><i className={repository?.connected ? "ok" : "warn"} /></div>
    </section>
  );
}
