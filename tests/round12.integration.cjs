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

// Tur 12: toplu öneri aktarımı API'si (yetki, deneme, onay, pasif öneren, e-posta yok, tekrar aktarım, boyut sınırı).
(async()=>{
await login('admin');
let [r,b]=await req('state');const op=b.state.operations[0];const dept=b.state.settings.org.departments[0].name;
const row=(o={})=>({legacyNo:'ESKI-1',created:'14.02.2023',title:'Forklift şarj alanı işareti',problem:'Şarj alanı karışık.',solution:'Zemin işaretlemesi.',author:'calisan',operation:op,category:'Verimlilik',status:'Tamamlandı',stageAt:'30.04.2023',gainType:'Parasal',gainAmount:'48.000',gainPeriod:'Yıllık',gainCost:'6.500',score:'72',...o});
const rows=[row(),row({legacyNo:'ESKI-2',author:'hasan.ak',authorName:'Hasan Ak',authorDepartment:dept,status:'Ön değerlendirme',stageAt:'',gainType:'',gainAmount:'',gainCost:'',score:''})];
// Yetki
await login('calisan');[r,b]=await req('command',{action:'importProposals',rows,dryRun:true});assert.equal(r.status,403);
await login('admin');
// Hatalı satır: satır numarasıyla döner, hiçbir şey yazılmaz
[r,b]=await req('command',{action:'importProposals',rows:[row({status:'Yok'})],dryRun:true});
assert.equal(r.status,400);assert.ok(b.errors[0].startsWith('Satır 2:'));
// Deneme: özet döner, veri değişmez
const v0=sqlite.prepare("SELECT version FROM workspace WHERE id='main'").get().version;
[r,b]=await req('command',{action:'importProposals',rows,dryRun:true});
assert.equal(r.status,200,JSON.stringify(b));assert.equal(b.preview.ready,2);assert.deepEqual(b.preview.newUsers,['hasan.ak']);assert.ok(b.preview.bytes>0);
assert.equal(sqlite.prepare("SELECT version FROM workspace WHERE id='main'").get().version,v0);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM users WHERE username='hasan.ak'").get().n,0,'denemede kullanıcı açılmaz');
const mails=sqlite.prepare("SELECT COUNT(*) n FROM outbox").get().n;
// Onay
[r,b]=await req('command',{action:'importProposals',rows});
assert.equal(r.status,200,JSON.stringify(b));assert.equal(b.imported,2);assert.equal(b.newUsers,1);
const u=sqlite.prepare("SELECT * FROM users WHERE username='hasan.ak'").get();
assert.equal(u.active,0,'öneren pasif kullanıcı olarak açılır');assert.equal(u.role,'employee');
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM outbox").get().n,mails,'aktarım e-posta üretmez');
[r,b]=await req('state');
const p1=b.state.proposals.find(p=>p.legacyNo==='ESKI-1'),p2=b.state.proposals.find(p=>p.legacyNo==='ESKI-2');
assert.ok(/^KZ-\d{4}-\d{4}$/.test(p1.id));assert.equal(p1.gain.approved,true);assert.equal(p1.score.total,72);assert.ok(p1.rev>0);
assert.equal(p2.author,u.id);assert.equal(p2.owner,'on','açık öneri ön değerlendirme sorumlusuna düşer');
// Pasif kullanıcı giriş yapamaz
await req('auth',{action:'logout'});[r,b]=await req('auth',{username:'hasan.ak',password:'x'});assert.ok(!b.user);
await login('admin');
// Aynı dosya ikinci kez aktarılamaz
[r,b]=await req('command',{action:'importProposals',rows,dryRun:true});assert.equal(r.status,400);assert.ok(b.errors.some(e=>e.includes('daha önce aktarılmış')));
// Boyut sınırı: tek kayıt sınırını aşacak aktarım reddedilir, veri değişmez
const big=Array.from({length:400},(_,i)=>row({legacyNo:'B-'+i,problem:'x'.repeat(2500),solution:'y'.repeat(2500)}));
const v1=sqlite.prepare("SELECT version FROM workspace WHERE id='main'").get().version;
[r,b]=await req('command',{action:'importProposals',rows:big});
assert.equal(r.status,400);assert.ok(b.error.includes('2 MB'));
assert.equal(sqlite.prepare("SELECT version FROM workspace WHERE id='main'").get().version,v1);
// Geri alma: paket silinir, aktarımla açılan pasif kullanıcı da silinir
{[r,b]=await req('state');const batch=b.state.importBatches[0];assert.equal(batch.count,2);assert.deepEqual(batch.newUsers,[u.id]);
[r,b]=await req('command',{action:'deleteImported',batch:batch.id,version:b.version});
assert.equal(r.status,200,JSON.stringify(b));assert.equal(b.id.removed,2);
[r,b]=await req('state');assert.equal(b.state.proposals.filter(p=>p.legacyNo).length,0);assert.ok(b.state.importBatches[0].undone);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM users WHERE username='hasan.ak'").get().n,0,'pasif kullanıcı silinir');
// Çalışan silemez
await login('calisan');[r,b]=await req('state');[r,b]=await req('command',{action:'deleteImported',batch:batch.id,version:b.version});assert.equal(r.status,400);
await login('admin');
// Aynı dosya tekrar aktarılabilir
[r,b]=await req('command',{action:'importProposals',rows,dryRun:true});assert.equal(r.status,200,JSON.stringify(b));}
console.log('Round 12 integration passed: import permissions, row errors, dry run, confirm, passive authors, no e-mail, duplicates, size guard, undo with passive-user cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
