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
// Tur 13: tek kullanımlık geçici şifre (yeni kullanıcı) ve yöneticinin şifre sıfırlaması.
(async()=>{
await login('admin');
let [r,b]=await req('state');let version=b.version;
const calisan=b.users.find(u=>u.id==='calisan');
const yeni={action:'user',version,username:'yeni.kisi',name:'Yeni Kişi',department:calisan.department,directorate:calisan.directorate,role:'employee',manager:''};
[r,b]=await req('command',yeni);assert.equal(r.status,200,JSON.stringify(b));
const temp=b.temp.password;assert.match(temp,/^[a-hj-np-z2-9]{6}-\d{3}$/);assert.equal(b.temp.username,'yeni.kisi');
// eski sabit şifre artık çalışmaz, geçici şifre ilk girişte değiştirilmeli
await req('auth',{action:'logout'});[r,b]=await req('auth',{username:'yeni.kisi',password:'Kaizen123!'});assert.equal(b.user,undefined);
[r,b]=await req('auth',{username:'yeni.kisi',password:temp});assert.equal(r.status,200);assert.equal(b.user.mustChange,1);
const own='Kendi-Sifrem-2026';[r,b]=await req('auth',{action:'password',oldPassword:temp,password:own});assert.equal(b.user.mustChange,0);
const row=sqlite.prepare("SELECT password FROM users WHERE username='yeni.kisi'").get();assert.ok(!row.password.includes(temp));
// yönetici olmayan sıfırlayamaz
const id=sqlite.prepare("SELECT id FROM users WHERE username='yeni.kisi'").get().id;
[r,b]=await req('command',{action:'resetPassword',userId:'admin'});assert.equal(r.status,403);
// yönetici sıfırlar: eski şifre geçmez, yeni geçici şifre ile ilk giriş istenir, açık oturum kapanır
await login('admin');[r,b]=await req('command',{action:'resetPassword',userId:id});assert.equal(r.status,200);const temp2=b.temp.password;assert.notEqual(temp2,temp);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(id).n,0);
[r,b]=await req('command',{action:'resetPassword',userId:'admin'});assert.equal(r.status,400);
await req('auth',{action:'logout'});[r,b]=await req('auth',{username:'yeni.kisi',password:own});assert.equal(b.user,undefined);
[r,b]=await req('auth',{username:'yeni.kisi',password:temp2});assert.equal(b.user.mustChange,1);
console.log('Round 13 integration passed: one-time temporary passwords for new users, admin password reset (old password invalid, sessions closed, first-login change), permissions.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
