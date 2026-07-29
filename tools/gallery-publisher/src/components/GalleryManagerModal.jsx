import { useMemo, useState } from "react";

import { Icon } from "../icons.jsx";
import { formatPhotoNumber } from "../utils.js";

export function GalleryManagerModal({ gallery, session, busy, onClose, onDelete }) {
  const suggested = useMemo(
    () => gallery.duplicateGroups.flatMap((numbers) => numbers.slice(1)),
    [gallery.duplicateGroups],
  );
  const [selected, setSelected] = useState(() => new Set(suggested));
  const [confirming, setConfirming] = useState(false);
  const blocked = Boolean(session);
  const orderedSelectedItems = gallery.items.filter((item) => selected.has(item.number));
  const orderedSelection = orderedSelectedItems.map((item) => item.number);
  const suggestedDisplayNumbers = gallery.items
    .filter((item) => suggested.includes(item.number))
    .map((item) => item.displayNumber);

  const toggle = (number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="gallery-manager-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-manager-title">
        <button className="modal-close" type="button" aria-label="关闭官网照片管理" onClick={onClose} disabled={busy}><Icon name="close" size={22} /></button>
        <div className="modal-title"><Icon name="trash" size={24} /><div><h2 id="gallery-manager-title">删除官网团建照片</h2><p>移除相册条目和对应图片文件；发布前保留临时备份可回滚</p></div></div>

        {gallery.duplicateGroups.length ? (
          <div className="duplicate-notice"><Icon name="info" size={18} /><span>已找到 <strong>{suggested.length}</strong> 张文件级精确重复，已预选后加入的副本：{suggestedDisplayNumbers.map(formatPhotoNumber).join("、")}</span></div>
        ) : <div className="duplicate-notice is-clear"><Icon name="check" size={18} />当前官网未发现文件级精确重复；新增照片会以正式官网当前相册为准执行本机画面检测</div>}

        {blocked ? <div className="manager-blocked"><Icon name="lock" size={18} />当前已有{session.type === "delete" ? "删除" : "新增照片"}预览，请先发布或清空当前批次。为了避免两次操作互相覆盖，此处暂不生成新预览。</div> : null}

        <div className="gallery-manager-toolbar">
          <span>已选 <strong>{selected.size}</strong> / {gallery.count} 张</span>
          <button type="button" onClick={() => setSelected(new Set(suggested))} disabled={!suggested.length}>只选精确重复</button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size}>清除选择</button>
        </div>

        <div className="gallery-manager-grid">
          {gallery.items.map((item) => {
            const checked = selected.has(item.number);
            return (
              <button className={checked ? "is-selected" : ""} type="button" role="checkbox" aria-checked={checked} key={item.number} onClick={() => toggle(item.number)}>
                <img src={item.publicUrl} alt={`官网相册 ${formatPhotoNumber(item.displayNumber)}`} />
                <span>{formatPhotoNumber(item.displayNumber)}</span>
                {item.duplicateOf ? <small>与 {formatPhotoNumber(item.duplicateOfDisplayNumber)} 相同</small> : null}
                <i aria-hidden="true">{checked ? <Icon name="check" size={15} /> : null}</i>
              </button>
            );
          })}
        </div>

        <div className="manager-safety-note"><Icon name="shield" size={18} />删除后剩余照片会自动向前补位并连续排列；下次新增从最后一张继续。</div>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>取消</button>
          <button className="confirm-delete-preview" type="button" onClick={() => setConfirming(true)} disabled={busy || blocked || !selected.size}><Icon name="trash" size={18} />生成删除预览</button>
        </div>

        {confirming ? (
          <div className="delete-confirmation-backdrop" role="presentation">
            <section className="delete-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirmation-title">
              <div className="modal-title"><Icon name="info" size={24} /><div><h2 id="delete-confirmation-title">确认删除范围</h2><p>请再核对一次，生成预览后仍可在发布前清空回滚</p></div></div>
              <dl>
                <div><dt>删除数量</dt><dd>{orderedSelection.length} 张</dd></div>
                <div><dt>照片编号</dt><dd>{orderedSelectedItems.map((item) => formatPhotoNumber(item.displayNumber)).join("、")}</dd></div>
                <div><dt>操作范围</dt><dd>移除官网相册条目和对应原图、WebP、缩略图</dd></div>
                <div><dt>编号规则</dt><dd>删除后剩余照片自动向前补位并连续排列</dd></div>
              </dl>
              <div className="publish-warning"><Icon name="info" size={19} />这一步只生成本地预览，不会立即改动正式网站</div>
              <div className="modal-actions">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy}>返回重选</button>
                <button className="confirm-delete-preview" type="button" onClick={() => onDelete(orderedSelection)} disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="trash" size={18} />}确认生成删除预览</button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
