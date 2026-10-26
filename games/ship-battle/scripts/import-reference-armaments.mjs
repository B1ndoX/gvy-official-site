/** Fill only missing weapon-card records from the bot's public RSI/supplemental data. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),source=path.resolve(process.argv[2]);
const loadFile=new URL('src/data/fleet-weapon-loadouts.json',root),catalogFile=new URL('src/data/weapon-catalog.json',root);
const loads=JSON.parse(fs.readFileSync(loadFile)),catalog=JSON.parse(fs.readFileSync(catalogFile)),ships=JSON.parse(fs.readFileSync(new URL('src/data/ships.json',root)));
const matrixFile=path.join(source,'../data/shipmatrix-index.json'),supplementFile=path.join(source,'ship-supplemental.json');
const matrix=JSON.parse(fs.readFileSync(matrixFile)).data,supplement=JSON.parse(fs.readFileSync(supplementFile)).ships;
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,''),integer=n=>Number.isInteger(Number(n))&&Number(n)>0?Number(n):null;
const inputs=Object.fromEntries([matrixFile,supplementFile].map(file=>[path.basename(file),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
function weapon(size,name,kind='gun'){
 const found=Object.values(catalog.weapons).find(w=>w.size===size&&norm(w.name)===norm(name));if(found)return found.id;
 const defense=/PDT|PDC|PDS/.test(name),beam=/Laser$|Beam/.test(name)&&size>=10;
 const family=defense?'repeater':beam?'beam':kind==='torpedo'?'torpedo':kind==='missile'?'missile':/Gatling/i.test(name)?'gatling':/Ballistic/i.test(name)?'ballistic-cannon':/Repeater/i.test(name)?'repeater':'energy-cannon';
 const id=`reference-s${size}-${defense?'pdc':beam?'beam':kind==='gun'?`weapon-${family}`:kind}`;
 catalog.weapons[id]??={id,name:`Size ${size} ${defense?'PDC':beam?'beam':kind}`,nameZh:defense?'点防炮':beam?'主光束':kind==='torpedo'?'鱼雷（型号未公开）':kind==='missile'?'导弹（型号未公开）':'武器（型号未公开）',size,type:family,family,category:kind==='gun'?'gun':'ordnance',damage:null,rpm:null,speed:kind==='torpedo'?270:kind==='missile'?650:1000,...(defense?{interceptsOnly:true}:{}),referenceOnly:true,note:'Source confirms size/count only; unpublished model and live performance are not invented. Game parameters are size-based estimates.'};
 return id;
}
const audit={inputs,ships:{}};
for(const ship of ships){
 if(['snapshot','unarmed'].includes(loads.ships[ship.id].status))continue;
 const alternate={'endeavor-master-set':'Endeavor','nautilus-solstice':'Nautilus Solstice Edition','genesis-starliner':'Genesis'}[ship.id];
 const row=matrix.find(r=>norm(r.name)===norm(alternate??ship.name)||norm(r.name)===norm(ship.id));
 const extra=ship.id==='mauler'?supplement.find(r=>/Mauler/.test(r.name)):null;
 const systems=new Map(),unknown=[];
 const add=(id,count,banks)=>{const s=systems.get(id)??{weaponId:id,count:0,banks:[]};s.count+=count;if(banks)s.banks.push(...banks);systems.set(id,s);};
 if(row?.compiled?.RSIWeapon){
  for(const category of ['weapons','turrets','missiles'])for(const item of row.compiled.RSIWeapon[category]??[]){
   const mounts=integer(item.mounts),quantity=integer(item.quantity),name=String(item.name??'');
   if(!mounts){unknown.push({category,name,reason:'No confirmed count'});continue;}
   if(item.loadout?.length){for(const gun of item.loadout){const size=integer(gun.size),count=integer(gun.count);if(!size||!count){unknown.push({category,name,reason:'Incomplete installed loadout'});continue;}add(weapon(size,gun.name),mounts*count,Array(mounts).fill(count));}continue;}
   const size=integer(name.match(/S(\d+)/)?.[1])??integer(item.component_size)??integer(item.size);
   if(!size||!quantity||/Rack|Launcher|TBD Missile|Remote Missile Turret/i.test(name)){unknown.push({category,name,reason:'Unknown weapon size/model or launcher capacity; rack size is not missile size'});continue;}
   const kind=/Torpedo/i.test(name)?'torpedo':/Missile/i.test(name)?'missile':'gun';
   add(weapon(size,name,kind),mounts*quantity,kind==='gun'?Array(mounts).fill(quantity):null);
  }
 }
 if(extra){for(const item of extra.supplemental_system_rows??[]){if(!['武器','炮塔','主炮','副炮','导弹','鱼雷'].includes(item.label))continue;for(const part of item.value.split('/')){const m=part.trim().match(/^(\d+)组 S(\d+)$/);if(!m){unknown.push({label:item.label,value:part,reason:'Incomplete weapon row'});continue;}const count=Number(m[1]),size=Number(m[2]),name=ship.id==='mauler'&&size===10?'S10 Beam':`S${size} Weapon`;add(weapon(size,name),count,Array(count).fill(1));}}}
 if(systems.size){
  const sourceName=row?.name??extra.name;
  loads.ships[ship.id]={status:'reference',match:row?'bot-rsi-weapon-card':'bot-supplemental-weapon-card',sourceShip:sourceName,sourceURL:row?`https://robertsspaceindustries.com${row.url}`:extra.supplemental_source_url,systems:[...systems.values()].map(s=>({...s,...(!s.banks.length?{banks:undefined}:{})})),coverage:unknown.length?'partial':'size-and-count',unknown,note:'Only weapon-card fields. Unpublished model/type/performance remain explicitly estimated; no hull, shield, engine or other systems copied.'};
 }
 audit.ships[ship.id]={status:loads.ships[ship.id].status,source:row?.name??extra?.name??null,known:loads.ships[ship.id].systems,unknown,...(!systems.size?{reason:'No reliable weapon size/count in available weapon-card sources; original simulation retained, not claimed authentic.'}:{})};
}
// Keep the user-confirmed torpedo-module fit, now with its published finite capacity.
// CIG Retaliator brochure: front 4x S9, rear 2x S9; no unpublished model is invented.
for(const id of ['retaliator-base','retaliator-bomber']){
 const weaponId=weapon(9,'S9 Torpedo','torpedo'),record=loads.ships[id];
 record.systems=record.systems.filter(s=>s.weaponId!==weaponId);record.systems.push({weaponId,count:6});
 record.approvedModule={name:'Front and rear torpedo modules',sourceURL:'https://media.robertsspaceindustries.com/7b992m2rft3xu/source.pdf',size:9,capacity:6};
}
loads.referenceInputs=inputs;catalog.referenceInputs=inputs;
fs.writeFileSync(loadFile,JSON.stringify(loads,null,2)+'\n');fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');fs.writeFileSync(new URL('src/data/weapon-reference-audit.json',root),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({referenceShips:Object.values(loads.ships).filter(s=>s.status==='reference').length,fallback:Object.entries(loads.ships).filter(([,s])=>s.status==='fallback').map(([id])=>id)}));
