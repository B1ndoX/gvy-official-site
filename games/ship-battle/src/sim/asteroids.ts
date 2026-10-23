import type {Ship,Vec} from './types';
import {clamp,distance,randomGenerator} from './math';
export interface Asteroid extends Vec {id:number;radius:number;rotation:number}
export function createAsteroids(ships:Ship[],arena:number,seed:number):Asteroid[]{
 const random=randomGenerator(seed^0xa57e),rocks:Asteroid[]=[];
 // Twenty cells retain the existing footprint, with a modest gap and no central pile.
 const bands=[[.08,.45,6],[.45,.66,7],[.66,.86,7]],offset=random()*Math.PI*2;
 for(let band=0,i=0;band<bands.length;band++){
 const [inner,outer,sectors]=bands[band];
 for(let sector=0;sector<sectors;sector++,i++)for(let attempt=0;attempt<150;attempt++){
  const slot=attempt<75?sector+.15+random()*.7:random()*sectors;
  const angle=offset+(slot+band*.31)*Math.PI*2/sectors;
  const radius=arena*Math.sqrt(inner*inner+random()*(outer*outer-inner*inner));
  const rock={id:i+1,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,radius:i===13||i===17?110+random()*75:i%3===1?45+random()*45:16+random()*18,rotation:random()*Math.PI*2};
  if(Math.hypot(rock.x,rock.y)+rock.radius>arena*.94||ships.some(s=>distance(s,rock)<s.radius+rock.radius+150)||rocks.some(r=>distance(r,rock)<r.radius+rock.radius+135))continue;
  rocks.push(rock);break;
 }}return rocks;
}
export function avoidAsteroids(ship:Ship,rocks:Asteroid[]){
 let x=0,y=0;const speed=Math.hypot(ship.vx,ship.vy),look=Math.min(1.6,.65+ship.spec.length/220),px=ship.x+ship.vx*look,py=ship.y+ship.vy*look;
 for(const rock of rocks){const safe=ship.radius+rock.radius+70,d=Math.hypot(ship.x-rock.x,ship.y-rock.y),future=Math.hypot(px-rock.x,py-rock.y);if(Math.min(d,future)>safe+speed*.4)continue;
  const nx=ship.x-rock.x,ny=ship.y-rock.y,n=Math.max(1,Math.hypot(nx,ny)),weight=clamp(1-Math.min(d,future)/(safe+speed*.4),0,1)*2;
  // Lateral steering gives a passing lane instead of braking head-on into the obstacle.
  const side=(Math.cos(ship.heading)*(rock.y-ship.y)-Math.sin(ship.heading)*(rock.x-ship.x))>0?-1:1;
  x+=nx/n*weight-Math.sin(ship.heading)*side*weight;y+=ny/n*weight+Math.cos(ship.heading)*side*weight;
 }return {x,y};
}
export function segmentRock(from:Vec,to:Vec,rock:Asteroid):number|null{
 const dx=to.x-from.x,dy=to.y-from.y,x=from.x-rock.x,y=from.y-rock.y,a=dx*dx+dy*dy,c=x*x+y*y-rock.radius**2;
 if(c<=0)return 0;if(a<1e-9)return null;const b=2*(x*dx+y*dy),disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
