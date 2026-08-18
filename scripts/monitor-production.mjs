import assert from "node:assert/strict";
import tls from "node:tls";

const retries = Number(process.env.GVY_MONITOR_ATTEMPTS || 3);
const minimumCertificateDays = Number(process.env.GVY_MIN_CERTIFICATE_DAYS || 21);
const minimumDomainDays = Number(process.env.GVY_MIN_DOMAIN_DAYS || 180);

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function withRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(750 * attempt);
    }
  }
  throw new Error(`${label} failed after ${retries} attempts: ${lastError?.message || lastError}`);
}

async function fetchResponse(url, init = {}) {
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

async function checkPage({ url, marker, requireSecurityHeaders = false }) {
  await withRetry(`${url} page check`, async () => {
    const response = await fetchResponse(`${url}?health-check=${Date.now()}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("server") || "", /edgeone/i);
    assert.ok(html.includes(marker), `${url} is missing marker ${marker}`);
    if (requireSecurityHeaders) {
      assert.match(response.headers.get("strict-transport-security") || "", /max-age=15552000/);
      assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/);
      assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
    }
  });
}

async function checkHttpsRedirect(url) {
  await withRetry(`${url} HTTPS redirect`, async () => {
    const response = await fetchResponse(url, { redirect: "manual" });
    assert.ok([301, 308].includes(response.status), `${url} returned ${response.status}`);
    const location = new URL(response.headers.get("location"), url);
    assert.equal(location.protocol, "https:");
    assert.equal(location.host, new URL(url).host);
  });
}

function readCertificate(host) {
  return new Promise((resolveCertificate, rejectCertificate) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: true,
    });
    socket.setTimeout(15_000);
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      resolveCertificate(certificate);
    });
    socket.once("timeout", () => socket.destroy(new Error(`${host} TLS timeout`)));
    socket.once("error", rejectCertificate);
  });
}

async function checkCertificate(host) {
  await withRetry(`${host} certificate`, async () => {
    const certificate = await readCertificate(host);
    const expiresAt = Date.parse(certificate.valid_to);
    assert.ok(Number.isFinite(expiresAt), `${host} certificate has no valid expiry`);
    const daysRemaining = (expiresAt - Date.now()) / 86_400_000;
    assert.ok(
      daysRemaining >= minimumCertificateDays,
      `${host} certificate expires in ${daysRemaining.toFixed(1)} days`,
    );
  });
}

async function checkDomainRegistration() {
  await withRetry("gvyvoyagers.vip RDAP", async () => {
    const domain = "gvyvoyagers.vip";
    const topLevelDomain = domain.split(".").at(-1);
    const bootstrapResponse = await fetchResponse("https://data.iana.org/rdap/dns.json");
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    const service = bootstrap.services?.find(([domains]) => domains.includes(topLevelDomain));
    const registryBaseUrl = service?.[1]?.[0];
    assert.ok(registryBaseUrl, `IANA has no RDAP service for .${topLevelDomain}`);
    const response = await fetchResponse(new URL(`domain/${domain}`, registryBaseUrl));
    assert.equal(response.status, 200);
    const record = await response.json();
    const expiryEvent = record.events?.find((event) => event.eventAction === "expiration");
    const expiresAt = Date.parse(expiryEvent?.eventDate || "");
    assert.ok(Number.isFinite(expiresAt), `${domain} expiry is unavailable`);
    const daysRemaining = (expiresAt - Date.now()) / 86_400_000;
    assert.ok(daysRemaining >= minimumDomainDays, `domain expires in ${daysRemaining.toFixed(1)} days`);
  });
}

const requiredChecks = [
  ["www homepage", () => checkPage({ url: "https://www.gvyvoyagers.vip/", marker: "星际远航者", requireSecurityHeaders: true })],
  ["apex homepage", () => checkPage({ url: "https://gvyvoyagers.vip/", marker: "星际远航者", requireSecurityHeaders: true })],
  ["www forced HTTPS", () => checkHttpsRedirect("http://www.gvyvoyagers.vip/")],
  ["apex forced HTTPS", () => checkHttpsRedirect("http://gvyvoyagers.vip/")],
  ...["www.gvyvoyagers.vip", "gvyvoyagers.vip"]
    .map((host) => [`${host} TLS`, () => checkCertificate(host)]),
  ["domain registration", checkDomainRegistration],
];

// Child services are independently maintained and may be under maintenance while the
// official site is healthy. Observe them here, but never turn their downtime into an
// official-site incident or trigger changes in those projects.
const advisoryChecks = [
  ["blueprint service", () => checkPage({ url: "https://lantu.gvyvoyagers.vip/", marker: "星际公民蓝图查询" })],
  ["Wikelo service", () => checkPage({ url: "https://wikelo.gvyvoyagers.vip/", marker: "GVY 维科洛交易查询" })],
  ...["lantu.gvyvoyagers.vip", "wikelo.gvyvoyagers.vip"]
    .map((host) => [`${host} TLS`, () => checkCertificate(host)]),
];

const failures = [];
for (const [label, check] of requiredChecks) {
  try {
    await check();
    console.log(`Production monitor OK: ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.error(`Production monitor FAILED: ${label}: ${error.message}`);
  }
}

const advisories = [];
for (const [label, check] of advisoryChecks) {
  try {
    await check();
    console.log(`Child service observer OK: ${label}`);
  } catch (error) {
    const message = `${label}: ${error.message}`;
    advisories.push(message);
    console.warn(`Child service observer WARNING: ${message}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(`::warning title=Independent child service unavailable::${message}`);
    }
  }
}

assert.equal(
  failures.length,
  0,
  `Production monitor failed for ${failures.length}/${requiredChecks.length} required checks:\n${failures.join("\n")}`,
);
console.log(`Production monitor passed: ${requiredChecks.length} required checks.`);
console.log(`Child service observer completed: ${advisoryChecks.length - advisories.length}/${advisoryChecks.length} available.`);
