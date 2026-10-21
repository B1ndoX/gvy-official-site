import {test,expect} from 'vitest';
import ships from '../src/data/ships.json';
import translations from '../src/data/ship-names-zh.json';
import {localizedShips} from '../src/data/localized-ships';
import {BattleEngine} from '../src/sim/engine';

test('all current ship display names are Chinese while IDs and combat data remain identical',()=>{
 expect(Object.keys(translations.names).sort()).toEqual(ships.map(s=>s.id).sort());
 localizedShips.forEach((s,i)=>{expect(s.name).toMatch(/[\u4e00-\u9fff]/);expect({...s,name:ships[i].name}).toEqual(ships[i]);});
 expect(translations.source.sha256).toBe('19c6e78aeec18ed2f055a2555af9449ffd16fc0152e51f8cee04de169ac97bd7');
});
test('standings and boss labels use translated names, preserving member names',()=>{
 const e=new BattleEngine();e.reset([{specId:'idris-p',count:1,member:{handle:'Pilot_EN',name:'Pilot_EN',avatar:''}},{specId:'mauler',count:1,npc:'boss'}],localizedShips,42);
 expect(e.ships.find(s=>s.npc==='boss')!.label).toBe('BOSS · 剜度 重拳 驱逐舰');
 expect(e.snapshot().standings.find(s=>s.specId==='idris-p')!.shipName).toBe('圣盾 伊德里斯-P');
 expect(e.ships[0].label).toBe('Pilot_EN');
});
