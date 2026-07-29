import { Icon } from "../icons.jsx";
import { formatPhotoNumber } from "../utils.js";

export function PhotoFilmstrip({ photos, startNumber, onRemove, onMove, disabled }) {
  if (!photos.length) return null;
  return (
    <section className="filmstrip-section" aria-label="本批照片排序">
      <div className="filmstrip-heading"><span>已添加 <strong>{photos.length}</strong> 张</span><span><Icon name="grip" size={16} />拖拽可调整顺序</span></div>
      <div className="photo-filmstrip">
        {photos.map((photo, index) => (
          <article
            className={`photo-card ${index === 0 ? "is-batch-start" : ""}`}
            key={photo.id}
            draggable={!disabled}
            onDragStart={(event) => event.dataTransfer.setData("text/photo-index", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onMove(Number(event.dataTransfer.getData("text/photo-index")), index);
            }}
          >
            <div className="photo-frame">
              <img src={photo.url} alt={photo.file.name} />
              {index === 0 ? <span className="batch-start-badge"><span className="signal-dot" />本批起点</span> : null}
              <button className="remove-photo" type="button" aria-label={`移除 ${photo.file.name}`} onClick={() => onRemove(photo.id)} disabled={disabled}><Icon name="close" size={15} /></button>
              <span className="drag-grip"><Icon name="grip" size={16} /></span>
            </div>
            <div className="photo-card-footer">
              <button type="button" aria-label="向前移动" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}><Icon name="arrowLeft" size={15} /></button>
              <strong>{formatPhotoNumber(startNumber + index)}</strong>
              <button type="button" aria-label="向后移动" disabled={disabled || index === photos.length - 1} onClick={() => onMove(index, index + 1)}><Icon name="arrowRight" size={15} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="batch-summary"><Icon name="info" size={17} />本批 <strong>{photos.length}</strong> 张 · 编号 <strong>{formatPhotoNumber(startNumber)}–{formatPhotoNumber(startNumber + photos.length - 1)}</strong> · “最新”将精准定位 <strong>{formatPhotoNumber(startNumber)}</strong></div>
    </section>
  );
}
