import { useCallback, useEffect, useMemo, useState } from "react";

import { createDeletePreview, createPreview, fetchStatus, publishWebsite, rollbackPreview } from "./api.js";
import { ActionBar } from "./components/ActionBar.jsx";
import { AppHeader } from "./components/AppHeader.jsx";
import { CheckRail } from "./components/CheckRail.jsx";
import { DropZone } from "./components/DropZone.jsx";
import { DuplicateReviewModal } from "./components/DuplicateReviewModal.jsx";
import { HelpModal } from "./components/HelpModal.jsx";
import { GalleryManagerModal } from "./components/GalleryManagerModal.jsx";
import { PhotoFilmstrip } from "./components/PhotoFilmstrip.jsx";
import { PreviewPanel } from "./components/PreviewPanel.jsx";
import { PublishModal } from "./components/PublishModal.jsx";
import { StatusStrip } from "./components/StatusStrip.jsx";
import { Icon } from "./icons.jsx";
import { moveItem, validateSelectedFiles } from "./utils.js";

const EMPTY_STATUS = {
  gallery: { count: 0, latestStart: 0, latestEnd: 0, maxPhotoNumber: 0, previewCount: 0, items: [], duplicateGroups: [] },
  repository: { branch: "检查中", connected: false, changes: [] },
  operation: { status: "idle", message: "正在读取官网相册", steps: [] },
  session: null,
  activity: [],
};

function makePhoto(file) {
  return { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGalleryManager, setShowGalleryManager] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState(null);

  const refresh = useCallback(async () => {
    const next = await fetchStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    refresh().catch((reason) => setError(reason.message));
  }, [refresh]);

  useEffect(() => {
    if (!busy) return undefined;
    const timer = window.setInterval(() => refresh().catch(() => {}), 1500);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  const startNumber = (status.session?.displayStart || status.gallery.count + 1);
  const activityMessage = status.operation?.message || status.activity?.[0]?.message || "等待添加照片";
  const repositoryDirty = status.repository?.changes?.length > 0;

  const addFiles = useCallback((incoming) => {
    setError("");
    const { accepted, rejected } = validateSelectedFiles(incoming);
    setPhotos((current) => {
      const available = Math.max(0, 100 - current.length);
      return [...current, ...accepted.slice(0, available).map(makePhoto)];
    });
    if (rejected.length) setError(`已跳过不支持的文件：${rejected.join("、")}`);
    else if (accepted.length + photos.length > 100) setError("单批最多添加 100 张照片");
  }, [photos.length]);

  const removePhoto = useCallback((id) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.id !== id);
    });
  }, []);

  const reorderPhoto = useCallback((fromIndex, toIndex) => {
    setPhotos((current) => moveItem(current, fromIndex, toIndex));
  }, []);

  const handlePreview = useCallback(async () => {
    if (!photos.length) return;
    setBusy(true);
    setError("");
    try {
      if (status.session) await rollbackPreview();
      const next = await createPreview(photos);
      if (next.reviewRequired && Array.isArray(next.duplicates)) {
        setDuplicateReview(next.duplicates);
        await refresh().catch(() => {});
      } else {
        setStatus(next);
      }
    } catch (reason) {
      if (reason.code === "DUPLICATE_REVIEW_REQUIRED" && Array.isArray(reason.duplicates)) {
        setDuplicateReview(reason.duplicates);
      } else {
        setError(reason.message);
      }
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [photos, refresh, status.session]);

  const continueDuplicatePreview = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setStatus(await createPreview(photos, { allowDuplicates: true }));
      setDuplicateReview(null);
    } catch (reason) {
      setError(reason.message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [photos, refresh]);

  const clearBatch = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setStatus(await rollbackPreview());
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }, [photos, status.session]);

  const handleDeletePreview = useCallback(async (numbers) => {
    setBusy(true);
    setError("");
    try {
      setStatus(await createDeletePreview(numbers));
      setShowGalleryManager(false);
    } catch (reason) {
      setError(reason.message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const confirmPublish = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await publishWebsite();
      setShowPublish(false);
      for (let attempt = 0; attempt < 170; attempt += 1) {
        const next = await refresh();
        if (next.operation.type === "publish" && next.operation.status !== "running") {
          if (next.operation.status === "error") setError(next.operation.message);
          break;
        }
        await delay(2000);
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const recentActivity = useMemo(() => status.activity?.slice(0, 3) || [], [status.activity]);

  return (
    <div className="publisher-shell">
      <AppHeader repository={status.repository} onHelp={() => setShowHelp(true)} />
      <StatusStrip gallery={status.gallery} repository={status.repository} />
      {repositoryDirty && !status.session ? <div className="baseline-warning"><Icon name="info" size={17} />当前仓库已有本地改动：发布器只操作团建相册，因此在工作区恢复干净前不会生成预览。</div> : null}
      {error ? <div className="error-banner" role="alert"><Icon name="info" size={18} /><span>{error}</span><button type="button" aria-label="关闭错误" onClick={() => setError("")}><Icon name="close" size={17} /></button></div> : null}
      <main className="workspace-layout">
        <section className="main-workspace">
          <div className="gallery-management-bar">
            <div><Icon name="image" size={18} /><span>官网照片管理</span>{status.gallery.duplicateGroups?.length ? <strong>发现 {status.gallery.duplicateGroups.reduce((total, group) => total + group.length - 1, 0)} 张精确重复</strong> : <small>正式官网基准＋本机画面去重已启用</small>}</div>
            <button type="button" onClick={() => setShowGalleryManager(true)} disabled={busy}><Icon name="trash" size={17} />选择并删除官网照片</button>
          </div>
          {status.session?.verified ? (
            <PreviewPanel gallery={status.gallery} session={status.session} />
          ) : (
            <DropZone onFiles={addFiles} disabled={busy} />
          )}
          <PhotoFilmstrip
            photos={photos}
            startNumber={startNumber}
            onRemove={removePhoto}
            onMove={reorderPhoto}
            disabled={busy || Boolean(status.session)}
          />
          {!photos.length && status.session?.verified ? null : !photos.length ? (
            <div className="empty-filmstrip"><span>选择照片后将在这里确认编号与顺序</span></div>
          ) : null}
        </section>
        <CheckRail operation={status.operation} />
      </main>
      <ActionBar
        photoCount={photos.length}
        session={status.session}
        busy={busy}
        onPreview={handlePreview}
        onClear={clearBatch}
        onPublish={() => setShowPublish(true)}
      />
      <footer className="activity-footer">
        <span className={busy ? "spinner" : "activity-dot"} />
        <strong>{activityMessage}</strong>
        {recentActivity.length > 1 ? <span className="activity-history">{recentActivity.slice(1).map((item) => item.message).join(" · ")}</span> : null}
      </footer>
      {showPublish && status.session ? <PublishModal session={status.session} onClose={() => setShowPublish(false)} onConfirm={confirmPublish} busy={busy} /> : null}
      {showGalleryManager ? <GalleryManagerModal gallery={status.gallery} session={status.session} busy={busy} onClose={() => setShowGalleryManager(false)} onDelete={handleDeletePreview} /> : null}
      {duplicateReview ? <DuplicateReviewModal duplicates={duplicateReview} photos={photos} busy={busy} onCancel={() => setDuplicateReview(null)} onConfirm={continueDuplicatePreview} /> : null}
      {showHelp ? <HelpModal onClose={() => setShowHelp(false)} /> : null}
    </div>
  );
}
