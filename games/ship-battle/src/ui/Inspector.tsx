import {Crosshair,Heart,Shield,X} from 'lucide-react';
import {useLayoutEffect,useRef} from 'react';
import type {Ship} from '../sim/types';
import {avatarURL} from './MemberLeaderboard';
const simulatedNames={laser:'模拟激光炮',turret:'模拟炮台',ballistic:'模拟实弹炮',beam:'模拟持续光束',railgun:'模拟龙骨炮',missile:'模拟导弹',torpedo:'模拟鱼雷'};

export function weaponDetails(ship:Ship){
 const groups=new Map<string,{name:string;size:number|undefined;count:number;ammo:number;finite:boolean;ordnance:boolean;rearms:boolean}>();
 ship.spec.mounts.forEach((m,index)=>{
  if(m.interceptsOnly)return;
  const key=m.weaponId??m.weaponName??`simulation-${m.kind}`;
  const group=groups.get(key)??{name:m.weaponName??simulatedNames[m.kind],size:m.weaponSize,count:0,ammo:0,finite:false,ordnance:m.kind==='missile'||m.kind==='torpedo',rearms:!!m.ammoReload};
  group.count+=m.weaponCount??m.barrels??1;
  if(m.ammo!==undefined){group.finite=true;group.ammo+=ship.weaponCycles?.[index]?.ammoLeft??m.ammo;}
  groups.set(key,group);
 });
 return [...groups.entries()].map(([id,g])=>({id,text:`${g.size?`S${g.size} `:''}${g.name} · ${g.ordnance?(g.finite?`余弹${g.ammo}枚${g.rearms?" · 可补弹":""}`:'循环发射'):`${g.count}门${g.finite?` · 余弹${g.ammo}发`:''}`}`}));
}

export function Inspector({ship,onClose,hasBoss=false}:{ship:Ship;onClose:()=>void;hasBoss?:boolean}){
 const panel=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const card=panel.current,field=card?.parentElement;if(!card||!field)return;
  const boss=field.querySelector<HTMLElement>('.boss-hud');
  const measure=()=>{
   const width=field.clientWidth,height=field.clientHeight;if(width<1||height<1)return;
   const ui=(parseFloat(getComputedStyle(field).fontSize)||14)/14;
   const inset=Math.min(12*ui,Math.max(6*ui,Math.min(width,height)*.015));
   const cardWidth=Math.min(width-inset*2,Math.max(160*ui,Math.min(width*.22,224*ui)));
   const top=boss?Math.max(inset,boss.offsetTop+boss.offsetHeight+inset):inset;
   // Grow into clear space beside the centred ship; stay above it on narrow fields.
   const clearance=70*ui,sideRoom=Math.max(0,width-2*(cardWidth+inset+clearance));
   const maximum=Math.max(0,Math.min(height-top-inset,height/2-top-clearance+sideRoom));
   for(const [key,value] of Object.entries({inset,top,width:cardWidth,height:maximum}))card.style.setProperty(`--inspector-${key}`,`${value}px`);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(field);if(boss)observer.observe(boss);
  return()=>observer.disconnect();
 },[hasBoss]);
 return <section ref={panel} className="inspector">
  <div className="inspector-title">{ship.member?<img className="inspector-avatar" src={avatarURL(ship.member.avatar)} alt=""/>:<Crosshair size={15}/>}<strong>{ship.label}</strong><button className="icon-button" onClick={onClose} aria-label="关闭舰船详情"><X size={15}/></button></div>
  <p className="inspector-ship-name">{ship.spec.name}</p>
  <div className="inspector-body">
  <div className="vital"><span><Shield size={13}/>护盾</span><b>{Math.ceil(ship.shield)} <small>/ {ship.spec.shield}</small></b><i><em style={{width:`${ship.spec.shield?ship.shield/ship.spec.shield*100:0}%`}}/></i></div>
  <div className="vital hull"><span><Heart size={13}/>舰体</span><b>{Math.ceil(ship.hull)} <small>/ {ship.spec.hull}</small></b><i><em style={{width:`${ship.hull/ship.spec.hull*100}%`}}/></i></div>
  <div className="inspector-details">
   <span>{ship.spec.length} m · {ship.spec.role}</span>
   <span>击毁 {ship.kills}</span>
   {weaponDetails(ship).map(row=><span key={row.id}>{row.text}</span>)}
  </div>
  </div>
  <small className="muted">{ship.alive?'自主飞行 · 自动交火':'舰船已被击毁'}</small>
 </section>;
}
