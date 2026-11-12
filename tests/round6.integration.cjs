const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const Module=require('node:module');
// Bilinçli olarak yalnız ilk migrasyon uygulanır: e-posta sütunları ve giden kutusu ensureSchema ile tamamlanmalı (eski kurulum senaryosu).
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_high_proudstar.sql','utf8'));
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){return sqlite.prepare(sql).get(...this.params)||null},async all(){return {results:sqlite.prepare(sql).all(...this.params)}},async run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const original=Module._load;Module._load=function(name,parent,...rest){if(name==='cloudflare:workers')return {env:{DB:db}};return original.call(this,name,parent,...rest)};
const R=n=>require('/tmp/kaizen-server-tests/app/api/'+n+'/route.js');
const handlers={auth:R('auth'),state:R('state'),command:R('command'),similar:R('similar'),recognition:R('recognition'),notify:R('notify')};
let cookie='';const origin='https://kaizen.test';
async function req(route,body,query=''){const request=new Request(origin+'/api/'+route+query,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{'Cookie':cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const r=await handlers[route][body?'POST':'GET'](request);const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return [r,await r.json()];}
async function login(u,p='Kaizen123!',np='YeniSifre-2026'){await req('auth',{action:'logout'});let [r,b]=await req('auth',{username:u,password:p});if(!b.user)[r,b]=await req('auth',{username:u,password:np});if(b.user?.mustChange)await req('auth',{action:'password',oldPassword:p,password:np});return b;}

// Tur 6: anonim önerinin sunucu yanıtında gizlenmesi, ek türü bilgisinin istemciye gitmesi.
(async()=>{
await login('calisan');
let [r,b]=await req('state');let version=b.version;const op=b.state.operations[0];
const img='data:image/jpeg;base64,'+Buffer.from('jpeg').toString('base64');
[r,b]=await req('command',{action:'create',version,title:'Raf arası aydınlatma',problem:'B blok raf aralarında ışık yetersiz.',solution:'LED armatür eklensin.',operation:op,category:'Ergonomi',anonymous:true,attachments:[{name:'once.jpg',data:img}]});
assert.equal(r.status,200);const id=b.id;
[r,b]=await req('state');let p=b.state.proposals.find(x=>x.id===id);
assert.equal(p.author,'calisan','öneren kendi önerisini adıyla görür');assert.equal(p.attachments[0].kind,'before');assert.equal(p.attachments[0].data,undefined);
for(const u of ['on.degerlendirme','admin']){
  await login(u);[r,b]=await req('state');p=b.state.proposals.find(x=>x.id===id);
  assert.ok(p,u+' öneriyi görür');assert.equal(p.author,'anonim');
  assert.ok(!JSON.stringify(p).includes('"calisan"'),u+' yanıtında önerenin kimliği geçmez');
}
// Ödül kayıtları: yalnız ilgili kişi, ödül sorumlusu (İK) ve sistem yöneticisi görür.
{const row=sqlite.prepare("SELECT data FROM workspace WHERE id='main'").get();const st=JSON.parse(row.data);st.rewards=[{id:'OD-T',proposalId:id,created:'2026-11-12',status:'Onaylandı',ruleLabel:'Başarı ödülü',kind:'amount',total:5000,recipients:[{userId:'calisan',value:5000}],basis:{score:80,net:0}}];sqlite.prepare("UPDATE workspace SET data=?, version=version+1 WHERE id='main'").run(JSON.stringify(st));
for(const [u,n] of [['it',0],['calisan',1],['admin',1],['on.degerlendirme',0]]){await login(u);[r,b]=await req('state');assert.equal((b.state.rewards||[]).length,n,u+' ödül görünürlüğü');}}
console.log('Round 6 integration passed: anonymous author hidden from evaluator and admin in API responses, attachment kinds.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
