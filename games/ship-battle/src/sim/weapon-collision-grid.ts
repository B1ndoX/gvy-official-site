import type {Ship,Vec} from './types';

/** Broad phase only. The existing swept hull test still decides every impact. */
export class WeaponCollisionGrid {
 private cells=new Map<string,Ship[]>();
 private size=400;
 constructor(ships:Ship[],dt:number){
  for(const ship of ships){
   const radius=Math.max(ship.spec.length,ship.spec.beam)*.5+8+Math.max(Math.abs(ship.vx),Math.abs(ship.vy))*dt;
   for(let x=Math.floor((ship.x-radius)/this.size);x<=Math.floor((ship.x+radius)/this.size);x++)for(let y=Math.floor((ship.y-radius)/this.size);y<=Math.floor((ship.y+radius)/this.size);y++){
    const key=`${x}:${y}`,cell=this.cells.get(key);if(cell)cell.push(ship);else this.cells.set(key,[ship]);
   }
  }
 }
 query(from:Vec,to:Vec){
  const candidates=new Map<number,Ship>();
  for(let x=Math.floor(Math.min(from.x,to.x)/this.size);x<=Math.floor(Math.max(from.x,to.x)/this.size);x++)for(let y=Math.floor(Math.min(from.y,to.y)/this.size);y<=Math.floor(Math.max(from.y,to.y)/this.size);y++)for(const ship of this.cells.get(`${x}:${y}`)??[])candidates.set(ship.id,ship);
  return candidates.values();
 }
}
