import type {KillRecord} from '../sim/types';

export function BattleLog({records}:{records:KillRecord[]}){
  return <div className="battle-log" aria-label="最近击毁记录">{records.map(record=><p key={record.id} data-testid="kill-record"><span aria-hidden="true">✦</span><strong className="feed-victim">{record.victimName}</strong>{record.cause==='asteroid'?<small className="feed-environment">撞到陨石，炸了！</small>:record.cause==='collision'?<><small>{record.mutual||record.friendly?'与':'被'}{record.friendly?'队友':''}</small><strong className="feed-killer">{record.killerName}</strong><small>{record.mutual?'相撞，双双炸了！':record.friendly?'相撞，炸了！':'撞毁！'}</small></>:<><small>被</small><strong className="feed-killer">{record.killerName}</strong><small>击毁</small></>}</p>)}</div>;
}
