import type { ShipSpec, Mount, Vec } from '../sim/types';
import fleetLoadouts from '../data/fleet-weapon-loadouts.json';

export interface ShipAsset {
  shipId: string; url: string;
  author: string; source: string; permission: string;
  licenseStatus: 'permission-recorded' | 'user-directed-noncommercial';
  length: number; beam: number; noseDegrees: number; center: Vec;
  engines: Vec[]; mounts: Mount[]; calibrated: boolean; combatVersion?:number; turretLayoutVersion?:number; engineLayoutVersion?:number;
}
export interface AssetManifest { version: 1; assets: ShipAsset[] }
const DB='gvy-ship-battle-assets-v1';
async function database():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('ships',{keyPath:'shipId'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function localAssets():Promise<ShipAsset[]>{
  const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('ships').objectStore('ships').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}
}
export async function saveAssets(assets:ShipAsset[]){
  // Decode before committing so a corrupt JSON image cannot poison the persisted library.
  for(let start=0;start<assets.length;start+=4)await Promise.all(assets.slice(start,start+4).map(async asset=>{const response=await fetch(assetURL(asset));if(!response.ok)throw new Error(`${asset.shipId} 图片无法读取`);const bitmap=await createImageBitmap(await response.blob());const valid=bitmap.width>0&&bitmap.height>0&&bitmap.width<=4096&&bitmap.height<=4096;bitmap.close();if(!valid)throw new Error('图片最大为 4096 × 4096');}));
  const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('ships','readwrite');for(const a of assets)tx.objectStore('ships').put(a);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export const saveAsset=(asset:ShipAsset)=>saveAssets([asset]);
export async function deleteAsset(id:string){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('ships','readwrite');tx.objectStore('ships').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateAsset(value:unknown,ids:Set<string>):asserts value is ShipAsset {
  if(!value||typeof value!=='object')throw new Error('素材记录格式错误');
  const a=value as ShipAsset;
  if(!ids.has(a.shipId))throw new Error('未知舰船 ID');
  if(typeof a.url!=='string'||!(/^data:image\/(png|webp);base64,[A-Za-z0-9+/]{32,}={0,2}$/.test(a.url)||/^assets\/ships\/[a-zA-Z0-9_./-]+\.(png|webp)$/.test(a.url)&&!a.url.includes('..')))throw new Error('只接受 PNG/WebP 或本游戏素材目录');
  if(!finite(a.length,1,5000)||!finite(a.beam,1,5000)||!finite(a.noseDegrees,-360,360))throw new Error('长度、宽度或舰首角度无效');
  if(!a.center||!finite(a.center.x,0,1)||!finite(a.center.y,0,1))throw new Error('旋转中心必须位于图片范围内');
  if(!['permission-recorded','user-directed-noncommercial'].includes(a.licenseStatus)||![a.author,a.source,a.permission].every(s=>typeof s==='string'&&s.trim().length>1&&s.length<=3000))throw new Error('请保留作者、来源和使用许可记录');
  if(!Array.isArray(a.engines)||a.engines.length>32||!Array.isArray(a.mounts)||a.mounts.length>64||a.mounts.length===0&&(fleetLoadouts.ships as Record<string,{status:string}>)[a.shipId]?.status!=='unarmed')throw new Error('喷口最多 32 个，武器挂点最多64个（无武装舰可为空）');
  for(const p of [...a.engines,...a.mounts])if(!finite(p.x,-1,1)||!finite(p.y,-1,1))throw new Error('挂点坐标超出范围');
  const mountIds=new Set();
  for(const m of a.mounts){if(m.role!==undefined&&!['main','point-defense','anti-capital'].includes(m.role))throw new Error('武器定位不合法');if(typeof m.id!=='string'||mountIds.has(m.id)||!['laser','turret','missile','beam','railgun','torpedo','ballistic'].includes(m.kind)||!finite(m.facing,-180,180)||!finite(m.arc,1,360)||!finite(m.cooldown,.05,60)||!finite(m.damage,1,10000000)||!finite(m.range,10,10000)||!finite(m.speed,10,10000)||!finite(m.turnRate,.01,30))throw new Error('武器挂点参数不合法');
    if(m.weaponCount!==undefined&&(!Number.isInteger(m.weaponCount)||!finite(m.weaponCount,1,256))||m.interceptsOnly!==undefined&&(typeof m.interceptsOnly!=='boolean'||m.interceptsOnly&&m.kind!=='turret')||m.ammoReload!==undefined&&(!finite(m.ammoReload,1,120)||m.ammo===undefined)||m.pellets!==undefined&&(!Number.isInteger(m.pellets)||!finite(m.pellets,1,9))||m.scatterAngle!==undefined&&!finite(m.scatterAngle,0,.4)||m.weaponId!==undefined&&(typeof m.weaponId!=='string'||m.weaponId.length<1||m.weaponId.length>160)||m.damageType!==undefined&&m.damageType!=='distortion'||m.cooldownJitter!==undefined&&!finite(m.cooldownJitter,0,.3)||m.barrels!==undefined&&(!Number.isInteger(m.barrels)||!finite(m.barrels,1,8))||m.barrelSpacing!==undefined&&!finite(m.barrelSpacing,0,20)||m.ammo!==undefined&&(!Number.isInteger(m.ammo)||!finite(m.ammo,1,1000000))||m.launcherCount!==undefined&&(!Number.isInteger(m.launcherCount)||!finite(m.launcherCount,1,8)||m.kind!=='torpedo'||m.ammo===undefined)||m.projectileKind!==undefined&&(m.projectileKind!=='ballistic'||m.kind!=='turret')||m.impact!==undefined&&!['heavy-cannon','heavy-torpedo'].includes(m.impact)||m.impact==='heavy-torpedo'&&m.kind!=='torpedo'||m.impact==='heavy-cannon'&&(m.kind!=='turret'||m.projectileKind!=='ballistic')||m.weaponName!==undefined&&(typeof m.weaponName!=='string'||m.weaponName.length>120)||m.weaponSize!==undefined&&(!Number.isInteger(m.weaponSize)||!finite(m.weaponSize,1,20)))throw new Error('重型武器分组参数不合法');
    if(m.capacitor!==undefined&&(!Number.isInteger(m.capacitor)||!finite(m.capacitor,1,1000000)||m.ammo!==undefined)||m.resourceEstimated!==undefined&&typeof m.resourceEstimated!=='boolean')throw new Error('武器弹药或电容参数不合法');
    if(m.beamWidth!==undefined&&!finite(m.beamWidth,1,1000)||m.kind==='beam'&&!finite(m.duration,.1,8)||m.charge!==undefined&&!finite(m.charge,0,5)||m.emitters!==undefined&&(!Array.isArray(m.emitters)||m.emitters.length<1||m.emitters.length>12||!m.emitters.every(x=>finite(x,-.5,.5)))||m.width!==undefined&&!finite(m.width,.5,8)||m.color!==undefined&&!finite(m.color,0,0xffffff)||m.burstCount!==undefined&&(!Number.isInteger(m.burstCount)||!finite(m.burstCount,1,16))||m.burstCooldown!==undefined&&!finite(m.burstCooldown,.05,15))throw new Error('武器周期参数不合法');mountIds.add(m.id);}
  if(typeof a.calibrated!=='boolean')throw new Error('缺少校准状态');
}
export function withAssets(specs:ShipSpec[],assets:ShipAsset[]):ShipSpec[]{
  const map=new Map(assets.map(a=>[a.shipId,a]));
  return specs.map(s=>{const a=map.get(s.id);return a?{...s,length:a.length,beam:a.beam,engines:a.engines,mounts:a.mounts,calibration:a.calibrated?'verified':'draft'}:s;});
}
export const assetURL=(a:ShipAsset)=>a.url.startsWith('data:')?a.url:import.meta.env.BASE_URL+a.url;
export function upgradeCombat(local:ShipAsset,builtin:ShipAsset):ShipAsset{
  const combat=(local.combatVersion??0)<(builtin.combatVersion??0),layout=(local.turretLayoutVersion??0)<(builtin.turretLayoutVersion??0);
  const engineLayout=(local.engineLayoutVersion??0)<(builtin.engineLayoutVersion??0);
  if(!combat&&!layout&&!engineLayout)return local;
  const localMounts=new Map(local.mounts.map(m=>[m.id,m]));
  // Upgrade stock render geometry; explicit user calibrations and custom artwork remain theirs.
  const stockLayout=layout&&!local.calibrated&&local.url===builtin.url;
  const stockDimensions=combat&&!local.calibrated&&local.url===builtin.url&&(builtin.combatVersion??0)>=14;
  return {...local,...(engineLayout&&!local.calibrated&&local.url===builtin.url?{engines:builtin.engines}:{}),engineLayoutVersion:builtin.engineLayoutVersion,...(stockDimensions?{length:builtin.length,beam:builtin.beam}:{}),combatVersion:builtin.combatVersion,turretLayoutVersion:builtin.turretLayoutVersion,mounts:builtin.mounts.map(m=>{const old=localMounts.get(m.id),point=stockLayout&&(m.kind==='turret'||(builtin.combatVersion??0)>=11&&!!m.weaponId);return old?{...m,x:point?m.x:old.x,y:point?m.y:old.y,facing:m.fireControl==='pilot'?0:point?m.facing:old.facing,arc:m.fireControl==='pilot'?m.arc:point?m.arc:old.arc}:m;})};
}
export async function readLibrary(specs:ShipSpec[]):Promise<{assets:ShipAsset[];warning:string|null}>{
  const ids=new Set(specs.map(s=>s.id));
  const response=await fetch(import.meta.env.BASE_URL+'assets/ships/manifest.json');
  if(!response.ok)throw new Error('舰船素材清单加载失败');
  const manifest=await response.json() as AssetManifest;
  if(manifest.version!==1||!Array.isArray(manifest.assets))throw new Error('素材清单版本不支持');
  const combined=new Map<string,ShipAsset>();for(const a of manifest.assets){validateAsset(a,ids);combined.set(a.shipId,a);}
  let warning:string|null=null;
  try{for(const a of await localAssets()){validateAsset(a,ids);const builtin=combined.get(a.shipId)!;combined.set(a.shipId,upgradeCombat(a,builtin));}}catch{warning='浏览器本地图库不可用；内置素材仍可使用。';}
  return {assets:[...combined.values()],warning};
}
export function downloadJSON(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// Importer processing removes transparent margins; it never creates or invents ship artwork.
export async function prepareImage(file:File):Promise<string>{
  if(!['image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('请选择不超过 12 MB 的 PNG 或 WebP');
  const bitmap=await createImageBitmap(file);
  if(bitmap.width>4096||bitmap.height>4096){bitmap.close();throw new Error('图片最大为 4096 × 4096');}
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(bitmap,0,0);bitmap.close();
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=canvas.width,right=-1,top=canvas.height,bottom=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('这是一张完全透明的图片');
  const result=document.createElement('canvas');result.width=right-left+1;result.height=bottom-top+1;result.getContext('2d')!.drawImage(canvas,left,top,result.width,result.height,0,0,result.width,result.height);
  return result.toDataURL('image/png');
}
