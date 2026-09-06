import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveBreakpointScroll} from '../assets/js/cinematic-timelines.js';

test('breakpoint transaction preserves scroll, not height-only changes; cleanup removes both hooks', () => {
  const listeners = new Map();
  const calls = [];
  const gsap = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if(listeners.get(name) === fn) listeners.delete(name); },
  };
  const view = {innerWidth:1512,scrollX:0,scrollY:4871,scrollTo: (options) => calls.push(options)};
  const cleanup = preserveBreakpointScroll(gsap, view);
  view.innerWidth = 390;
  listeners.get('matchMediaInit')();
  view.scrollY = 0;
  listeners.get('matchMedia')();
  assert.deepEqual(calls, [{left:0,top:4871,behavior:'instant'}]);
  listeners.get('matchMediaInit')();
  listeners.get('matchMedia')();
  assert.equal(calls.length, 1);
  view.innerWidth = 1512;
  view.scrollY = 4000;
  listeners.get('matchMediaInit')();
  listeners.get('matchMedia')();
  assert.equal(calls.length, 1, 'unchanged position must not interrupt native scrolling');
  cleanup();
  assert.equal(listeners.size, 0);
});
