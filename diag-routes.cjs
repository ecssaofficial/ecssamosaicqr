process.env.NEXT_PUBLIC_BASE_PATH = '/ecssamosaicqr';
const loadConfig = require('next/dist/server/config').default;
(async () => {
  const cfg = await loadConfig('phase-production-build', process.cwd());
  console.log('basePath =', JSON.stringify(cfg.basePath));
  const mod = require('next/dist/lib/load-custom-routes');
  const fn = mod.default || mod.loadCustomRoutes;
  const routes = await fn('build', cfg);
  const { pathToRegexp } = require('next/dist/compiled/path-to-regexp');
  let bad = 0;
  for (const r of routes.redirects || []) {
    try { pathToRegexp(r.source, [], { strict: true, sensitive: false, delimiter: '/' }); }
    catch (e) { bad++; console.log('BAD REDIRECT:', JSON.stringify(r.source), '->', JSON.stringify(r.destination)); }
  }
  for (const h of routes.headers || []) {
    try { pathToRegexp(h.source, [], { strict: true, sensitive: false, delimiter: '/' }); }
    catch (e) { console.log('BAD HEADER:', JSON.stringify(h.source)); bad++; }
  }
  console.log('redirects:', (routes.redirects || []).length, 'headers:', (routes.headers || []).length, 'bad:', bad);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
