/** Offline, read-only import of physical/combat facts from the bot's public snapshots. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),source=path.resolve(process.argv[2]??'');
const inputs=['ship-loadouts-erkul.json','component-matrix-erkul.json','ship-supplemental.json','../data/shipmatrix-index.json','ship-capacities-wiki.json'];
const [load,components,supplement,matrix,normalized]=inputs.map(p=>JSON.parse(fs.readFileSync(path.join(source,p))));
if(load.version!==components.version)throw Error('Physical and component snapshots must have matching versions');
const ships=JSON.parse(fs.readFileSync(new URL('src/data/ships.json',root))),fits=JSON.parse(fs.readFileSync(new URL('src/data/fleet-weapon-loadouts.json',root))).ships;
const artwork=JSON.parse(fs.readFileSync(new URL('docs/starjump-sources.json',root))).assets;
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,''),number=v=>{const n=Number(String(v??'').replaceAll(',',''));return Number.isFinite(n)&&n>0?n:null;};
const median=a=>{const v=a.filter(n=>n>0).sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length?v.length%2?v[i]:(v[i-1]+v[i])/2:null;};
const live=Object.values(load.ships),official=matrix.data,extra=supplement.ships;
const seconds=v=>number(String(v??'').replace(/s$/,''));
const shieldRows=components.categories.shield.rows.map(r=>({name:r.values[1],size:number(r.values[0]),class:r.values[3],grade:r.values[4],capacity:number(r.values[5]),regen:number(r.values[6]),delay:seconds(r.values[7]),downDelay:seconds(r.values[8])}));
const result={version:1,snapshotVersion:load.version,inputs:Object.fromEntries(inputs.map(p=>[path.basename(p),crypto.createHash('sha256').update(fs.readFileSync(path.join(source,p))).digest('hex')])),notes:['hullTotal is the source totalHp, not independently verified core-destruction HP.','Shield component capacity is distinct from armor HP and component health. Ambiguous model variants retain a range and use its median, never claim an exact equipped variant.','Physical beam is retained separately from the original artwork projection width. No prices, fuel, cargo, descriptions or unrelated bot fields are imported.'],ships:{}};
for(const ship of ships){
 const fit=fits[ship.id],names=[ship.id,ship.name,fit.sourceShip].filter(Boolean).map(norm);
 const l=live.find(x=>names.includes(norm(x.name))||names.includes(norm(x.shortName)));
 const alias={'endeavor-master-set':'Endeavor','nautilus-solstice':'Nautilus Solstice Edition','genesis-starliner':'Genesis'}[ship.id];
 const m=official.find(x=>names.includes(norm(x.name))||norm(x.name)===norm(alias));
 const e=extra.find(x=>names.includes(norm(x.name))||(x.aliases??[]).some(a=>names.includes(norm(a))));
 const n=Object.values(normalized.ships).find(x=>names.includes(norm(x.name))||(x.aliases??[]).some(a=>names.includes(norm(a))));
 const facts={},provenance={},missing=[];
 const field=(key,candidates)=>{for(const [value,origin]of candidates){const n=number(value);if(n!==null){facts[key]=n;provenance[key]=origin;return;}}missing.push(key);};
 for(const key of ['length','beam','height'])field(key,[[n?.specs?.[key],`bot-normalized:${n?.version}`],[m?.[key],'rsi-matrix'],[l?.specs?.[key],'erkul-snapshot'],[e?.[key],'bot-supplement']]);
 for(const [key,raw]of [['mass','mass'],['scm','scm_speed']])field(key,[[l?.specs?.[raw],'erkul-snapshot'],[m?.[raw],'rsi-matrix'],[e?.[raw],'bot-supplement']]);
 field('yawDegrees',[[m?.yaw_max,'rsi-matrix']]);
 field('hullTotal',[[l?.body?.hull_hp,'erkul-snapshot'],[e?.supplemental_body?.hull_hp,'bot-supplement']]);
 field('armorHealth',[[l?.body?.armor_hp,'erkul-snapshot'],[e?.supplemental_body?.armor_hp,'bot-supplement']]);
 const mods=l?.body?.damage_modifier??e?.supplemental_body?.damage_modifier??'';
 for(const [key,label]of [['physicalDamageMultiplier','物理'],['energyDamageMultiplier','能量']])field(key,[[mods.match(new RegExp(label+'[:：]?\\s*([0-9.]+)'))?.[1],l?.body?.damage_modifier?'erkul-snapshot':'bot-supplement']]);
 const shields=[],unknownShields=[];
 const install=(count,size,name,componentClass,grade,origin)=>{
  if(!(count>0)){unknownShields.push({reason:'Unknown shield generator count',origin});return;}
  const models=name?shieldRows.filter(s=>norm(s.name)===norm(name)&&(!size||s.size===size)):[];
  const candidates=models.length?models:size?shieldRows.filter(s=>s.size===size&&(!componentClass||s.class===componentClass)&&(!grade||s.grade===grade)):[];
  const values=[...new Set(candidates.map(s=>s.capacity).filter(n=>n>0))];
  if(values.length){shields.push({count,size,model:name??null,capacity:median(values),capacityRange:[Math.min(...values),Math.max(...values)],regen:median(candidates.map(s=>s.regen)),delay:median(candidates.map(s=>s.delay)),downDelay:median(candidates.map(s=>s.downDelay)),status:models.length?(values.length===1?'model':'ambiguous-model'):'size-class-estimate',origin});}
  else unknownShields.push({count,size,model:name??null,reason:'No verified matching capacity in same-version component table',origin});
 };
 const modular=m?.compiled?.RSIModular?.shield_generators;
 if(modular?.length)for(const s of modular)install(number(s.mounts)* (number(s.quantity)??1),number(s.size),s.name,null,null,'rsi-matrix');
 else for(const row of l?.rows??e?.supplemental_system_rows??[]){if(row.label!=='护盾')continue;const p=row.value.match(/^(\d+)组 S(\d+)\s*(.*)$/);if(p){const type=p[3].match(/^(工业|军用|民用|隐身|竞速)/)?.[1],grade=p[3].match(/([A-D])$/)?.[1];install(Number(p[1]),Number(p[2]),null,type,grade,l?'erkul-snapshot':'bot-supplement');}}
 if(shields.length&&!unknownShields.length){facts.shieldCapacity=shields.reduce((n,s)=>n+s.count*s.capacity,0);provenance.shieldCapacity=shields.every(s=>s.status==='model')?'component-model':'component-estimate';
  if(shields.every(s=>s.regen>0)){facts.shieldRegen=shields.reduce((n,s)=>n+s.count*s.regen,0);provenance.shieldRegen=provenance.shieldCapacity;}
  if(shields.every(s=>s.delay>0&&s.downDelay>0)){facts.shieldDelay=Math.max(...shields.map(s=>s.delay));facts.shieldDownDelay=Math.max(...shields.map(s=>s.downDelay));provenance.shieldDelay=provenance.shieldDownDelay=provenance.shieldCapacity;}
 }else missing.push('shieldCapacity');
 const art=artwork.find(a=>a.shipId===ship.id);
 const geometryConflict=!!facts.length&&(facts.length/art.length>1.6||facts.length/art.length<.625);
 result.ships[ship.id]={sourceName:l?.name??m?.name??e?.name??null,sourceURL:m?`https://robertsspaceindustries.com${m.url}`:e?.supplemental_source_url??null,facts,provenance,missing,shields,unknownShields,...(geometryConflict?{geometryConflict:{sourceLength:facts.length,artworkLength:art.length,reason:'Source axes, posture or revision disagree substantially with retained model scale. Preserve raw facts; use explicit artwork estimate pending verification.'}}:{}),...(!facts.length||geometryConflict?{fallbackGeometry:{length:art.length,projectionRatio:art.height/art.width},note:'Retained artwork length is an explicit estimate, not a verified official physical measurement.'}:{})};
}
fs.writeFileSync(new URL('src/data/ship-reference-facts.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ships:ships.length,coverage:Object.fromEntries(['length','beam','height','mass','scm','yawDegrees','hullTotal','shieldCapacity'].map(k=>[k,Object.values(result.ships).filter(s=>s.facts[k]>0).length]))}));
