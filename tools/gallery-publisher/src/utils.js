export function formatPhotoNumber(number, width = 3) {
  return String(number).padStart(width, "0");
}

export function moveItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function validateSelectedFiles(fileList) {
  const supported = new Set(["jpg", "jpeg", "png", "heic", "heif"]);
  const accepted = [];
  const rejected = [];
  for (const file of fileList) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!supported.has(extension)) rejected.push(file.name);
    else accepted.push(file);
  }
  return { accepted, rejected };
}
