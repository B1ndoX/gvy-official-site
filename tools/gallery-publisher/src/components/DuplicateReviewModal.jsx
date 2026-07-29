import { Icon } from "../icons.jsx";

function comparisonTarget(duplicate, photos) {
  if (duplicate.matchSource === "gallery") {
    return {
      url: duplicate.matchUrl,
      label: `官网已有照片 · 当前顺序第 ${duplicate.matchDisplayNumber} 张`,
    };
  }
  return {
    url: photos[duplicate.matchUploadIndex]?.url,
    label: `本批已选照片 · ${duplicate.matchName}`,
  };
}

export function DuplicateReviewModal({ duplicates, photos, busy, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="duplicate-review-modal" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-review-title">
        <div className="modal-title">
          <Icon name="info" size={24} />
          <div>
            <h2 id="duplicate-review-title">检测到疑似相同照片，是否继续上传？</h2>
            <p>检测和对比均在本机完成；请核对画面后由你决定</p>
          </div>
        </div>

        <div className="duplicate-review-list">
          {duplicates.map((duplicate) => {
            const target = comparisonTarget(duplicate, photos);
            const incoming = photos[duplicate.uploadIndex];
            return (
              <article className="duplicate-comparison" key={`${duplicate.uploadIndex}-${duplicate.matchSource}`}>
                <div className="duplicate-confidence">
                  <strong>{duplicate.matchType === "exact" ? "文件完全相同" : "画面高度相似"}</strong>
                  <span>{duplicate.uploadName}</span>
                </div>
                <div className="duplicate-image-pair">
                  <figure>
                    <img src={incoming?.url} alt={`本次上传 ${duplicate.uploadName}`} />
                    <figcaption>本次上传 · {duplicate.uploadName}</figcaption>
                  </figure>
                  <span className="duplicate-versus">对比</span>
                  <figure>
                    <img src={target.url} alt={target.label} />
                    <figcaption>{target.label}</figcaption>
                  </figure>
                </div>
              </article>
            );
          })}
        </div>

        <div className="publish-warning"><Icon name="shield" size={19} />选择继续只会生成本地预览，仍需你再次确认后才会发布官网</div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>取消，返回检查</button>
          <button className="confirm-duplicate-upload" type="button" onClick={onConfirm} disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="play" size={18} />}我已核对，仍然继续上传</button>
        </div>
      </section>
    </div>
  );
}
