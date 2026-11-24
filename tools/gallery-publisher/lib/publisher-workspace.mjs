import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {gitOutput, listGitChanges} from './git-release.mjs';

export const isPublisherBranch = branch => /^gallery-publisher\/[a-f0-9-]{36}$/.test(branch);

export async function openPublisherWorkspace(sourceRoot, runtimeDir) {
  const root = join(resolve(runtimeDir), 'site-worktree');
  const recordPath = join(runtimeDir, 'workspace.json');
  await mkdir(runtimeDir, {recursive:true});
  let record;
  try {record=JSON.parse(await readFile(recordPath,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  if(record){
    if(record.root!==root)throw Error('相册独立工作区记录不一致，已停止操作');
    const common=await gitOutput(root,['rev-parse','--path-format=absolute','--git-common-dir']);
    const sourceCommon=await gitOutput(sourceRoot,['rev-parse','--path-format=absolute','--git-common-dir']);
    if(common!==sourceCommon)throw Error('相册工作区不属于当前官网仓库，已停止操作');
  }else{
    try {await access(root);throw Error('相册工作区目录已经存在但没有归属记录，请保留现场交由维护者检查');}
    catch(error){if(error.code!=='ENOENT')throw error;}
    // Always branch from the committed remote baseline, never copy a dirty
    // index, unstaged source, staged files or untracked files from the developer.
    await gitOutput(sourceRoot,['worktree','add','--detach',root,'origin/main']);
    await writeFile(recordPath,JSON.stringify({version:1,root,createdAt:new Date().toISOString()},null,2)+'\n');
  }
  return root;
}

export async function refreshPublisherWorkspace(root, onUpdate=()=>{}) {
  const changes=await listGitChanges(root);
  if(changes.length)throw Error('相册独立工作区有未完成或外部改动，已保留现场；请恢复或清空当前相册预览后重试');
  onUpdate('同步正式发布基线；开发工作区保持原样');
  await gitOutput(root,['fetch','origin','main']);
  await gitOutput(root,['switch','--detach','origin/main']);
  const branch=`gallery-publisher/${randomUUID()}`;
  await gitOutput(root,['switch','-c',branch]);
  return branch;
}
