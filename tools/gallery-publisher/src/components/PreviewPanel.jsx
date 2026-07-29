import { Icon } from "../icons.jsx";
import { formatPhotoNumber } from "../utils.js";

export function PreviewPanel({ gallery, session }) {
  if (session.type === "delete") {
    return (
      <section className="preview-panel deletion-preview-panel">
        <div className="preview-success"><Icon name="check" size={18} />删除预览已通过 · 发布前临时备份可回滚</div>
        <div className="preview-title-row">
          <div><p>本地预览 · 将从官网相册移除</p><small>删除后官网可见序号自动连续重排</small></div>
          <a href="/preview/#archive" target="_blank" rel="noreferrer"><span className="signal-dot" />打开官网预览<Icon name="external" size={15} /></a>
        </div>
        <div className="deleted-preview-grid">
          {session.items.map((item) => (
            <figure key={item.number}>
              <img src={item.publicUrl} alt={`将删除的相册 ${formatPhotoNumber(item.displayNumber)}`} />
              <figcaption><Icon name="trash" size={15} />{formatPhotoNumber(item.displayNumber)}</figcaption>
            </figure>
          ))}
        </div>
        <div className="batch-summary"><Icon name="info" size={17} />将删除 <strong>{session.itemCount}</strong> 张 · 官网相册 <strong>{gallery.count}</strong> → <strong>{session.resultCount}</strong> 张 · 删除后“最新”定位 <strong>{formatPhotoNumber(session.nextLatestStart)}</strong></div>
      </section>
    );
  }

  const previewItems = [
    ...(session.previousItem ? [{ number: session.previousItem.displayNumber, url: session.previousItem.publicUrl }] : []),
    ...session.items.slice(0, 4).map((item) => ({ number: item.displayNumber, url: item.publicUrl })),
  ];

  return (
    <section className="preview-panel">
      <div className="preview-success"><Icon name="check" size={18} />本地预览已通过 · 最新精准定位 {formatPhotoNumber(session.displayStart)}</div>
      <div className="preview-title-row">
        <div><p>本地预览 · 最新相册</p><small>与正式发布效果一致</small></div>
        <a href="/preview/#archive" target="_blank" rel="noreferrer"><span className="signal-dot" />打开官网预览<Icon name="external" size={15} /></a>
      </div>
      <div className="website-preview-strip">
        {previewItems.map((item) => (
          <figure className={item.number === session.displayStart ? "is-latest-start" : ""} key={item.number}>
            <img src={item.url} alt={`预览相册 ${formatPhotoNumber(item.number)}`} />
            <figcaption>{formatPhotoNumber(item.number)}</figcaption>
          </figure>
        ))}
      </div>
      <div className="batch-summary"><Icon name="info" size={17} />本批 <strong>{session.itemCount}</strong> 张 · 编号 <strong>{formatPhotoNumber(session.displayStart)}–{formatPhotoNumber(session.displayEnd)}</strong> · “最新”将精准定位 <strong>{formatPhotoNumber(session.displayStart)}</strong> · 发布后共 {gallery.previewCount} 张</div>
    </section>
  );
}
