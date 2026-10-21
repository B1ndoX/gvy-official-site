import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync(new URL("../assets/js/member-arena-motion.js", import.meta.url), "utf8"), context);
const { wrapRadians, wrapDegrees, createPID, pidTorque, localToWorld, worldToLocal,
  compilePath, samplePath, interpolatePose, triangulateConvexParts } = context.GVYArenaMotion;
const point = (x, y) => ({ x, y });
const plain = (value) => JSON.parse(JSON.stringify(value));
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const area = (polygon) => Math.abs(polygon.reduce((s, p, i) => {
  const q = polygon[(i + 1) % polygon.length]; return s + p.x * q.y - q.x * p.y;
}, 0)) / 2;
const insideTriangle = (p, [a, b, c]) => [cross(a, b, p), cross(b, c, p), cross(c, a, p)].every((v) => v >= -1e-12);

test("angle wrapping preserves original positive half-turn boundary and finite invalid fallback", () => {
  for (const value of [-1080, -360, 0, 360, 1080]) near(wrapDegrees(value), 0);
  for (const value of [-540, -180, 180, 540]) near(wrapDegrees(value), 180);
  near(wrapDegrees(181), -179); near(wrapDegrees(-181), 179);
  near(wrapRadians(-Math.PI), Math.PI); near(wrapRadians(Math.PI * 5), Math.PI);
  for (const value of [NaN, Infinity, -Infinity, undefined, "90"]) {
    assert.equal(wrapDegrees(value), 0); assert.equal(wrapRadians(value), 0);
  }
});

test("PID matches native P + accumulated I + first difference D without anti-windup", () => {
  const pid = createPID(2, 3, 4);
  near(pid.step(1, .5), 11.5); near(pid.step(2, .5), 16.5); near(pid.step(2, 1), 14.5);
  pid.reset(2); near(pid.step(2, .5), 7);
  const integral = createPID(0, 1, 0);
  for (let i = 1; i <= 100; i++) near(integral.step(1, 1), i);
  near(integral.step(-1, 1), 99);
});

test("invalid or overflowing PID steps return zero without corrupting a valid session", () => {
  const pid = createPID(1, 1, 1); pid.reset(1); near(pid.step(1, 1), 2);
  for (const dt of [0, -1, NaN, Infinity, undefined]) assert.equal(pid.step(20, dt), 0);
  for (const error of [NaN, Infinity, undefined]) assert.equal(pid.step(error, .02), 0);
  assert.equal(pid.step(Number.MAX_VALUE, Number.MAX_VALUE), 0);
  near(pid.step(1, 1), 3);
  assert.throws(() => createPID(1, NaN, 0), /Finite PID/);
});

test("torque sends short wrapped degree errors and clamps the error rather than PID output", () => {
  const pid = createPID(2, 0, 0);
  near(pidTorque(pid, point(0, 0), point(0, 1), 0, 30, .02), 60);
  near(pidTorque(pid, point(0, 0), point(Math.cos(-Math.PI + .01), Math.sin(-Math.PI + .01)),
    Math.PI - .01, 30, .02), .04 * 180 / Math.PI);
  assert.equal(pidTorque(pid, point(0, 0), point(0, 1), 0, 30, 0), 0);
  assert.equal(pidTorque(pid, point(NaN, 0), point(0, 1), 0, 30, .02), 0);
});

test("grip matrix has an exact known quarter-turn and invertible mirrored transforms", () => {
  const world = localToWorld(point(2, 1), point(10, 20), Math.PI / 2, 3, -1);
  near(world.x, 7); near(world.y, 14);
  for (const angle of [-Math.PI, -2, 0, .7, Math.PI]) for (const scale of [.1, 2, 30]) for (const mirror of [-1, 1]) {
    const p = point(.12, -.95), origin = point(82, -17);
    const actual = worldToLocal(localToWorld(p, origin, angle, scale, mirror), origin, angle, scale, mirror);
    near(actual.x, p.x); near(actual.y, p.y);
    assert.deepEqual(plain(localToWorld(point(0, 0), origin, angle, scale, mirror)), origin);
  }
  for (const fn of [localToWorld, worldToLocal]) {
    assert.equal(fn(point(1, 2), point(0, 0), 0, 0), null);
    assert.equal(fn(point(1, 2), point(0, 0), Infinity), null);
    assert.equal(fn(point(1, 2), point(0, 0), 0, 1, 0), null);
    assert.equal(fn(point(Infinity, 0), point(0, 0), 0), null);
  }
});

test("pose interpolation crosses pi continuously through the short arc and clamps alpha", () => {
  const a = { x: 0, y: 8, angle: 179 * Math.PI / 180 }, b = { x: 10, y: 2, angle: -179 * Math.PI / 180 };
  const middle = interpolatePose(a, b, .5);
  near(middle.x, 5); near(middle.y, 5); near(middle.angle, Math.PI);
  let previous = a.angle;
  for (let i = 1; i <= 100; i++) {
    const current = interpolatePose(a, b, i / 100).angle;
    near(wrapRadians(current - previous), .02 * Math.PI / 180); previous = current;
  }
  near(interpolatePose(a, b, -1).x, 0); near(interpolatePose(a, b, 2).x, 10);
  assert.equal(interpolatePose(a, b, NaN), null);
  assert.equal(interpolatePose(a, { ...b, angle: Infinity }, .5), null);
});

test("two-point paths include both endpoints and travel by distance, including stationary paths", () => {
  const path = compilePath([point(0, 0), point(10, 0)]);
  near(path.length, 10); assert.equal(path.points.length, 6);
  for (let i = 0; i <= 10; i++) {
    const p = samplePath(path, i / 10); near(p.x, i); near(p.y, 0);
  }
  assert.deepEqual(plain(samplePath(path, -1)), point(0, 0));
  assert.deepEqual(plain(samplePath(path, 2)), point(10, 0));
  const still = compilePath([point(3, 4), point(3, 4)]);
  assert.equal(still.length, 0); assert.deepEqual(plain(samplePath(still, .7)), point(3, 4));
});

test("curved Catmull-Rom paths pass authored waypoints with nearly uniform arc-length motion", () => {
  const authored = [point(0, 0), point(2, 0), point(4, 2), point(6, 2)];
  const path = compilePath(authored, 20);
  authored.forEach((p, i) => assert.deepEqual(plain(path.points[i * 20]), p));
  const distances = [];
  let previous = samplePath(path, 0);
  for (let i = 1; i <= 200; i++) {
    const p = samplePath(path, i / 200);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    distances.push(Math.hypot(p.x - previous.x, p.y - previous.y)); previous = p;
  }
  assert.ok(Math.max(...distances) / Math.min(...distances) < 1.02);
  near(distances.reduce((a, b) => a + b, 0), path.length, .005);
  assert.ok(Object.isFrozen(path) && Object.isFrozen(path.points) && Object.isFrozen(path.points[0]));
  authored[0].x = 999; near(samplePath(path, 0).x, 0);
});

test("invalid and oversized paths fail explicitly and never leak NaN into a pose", () => {
  for (const input of [null, [], [point(NaN, 0)], Array(257).fill(point(1, 1))]) assert.equal(compilePath(input), null);
  for (const resolution of [0, -1, 1.5, 65, Infinity]) assert.equal(compilePath([point(0, 0), point(1, 1)], resolution), null);
  assert.equal(compilePath([point(Number.MAX_VALUE, 0), point(-Number.MAX_VALUE, 1)]), null);
  assert.equal(samplePath({}, .5), null); assert.equal(samplePath(null, .5), null);
  assert.equal(samplePath(compilePath([point(0, 0)]), NaN), null);
});

// Exact original PolygonCollider2D local paths, sharedassets0.assets pathIDs
// 774 (Sword), 778 (Axe), 772 (Spear), 759 (MorningStar), 776 (Pitchfork).
// Static evidence: original-weapon-geometry.json, archive SHA256 0d943e7e...56c1c.
const weaponPolygons = {
  sword: [[.07270669937133789,-.5793833136558533],[.048101186752319336,1.2192261219024658],[-.0016120672225952148,1.426862120628357],[-.044831156730651855,1.2122557163238525],[-.07183229923248291,-.5724424719810486],[-.3411980867385864,-.5996217131614685],[-.0761193037033081,-.7296955585479736],[-.1008450984954834,-1.3826814889907837],[.09719105064868927,-1.384110450744629],[.07723033428192139,-.730516254901886],[.3323851227760315,-.6030197739601135]],
  axe: [[-.008888889104127884,-.4555555582046509],[-.014068638905882835,.4829443097114563],[.19111111760139465,.3844444453716278],[.25198572874069214,.5191826820373535],[.2667241096496582,.7133333683013916],[-.26767945289611816,.663276731967926],[-.18666666746139526,.1088888943195343],[-.16324517130851746,-.6822222471237183],[-.02222222276031971,-.7133333683013916],[.0315343514084816,-.6197180151939392]],
  spear: [[.0005270764231681824,1.64314603805542],[-.11077302694320679,1.1108065843582153],[-.07909940183162689,-1.638691782951355],[.07280649989843369,-1.6388263702392578],[.0950000137090683,-.25333335995674133],[.10401313006877899,1.1153736114501953]],
  mace: [[.05354975908994675,.6268880367279053],[.2018551379442215,.6567335724830627],[.2702656686306,.8074941039085388],[.2152489423751831,1.0654525756835938],[.00002748984843492508,1.1839067935943604],[-.22028090059757233,1.0550693273544312],[-.28353559970855713,.8050121665000916],[-.20099890232086182,.6581117510795593],[-.06158717721700668,.6224046349525452],[-.0684361457824707,-1.2763633728027344],[.06862209737300873,-1.2763116359710693]],
  pitchfork: [[-.2530933618545532,1.460031509399414],[-.21660852432250977,.8690534234046936],[-.05568109080195427,.8525901436805725],[-.05176911875605583,-1.4792160987854004],[.053031355142593384,-1.4798542261123657],[.052400365471839905,.8522398471832275],[.21455389261245728,.8709040284156799],[.24702028930187225,1.4605939388275146]],
};

test("real original weapon silhouettes decompose fully, preserve area, bounds, handedness and concave gaps", () => {
  for (const coordinates of Object.values(weaponPolygons)) for (const winding of [coordinates, [...coordinates].reverse()]) {
    const polygon = winding.map(([x, y]) => point(x, y));
    const before = JSON.stringify(polygon), triangles = triangulateConvexParts(polygon);
    assert.equal(triangles.length, polygon.length - 2);
    near(triangles.reduce((sum, triangle) => sum + area(triangle), 0), area(polygon));
    for (const triangle of triangles) {
      assert.equal(triangle.length, 3); assert.ok(cross(...triangle) > 0);
      assert.ok(triangle.every((p) => polygon.some((q) => q.x === p.x && q.y === p.y)));
    }
    assert.equal(JSON.stringify(polygon), before);
  }
  const sword = triangulateConvexParts(weaponPolygons.sword);
  assert.ok(!sword.some((triangle) => insideTriangle(point(.25, -.4), triangle)), "crossguard concavity must not become a convex hull");
  assert.ok(sword.some((triangle) => insideTriangle(point(0, .5), triangle)), "blade center must remain solid");
});

test("polygon cleanup accepts closure, adjacent duplicates and collinear boundary points", () => {
  const polygon = [[0,0],[1,0],[1,0],[2,0],[2,2],[0,2],[0,0]];
  const triangles = triangulateConvexParts(polygon);
  assert.equal(triangles.length, 2); near(triangles.reduce((s, p) => s + area(p), 0), 4);
  const regular = Array.from({ length: 64 }, (_, i) => point(Math.cos(i * Math.PI / 32), Math.sin(i * Math.PI / 32)));
  assert.equal(triangulateConvexParts(regular).length, 62);
});

test("self intersections, self touches, overlaps, zero area and invalid polygons never return partial colliders", () => {
  const invalid = [null, [], [[0,0],[1,1]], [[0,0],[2,2],[0,2],[2,0]],
    [[0,0],[2,0],[1,0],[2,2],[0,2]], [[0,0],[2,0],[2,2],[1,0],[0,2]],
    [[0,0],[1,0],[2,0]], [[0,0],[1,0],[0,0],[0,1]], [[0,0],[NaN,1],[1,0]],
    Array.from({ length: 65 }, (_, i) => point(Math.cos(i), Math.sin(i)))];
  for (const polygon of invalid) assert.deepEqual(plain(triangulateConvexParts(polygon)), []);
});
