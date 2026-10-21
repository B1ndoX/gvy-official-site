import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync(new URL("../assets/js/member-arena-rules.js", import.meta.url), "utf8"), context);
const { distanceToSegment, sweptCircleHit, inShieldArc, makeLoadout, teamFor, isEnemy, physicalDamage, buildTerrainPoints, sampleTerrainContour, createStatsStorage } = context.GVYArenaRules;
const plain = (value) => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const point = (x, y) => ({ x, y });
const participant = (handle, edits = {}) => ({ handle, name: handle, kills: 2, deaths: 1, bestStreak: 2, ...edits });
const result = (id, winnerHandles = []) => ({ id, winnerHandles });
function memoryStorage(initial = null) {
  let bytes = initial;
  return { getItem: () => bytes, setItem: (_key, value) => { bytes = value; } };
}

test("segment distance clamps to endpoints and handles a stationary or invalid segment", () => {
  assert.equal(distanceToSegment(5, 4, 0, 0, 10, 0), 4);
  assert.equal(distanceToSegment(13, 4, 0, 0, 10, 0), 5);
  assert.equal(distanceToSegment(-3, 4, 0, 0, 10, 0), 5);
  assert.equal(distanceToSegment(3, 4, 0, 0, 0, 0), 5);
  near(distanceToSegment(4, 0, 0, 0, 4, 4), Math.sqrt(8));
  assert.equal(distanceToSegment(NaN, 0, 0, 0, 1, 1), Infinity);
});

test("swept circle catches high-speed tunnelling at its earliest contact, including very long travel", () => {
  near(sweptCircleHit(point(-1000, 0), point(1000, 0), point(0, 0), 12), .494);
  near(sweptCircleHit(point(0, 0), point(1e9, 0), point(5e8, 0), 1), .499999999, 1e-14);
  near(sweptCircleHit(point(0, 0), point(10, 10), point(5, 5), Math.sqrt(2)), .4);
  near(sweptCircleHit(point(10, 0), point(0, 0), point(5, 0), 1), .4);
});

test("swept circle rejects misses/targets beyond the frame and handles overlaps, tangency and zero-length travel", () => {
  assert.equal(sweptCircleHit(point(-10, 3), point(10, 3), point(0, 0), 2), null);
  assert.equal(sweptCircleHit(point(0, 0), point(1, 0), point(3, 0), 1), null);
  assert.equal(sweptCircleHit(point(0, 0), point(1, 0), point(-3, 0), 1), null);
  assert.equal(sweptCircleHit(point(0, 0), point(0, 0), point(0, 1), 1), 0);
  assert.equal(sweptCircleHit(point(0, 0), point(0, 0), point(0, 2), 1), null);
  assert.equal(sweptCircleHit(point(0, 0), point(10, 0), point(1, 0), 2), 0);
  assert.equal(sweptCircleHit(point(0, 0), point(10, 0), point(11, 0), 1), 1);
  assert.equal(sweptCircleHit(point(-10, 2), point(10, 2), point(0, 0), 2), .5);
  assert.equal(sweptCircleHit(point(0, 0), point(10, 0), point(5, 0), 0), .5);
  assert.equal(sweptCircleHit(point(NaN, 0), point(10, 0), point(5, 0), 1), null);
  assert.equal(sweptCircleHit(point(0, 0), point(10, 0), point(5, 0), -1), null);
});

test("shield arc respects facing, exact edges and angle wrapping", () => {
  const defender = { x: 0, y: 0, aim: 0 };
  assert.equal(inShieldArc(defender, point(5, 0)), true);
  assert.equal(inShieldArc(defender, point(-5, 0)), false);
  assert.equal(inShieldArc(defender, point(0, 5)), false);
  assert.equal(inShieldArc({ ...defender, aim: Math.PI / 2 }, point(0, 5)), true);
  assert.equal(inShieldArc({ ...defender, aim: Math.PI - .02 }, point(-5, -.05)), true);
  const edge = Math.PI * .4;
  assert.equal(inShieldArc(defender, point(Math.cos(edge), Math.sin(edge))), true);
  assert.equal(inShieldArc(defender, point(Math.cos(edge + .01), Math.sin(edge + .01))), false);
  assert.equal(inShieldArc(defender, point(0, 0)), true);
  assert.equal(inShieldArc(defender, point(-5, 0), Math.PI), true);
  assert.equal(inShieldArc(defender, point(5, 0), -1), false);
});

test("loadout policies use a supplied random source and mirror even/odd rosters", () => {
  const pool = ["sword", "spear", "blaster"];
  let i = 0;
  const sequence = () => [0, .4, .99][i++ % 3];
  assert.deepEqual(plain(makeLoadout(4, "random", pool, sequence)), ["sword", "spear", "blaster", "sword"]);
  i = 0;
  assert.deepEqual(plain(makeLoadout(5, "mirrored", pool, sequence)), ["sword", "spear", "blaster", "spear", "sword"]);
  assert.equal(i, 3);
  i = 0;
  assert.deepEqual(plain(makeLoadout(4, "mirrored", pool, sequence)), ["sword", "spear", "spear", "sword"]);
  assert.equal(i, 2);
  assert.deepEqual(plain(makeLoadout(3, "same", pool, () => .99)), ["blaster", "blaster", "blaster"]);
  assert.deepEqual(plain(makeLoadout(3, "unarmed", pool, () => { throw new Error("must not draw"); })), ["fists", "fists", "fists"]);
  assert.deepEqual(plain(makeLoadout(2, "random", [], () => 0)), ["fists", "fists"]);
  assert.deepEqual(plain(makeLoadout(0, "same", pool)), []);
  assert.deepEqual(plain(makeLoadout(-1, "random", pool)), []);
  assert.deepEqual(plain(makeLoadout(2, "random", pool, () => 1)), ["blaster", "blaster"]);
  assert.deepEqual(plain(makeLoadout(1, "random", pool, () => NaN)), ["sword"]);
  assert.deepEqual(plain(makeLoadout(1, "random", pool, () => -.5)), ["sword"]);
});

test("odd team assignment gives the first ceil half one team; enemy checks exclude self, allies and dead fighters", () => {
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => teamFor(i, 5, "teams")), [0, 0, 0, 1, 1]);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => teamFor(i, 4, "teams")), [0, 0, 1, 1]);
  assert.deepEqual(Array.from({ length: 3 }, (_, i) => teamFor(i, 3, "free-for-all")), [0, 1, 2]);
  assert.equal(teamFor(5, 5, "teams"), -1);
  const a = { id: 0, team: 0, alive: true }, b = { id: 1, team: 1, alive: true };
  assert.equal(isEnemy(a, b), true);
  assert.equal(isEnemy(a, a), false);
  assert.equal(isEnemy(a, { ...b, team: 0 }), false);
  assert.equal(isEnemy(a, { ...b, alive: false }), false);
  assert.equal(isEnemy({ ...a, alive: false }, b), false);
  assert.equal(isEnemy(a, null), false);
  assert.equal(isEnemy(a, { alive: true, team: 1 }), false);
});

const swordStats = { collisionDamage: true, minDamageVelocity: 10, minDamage: 20, maxDamage: 50,
  damageMultiplier: 1.25, velocityMultiplier: 1.1 };
test("original sword collision damage uses the velocity threshold, multiplier and normal-damage clamp", () => {
  const noCritical = () => .5;
  assert.equal(physicalDamage(swordStats, 9.99, noCritical), 0);
  assert.equal(physicalDamage(swordStats, 10, noCritical), 20);
  assert.equal(physicalDamage(swordStats, 20, noCritical), 27.5);
  assert.equal(physicalDamage(swordStats, 100, noCritical), 50);
  const mustNotDraw = () => { throw new Error("inactive collision must not draw"); };
  assert.equal(physicalDamage({ ...swordStats, collisionDamage: false }, 100, mustNotDraw), 0);
  assert.equal(physicalDamage(swordStats, 5, mustNotDraw), 0);
});

test("critical damage includes the one-percent boundary and multiplies damage after the normal cap", () => {
  const sequence = (values) => { let index = 0; return () => values[index++]; };
  assert.equal(physicalDamage(swordStats, 20, sequence([.0100001])), 27.5);
  assert.equal(physicalDamage(swordStats, 20, sequence([.01, 0])), 48.125);
  assert.equal(physicalDamage(swordStats, 20, sequence([.01, .5])), 79.0625);
  assert.equal(physicalDamage(swordStats, 20, sequence([0, 1])), 110);
  assert.equal(physicalDamage(swordStats, 100, sequence([.005, 1])), 200);
});

test("invalid physical damage stats, velocity or random values return finite zero", () => {
  for (const speed of [-1, NaN, Infinity, "20", undefined]) assert.equal(physicalDamage(swordStats, speed, () => .5), 0);
  for (const stats of [null, {}, { ...swordStats, minDamage: 51 }, { ...swordStats, minDamageVelocity: -1 },
    { ...swordStats, damageMultiplier: NaN }, { ...swordStats, velocityMultiplier: Infinity },
    { ...swordStats, maxDamage: "50" }, { ...swordStats, damageMultiplier: Number.MAX_VALUE }]) {
    assert.equal(physicalDamage(stats, 20, () => .5), 0);
  }
  for (const random of [null, () => NaN, () => Infinity, () => -.1, () => 1.1, () => { throw new Error("bad rng"); }]) {
    assert.equal(physicalDamage(swordStats, 20, random), 0);
  }
  let draws = 0;
  assert.equal(physicalDamage(swordStats, 20, () => draws++ ? NaN : 0), 0);
});

// Small fixtures transcribed from the original packaged Terrain 01/02 spline and
// Default/Slope curve configuration. Tests do not depend on external evidence paths.
const terrain01 = { id: "terrain01", generated: false, maxScale: 6,
  seedSplinePoints: [[-4, -.5], [-3, 1], [-3, 4], [0, 4], [3, 4], [3, 1], [4, -.5]] };
const terrain02 = { id: "terrain02", generated: false, maxScale: 6,
  seedSplinePoints: [[-5, 0], [-3.5, 1.350000023841858], [-1, 2], [0, 3], [1, 2], [3.5, 1.350000023841858], [5, 0]] };
const defaultTerrain = { id: "default", generated: true, maxScale: 6, curve: {
  points: 10, spacing: 1.399999976158142, amplitude: 1, endPointYOffset: -.5, addNoise: true,
  additionalRandomVariety: true, perlinRange: [1, 2], curve: { keys: [
    [0, 0, 2, 2, 0, 0, .3333333432674408],
    [.5, 1, 0, 0, 0, .3333333432674408, .3333333432674408],
    [1, 0, -2, -2, 0, .3333333432674408, 0],
  ] } } };
const slopeTerrain = { id: "slope", generated: true, maxScale: 6, curve: {
  points: 8, spacing: 1.2000000476837158, amplitude: 1, endPointYOffset: -.5, addNoise: false,
  additionalRandomVariety: true, perlinRange: [1, 3], curve: { keys: [
    [0, 0, 0, 1.8000030517578125, 0, 0, .33716511726379395],
    [.5, .9000015258789062, 0, 0, 0, .3333333432674408, .3333333432674408],
    [1, 0, -1.8000030517578125, -1.6000518798828125, 0, .3333333432674408, 0],
  ] } } };

test("fixed original terrains preserve all seven authoritative spline points as fresh unscaled Unity XY objects", () => {
  for (const terrain of [terrain01, terrain02]) {
    const actual = buildTerrainPoints(terrain, 6, () => { throw new Error("fixed terrain must not draw"); });
    assert.deepEqual(plain(actual), terrain.seedSplinePoints.map(([x, y]) => ({ x, y })));
    assert.equal(actual.length, 7);
    actual[0].x = 999;
    assert.notEqual(terrain.seedSplinePoints[0][0], 999);
  }
});

test("original Default generator uses one spacing/amplitude draw and cubic Hermite interior plus uniform noise", () => {
  let draws = 0;
  const points = buildTerrainPoints(defaultTerrain, 1, () => { draws++; return .5; });
  assert.equal(points.length, 10);
  assert.equal(draws, 10); // Two global variety samples, eight interior noise samples.
  near(points[0].x, -6.862499892711639);
  near(points[9].x, 6.862499892711639);
  assert.equal(points[0].y, -.5);
  assert.equal(points[9].y, -.5);
  // At t=4/9 the original keys/tangents give 712/729 before amplitude/noise.
  near(points[4].y, (712 / 729) * 1.625 + 1.5);
  near(points[5].y, points[4].y);
  const eleven = buildTerrainPoints(defaultTerrain, 1.1, () => .5);
  assert.equal(eleven.length, 11);
  assert.equal(eleven[5].x, 0);
  near(eleven[5].y, 3.225); // Exact original middle key: value 1 * 1.725 + noise 1.5.
});

test("original Slope samples no interior noise and preserves its asymmetric in/out tangent data", () => {
  let draws = 0;
  const points = buildTerrainPoints(slopeTerrain, 1, () => { draws++; return .5; });
  assert.equal(points.length, 8);
  assert.equal(draws, 2);
  near(points[0].x, -4.637500166893005);
  near(points[7].x, 4.637500166893005);
  near(points[3].y, .9000015258789062 * (330 / 343) * 1.625);
  assert.equal(points[0].y, -.5);
  assert.equal(points[7].y, -.5);
});

test("terrain scale clamps at original limits and invalid, weighted, oversized or non-finite inputs produce no NaN geometry", () => {
  assert.equal(buildTerrainPoints(defaultTerrain, -10, () => .5).length, 10);
  assert.equal(buildTerrainPoints(defaultTerrain, 100, () => .5).length, 60);
  assert.deepEqual(plain(buildTerrainPoints(defaultTerrain, 100, () => .5)), plain(buildTerrainPoints(defaultTerrain, 6, () => .5)));
  const atLimit = structuredClone(defaultTerrain); atLimit.curve.points = 256;
  assert.equal(buildTerrainPoints(atLimit, 1, () => .5).length, 256);
  assert.deepEqual(plain(buildTerrainPoints(atLimit, 2, () => .5)), []);
  for (const edit of [
    (d) => { d.maxScale = Infinity; }, (d) => { d.curve.spacing = NaN; },
    (d) => { d.curve.amplitude = Infinity; }, (d) => { d.curve.endPointYOffset = NaN; },
    (d) => { d.curve.curve.keys[1][0] = 0; }, (d) => { d.curve.curve.keys[1][4] = 1; },
    (d) => { d.curve.curve.keys[1][3] = Infinity; }, (d) => { d.curve.perlinRange = [2, 1]; },
  ]) {
    const malformed = structuredClone(defaultTerrain); edit(malformed);
    assert.deepEqual(plain(buildTerrainPoints(malformed, 1, () => .5)), []);
  }
  assert.deepEqual(plain(buildTerrainPoints(null)), []);
  assert.deepEqual(plain(buildTerrainPoints(defaultTerrain, NaN)), []);
  assert.deepEqual(plain(buildTerrainPoints(defaultTerrain, 1, () => NaN)), []);
  assert.deepEqual(plain(buildTerrainPoints(defaultTerrain, 1, () => { throw new Error("bad rng"); })), []);
  assert.deepEqual(plain(buildTerrainPoints({ ...terrain01, seedSplinePoints: [[0, 0], [1, Infinity]] })), []);
});

test("generated terrain contour restores curved handles rather than straight chords and retains original endpoints", () => {
  const points = [{ x: -2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }];
  const contour = sampleTerrainContour(points, { generated: true, curve: { tangentLength: .5 } });
  assert.equal(contour.length, 17);
  assert.deepEqual(plain(contour[0]), points[0]);
  assert.deepEqual(plain(contour[8]), points[1]);
  assert.deepEqual(plain(contour[16]), points[2]);
  // Original middle handles are horizontal: the half-segment sample is not on
  // the straight chord y=x+2. These exact values distinguish the reconstructed curve.
  assert.deepEqual(plain(contour[4]), { x: -1.1875, y: 1 });
  assert.deepEqual(plain(contour[12]), { x: 1.1875, y: 1 });
  assert.ok(contour[4].y > contour[4].x + 2);
  for (let i = 0; i < contour.length; i++) {
    const segment = i <= 8 ? 0 : 1;
    assert.ok(contour[i].x >= points[segment].x && contour[i].x <= points[segment + 1].x);
    if (i) assert.ok(contour[i].x >= contour[i - 1].x);
  }
});

test("fixed zero-handle terrains keep the seven original corners and Terrain 01 vertical edges", () => {
  for (const terrain of [terrain01, terrain02]) {
    const points = buildTerrainPoints(terrain);
    const contour = sampleTerrainContour(points, terrain);
    assert.deepEqual(plain(contour), plain(points));
    assert.equal(contour.length, 7);
    contour[0].x = 999;
    assert.notEqual(points[0].x, 999);
  }
  const contour = sampleTerrainContour(buildTerrainPoints(terrain01), terrain01);
  assert.equal(contour[1].x, contour[2].x);
  assert.equal(contour[4].x, contour[5].x);
  assert.equal(contour[2].y - contour[1].y, 3);
});

test("terrain contour keeps collinear points straight, remains finite under the total budget and never mutates inputs", () => {
  const line = [{ x: -2, y: -2 }, { x: 0, y: 0 }, { x: 2, y: 2 }];
  const definition = { generated: true, curve: { tangentLength: .5 } };
  for (const point of sampleTerrainContour(line, definition)) near(point.y, point.x);
  for (const length of [2, 5, 60, 256]) {
    const points = Array.from({ length }, (_, i) => ({ x: i * 2, y: i % 3 }));
    const before = JSON.stringify(points);
    const output = sampleTerrainContour(points, definition);
    assert.ok(output.length >= length && output.length <= 256);
    assert.ok((output.length - 1) / (length - 1) <= 8);
    assert.equal(JSON.stringify(points), before);
    assert.ok(output.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
    for (let i = 1; i < output.length; i++) assert.ok(output[i].x >= output[i - 1].x);
  }
});

test("terrain contour rejects invalid or backward geometry rather than inventing replacement points", () => {
  const definition = { generated: true, curve: { tangentLength: .5 } };
  for (const points of [[], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: Infinity }],
    [{ x: 1, y: 0 }, { x: 0, y: 1 }], [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    Array.from({ length: 257 }, (_, i) => ({ x: i, y: 0 }))]) {
    assert.deepEqual(plain(sampleTerrainContour(points, definition)), []);
  }
  assert.deepEqual(plain(sampleTerrainContour([{ x: 0, y: 0 }, { x: 1, y: 1 }], { generated: true, curve: { tangentLength: NaN } })), []);
  assert.deepEqual(plain(sampleTerrainContour([{ x: 0, y: 0 }, { x: 1, y: 1 }], null)), []);
});

test("stats persist by RSI handle across renamed display names and sort wins before kills", () => {
  const storage = memoryStorage();
  const stats = createStatsStorage(storage);
  stats.record([participant("Alpha", { name: "旧名", kills: 1, bestStreak: 1 }), participant("Bravo", { kills: 20 })], result("one", ["Alpha"]));
  const next = createStatsStorage(storage);
  const records = plain(next.record([participant("aLPHa", { name: "新名字", kills: 3, deaths: 0, bestStreak: 3 }), participant("Bravo")], result("two", ["ALPHA"])));
  assert.deepEqual(records[0], { handle: "aLPHa", name: "新名字", matches: 2, wins: 2, kills: 4, deaths: 1, bestStreak: 3 });
  assert.equal(records.length, 2);
  assert.equal(records[1].handle, "Bravo");
  const clone = next.read(); clone[0].wins = 999;
  assert.equal(next.read()[0].wins, 2);
});

test("same outcome is counted once after reload; duplicate participants and unknown winners do not create extra results", () => {
  const storage = memoryStorage();
  const stats = createStatsStorage(storage);
  const first = plain(stats.record([participant("Alpha"), participant("alpha", { kills: 999 }), participant("Bravo")], result("same", ["ALPHA", "Unknown"])));
  assert.deepEqual(plain(stats.record([participant("Alpha", { kills: 100 })], result("same", ["Alpha"]))), first);
  assert.deepEqual(plain(createStatsStorage(storage).record([participant("Alpha")], result("same", ["Alpha"]))), first);
  assert.equal(first.length, 2);
  assert.equal(first[0].kills, 2);
  assert.equal(first[0].wins, 1);
  assert.equal(stats.record([], result("empty")).length, 2);
});

test("infinite-match checkpoints persist only increments without counting each save as a match", () => {
  const storage = memoryStorage();
  const stats = createStatsStorage(storage);
  stats.record([participant("Alpha", { kills: 3, deaths: 0, bestStreak: 3 })], { ...result("checkpoint-15s"), countMatch: false });
  const second = { ...result("checkpoint-30s", ["Alpha"]), countMatch: false };
  const checkpoint = plain(stats.record([participant("Alpha", { kills: 2, deaths: 1, bestStreak: 4 })], second));
  assert.deepEqual(checkpoint[0], { handle: "Alpha", name: "Alpha", matches: 0, wins: 1, kills: 5, deaths: 1, bestStreak: 4 });

  // Reload after a checkpoint, including a win recorded before a match ends.
  const restored = createStatsStorage(storage);
  assert.deepEqual(plain(restored.read()), checkpoint);
  assert.deepEqual(plain(restored.record([participant("Alpha", { kills: 999 })], second)), checkpoint);
  const ended = plain(restored.record([participant("Alpha", { kills: 1, deaths: 0, bestStreak: 2 })], result("match-ended")));
  assert.deepEqual(ended[0], { handle: "Alpha", name: "Alpha", matches: 1, wins: 1, kills: 6, deaths: 1, bestStreak: 4 });
  assert.deepEqual(plain(createStatsStorage(storage).read()), ended);
});

test("stats fall back to session memory for unavailable storage, malformed data and unsupported versions", () => {
  for (const storage of [undefined, {}, memoryStorage("{bad"), memoryStorage('{"version":2,"records":[],"outcomes":[]}'),
    memoryStorage('{"version":1,"records":[{"handle":"Alpha","name":"x","matches":-1}],"outcomes":[]}'),
    { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } },
    { getItem() { return null; }, setItem() { throw new Error("quota"); } }]) {
    const stats = createStatsStorage(storage);
    assert.deepEqual(plain(stats.read()), []);
    stats.record([participant("Alpha")], result("one", ["Alpha"]));
    assert.equal(stats.read()[0].wins, 1);
    stats.record([participant("Alpha")], result("two"));
    assert.equal(stats.read()[0].matches, 2);
  }
});

test("separately opened arenas preserve each other's committed outcomes and deduplicate the latest snapshot", () => {
  const storage = memoryStorage();
  const a = createStatsStorage(storage), b = createStatsStorage(storage);
  a.record([participant("Alpha")], result("arena-a", ["Alpha"]));
  b.record([participant("Alpha")], result("arena-b", ["Alpha"]));
  a.record([participant("Alpha")], result("arena-c"));
  const latest = createStatsStorage(storage).read()[0];
  assert.equal(latest.matches, 3);
  assert.equal(latest.wins, 2);
  assert.equal(latest.kills, 6);
  assert.equal(b.record([participant("Alpha", { kills: 999 })], result("arena-c"))[0].kills, 6);
  assert.equal(JSON.parse(storage.getItem()).outcomes.length, 3);
});

test("stats use safe identity keys, sanitize counters and never inherit object properties", () => {
  const stats = createStatsStorage(memoryStorage());
  const records = plain(stats.record([participant("__proto__"), participant("constructor"), participant("toString"),
    participant("Valid", { kills: -1, deaths: Infinity, bestStreak: 1.9 }), participant("bad/handle")], result("__proto__", ["__proto__"])));
  assert.equal(records.length, 4);
  assert.equal(records[0].handle, "__proto__");
  assert.equal(records[0].wins, 1);
  assert.equal({}.wins, undefined);
  assert.deepEqual(records.find((entry) => entry.handle === "Valid"), { handle: "Valid", name: "Valid", matches: 1, wins: 0, kills: 0, deaths: 0, bestStreak: 1 });
});

test("stats retain the latest 500 identities and a bounded 500-outcome deduplication window", () => {
  const storage = memoryStorage();
  const stats = createStatsStorage(storage);
  stats.record(Array.from({ length: 500 }, (_, i) => participant(`Member${i}`)), result("initial"));
  stats.record([participant("Member0"), participant("NewMember")], result("new"));
  assert.equal(stats.read().length, 500);
  assert.ok(stats.read().some((entry) => entry.handle === "Member0"));
  assert.ok(!stats.read().some((entry) => entry.handle === "Member1"));
  for (let i = 0; i < 501; i++) stats.record([participant("NewMember")], result(`round-${i}`));
  const persisted = JSON.parse(storage.getItem());
  assert.equal(persisted.records.length, 500);
  assert.equal(persisted.outcomes.length, 500);
  assert.equal(persisted.outcomes[0], "round-1");
  assert.deepEqual(plain(createStatsStorage(storage).read()), plain(stats.read()));
});

test("timed Classic ranking and winners share kills/deaths, retain exact ties and never use hidden HP", () => {
  const R=context.GVYArenaRules;
  const a={id:1,kills:7,deaths:2,hp:1},b={id:2,kills:7,deaths:3,hp:100},c={id:3,kills:6,deaths:0,hp:100};
  assert.deepEqual(plain(R.classicWinners([b,c,a])).map(f=>f.id),[1]);
  const tied={id:4,kills:7,deaths:2,hp:100};
  assert.deepEqual(plain(R.rankMatch([a,b,tied,c])).map(e=>[e.fighter.id,e.rank]),[[1,1],[4,1],[2,3],[3,4]]);
  assert.deepEqual(plain(R.classicWinners([a,b,tied,c])).map(f=>f.id),[1,4]);
  assert.deepEqual(plain(R.classicWinners([{kills:0,deaths:0},{kills:0,deaths:2} ])),[]);
});

test('critical metadata describes the same native roll without changing damage or drawing extra random values',()=>{
 const stats={collisionDamage:true,minDamageVelocity:1,minDamage:1,maxDamage:20,damageMultiplier:1,velocityMultiplier:1};
 const result={};let calls=0;
 const value=physicalDamage(stats,20,()=>++calls===1?.005:.5,result);
 assert.equal(calls,2);assert.equal(result.critical,true);assert.equal(value,57.5);
 physicalDamage(stats,20,()=>.5,result);assert.equal(result.critical,false);
 physicalDamage(stats,0,()=>{throw new Error('below-threshold roll');},result);assert.equal(result.critical,false);
});
