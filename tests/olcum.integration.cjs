// Ortak ölçüm ayarı (OLCUM_URL / OLCUM_PROJE) yalnızca herkese açık vitrin demosunda istemciye gider.
// Şirket kurulumunda (IVME_VITRIN kapalı) ayar tanımlı olsa bile gönderilmez: betik yüklenmez, ölçüm yapılmaz.
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const Module=require('node:module');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_high_proudstar.sql','utf8'));
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){return sqlite.prepare(sql).get(...this.params)||null},async all(){return {results:sqlite.prepare(sql).all(...this.params)}},async run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const ENV={DB:db,OLCUM_URL:'https://olcum.ysfdurak.com',OLCUM_PROJE:'ivme'};
const original=Module._load;Module._load=function(name,parent,...rest){if(name==='cloudflare:workers')return {env:ENV};return original.call(this,name,parent,...rest)};
const auth=require('/tmp/kaizen-server-tests/app/api/auth/route.js');
const get=async()=>(await auth.GET(new Request('https://kaizen.test/api/auth'))).json();
(async()=>{
  ENV.IVME_VITRIN='0';
  let b=await get();
  assert.equal(b.olcum,undefined,'şirket kurulumunda ölçüm ayarı gönderilmez');
  ENV.IVME_VITRIN='1';
  b=await get();
  assert.deepEqual(b.olcum,{url:'https://olcum.ysfdurak.com',proje:'ivme'},'vitrinde gönderilir');
  ENV.OLCUM_URL='';
  b=await get();
  assert.equal(b.olcum,null,'adres boşsa ölçüm kapalı');
  ENV.OLCUM_URL='javascript:alert(1)';ENV.OLCUM_PROJE='ivme';
  b=await get();
  assert.equal(b.olcum,null,'yalnızca https adresi kabul edilir');
  ENV.OLCUM_URL='https://olcum.ysfdurak.com';ENV.OLCUM_PROJE='<script>';
  b=await get();
  assert.equal(b.olcum,null,'proje adı denetlenir');
  console.log('Ölçüm entegrasyonu geçti: yalnızca vitrinde, yalnızca geçerli https adresi ve proje adıyla.');
})().catch(e=>{console.error(e);process.exit(1)});
