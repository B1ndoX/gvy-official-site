import assert from "node:assert/strict";
import test from "node:test";

import { selectOperationIndex } from "../assets/js/cinematic-timelines.js";

const OPERATION_COUNT = 4;
const BOUNDARIES = [2.28, 4.78, 7.28];

test("minor scroll reversals keep the current operation on either side of every boundary", () => {
  BOUNDARIES.forEach((boundary, index) => {
    for (const startingOperation of [index, index + 1]) {
      let active = startingOperation;
      for (let repetition = 0; repetition < 10; repetition += 1) {
        for (const time of [boundary - 0.012, boundary + 0.012]) {
          active = selectOperationIndex(time, active, OPERATION_COUNT);
          assert.equal(active, startingOperation,
            `Small reversals at boundary ${index + 1} must not restart the neighbouring operation`);
        }
      }
    }
  });
});

test("deliberate forward and backward scrolling still switches every neighbouring operation", () => {
  BOUNDARIES.forEach((boundary, index) => {
    let active = selectOperationIndex(boundary + 0.06, index, OPERATION_COUNT);
    assert.equal(active, index + 1);

    active = selectOperationIndex(boundary - 0.06, active, OPERATION_COUNT);
    assert.equal(active, index);
  });
});

test("a large scroll or operation jump can cross several scenes in either direction", () => {
  let active = selectOperationIndex(8.32, 0, OPERATION_COUNT);
  assert.equal(active, 3);

  active = selectOperationIndex(0.82, active, OPERATION_COUNT);
  assert.equal(active, 0);

  active = selectOperationIndex(8.32, active, OPERATION_COUNT);
  active = selectOperationIndex(3.32, active, OPERATION_COUNT);
  assert.equal(active, 1, "The latest selected operation must remain reachable after a long jump");
});

test("operation selection stays within the first and last scene", () => {
  assert.equal(selectOperationIndex(-100, 3, OPERATION_COUNT), 0);
  assert.equal(selectOperationIndex(100, 0, OPERATION_COUNT), 3);
  assert.equal(selectOperationIndex(0, -10, OPERATION_COUNT), 0);
  assert.equal(selectOperationIndex(10.38, 10, OPERATION_COUNT), 3);
});
