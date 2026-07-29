import { useRef, useState } from "react";
import { Icon } from "../icons.jsx";

export function DropZone({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const receive = (files) => {
    if (!disabled && files?.length) onFiles(Array.from(files));
  };

  return (
    <div
      className={`drop-zone ${dragging ? "is-dragging" : ""} ${disabled ? "is-disabled" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); receive(event.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
        multiple
        disabled={disabled}
        onChange={(event) => { receive(event.target.files); event.target.value = ""; }}
      />
      <Icon name="upload" size={48} />
      <h2>拖入本次团建照片</h2>
      <p>支持 JPG、PNG、HEIC · 单批最多 100 张 · 文件与画面均在本机去重</p>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>选择照片</button>
    </div>
  );
}
