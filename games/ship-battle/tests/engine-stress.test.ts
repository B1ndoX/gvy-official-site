import { expect, test } from 'vitest';
import data from '../src/data/ships.json';
import { BattleEngine } from '../src/sim/engine';
import type { ShipSpec } from '../src/sim/types';
const specs=data as ShipSpec[];

// Keep the sustained stress run in a fresh worker, separate from reduced-defense fixtures.
 test('600 simulated seconds of continuous 30-ship combat remains bounded',()=>{const durable=specs.map(s=>({...s,hull:s.hull*500,shield:s.shield*500,shieldRegen:0}));const e=new BattleEngine();e.reset([{specId:'gladius',count:30}],durable,7);e.start();for(let i=0;i<600*60;i++)e.step();expect(e.time).toBeCloseTo(600,3);expect(e.phase).toBe('running');expect(e.living.length).toBeGreaterThan(1);expect(e.projectiles.length).toBeLessThan(3500);expect(e.events.length).toBeLessThanOrEqual(800);expect(e.ships.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y))).toBe(true);},30000);
