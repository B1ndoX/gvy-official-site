import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../src/data/defense-balance.json',import.meta.url),'utf8'));
const file=new URL('../src/data/ships.json',import.meta.url),ships=JSON.parse(await readFile(file,'utf8'));
function roleFor(ship){
  const r=ship.role.toLowerCase();
  if(/重型战斗机|heavy fighter/.test(r))return 'fighter-heavy';
  if(/中型战斗机|medium fighter/.test(r))return 'fighter-medium';
  if(/隐形|stealth/.test(r))return 'stealth';
  if(/racing/.test(r))return 'racing';
  if(/fighter|战斗机/.test(r))return 'fighter-light';
  if(/armored|military transport|dropship/.test(r))return 'armored-transport';
  if(/gunship|炮|护卫|驱逐|巡逻|bomber|carrier|frigate|destroyer|battle cruiser|dreadnaught|interdiction|boarding|combat patrol|combined arms|minelayer/.test(r))return 'military';
  if(/multi.?role|generalist/.test(r))return 'multirole';
  return 'civilian';
}
const round=n=>Math.round(n/50)*50;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function gradual(length,read){const x=config.referenceLengths;let i=0;while(i<x.length-1&&length>x[i+1])i++;if(i===x.length-1)return read(i);const t=clamp(Math.log(length/x[i])/Math.log(x[i+1]/x[i]),0,1);return read(i)+(read(i+1)-read(i))*t;}
for(const ship of ships){
  const tier=config.tiers.find(t=>ship.length<t.maxLength)??config.tiers.at(-1),role=roleFor(ship),factor=config.roles[role],boss=config.bossBase[ship.id];
  ship.defenseTier=tier.id;ship.defenseRole=boss?'boss-base':role;
  ship.doctrine=/bomber|轰炸/i.test(ship.role)||/retaliator-bomber|eclipse|gladiator|a1-spirit|a2-hercules|vanguard-harbinger|polaris/.test(ship.id)?'bomber':/hammerhead|redeemer|paladin/.test(ship.id)?'escort':role.startsWith('fighter')||role==='stealth'?'interceptor':ship.length>=100?'capital':'balanced';
  ship.hull=(boss?.hull??round(gradual(ship.length,i=>config.tiers[i].hull)*factor.hull))*config.defenseMultiplier;ship.shield=(boss?.shield??round(gradual(ship.length,i=>config.tiers[i].shield)*factor.shield))*config.defenseMultiplier;
  ship.shieldRegen=Number((ship.shield*config.shieldRecoveryPerSecond).toFixed(2));
  const capital=ship.length>=100,heavy=ship.length>=35,profile=config.handling[capital?'large':heavy?'medium':'small'],mobility=config.roleMobility[role];
  ship.class=capital?'capital':heavy?'heavy':'fighter';
  const length=ship.length,t=clamp(Math.log(Math.max(12,length)/12)/Math.log(2800/12),0,1);
  ship.speed=Number(((32+280/(1+(length/55)**1.05))*mobility).toFixed(3));
  ship.acceleration=Number(((7+170/(1+(length/35)**1.2))*mobility).toFixed(3));
  ship.turnRate=Number(((.1+3.6/(1+(length/32)**1.2))*mobility).toFixed(3));
  const laserCooldown=.32+3.3*t**1.65;
  if(boss){ship.mounts=ship.mounts.filter(m=>!m.id.startsWith('boss-turret-'));for(let i=0;i<8;i++)ship.mounts.push({id:`boss-turret-${i+1}`,kind:'turret',x:i%2?.24:-.24,y:-.32+Math.floor(i/2)*.21,facing:i%2?90:-90,arc:300,range:Math.max(1400,ship.length*1.2),damage:1,cooldown:1,speed:1250,turnRate:1});}
  let turret=0;
  for(const m of ship.mounts){
    const pointDefense=m.kind==='turret'&&(ship.doctrine==='escort'||capital&&turret++%(boss?3:5)===0);
    m.role=m.kind==='missile'&&ship.doctrine==='bomber'?'anti-capital':pointDefense?'point-defense':'main';
    m.cooldown=m.kind==='missile'?9+6*t:pointDefense?.65+t*.65:m.kind==='turret'?laserCooldown*1.15+.1:laserCooldown;
    m.cooldown=Number(m.cooldown.toFixed(3));
    m.turnRate=m.kind==='missile'?(m.role==='anti-capital'?.72:capital?.65:2.3):m.kind==='laser'?3:pointDefense?2.3:Math.max(.16,ship.turnRate*.8);
    m.speed=m.kind==='missile'?420:pointDefense?1400:Math.round(550+700/(1+(length/90)**1.2));
    if(pointDefense)m.range=boss?750+ship.length*.35:750;
  }
  ship.preferredRange=ship.doctrine==='bomber'?Math.min(1100,850+ship.length*.3):ship.doctrine==='escort'?590:capital?850:heavy?500:380;
  const weight=m=>m.role==='anti-capital'?4:m.role==='point-defense'?(boss?1.2:ship.doctrine==='escort'?2:.55):m.kind==='turret'?(capital?1.3:1.1):m.kind==='missile'?.9:1;
  const total=ship.mounts.reduce((sum,m)=>sum+weight(m),0),target=config.bossDps[ship.id]??gradual(ship.length,i=>config.weaponDps[config.tiers[i].id])*config.roleDps[role];
  for(const m of ship.mounts)m.damage=Number((target*weight(m)/total*m.cooldown).toFixed(2));
}
await writeFile(file,JSON.stringify(ships,null,2)+'\n');
const assetFile=new URL('../public/assets/ships/manifest.json',import.meta.url),manifest=JSON.parse(await readFile(assetFile,'utf8'));
for(const a of manifest.assets){const ship=ships.find(s=>s.id===a.shipId);a.combatVersion=config.version;a.mounts=ship.mounts;}
await writeFile(assetFile,JSON.stringify(manifest,null,2)+'\n');
console.log(`Updated ${ships.length} defense, weapon and mobility profiles; image geometry preserved.`);
