import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { decodeRoster } from "../../scripts/lib/rsi-members.mjs";

const published = decodeRoster(readFileSync(new URL("../../assets/js/fleet-members.js", import.meta.url), "utf8"));
const rosterURL = /\/assets\/js\/fleet-members\.js(?:\?|$)/;
const matterURL = /\/assets\/vendor\/matter\.min\.js(?:\?|$)/;
const poll = { intervals: [25, 50, 100] };

function fixtureMembers(count = 4, names) {
  return Array.from({ length: count }, (_, i) => ({
    ...published.members[i % published.members.length],
    handle: `ArenaFixture_${i}`,
    name: names?.[i] || `测试成员${i + 1}`,
  }));
}

async function fixtureRoster(page, members = fixtureMembers()) {
  await page.route(rosterURL, (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__gvyFleetRoster = ${JSON.stringify({ ...published, members, total: members.length })};`,
  }));
}

const snapshot = (target) => target.evaluate(() => window.__gvyArena.snapshot());

async function ready(target) {
  await expect.poll(() => target.evaluate(() => Boolean(window.__gvyArena)), poll).toBe(true);
  await expect(target.locator("[data-brawl-start]")).toBeVisible();
  await expect(target.locator("[data-brawl-start]")).toBeEnabled();
}

async function startRound(target, options = {}) {
  for (const [key, value] of Object.entries(options)) {
    await target.locator(`[data-arena-${key}]`).selectOption(value);
  }
  await target.locator("[data-brawl-start]").click();
  await expect.poll(async () => (await snapshot(target)).phase, poll).toBe("running");
  await expect.poll(async () => (await snapshot(target)).simTime, poll).toBeGreaterThan(0);
}

async function standalone(page, options = {}, members = fixtureMembers()) {
  await fixtureRoster(page, members);
  await page.goto("/member-brawl.html", { waitUntil: "domcontentloaded" });
  await ready(page);
  await startRound(page, { mode: "teams", terrain: "flat", ...options });
}

async function pause(target) {
  await target.locator("[data-arena-pause]").click();
  await expect.poll(async () => (await snapshot(target)).paused, poll).toBe(true);
}

async function resume(target) {
  await target.locator("[data-arena-pause]").click();
  await expect.poll(async () => (await snapshot(target)).paused, poll).toBe(false);
}

// These fixtures arrange real Matter bodies and a real attack's active window.
// Damage, collision filtering, elimination and round changes stay in the product.
async function arrangeContact(target, { victim = 1, hp = 100 } = {}) {
  return target.evaluate(({ victim, hp }) => {
    const fighters = [...document.querySelectorAll(".member-fighter")].map((e) => e.physicsItem);
    const field = document.querySelector("[data-member-brawl-field]").getBoundingClientRect();
    const now = window.__gvyArena.snapshot().simTime;
    for (const [i, f] of fighters.entries()) {
      Matter.Body.setStatic(f.body, true);
      Matter.Body.setVelocity(f.body, { x: 0, y: 0 });
      Matter.Body.setPosition(f.body, { x: field.width * .72 + (i % 2) * 55, y: field.height * .72 });
      f.nextAttack = Infinity; f.nextMovement = Infinity; f.attack = null; f.damageSources.clear();
    }
    for (const f of fighters) { f.rig?.reset({ ...f.body.position, aim: 0 }); f.damageSources.clear(); }
    const attacker = fighters[0], defender = fighters[victim];
    const y = Math.min(150, field.height * .35);
    Matter.Body.setPosition(attacker.body, { x: 100, y });
    const unit = window.__gvyArena.snapshot().map.unit;
    Matter.Body.setPosition(defender.body, { x: 100 + unit, y });
    attacker.rig.reset({ x: 100, y, aim: 0 });
    defender.rig.reset({ ...defender.body.position, aim: 0 });
    defender.hp = hp;
    attacker.aim = 0;
    // A real moving fist touches the defender's real circle. Its measured
    // velocity clears the native threshold before the solver absorbs impact.
    // Product collision/CCD, immunity, damage and elimination remain untouched.
    const animation = attacker.weapon.animations[0];
    const timeline = GVYArenaActions.compile(animation, GVYArenaMotion);
    attacker.attack = { start: now - 400, aim: 0, inverse: false, hit: new Set(), fired: false,
      animation, timeline, duration: timeline.duration, target: { ...defender.body.position } };
    Matter.Body.setVelocity(attacker.rig.fistBody, { x: unit * 20 / 60, y: 0 });
    return { attacker: attacker.id, victim: defender.id, now };
  }, { victim, hp });
}

function runtimeFailures(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("phone homepage keeps the arena lazy and opens a readable viewport instead of a scaled desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtureRoster(page);
  const errors = runtimeFailures(page), requests = [];
  page.on("request", (r) => {
    if (/fleet-members\.js|fleet-command-brawl\.js|member-arena-rules\.js|\/member-avatars\//.test(r.url())) requests.push(r.url());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__gvyCinematicHomepage));
  await expect(page.locator("[data-member-brawl-frame]")).not.toHaveAttribute("src", /.+/);
  expect(requests).toEqual([]);
  await page.locator("[data-member-brawl-open]").evaluate((e) => e.click());
  const arena = page.frameLocator("[data-member-brawl-frame]");
  await expect(arena.locator("[data-brawl-start]")).toBeVisible();
  const frame = page.frames().find((f) => /\/member-brawl\.html(?:\?|$)/.test(f.url()));
  await ready(frame);
  const geometry = await frame.evaluate(() => ({
    width: innerWidth, height: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
    controls: [...document.querySelectorAll(".arena-action, select, [data-brawl-start]")]
      .filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height),
  }));
  expect(geometry.width).toBeGreaterThan(300);
  expect(geometry.width).toBeLessThanOrEqual(390);
  expect(geometry.height).toBeGreaterThan(400);
  expect(geometry.height).toBeLessThan(844);
  expect(geometry.overflow).toBe(false);
  expect(geometry.controls).toHaveLength(5); // Four selectors and the start button.
  expect(geometry.controls.every((height) => height >= 44)).toBe(true);
  await expect(page.locator("[data-member-brawl-frame]")).toHaveCSS("transform", "none");
  await startRound(frame, { mode: "teams", loadout: "unarmed", terrain: "flat" });
  await expect(frame.locator(".member-fighter")).toHaveCount(4);
  const readable = await frame.locator(".fighter-avatar-wrap").first().boundingBox();
  expect(readable.width).toBeGreaterThanOrEqual(20);
  expect(await frame.locator(".fighter-avatar-wrap").first().evaluate(e=>parseFloat(getComputedStyle(e).width))).toBeCloseTo((await snapshot(frame)).map.unit * 1.12, 1);
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("manual pause freezes a real projectile while minimizing retains the same running simulation", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.addInitScript(() => { Math.random = () => .2; });
  await fixtureRoster(page);
  const errors = runtimeFailures(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-member-brawl-open]").evaluate((e) => e.click());
  await page.frameLocator("[data-member-brawl-frame]").locator("[data-brawl-start]").waitFor({ state: "visible" });
  const frame = page.frames().find((f) => /\/member-brawl\.html(?:\?|$)/.test(f.url()));
  await startRound(frame, { mode: "teams", loadout: "same", terrain: "flat" });
  await pause(frame);
  expect((await snapshot(frame)).fighters.every((f) => f.weapon === "bow")).toBe(true);
  await frame.evaluate(() => {
    const fighters = [...document.querySelectorAll(".member-fighter")].map((e) => e.physicsItem);
    const box = document.querySelector("[data-member-brawl-field]").getBoundingClientRect();
    for (const [i, f] of fighters.entries()) {
      Matter.Body.setStatic(f.body, true);
      Matter.Body.setPosition(f.body, { x: i ? box.width * .85 : 65, y: i > 1 ? box.height * .75 : 120 });
      f.attack = null; f.nextAttack = Infinity; f.nextMovement = Infinity;
      f.rig.reset({ ...f.body.position, aim: 0 });
    }
    const attacker = fighters[0], now = window.__gvyArena.snapshot().simTime;
    attacker.aim = 0;
    attacker.attack = { start: now - 500, aim: 0, inverse: false, hit: new Set(), fired: false, duration: .625, target: { ...fighters[1].body.position } };
    window.__arenaRetainedFrame = "same-game";
  });
  await resume(frame);
  await expect.poll(async () => (await snapshot(frame)).projectiles, poll).toBeGreaterThan(0);
  await pause(frame);
  const paused = await snapshot(frame);
  const pausedFlight = await frame.locator(".arena-projectile").evaluateAll((nodes) => nodes.map((e) => e.style.transform));
  await page.waitForTimeout(450);
  expect(await snapshot(frame)).toEqual(paused);
  expect(await frame.locator(".arena-projectile").evaluateAll((nodes) => nodes.map((e) => e.style.transform))).toEqual(pausedFlight);
  await resume(frame);
  await expect.poll(async () => (await snapshot(frame)).simTime, poll).toBeGreaterThan(paused.simTime + 30);
  const beforeDock = await snapshot(frame);
  await page.locator("[data-member-brawl-close]").click();
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("data-window-state", "docked");
  await expect.poll(async () => (await snapshot(frame)).simTime, poll).toBeGreaterThan(beforeDock.simTime + 200);
  expect((await snapshot(frame)).paused).toBe(false);
  await page.locator(".member-brawl-dock-bar [data-member-brawl-restore]").click();
  await expect(page.locator("[data-member-brawl-dialog]")).toHaveAttribute("data-window-state", "expanded");
  expect(await frame.evaluate(() => window.__arenaRetainedFrame)).toBe("same-game");
  expect((await snapshot(frame)).round).toBe(beforeDock.round);
  expect(errors).toEqual([]);
});

test("resizing a paused battle preserves identities, damage, scores and round instead of restarting", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await standalone(page, { loadout: "unarmed" });
  await pause(page);
  await page.evaluate(() => {
    const fighters = [...document.querySelectorAll(".member-fighter")].map((e) => e.physicsItem);
    for (const [i, f] of fighters.entries()) {
      Matter.Body.setStatic(f.body, true);
      f.hp = 39 + i; f.kills = i + 1; f.deaths = i;
      f.attack = null; f.nextAttack = Infinity; f.nextMovement = Infinity;
    }
  });
  const before = await snapshot(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await snapshot(page)).paused).toBe(true);
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).simTime, poll).toBeGreaterThan(before.simTime + 40);
  await pause(page);
  const after = await snapshot(page);
  const stable = (s) => s.fighters.map(({ handle, hp, kills, deaths, alive, weapon }) => ({ handle, hp, kills, deaths, alive, weapon }));
  expect(stable(after)).toEqual(stable(before));
  expect(after.round).toBe(before.round);
  expect(after.fighters.some((f, i) => Math.abs(f.x - before.fighters[i].x) > 10)).toBe(true);
  const width = await page.locator("[data-member-brawl-field]").evaluate((e) => e.clientWidth);
  expect(after.fighters.every((f) => Number.isFinite(f.x) && Number.isFinite(f.y) && f.x >= 0 && f.x <= width)).toBe(true);
});

test("mirrored teams receive matching weapon pools and real contacts apply native thirty-percent friendly damage", async ({ page }) => {
  await standalone(page, { mode: "teams", loadout: "mirrored" });
  await pause(page);
  const mirrored = await snapshot(page);
  const weapons = (team) => mirrored.fighters.filter((f) => f.team === team).map((f) => f.weapon).sort();
  expect(mirrored.fighters.filter((f) => f.team === 0)).toHaveLength(2);
  expect(mirrored.fighters.filter((f) => f.team === 1)).toHaveLength(2);
  expect(weapons(0)).toEqual(weapons(1));
  await page.locator("[data-arena-settings]").click();
  await startRound(page, { mode: "teams", loadout: "unarmed", terrain: "flat" });
  await pause(page);
  const friendly = await arrangeContact(page, { victim: 1 });
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).simTime, poll).toBeGreaterThan(friendly.now + 350);
  await pause(page);
  const noFriendlyDamage = await snapshot(page);
  expect(noFriendlyDamage.fighters[1].hp).toBeLessThan(100);
  expect(noFriendlyDamage.hits).toBeGreaterThan(0);
  const hostile = await arrangeContact(page, { victim: 2 });
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).fighters[hostile.victim].hp, poll).toBeLessThan(100);
  expect((await snapshot(page)).hits).toBeGreaterThan(0);
});

test("a real team elimination records one outcome and automatically starts exactly one round after eight seconds", async ({ page }) => {
  await standalone(page, { mode: "teams", loadout: "unarmed" }, fixtureMembers(2));
  await pause(page);
  await arrangeContact(page, { victim: 1, hp: 1 });
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).phase, poll).toBe("result");
  const result = await snapshot(page);
  expect(result.round).toBe(1);
  expect(result.fighters.filter((f) => f.alive)).toHaveLength(1);
  expect(result.fighters[0].kills).toBe(1);
  await expect(page.locator('.member-fighter').first().locator('.fighter-life-kills')).toHaveText('1');
  await expect(page.locator('.member-fighter').first().locator('.fighter-life-kills img')).toHaveAttribute('src', /original-killcounticon/);
  await expect(page.locator('.member-fighter').first().locator('.fighter-total-kills')).toHaveText('1');
  expect(result.fighters[1].deaths).toBe(1);
  await expect(page.locator("[data-arena-result]")).toBeVisible();
  await expect(page.locator("[data-arena-result-title]")).toHaveText("蓝队获胜");
  const frozenPoses = await page.locator('.arena-hand,.arena-weapon').evaluateAll(nodes=>nodes.map(e=>e.style.transform));
  await page.waitForTimeout(160);
  expect(await page.locator('.arena-hand,.arena-weapon').evaluateAll(nodes=>nodes.map(e=>e.style.transform))).toEqual(frozenPoses);
  const firstRecord = await page.evaluate(() => JSON.parse(localStorage.getItem("gvy-arena-stats-v1")));
  expect(firstRecord.outcomes).toHaveLength(1);
  expect(firstRecord.records.every((r) => r.matches === 1)).toBe(true);
  await page.waitForTimeout(500);
  expect((await snapshot(page)).round).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gvy-arena-stats-v1")).outcomes.length)).toBe(1);
  await expect.poll(async () => (await snapshot(page)).round, { timeout: 12_000, intervals: [50, 100, 200] }).toBe(2);
  const next = await snapshot(page);
  expect(next.phase).toBe("running");
  expect(next.simTime).toBeLessThan(1500);
  await expect(page.locator("[data-arena-result]")).toBeHidden();
  const wallStart = Date.now(), clockStart = next.simTime;
  await page.waitForTimeout(800);
  const later = await snapshot(page), elapsed = Date.now() - wallStart;
  expect(later.round).toBe(2);
  expect(later.simTime - clockStart).toBeGreaterThan(elapsed * .30);
  expect(later.simTime - clockStart).toBeLessThan(elapsed * 1.35 + 120);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gvy-arena-stats-v1")).outcomes.length)).toBe(1);
});

test("reduced-motion still runs collision-based combat and emits no particles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await standalone(page, { loadout: "unarmed" }, fixtureMembers(2));
  await pause(page);
  const contact = await arrangeContact(page);
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).hits, poll).toBeGreaterThan(0);
  const state = await snapshot(page);
  expect(state.phase).toBe("running");
  expect(state.simTime).toBeGreaterThan(contact.now);
  expect(state.fighters[1].hp).toBeLessThan(100);
  expect(state.particles).toBe(0);
  await expect(page.locator(".arena-particle")).toHaveCount(0);
});

test("fighters are display-only: mouse and touch dragging cannot capture or manipulate a combatant", async ({ page }) => {
  await standalone(page, { loadout: "unarmed" });
  await pause(page);
  const labels = await page.locator(".fighter-name").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return { actorChild: node.parentElement.matches(".member-fighter"),
      fontSize: parseFloat(style.fontSize) / (parseFloat(getComputedStyle(document.body).fontSize) / 14), borderWidth: style.borderWidth, background: style.backgroundColor,
      pointerEvents: style.pointerEvents, z: style.zIndex };
  }));
  expect(labels).toHaveLength(4);
  expect(labels.every((label) => label.actorChild && Math.abs(label.fontSize - 11) < .01 &&
    label.borderWidth === "0px" && label.background === "rgba(0, 0, 0, 0)" &&
    label.pointerEvents === "none" && label.z === "auto")).toBe(true);
  await expect(page.locator("button.member-fighter")).toHaveCount(0);
  expect(await page.locator(".member-fighter").evaluateAll((nodes) => nodes.every((e) =>
    !e.matches("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")))).toBe(true);
  const before = await snapshot(page);
  const fighter = page.locator(".member-fighter").first();
  const box = await fighter.boundingBox();
  expect(box).not.toBeNull();
  const hittable = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".member-fighter")),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hittable).toBe(false);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 90, { steps: 6 });
  await page.mouse.up();
  await fighter.dispatchEvent("pointerdown", { pointerId: 71, pointerType: "touch", clientX: box.x + 5, clientY: box.y + 5, bubbles: true });
  await fighter.dispatchEvent("pointermove", { pointerId: 71, pointerType: "touch", clientX: box.x + 140, clientY: box.y + 90, bubbles: true });
  await fighter.dispatchEvent("pointercancel", { pointerId: 71, pointerType: "touch", bubbles: true });
  expect(await snapshot(page)).toEqual(before);
  expect(await page.locator(".member-fighter").evaluateAll((nodes) => nodes.every((e) =>
    e.physicsItem.body.isStatic === false && !e.classList.contains("is-dragging")))).toBe(true);
});

test("missing dependencies and bad roster show recovery guidance; valid names and selected rules remain safe after reload", async ({ page }) => {
  const errors = runtimeFailures(page), upstream = [];
  page.on("request", (r) => { if (/https:\/\/(?:[^/]+\.)?robertsspaceindustries\.com\//.test(r.url())) upstream.push(r.url()); });
  let members = [], brokenMatter = false;
  await page.route(rosterURL, (route) => route.fulfill({ contentType: "text/javascript", body: `window.__gvyFleetRoster=${JSON.stringify({ members })};` }));
  await page.route(matterURL, (route) => brokenMatter ? route.abort("failed") : route.continue());
  await page.goto("/member-brawl.html");
  await expect(page.locator("[data-arena-error]")).toBeVisible();
  await expect(page.locator("[data-arena-error]")).toContainText("成员名单");
  await expect(page.locator("[data-arena-error]")).toContainText("刷新");
  await expect(page.locator("[data-brawl-start]")).toBeDisabled();
  const names = ['<img src=x onerror="window.arenaMarkupExecuted=1">', "成员甲 & 成员乙"];
  members = fixtureMembers(2, names); brokenMatter = true;
  await page.reload();
  await expect(page.locator("[data-arena-error]")).toBeVisible();
  await expect(page.locator("[data-arena-error]")).toContainText("战斗组件加载失败");
  await expect(page.locator("[data-brawl-start]")).toBeDisabled();
  brokenMatter = false;
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-arena-error]")).toBeHidden();
  const configured = { mode: "teams", loadout: "unarmed", terrain: "platforms", modifier: "low-gravity" };
  await startRound(page, configured);
  expect((await snapshot(page)).options).toMatchObject(configured);
  expect(await page.locator(".fighter-name").allTextContents()).toEqual(names);
  await expect(page.locator(".fighter-name img")).toHaveCount(0);
  expect(await page.evaluate(() => window.arenaMarkupExecuted)).toBeUndefined();
  expect(upstream).toEqual([]);
  expect(errors).toEqual([]);
});

test("automatic tour alternates finite individual and team rounds, excluding infinite Classic between rounds without adding live services or player controls", async ({ page, baseURL }) => {
  const errors = runtimeFailures(page), liveRequests = [], foreignRequests = [], sockets = [];
  const origin = new URL(baseURL).origin;
  page.on("request", (request) => {
    if (["fetch", "xhr", "eventsource"].includes(request.resourceType())) liveRequests.push(request.url());
    if (new URL(request.url()).origin !== origin) foreignRequests.push(request.url());
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await standalone(page, { mode: "auto", loadout: "unarmed", terrain: "random" });
  const rounds = [];
  const originalMaps = ["default", "smallhill", "pit", "canyon", "slope", "terrain01", "terrain02"];
  for (let index = 0; index < 3; index++) {
    if (index) {
      await page.locator("[data-arena-restart]").click();
      await expect.poll(async () => (await snapshot(page)).round, poll).toBe(index + 1);
      await expect.poll(async () => (await snapshot(page)).simTime, poll).toBeGreaterThan(0);
    }
    await pause(page);
    const state = await snapshot(page);
    expect(state.phase).toBe("running");
    expect(state.round).toBe(index + 1);
    expect(state.options.rotation).toBe(true);
    expect(["teams", "royale", "score"]).toContain(state.options.mode);
    expect(originalMaps).toContain(state.options.terrain);
    expect(state.fighters).toHaveLength(4);
    expect(state.fighters.every((f) => f.alive)).toBe(true);
    await expect(page.locator("button.member-fighter")).toHaveCount(0);
    expect(await page.locator(".member-fighter").evaluateAll((nodes) => nodes.every((e) =>
      e.physicsItem.body.isStatic === false && !e.matches("[tabindex]:not([tabindex='-1'])")))).toBe(true);
    await page.waitForTimeout(150);
    expect(await snapshot(page)).toEqual(state);
    rounds.push({ mode: state.options.mode, terrain: state.options.terrain });
  }
  expect(new Set(rounds.map((r) => r.mode)).size).toBe(3);
  expect(rounds[1].terrain).not.toBe(rounds[0].terrain);
  expect(rounds[2].terrain).not.toBe(rounds[1].terrain);
  expect(liveRequests).toEqual([]);
  expect(foreignRequests).toEqual([]);
  expect(sockets).toEqual([]);
  expect(errors).toEqual([]);
});

test("a 100-member roster rotates two balanced mirrored teams within the 64-fighter limit", async ({ page }) => {
  const errors = runtimeFailures(page);
  const members = fixtureMembers(100);
  await standalone(page, { mode: "teams", loadout: "mirrored" }, members);
  const participating = new Set();
  for (let round = 1; round <= 2; round++) {
    if (round === 2) {
      await page.locator("[data-arena-restart]").click();
      await expect.poll(async () => (await snapshot(page)).round, poll).toBe(round);
      await expect.poll(async () => (await snapshot(page)).simTime, poll).toBeGreaterThan(0);
    }
    await pause(page);
    const state = await snapshot(page);
    expect(state.round).toBe(round);
    expect(state.rosterCount).toBe(100);
    expect(state.activePool).toBe(64);
    await expect(page.locator(".member-fighter")).toHaveCount(64);
    expect(new Set(state.fighters.map((f) => f.handle)).size).toBe(64);
    const blue = state.fighters.filter((f) => f.team === 0);
    const red = state.fighters.filter((f) => f.team === 1);
    expect(blue).toHaveLength(32);
    expect(red).toHaveLength(32);
    expect(blue.map((f) => f.weapon).sort()).toEqual(red.map((f) => f.weapon).sort());
    expect(state.fighters.filter((f) => f.alive)).toHaveLength(16);
    expect(state.fighters.filter((f) => f.reserve)).toHaveLength(48);
    expect(state.map.reserveCount).toBe(48);
    for (const fighter of state.fighters) participating.add(fighter.handle);
  }
  expect([...participating].sort()).toEqual(members.map((m) => m.handle).sort());
  expect(errors).toEqual([]);
});

test("a giant fighter releases its actual staged fireball and collision causes radial damage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => { Math.random = () => .35; });
  const errors = runtimeFailures(page);
  await standalone(page, { mode: "teams", loadout: "same", modifier: "giant" }, fixtureMembers(2));
  await pause(page);
  await page.evaluate(() => {
    const fighters = [...document.querySelectorAll(".member-fighter")].map((e) => e.physicsItem);
    const now = window.__gvyArena.snapshot().simTime, unit = window.__gvyArena.snapshot().map.unit;
    for (const [i, f] of fighters.entries()) {
      Matter.Body.setStatic(f.body, true);
      Matter.Body.setPosition(f.body, { x: 100 + i * unit * 4, y: 150 });
      f.rig.reset({ ...f.body.position, aim: i ? Math.PI : 0 });
      f.damageSources.clear(); f.attack = null; f.nextAttack = i ? Infinity : now; f.nextMovement = Infinity;
      f.aim = f.desiredAim = i ? Math.PI : 0;
    }
  });
  await resume(page);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.member-fighter').physicsItem.staged), poll).toBe(true);
  await pause(page);
  const staged = await page.evaluate(() => {
    const fighters = [...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem), a = fighters[0];
    const unit = window.__gvyArena.snapshot().map.unit, now = window.__gvyArena.snapshot().simTime;
    const p = a.staged;
    window.__stagedBody = p.body.id;
    // Arrange the existing physical charge immediately before the native release,
    // with real momentum and a real target. No fake projectile/hit is injected.
    a.attack.start = now - 520;
    Matter.Body.setPosition(p.body, { x: fighters[1].body.position.x - unit, y:150 });
    Matter.Body.setVelocity(p.body, { x:unit*30/60,y:0 });
    return { kind:p.kind, id:p.body.id, weapon:a.weaponId, radius:a.body.circleRadius };
  });
  expect(staged.weapon).toBe('fire');
  expect(staged.kind).toBe('fire');
  expect(staged.radius).toBeGreaterThan(30);
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).fighters[1].hp, poll).toBeLessThanOrEqual(96);
  const after = await snapshot(page);
  expect(after.hits).toBeGreaterThan(0);
  expect(after.fighters[1].hp).toBeGreaterThan(0);
  expect(after.options.modifier).toBe('giant');
  expect(errors).toEqual([]);
});

for (const modifier of ["none", "fast", "slow"]) {
  test(`native teams have no time cap and ${modifier} preserves the eight-second result`, async ({ page }) => {
    // Replay a full 65s match and settlement on slower shared CI CPUs.
    test.slow();
    await page.clock.install();
    await standalone(page, { mode: "teams", modifier, loadout: "unarmed" }, fixtureMembers(2));
    await page.evaluate(() => {
      for (const [i,e] of [...document.querySelectorAll(".member-fighter")].entries()) {
        const f=e.physicsItem; Matter.Body.setStatic(f.body,true); Matter.Body.setPosition(f.body,{x:i?800:100,y:100});
        f.attack=null; f.nextAttack=f.nextMovement=Infinity;
      }
    });
    await page.clock.runFor(65000);
    expect((await snapshot(page)).phase).toBe("running");
    expect((await snapshot(page)).roundLimit).toBeNull();
    await expect(page.locator("[data-arena-clock]")).toHaveText(/01:0[45]/);
    await pause(page); await arrangeContact(page,{hp:1}); await resume(page);
    await page.clock.runFor(150);
    expect((await snapshot(page)).phase).toBe("result");
    expect((await snapshot(page)).confetti).toBeGreaterThan(0);
    await pause(page); const held=await snapshot(page);
    await page.clock.runFor(2500); expect(await snapshot(page)).toEqual(held);
    await resume(page); await page.clock.runFor(1100);
    expect(Number(await page.locator("[data-arena-result-countdown]").textContent())).toBeLessThan(8);
    await page.clock.runFor(7000);
    expect((await snapshot(page)).round).toBe(2);
    expect((await snapshot(page)).phase).toBe("running");
    await expect(page.locator(".arena-confetti")).toHaveCount(0);
  });
}

test("manual pause freezes result celebration and reduced motion keeps a static victory marker", async ({ page }) => {
  await fixtureRoster(page, fixtureMembers(2));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-member-brawl-open]").evaluate((node) => node.click());
  await page.frameLocator("[data-member-brawl-frame]").locator("[data-brawl-start]").waitFor({ state: "visible" });
  const frame = page.frames().find((candidate) => /\/member-brawl\.html(?:\?|$)/.test(candidate.url()));
  await startRound(frame, { mode: "teams", loadout: "unarmed", terrain: "flat" });
  await pause(frame);
  await arrangeContact(frame, { hp: 1 });
  await resume(frame);
  await expect.poll(async () => (await snapshot(frame)).phase, poll).toBe("result");
  expect((await snapshot(frame)).confetti).toBeGreaterThan(0);
  await pause(frame);
  await expect.poll(async () => (await snapshot(frame)).paused, poll).toBe(true);
  const state = await snapshot(frame);
  const styles = await frame.locator(".arena-confetti-piece").evaluateAll((nodes) => nodes.map((node) => node.style.cssText));
  await page.waitForTimeout(1000);
  expect(await snapshot(frame)).toEqual(state);
  expect(await frame.locator(".arena-confetti-piece").evaluateAll((nodes) => nodes.map((node) => node.style.cssText))).toEqual(styles);
  await resume(frame);
  await expect.poll(async () => (await snapshot(frame)).resultRemaining, poll).toBeLessThan(state.resultRemaining);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/member-brawl.html");
  await ready(page);
  await startRound(page, { mode: "teams", loadout: "unarmed", terrain: "flat" });
  await pause(page);
  await arrangeContact(page, { hp: 1 });
  await resume(page);
  await expect.poll(async () => (await snapshot(page)).phase, poll).toBe("result");
  await expect(page.locator(".arena-victory-mark")).toBeVisible();
  expect((await snapshot(page)).confetti).toBe(0);
  expect((await snapshot(page)).particles).toBe(0);
  await expect(page.locator(".arena-confetti-piece, .arena-particle")).toHaveCount(0);
  await expect(page.locator("[data-arena-leaderboard] li:not(.arena-score-empty)").first().locator(".arena-rank, .arena-score-name, .arena-score-kills, .arena-score-deaths")).toHaveCount(4);
  await expect(page.locator("[data-arena-career] li:not(.arena-score-empty)").first().locator(".arena-rank, .arena-score-name, .arena-score-wins, .arena-score-kills")).toHaveCount(4);
});


test('setup defaults to random weapons, keeps endless last and offers three finite tour modes',async({page})=>{
  await fixtureRoster(page);await page.goto('/member-brawl.html');await ready(page);
  await expect(page.locator('[data-arena-loadout]')).toHaveValue('random');
  const choices=await page.locator('[data-arena-mode] option').evaluateAll(es=>es.map(e=>e.value));
  expect(choices).toEqual(['auto','royale','teams','score','classic']);
  await page.locator('[data-arena-mode]').selectOption('teams');
  await expect(page.locator('[data-arena-loadout]')).toHaveValue('random');
});

test('individual elimination finishes only with the final survivor and does not recycle the defeated player',async({page})=>{
  await standalone(page,{mode:'royale',loadout:'unarmed'},fixtureMembers(2));
  await pause(page);await arrangeContact(page,{hp:1});await resume(page);
  await expect.poll(async()=>(await snapshot(page)).phase,poll).toBe('result');
  const s=await snapshot(page);expect(s.fighters.filter(f=>f.alive)).toHaveLength(1);expect(s.readyCount).toBe(0);
  await expect(page.locator('[data-arena-result-title]')).toHaveText('测试成员1 获胜');
});

test('a lethal Classic collision queues the same member for a fresh native life without ending the match',async({page})=>{
  await page.clock.install();await standalone(page,{mode:'classic',loadout:'unarmed'},fixtureMembers(2));
  await page.clock.runFor(700);await pause(page);
  expect((await snapshot(page)).fighters.every(f=>f.alive)).toBe(true);
  await arrangeContact(page,{hp:1});await resume(page);await page.clock.runFor(150);await pause(page);
  const dead=await snapshot(page);expect(dead.phase).toBe('running');expect(dead.fighters[1].deaths).toBe(1);
  await resume(page);await page.clock.runFor(1500);
  const fresh=await snapshot(page);expect(fresh.round).toBe(1);expect(fresh.fighters[1].alive).toBe(true);
  expect(fresh.fighters[1].hp).toBe(100);expect(fresh.fighters[1].streak).toBe(0);
});
