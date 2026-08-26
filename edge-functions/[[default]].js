const emergencyDocument = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>航线未找到 | 星际远航者 GVY</title></head><body><main><h1>这条航线尚未建立</h1><p>目标页面不存在或已经移动。</p><a href="/">返回舰队主页</a></main></body></html>`;

export default async function onRequest(context) {
  const documentUrl = new URL("/404.html", context.request.url);
  const cookie = context.request.headers.get("cookie");
  const requestHeaders = cookie ? { cookie } : undefined;
  let html = emergencyDocument;

  try {
    const load = context.fetch || fetch;
    const document = await load(documentUrl, { headers: requestHeaders });
    if (document.ok) html = await document.text();
  } catch {
    // Keep the route a real 404 even if the branded document is unavailable.
  }

  return new Response(context.request.method === "HEAD" ? null : html, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
