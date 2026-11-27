import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

// Only idempotent PR reads belong here. Writes keep their existing recovery
// path so an uncertain response cannot create or merge a second PR.
export async function githubQuery(args,{cwd,run,wait=delay}) {
  assert(args[0]==='pr' && ['list','view'].includes(args[1]),'Only read-only PR queries can be retried');
  const delays=[1000,3000];
  for(let attempt=0;;attempt++){
    try{return await run('gh',args,{cwd});}
    catch(error){
      const transient=/(?:\bEOF\s*$|\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN)\b|TLS handshake timeout|connection reset by peer)/i.test(String(error.message));
      if(!transient || attempt===delays.length)throw error;
      await wait(delays[attempt]);
    }
  }
}
