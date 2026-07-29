let sessionToken = "";

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.code = payload.code;
    error.duplicates = payload.duplicates;
    throw error;
  }
  if (payload.token) sessionToken = payload.token;
  return payload;
}

export async function fetchStatus() {
  return parseResponse(await fetch("/api/status", { cache: "no-store" }));
}

export async function createPreview(files, { allowDuplicates = false } = {}) {
  const formData = new FormData();
  files.forEach((entry) => formData.append("photos", entry.file, entry.file.name));
  return parseResponse(await fetch("/api/import", {
    method: "POST",
    headers: {
      "X-GVY-Publisher-Token": sessionToken,
      "X-GVY-Allow-Duplicates": allowDuplicates ? "1" : "0",
    },
    body: formData,
  }));
}

async function postJson(path, payload = {}) {
  return parseResponse(await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GVY-Publisher-Token": sessionToken,
    },
    body: JSON.stringify(payload),
  }));
}

export function rollbackPreview() {
  return postJson("/api/rollback");
}

export function createDeletePreview(numbers) {
  return postJson("/api/delete-preview", { numbers });
}

export function publishWebsite() {
  return postJson("/api/publish", { confirmed: true });
}
