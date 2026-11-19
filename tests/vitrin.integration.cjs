// Vitrin: her ziyaretçinin kendi çalışma alanı. İki ziyaretçi birbirinin önerisini ve ekini göremez; kullanıcı
// tanımlarını değiştiren işlemler kapalı; alan açma sınırı; gece sıfırlaması bütün ziyaretçi alanlarını siler.
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const Module = require('node:module');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('drizzle/0000_high_proudstar.sql', 'utf8'));
const db = { prepare(sql) { return { params: [], bind(...params) { this.params = params; return this; }, async first() { return sqlite.prepare(sql).get(...this.params) || null; }, async all() { return { results: sqlite.prepare(sql).all(...this.params) }; }, async run() { const r = sqlite.prepare(sql).run(...this.params); return { meta: { changes: Number(r.changes) } }; } }; }, async batch(statements) { sqlite.exec('BEGIN'); try { const r = []; for (const s of statements) r.push(await s.run()); sqlite.exec('COMMIT'); return r; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
const original = Module._load;
Module._load = function (name, parent, ...rest) { if (name === 'cloudflare:workers') return { env: { DB: db, IVME_VITRIN: '1' } }; return original.call(this, name, parent, ...rest); };
const B = '/tmp/kaizen-server-tests/';
const auth = require(B + 'app/api/auth/route.js'), state = require(B + 'app/api/state/route.js'), command = require(B + 'app/api/command/route.js'), attachment = require(B + 'app/api/attachment/route.js');
const vitrin = require(B + 'lib/vitrin.js');
const origin = 'https://ivme.test';
function visitor(ip = '198.51.100.1') {
  const jar = {};
  const req = async (route, body, query = '') => {
    const cookie = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    const request = new Request(origin + '/api/' + route + query, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), 'cf-connecting-ip': ip }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const r = await ({ auth, state, command, attachment })[route][body ? 'POST' : 'GET'](request);
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, v] = kv.split('='); jar[k] = v; }
    const type = r.headers.get('content-type') || '';
    return [r, type.includes('json') ? await r.json() : null];
  };
  return { req, jar };
}
(async () => {
  const A = visitor('198.51.100.1'), V = visitor('198.51.100.2');
  let [r, b] = await A.req('auth', { action: 'showcase', username: 'admin' });
  assert.equal(r.status, 200);
  assert.match(A.jar.ivme_alan, /^[0-9a-f-]{36}$/, 'alan çerezi verildi');
  [r, b] = await A.req('state');
  assert.equal(r.status, 200);
  assert.equal(b.state.proposals.length, vitrin.VISITOR_PROPOSALS, 'ziyaretçi alanı küçük örnekle açılır');
  assert.ok(new Set(b.state.proposals.map(p => p.status)).size >= 4, 'farklı aşamalardan öneri var');
  let version = b.version;
  const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
  [r, b] = await A.req('command', { action: 'create', version, title: 'GİZLİ ziyaretçi A önerisi', problem: 'Gerçek saha fotoğrafı ve isim yazılmış bir öneri.', solution: 'Bu metin başka ziyaretçiye görünmemeli.', operation: 'Mal Kabul', attachments: [{ name: 'saha.png', data: png }] });
  assert.equal(r.status, 200, JSON.stringify(b));
  const aId = b.id;
  [r, b] = await A.req('state');
  assert.ok(b.state.proposals.some(p => p.id === aId), 'A kendi önerisini görür');
  // Aynı tarayıcı rol değiştirince aynı alanda kalır.
  [r] = await A.req('auth', { action: 'showcase', username: 'calisan' });
  [r] = await A.req('auth', { action: 'showcase', username: 'admin' });
  [r, b] = await A.req('state');
  assert.ok(b.state.proposals.some(p => p.id === aId), 'rol değişince alan aynı');

  [r, b] = await V.req('auth', { action: 'showcase', username: 'admin' });
  assert.equal(r.status, 200);
  assert.notEqual(V.jar.ivme_alan, A.jar.ivme_alan);
  [r, b] = await V.req('state');
  assert.equal(b.state.proposals.length, vitrin.VISITOR_PROPOSALS);
  assert.ok(!JSON.stringify(b.state).includes('GİZLİ ziyaretçi A'), 'B, A nın önerisini görmez');
  [r] = await V.req('attachment', null, `?id=${aId}&i=0`);
  assert.equal(r.status, 404, 'B, A nın ekini indiremez');
  [r] = await A.req('attachment', null, `?id=${aId}&i=0`);
  assert.equal(r.status, 200, 'A kendi ekini indirir');

  // Kullanıcı tanımları ortak: vitrinde değiştirilemez.
  for (const action of ['user', 'importUsers', 'importProposals', 'resetPassword', 'myPrefs']) {
    [r, b] = await V.req('command', { action, username: 'ahmet.yilmaz', name: 'Ahmet Yılmaz', department: 'Lojistik', directorate: 'X', role: 'employee', notify: 'off' });
    assert.equal(r.status, 400, action);
    assert.match(b.error, /Canlı demoda/);
  }
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM users WHERE name='Ahmet Yılmaz'").get().n, 0);

  // Alan çerezi olmayan oturum geçersiz.
  const sessionOnly = { ...A.jar }; delete sessionOnly.ivme_alan;
  const bare = new Request(origin + '/api/state', { headers: { Cookie: 'ivme_session=' + sessionOnly.ivme_session } });
  assert.equal((await state.GET(bare)).status, 401);

  // Alan açma sınırı: aynı IP'den saatte en fazla MAX_VISITOR_SPACES_IP_HOUR yeni alan.
  const statuses = [];
  for (let i = 0; i < vitrin.MAX_VISITOR_SPACES_IP_HOUR; i++) statuses.push((await visitor('203.0.113.9').req('auth', { action: 'showcase', username: 'calisan' }))[0].status);
  assert.ok(statuses.every(s => s === 200));
  [r, b] = await visitor('203.0.113.9').req('auth', { action: 'showcase', username: 'calisan' });
  assert.equal(r.status, 503);
  [r] = await A.req('auth', { action: 'showcase', username: 'calisan' });
  assert.equal(r.status, 200, 'var olan alan sınırdan etkilenmez');

  // Gece sıfırlaması: bütün ziyaretçi alanları ve oturumlar silinir, şablon yeniden kurulur.
  await vitrin.resetShowcase();
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM workspace WHERE id LIKE 'v:%'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM workspace WHERE id='main'").get().n, 1);
  [r] = await A.req('state');
  assert.equal(r.status, 401);
  console.log('Vitrin integration passed: visitor-private workspaces (proposals and attachments), role switch keeps space, shared user table locked, scope cookie required, per-IP space limit, nightly reset.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => sqlite.close());
