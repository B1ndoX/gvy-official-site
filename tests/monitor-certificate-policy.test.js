import assert from "node:assert/strict";
import test from "node:test";

import {
  CERTIFICATE_CRITICAL_DAYS,
  CERTIFICATE_WARNING_DAYS,
  classifyCertificateLifetime,
} from "../scripts/monitor-certificate-policy.mjs";

test("certificate policy warns before the EdgeOne renewal window without opening an incident", () => {
  assert.equal(CERTIFICATE_WARNING_DAYS, 21);
  assert.equal(CERTIFICATE_CRITICAL_DAYS, 14);
  assert.equal(classifyCertificateLifetime(30), "ok");
  assert.equal(classifyCertificateLifetime(20.8), "warning");
  assert.equal(classifyCertificateLifetime(14), "warning");
});

test("certificate policy becomes critical only after the renewal window has started", () => {
  assert.equal(classifyCertificateLifetime(13.99), "critical");
  assert.equal(classifyCertificateLifetime(0), "critical");
});

test("certificate policy rejects invalid or inverted thresholds", () => {
  assert.throws(() => classifyCertificateLifetime(Number.NaN), /finite/);
  assert.throws(
    () => classifyCertificateLifetime(30, { warningDays: 14, criticalDays: 14 }),
    /greater than/,
  );
});
