import {useEffect,useRef} from 'react';
import {randomGenerator} from '../sim/math';

/** Match the first game's gold/white/cyan foil and gentle drifting fall. Independent of combat RNG/speed. */
export function VictoryConfetti(){
  const layer=useRef<HTMLDivElement>(null);
  const count=innerWidth<600?40:72;
  useEffect(()=>{
    const element=layer.current;if(!element||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const random=randomGenerator(2956),pieces=[...element.children].map(node=>({node:node as HTMLElement,x:random(),drift:18+random()*67,angle:random()*360-180,spin:random()*320-160,delay:random()*1.15,duration:3.7+random()*1.9,phase:random()*Math.PI*2}));
    let frame=0,clock=0,last=performance.now();
    const draw=(now:number)=>{
      if(!document.hidden)clock+=Math.min(.1,(now-last)/1000);last=now;
      const width=element.clientWidth,height=element.clientHeight,ui=parseFloat(getComputedStyle(element).fontSize)/14;
      for(const p of pieces){const t=clock-p.delay,progress=t/p.duration;p.node.style.opacity=t<0||progress>1?'0':String(Math.min(1,(1-progress)*4));const x=p.x*width+Math.sin(t*2+p.phase)*p.drift*ui,y=-30*ui+progress*(height+80*ui);p.node.style.transform=`translate3d(${x}px,${y}px,0) rotate(${p.angle+t*p.spin}deg)`;}
      if(clock<6.8)frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <div ref={layer} className="confetti fleet-confetti" aria-hidden="true">{Array.from({length:count},(_,i)=><i key={i} style={{backgroundColor:['#d9b967','#e1e9ef','#7ec8de'][i%3]}}/>)}</div>;
}
