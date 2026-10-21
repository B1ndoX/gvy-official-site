/** Baseline duration relative to the previous release. Combat always steps at 60 Hz. */
export const BATTLE_DURATION = .75;
export const simulationSeconds = (elapsed:number,speed=1)=>elapsed*speed/BATTLE_DURATION;
export const battleSeconds = (simulation:number)=>simulation*BATTLE_DURATION;
