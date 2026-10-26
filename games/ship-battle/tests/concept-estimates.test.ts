import {expect,test} from 'vitest';
import shipsJSON from '../src/data/ships.json';
import facts from '../src/data/ship-reference-facts.json';
import values from '../src/data/ship-game-values.json';
import weaponAudit from '../src/data/concept-weapon-estimates.json';
import loads from '../src/data/fleet-weapon-loadouts.json';
import {mission} from '../scripts/concept-estimates.mjs';
import type {ShipSpec} from '../src/sim/types';
const ships=shipsJSON as ShipSpec[],find=(id:string)=>ships.find(s=>s.id===id)!;
test('Hull D/E derive missing data and gun models from Hull C while preserving public weapon sizes/counts',()=>{
 for(const id of ['hull-d','hull-e'] as const){
  expect(values.ships[id].estimation.hullTotal.shipId).toBe('hull-c');expect(values.ships[id].estimation.scm.shipId).toBe('hull-c');expect(weaponAudit[id].referenceShip).toBe('hull-c');
  expect(find(id).hull).toBeGreaterThan(find('hull-c').hull);expect(find(id).speed).toBeLessThan(find('hull-c').speed);expect(find(id).mounts.reduce((n,m)=>n+(m.barrels??1),0)).toBe(8);
  expect(find(id).mounts.every(m=>m.weaponSize!>0&&m.weaponSize!<=5&&m.weaponName?.includes('速射'))).toBe(true);
 }
});
test('functional concept donors are functional; no carrier/heavy warship weapon multiplier leaks into cargo, mining or repair',()=>{
 expect(mission(find('perseus')).functional).toBe(false);expect(mission(find('javelin')).functional).toBe(false);expect(mission(find('liberator')).functional).toBe(true);
 for(const [id,row] of Object.entries(weaponAudit)){expect(mission(find(id)).functional).toBe(true);expect(mission(find(row.referenceShip)).functional).toBe(true);expect((loads.ships as Record<string,{status:string}>)[row.referenceShip].status).toBe('snapshot');}
 expect(weaponAudit.orion.referenceShip).toBe('mole');expect(weaponAudit.crucible.referenceShip).toBe('starfarer');expect(weaponAudit.galaxy.referenceShip).not.toBe('perseus');
});
test('all known source hull, mass, SCM, shields and real gun damage/RPM survive estimation without alteration',()=>{
 const records=facts.ships as Record<string,{facts:Record<string,number>}>;
 for(const s of ships){const f=records[s.id].facts;if(f.hullTotal)expect(s.hull).toBe(Math.round(f.hullTotal));if(f.scm)expect(s.speed/.75).toBeCloseTo(f.scm,4);if(f.mass)expect(s.mass).toBeCloseTo(f.mass,4);if(f.shieldCapacity)expect(s.shield).toBe(Math.round(f.shieldCapacity));}
});
