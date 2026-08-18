export function middleware(context) {
  const url = new URL(context.request.url);
  const forwardedProtocol = context.request.headers.get("x-forwarded-proto");
  if (url.protocol === "http:" || forwardedProtocol === "http") {
    url.protocol = "https:";
    return context.redirect(url.toString(), 308);
  }
  return context.next();
}
