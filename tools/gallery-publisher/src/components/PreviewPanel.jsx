import { Icon } from "../icons.jsx";

export function PreviewPanel({ gallery, session }) {
  if (session.type === "delete") {
    return (
      <section className="preview-panel deletion-preview-panel">
        <div className="preview-success"><Icon name="check" size={18} />删除预览已通过 · 发布前临时备份可回滚</div>
        <div className="preview-title-row">
          <div><p>本地预览 · 将从官网相册移除</p><small>其他照片保持当前顺序</small></div>
          <a href="/preview/#archive" target="_blank" rel="noreferrer"><span className="signal-dot" />打开官网预览<Icon name="external" size={15} /></a>
        </div>
        <div className="deleted-preview-grid">
          {session.items.map((item) => (
            <figure key={item.number}>
              <img src={item.publicUrl} alt="将删除的团建照片" />
            </figure>
          ))}
        </div>
        <div className="batch-summary"><Icon name="info" size={17} />将删除 <strong>{session.itemCount}</strong> 张 · 官网相册 <strong>{gallery.count}</strong> → <strong>{session.resultCount}</strong> 张</div>
      </section>
    );
  }

  const previewItems = session.items.slice(0, 4);

  return (
    <section className="preview-panel">
      <div className="preview-success"><Icon name="check" size={18} />本地预览已通过 · 本批照片已追加到相册末尾</div>
      <div className="preview-title-row">
        <div><p>本地预览 · 最新相册</p><small>与正式发布效果一致</small></div>
        <a href="/preview/#archive" target="_blank" rel="noreferrer"><span className="signal-dot" />打开官网预览<Icon name="external" size={15} /></a>
      </div>
      <div className="website-preview-strip">
        {previewItems.map((item) => (
          <figure key={item.number}>
            <img src={item.publicUrl} alt="本批团建照片预览" />
          </figure>
        ))}
      </div>
      <div className="batch-summary"><Icon name="info" size={17} />本批 <strong>{session.itemCount}</strong> 张 · 发布后官网相册共 <strong>{gallery.previewCount}</strong> 张</div>
    </section>
  );
}
