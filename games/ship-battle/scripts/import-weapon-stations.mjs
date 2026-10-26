/** Read-only source installation structure; weapon names containing Turret are not enough. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),source=path.resolve(process.argv[2]),file=path.join(source,'../data/shipmatrix-index.json');
const matrix=JSON.parse(fs.readFileSync(file)).data,ships=JSON.parse(fs.readFileSync(new URL('src/data/ships.json',root))),fits=JSON.parse(fs.readFileSync(new URL('src/data/fleet-weapon-loadouts.json',root))).ships,catalog=JSON.parse(fs.readFileSync(new URL('src/data/weapon-catalog.json',root))).weapons;
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,''),short=s=>norm(String(s??'').replace(/^(Aegis|Anvil|Aopoa|Argo|Banu|C\.O\.|Crusader|Drake|Esperia|Gatac|Greycat|Kruger|MISC|Mirai|Origin|RSI|Tumbril|Vanduul)\s+/i,''));
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const result={version:1,inputSHA256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),source:'Bot-retained public RSI weapon installations; exact model matches first, size-only matches explicitly marked. Generic pilot-controlled turret/gimbal sockets stay forward firing.',ships:{}};
for(const ship of ships){
 const fit=fits[ship.id],names=[ship.name,ship.id,fit.sourceShip,fits[fit.variantOf]?.sourceShip,{'mercury-star-runner':'Mercury','endeavor-master-set':'Endeavor','nautilus-solstice':'Nautilus Solstice Edition','genesis-starliner':'Genesis'}[ship.id]].filter(Boolean).map(short);
 const row=matrix.find(r=>names.includes(short(r.name))),remaining=new Map(fit.systems.filter(s=>catalog[s.weaponId].category==='gun').map(s=>[s.weaponId,s.count])),systems=Object.fromEntries([...remaining.keys()].map(id=>[id,{stations:[],unclassified:0}])),unknown=[];
 const requests=[];
 if(row)for(const category of ['weapons','turrets'])for(const [index,item]of (row.compiled?.RSIWeapon?.[category]??[]).entries()){
  const seats=positive(item.mounts);if(!seats)continue;
  const name=String(item.name??'');
  const control=/remote turret/i.test(name)?'remote':category==='turrets'||/manned turret/i.test(name)?'manned':'pilot';
  // Empty turret/rack sockets say nothing about the weapon installed inside them.
  // In particular, a size-4 remote-turret socket must not consume a real S4 gun.
  if(/missile|rack|cap/i.test(name)||!item.loadout?.length&&!positive(item.component_size)&&/turret|mount/i.test(name)){
   unknown.push({category,name,reason:'Empty installation socket; no installed weapon asserted'});continue;
  }
  const installed=item.loadout?.length?item.loadout:[{name,size:positive(item.component_size)??positive(item.size),count:positive(item.quantity)??1}];
  // Old matrix rows with explicit component_size/quantity describe installed
  // size/count even when the model is unpublished. Keep that weaker evidence.
  for(const weapon of installed){const size=positive(weapon.size),count=positive(weapon.count);if(!size||!count){unknown.push({category,name,reason:'Unknown installed gun size/count'});continue;}
   for(let seat=0;seat<seats;seat++)requests.push({stationId:`rsi-${category}-${index+1}-${seat+1}`,control,name,weaponName:weapon.name,size,count,...(/forward.facing/i.test(name)?{arc:90}:{})});
  }
 }
 // Reserve exact models before using any size-only installation slot.
 const exact=req=>[...remaining.keys()].find(id=>catalog[id].size===req.size&&norm(catalog[id].name)===norm(req.weaponName));
 requests.sort((a,b)=>Number(!!exact(b))-Number(!!exact(a)));
 for(const req of requests){
  const precise=exact(req),beamRequest=/laser|beam/i.test(req.weaponName)&&!/cannon|repeater|gatling/i.test(req.weaponName);
  const choices=precise?[precise]:[...remaining.keys()].filter(id=>remaining.get(id)>0&&catalog[id].size===req.size&&(beamRequest?catalog[id].family==='beam':catalog[id].family!=='beam'));
  const candidate=choices.length===1?choices[0]:null;
  if(!candidate||remaining.get(candidate)<req.count){unknown.push({...req,reason:'No unambiguous matching active loadout capacity'});continue;}
  remaining.set(candidate,remaining.get(candidate)-req.count);systems[candidate].stations.push({...req,count:req.count,match:precise?'model-and-size':'size-only'});
 }
 for(const [id,count]of remaining){systems[id].unclassified=count;if(count)systems[id].stations.push({stationId:`unverified-${id}`,control:'pilot',count,match:'unverified-forward-fallback',name:'Unverified fire-control structure; no independent turret invented'});}
 result.ships[ship.id]={sourceName:row?.name??null,sourceURL:row?`https://robertsspaceindustries.com${row.url}`:null,systems,unknown};
}
fs.writeFileSync(new URL('src/data/weapon-stations.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ships:ships.length,matchedShips:Object.values(result.ships).filter(s=>s.sourceName).length,shipsWithUnclassified:Object.entries(result.ships).filter(([,s])=>Object.values(s.systems).some(x=>x.unclassified>0)).map(([id])=>id)}));
