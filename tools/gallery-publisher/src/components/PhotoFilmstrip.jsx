import { Icon } from "../icons.jsx";

export function PhotoFilmstrip({ photos, onRemove, onMove, disabled }) {
  if (!photos.length) return null;
  return (
    <section className="filmstrip-section" aria-label="本批照片">
      <div className="filmstrip-heading"><span>已添加 <strong>{photos.length}</strong> 张</span><span><Icon name="grip" size={16} />拖拽可调整顺序</span></div>
      <div className="photo-filmstrip">
        {photos.map((photo, index) => (
          <article
            className="photo-card"
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
              <button className="remove-photo" type="button" aria-label={`移除 ${photo.file.name}`} onClick={() => onRemove(photo.id)} disabled={disabled}><Icon name="close" size={15} /></button>
              <span className="drag-grip"><Icon name="grip" size={16} /></span>
            </div>
            <div className="photo-card-footer">
              <button type="button" aria-label="向前移动" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}><Icon name="arrowLeft" size={15} /></button>
              <button type="button" aria-label="向后移动" disabled={disabled || index === photos.length - 1} onClick={() => onMove(index, index + 1)}><Icon name="arrowRight" size={15} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="batch-summary"><Icon name="info" size={17} />本批 <strong>{photos.length}</strong> 张 · 将按上方顺序追加到官网相册末尾</div>
    </section>
  );
}
