export type Vec = { x: number; y: number };
export interface Member { handle: string; name: string; avatar: string }
export type BattleMode='bounty'|'brawl'|'challenge'|'teams';
export type BattleOutcome='players'|'member'|'boss'|'red'|'blue'|'draw'|null;
export type WeaponKind = 'laser' | 'turret' | 'missile';
export interface Mount extends Vec { id: string; kind: WeaponKind; role?:'main'|'point-defense'|'anti-capital'; facing: number; arc: number; range: number; damage: number; cooldown: number; speed: number; turnRate: number }
export interface ShipSpec {
  id: string; doctrine?:'interceptor'|'bomber'|'escort'|'capital'|'balanced'; name: string; manufacturer: string; class: 'fighter' | 'heavy' | 'capital'; role: string;
  length: number; beam: number; dimensionsStatus: string; source: string;
  hull: number; shield: number; shieldRegen: number; speed: number; acceleration: number; turnRate: number; preferredRange: number;
  engines: Vec[]; mounts: Mount[]; calibration: 'draft' | 'verified'; bossOnly?: boolean; battleReady?:boolean; assetIssue?:string; defenseTier?:string; defenseRole?:string;
}
export interface Ship extends Vec {
  id: number; spec: ShipSpec; label: string; member?: Member; npc?: 'boss'|'escort'; team?: string; enterUntil?: number; vx: number; vy: number; heading: number;
  hull: number; shield: number; kills: number; alive: boolean; radius: number; targetId: number | null;
  lastHit: number; lastDealt: number; searchAt: number; cooldowns: number[]; turretAngles: number[]; turretTargets: (number | null)[];
}
export interface Projectile extends Vec { id: number; owner: number; target: number; kind: WeaponKind; role?:Mount['role']; turnRate?:number; vx: number; vy: number; angle: number; speed: number; damage: number; ttl: number; travel: number; range: number; color: number }
export interface BattleEvent extends Vec { id: number; kind: 'hit' | 'shield' | 'destroy' | 'shot'; time: number; radius: number; ship: number; by: number; label: string }
export interface KillRecord { id: number; time: number; victimId: number; victimName: string; killerId: number; killerName: string }
export type BattlePhase = 'ready' | 'running' | 'paused' | 'finished';
export interface RosterEntry { specId: string; count: number; member?: Member; npc?: 'boss'|'escort'; team?: string }
export interface Standing { id: number; member?: Member; npc?: 'boss'|'escort'; name: string; shipName: string; specId: string; kills: number; alive: boolean }
export interface BattleSnapshot { phase: BattlePhase; mode: BattleMode; outcome: BattleOutcome; wave: number; waves: number; nextWaveIn: number; time: number; alive: number; total: number; destroyed: number; winner: Standing | null; standings: Standing[]; recentKills: KillRecord[]; boss: Ship|null; escortsAlive: number; memberAlive: number; memberTotal: number; redAlive:number;blueAlive:number;collisionDeaths:number; projectiles: number; shots: number; hits: number; selected: Ship | null }
