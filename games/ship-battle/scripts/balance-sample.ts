// Reproducible headless calibration. Trial overrides affect this process only.
import fs from 'node:fs';
import data from '../src/data/ships.json';
import people from '../src/data/members.json';
import rules from '../src/data/boss-mode-balance.json';
import {BattleEngine} from '../src/sim/engine.ts';
import {battleRoster,assignMemberShips} from '../src/sim/members.ts';
const cases=[];const count=Number(process.env.CASES??32),offset=Number(process.env.OFFSET??0),modes=(process.env.MODES??'bounty,challenge').split(',');
if(process.env.DAMAGE)rules.damageMultiplier=Number(process.env.DAMAGE);
if(process.env.DEFENSE)rules.bountyDefenseMultiplier=Number(process.env.DEFENSE);
if(process.env.BUDGET)rules.challengeBudgetMultiplier=Number(process.env.BUDGET);
for(const mode of modes){let wins=0,stuck=0,totalTime=0;
for(let seed=offset+1;seed<=offset+count;seed++){
 const e=new BattleEngine(),rows=assignMemberShips(people.members,data,seed);e.reset(battleRoster(rows,mode,seed),data,seed,mode);e.start();let firstKill=null,firstBossDeath=null,peak=0,moving=0,samples=0;
 for(let i=0;i<1200*60&&e.phase==='running';i++){e.step();if(i%120===0){for(const s of e.living){if(Math.hypot(s.vx,s.vy)>s.spec.speed*.1)moving++;samples++;}peak=Math.max(peak,e.projectiles.length);}if(firstKill===null&&e.ships.some(s=>!s.alive&&!s.npc))firstKill=e.time*.75;if(firstBossDeath===null&&e.ships.some(s=>!s.alive&&s.npc==='boss'))firstBossDeath=e.time*.75;}
 const won=e.outcome==='players';wins+=Number(won);stuck+=Number(e.phase!=='finished');totalTime+=e.time*.75;
 cases.push({mode,seed,win:won,phase:e.phase,time:+(e.time*.75).toFixed(1),wave:e.wave,alive:e.living.filter(s=>!s.npc).length,boss:e.snapshot().boss?.spec.id,winner:e.snapshot().winner?.specId,firstKill,firstBossDeath,collisionDeaths:e.collisionDeaths,moving:moving/Math.max(1,samples),peak,large:rows.filter(r=>data.find(s=>s.id===r.specId).length>=100).length,bombers:rows.filter(r=>data.find(s=>s.id===r.specId).doctrine==='bomber').length});
 if(seed%8===0)process.stdout.write(JSON.stringify({mode,done:seed-offset,wins,stuck,mean:Math.round(totalTime/(seed-offset))})+'\n');
}
process.stdout.write(JSON.stringify({mode,cases:count,wins,rate:wins/count,stuck,mean:Math.round(totalTime/count),damage:rules.damageMultiplier,defense:rules.bountyDefenseMultiplier,budget:rules.challengeBudgetMultiplier})+'\n');}
if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify({parameters:{count,offset,modes,memberCount:people.members.length,rules},cases},null,2));
