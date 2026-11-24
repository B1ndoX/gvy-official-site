// The app and Git release use one album validation sequence. Keep the site's
// mandatory basic gate, but do not run unrelated video metadata or game suites.
export const GALLERY_VERIFICATION_SCRIPTS=['verify:edgeone','gallery:publisher:test','gallery:publisher:build'];
export async function verifyGallery(root,run){
  for(const script of GALLERY_VERIFICATION_SCRIPTS)await run('npm',['run',script],{cwd:root});
}
