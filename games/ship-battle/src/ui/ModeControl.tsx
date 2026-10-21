import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Shuffle, Swords } from 'lucide-react';
import type { BattleMode } from '../sim/types';
import { MODE_NAMES } from '../sim/members';
export function ModeControl({mode,policy,onChange}:{mode:BattleMode;policy:BattleMode|'random';onChange:(value:BattleMode|'random')=>void}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[]);
  const select=(value:BattleMode|'random')=>{onChange(value);setOpen(false);};
  return <div className="mode-control" ref={root}><button className="mode-button" aria-label="切换战斗模式" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Swords size={19}/><strong data-testid="mode-name">{MODE_NAMES[mode]}</strong>{policy==='random'?<small>随机</small>:null}<ChevronDown size={14}/></button>{open?<div className="mode-menu" role="group" aria-label="选择战斗模式"><button className={policy==='random'?'active':''} onClick={()=>select('random')}><Shuffle size={14}/><span>随机模式<small>每次重新抽签随机切换</small></span></button>{(['bounty','brawl','challenge','teams'] as BattleMode[]).map(value=><button key={value} className={policy===value?'active':''} onClick={()=>select(value)}><span>{MODE_NAMES[value]}<small>{value==='bounty'?'成员协作，击败随机 BOSS 即胜利':value==='brawl'?'成员互相攻击，决出最后幸存者':value==='teams'?'红蓝两侧出生，敌方全灭获胜':'依长度挑战 5 艘 BOSS，不刷僚机'}</small></span></button>)}</div>:null}</div>;
}
