const notFoundDocument = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#03060b" />
    <title>航线未找到 | 星际远航者 GVY</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="stylesheet" href="/assets/cinematic-homepage.css?v=20260826-commercial-handoff" />
  </head>
  <body class="error-page">
    <main>
      <img src="/assets/gvy-logo.png" alt="" width="72" height="72" />
      <p class="system-label">ROUTE NOT FOUND / 404</p>
      <h1>这条航线尚未建立</h1>
      <p>目标页面不存在或已经移动，请返回舰队主页继续航行。</p>
      <a href="/">返回舰队主页</a>
    </main>
  </body>
</html>
`;

export default function onRequest(context) {
  return new Response(context.request.method === "HEAD" ? null : notFoundDocument, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
