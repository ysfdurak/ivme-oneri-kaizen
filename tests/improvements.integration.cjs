const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const Module=require('node:module');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_high_proudstar.sql','utf8'));
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){return sqlite.prepare(sql).get(...this.params)||null},async all(){return {results:sqlite.prepare(sql).all(...this.params)}},async run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const original=Module._load;Module._load=function(name,parent,...rest){if(name==='cloudflare:workers')return {env:{DB:db}};return original.call(this,name,parent,...rest)};
const auth=require('/tmp/kaizen-server-tests/app/api/auth/route.js');const state=require('/tmp/kaizen-server-tests/app/api/state/route.js');const command=require('/tmp/kaizen-server-tests/app/api/command/route.js');const attachment=require('/tmp/kaizen-server-tests/app/api/attachment/route.js');
let cookie='';const origin='https://kaizen.test';
async function req(route,body){const request=new Request(origin+'/api/'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{'Cookie':cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const handlers={auth,state,command,attachment};const r=await handlers[route][body?'POST':'GET'](request);const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return [r,await r.json()];}

// Kasım 2026 iyileştirmeleri: eşzamanlı işlem, sürüm kontrollü yenileme, eklerin ayrı sunulması, tek giriş mesajı.
(async()=>{
let [r,b]=await req('auth');assert.equal(b.demo,true);
[r,b]=await req('auth',{username:'yok.boyle',password:'x'});const unknown=b.error;
[r,b]=await req('auth',{username:'admin',password:'yanlis-sifre'});assert.equal(b.error,unknown,'giriş hata mesajı kullanıcının varlığını belli etmemeli');
[r,b]=await req('auth',{username:'admin',password:'Kaizen123!'});
await req('auth',{action:'password',oldPassword:'Kaizen123!',password:'YeniSifre-2026'});
[r,b]=await req('state');let version=b.version;
const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4 deneme').toString('base64');
[r,b]=await req('command',{action:'create',version,title:'Ekli öneri testi',problem:'Rampa önünde palet birikiyor.',solution:'Ara stok alanı açılsın.',operation:'Mal Kabul',category:'Verimlilik',attachments:[{name:'plan.pdf',data:pdf}]});
assert.equal(r.status,200);const A=b.id;assert.equal(b.version,version+1);
const stale=version; // Bu sürümü gören başka bir kullanıcıyı temsil eder.
[r,b]=await req('command',{action:'create',version:stale+1,title:'İkinci öneri testi',problem:'Etiketler elle kontrol ediliyor.',solution:'Barkod okutma eklensin.',operation:'Sevkiyat',category:'Kalite'});
assert.equal(r.status,200);const B=b.id;
// Eski sürümle, değişmemiş BAŞKA bir öneride işlem: kabul edilmeli.
[r,b]=await req('command',{action:'comment',id:'KZ-2026-0001',text:'Eşzamanlı yorum',version:stale});assert.equal(r.status,200,'farklı kayıtta işlem çakışma vermemeli');
// Eski sürümle, o sürümden sonra değişmiş öneride işlem: reddedilmeli.
[r,b]=await req('command',{action:'accept',id:B,version:stale});assert.equal(r.status,409);
// Durum yükü: ek içeriği gelmez, adı ve boyutu gelir.
[r,b]=await req('state');version=b.version;const att=b.state.proposals.find(p=>p.id===A).attachments[0];
assert.equal(att.name,'plan.pdf');assert.equal(att.data,undefined);assert.equal(att.type,'application/pdf');assert.ok(att.size>0);
// Sürüm değişmediyse kayıtlar tekrar gönderilmez.
let res=await state.GET(new Request(origin+'/api/state?v='+version,{headers:{Cookie:cookie}}));let body=await res.json();assert.equal(body.unchanged,true);assert.equal(body.state,undefined);
// Ek dosya ayrı uçtan, yetki kontrolüyle gelir.
res=await attachment.GET(new Request(origin+'/api/attachment?id='+A+'&i=0',{headers:{Cookie:cookie}}));assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await res.arrayBuffer()).toString(),'%PDF-1.4 deneme');
// IT kullanıcısı bu öneriyi göremez, ekini de alamaz; kullanıcı adlarını görmez.
await req('auth',{action:'logout'});await req('auth',{username:'it',password:'Kaizen123!'});await req('auth',{action:'password',oldPassword:'Kaizen123!',password:'YeniSifre-2026'});
res=await attachment.GET(new Request(origin+'/api/attachment?id='+A+'&i=0',{headers:{Cookie:cookie}}));assert.equal(res.status,404);
[r,b]=await req('state');assert.ok(b.users.every(u=>u.username===undefined));
console.log('Improvement integration passed: per-record concurrency, unchanged-state polling, attachments served separately with access control, uniform login error, hidden usernames.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
