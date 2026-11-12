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

// Tur 5: Excel'den kullanıcı yükleme, e-posta giden kutusu, kişisel bildirim tercihi, benzer öneri ve tanınma uçları.
(async()=>{
await login('admin');
let [r,b]=await req('state');
const U=n=>b.users.find(u=>u.id===n);
const calisan=U('calisan'),on=U('on');
const row=(o)=>({name:'Deneme Kişi',username:'deneme.kisi',email:'deneme@ornek.test',department:calisan.department,role:'Çalışan',manager:'',...o});
// Hatalı satırlar kaydedilmez, satır numarasıyla döner.
[r,b]=await req('command',{action:'importUsers',dryRun:true,rows:[row({username:'X'}),row({department:'Olmayan'}),row({role:'Genel müdür'})]});
assert.equal(r.status,400);assert.equal(b.errors.length,3);assert.ok(b.errors[0].startsWith('Satır 2'));
// Deneme: 1 yeni, 2 güncelleme; boş yönetici hücresi mevcut yöneticiyi korur.
const rows=[row({}),row({name:calisan.name,username:'calisan',email:'calisan@ornek.test',role:'employee'}),row({name:on.name,username:on.username,email:'on@ornek.test',role:'pre',department:on.department})];
[r,b]=await req('command',{action:'importUsers',dryRun:true,rows});assert.equal(r.status,200,JSON.stringify(b));assert.deepEqual(b.preview,{create:1,update:2});
[r,b]=await req('command',{action:'importUsers',rows});assert.equal(r.status,200);assert.equal(b.created.length,1);assert.equal(b.updated,2);
const temp=b.created[0].password;assert.ok(temp.length>=8);
[r,b]=await req('state');assert.equal(b.users.find(u=>u.id==='calisan').manager,calisan.manager,'boş yönetici hücresi eskiyi korur');
assert.equal(b.users.find(u=>u.id==='calisan').email,'calisan@ornek.test');
// Aynı e-posta başka kişide kullanılamaz.
[r,b]=await req('command',{action:'importUsers',dryRun:true,rows:[row({username:'baska.kisi',email:'calisan@ornek.test'})]});assert.equal(r.status,400);
// Yeni kişi geçici şifreyle girer ve şifre değiştirmesi istenir.
let a=await login('deneme.kisi',temp);assert.equal(a.user.mustChange,1);
// Yetki: yönetici dışında yükleme ve bildirim yönetimi yok.
await login('calisan');
[r,b]=await req('command',{action:'importUsers',rows});assert.equal(r.status,403);
[r,b]=await req('notify');assert.equal(r.status,403);
// Kişisel tercih.
[r,b]=await req('command',{action:'myPrefs',notify:'hepsi'});assert.equal(r.status,400);
[r,b]=await req('command',{action:'myPrefs',notify:'digest'});assert.equal(r.status,200);
[r,b]=await req('auth');assert.equal(b.user.notify,'digest');
await req('command',{action:'myPrefs',notify:'instant'});
// Öneri oluşturma: ön değerlendiriciye e-posta kuyruğa girer; işlemi yapan kişiye gitmez.
[r,b]=await req('state');let version=b.version;const op=b.state.proposals[0].operation;
[r,b]=await req('command',{action:'create',version,title:'Rampa önünde palet birikmesi',problem:'Rampada paletler bekliyor, forklift geçemiyor.',solution:'Ara stok alanı açılsın.',operation:op,category:'Verimlilik'});
assert.equal(r.status,200);const id=b.id;
// Benzer öneri ucu: kendi önerisini görebilen kişi listeyi alır; görmediği öneri için 404.
[r,b]=await req('similar',null,'?id='+id);assert.equal(r.status,200);assert.ok(Array.isArray(b.items));assert.ok(!b.items.some(x=>x.id===id));
[r,b]=await req('similar',{title:'Rampada palet birikiyor',problem:'Paletler rampada bekliyor',solution:'Alan',operation:op});assert.ok(b.items.some(x=>x.id===id),'taslak kontrolü yeni öneriyi bulur');
// Tanınma.
[r,b]=await req('recognition',null,'?gun=30');assert.equal(r.status,200);assert.equal(b.enabled,true);assert.equal(b.windowDays,30);assert.ok(b.me.submitted>=1);
await login('admin');
[r,b]=await req('notify');assert.equal(r.status,200);assert.equal(b.provider.ready,false,'sağlayıcı ayarsızken gönderim yok');
const mails=b.rows.filter(x=>x.subject.includes(id));
assert.ok(mails.some(x=>x.user_id==='on'&&x.status==='pending'),'ön değerlendiriciye kuyrukta e-posta');
assert.deepEqual(mails.filter(x=>x.user_id==='calisan').map(x=>x.subject.includes('Önerin alındı')),[true],'öneren yalnız alındı bilgisini alır');
// Test e-postası: yöneticinin adresi yoksa açık hata.
[r,b]=await req('notify',{action:'test'});assert.equal(r.status,400);
// Tanınma kapatılınca uç kapalı döner.
[r,b]=await req('state');version=b.version;
[r,b]=await req('command',{action:'recognitionSettings',enabled:false,version});assert.equal(r.status,200);
[r,b]=await req('recognition');assert.equal(b.enabled,false);
console.log('Round 5 integration passed: Excel import (dry run, errors, temp passwords, preserved fields), notify prefs, outbox on create, similar & recognition endpoints, permissions.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
