const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const Module=require('node:module');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('drizzle/0000_high_proudstar.sql','utf8'));
const db={prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){return sqlite.prepare(sql).get(...this.params)||null},async all(){return {results:sqlite.prepare(sql).all(...this.params)}},async run(){const r=sqlite.prepare(sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
// Ortam değişkenleri test sırasında değiştirilir: önce yapay zekâ paketi, sonda süreç paketi.
const env={DB:db,IVME_EDITION:'ai'};
const original=Module._load;Module._load=function(name,parent,...rest){if(name==='cloudflare:workers')return {env};return original.call(this,name,parent,...rest)};
const R=n=>require('/tmp/kaizen-server-tests/app/api/'+n+'/route.js');
const handlers={auth:R('auth'),state:R('state'),command:R('command'),tokens:R('tokens'),mcp:R('mcp')};
let cookie='';const origin='https://kaizen.test';
async function req(route,body){const request=new Request(origin+'/api/'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...(cookie?{'Cookie':cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const r=await handlers[route][body?'POST':'GET'](request);const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return [r,await r.json()];}
async function login(u,p='Kaizen123!',np='YeniSifre-2026'){await req('auth',{action:'logout'});let [r,b]=await req('auth',{username:u,password:p});if(!b.user)[r,b]=await req('auth',{username:u,password:np});if(b.user?.mustChange)await req('auth',{action:'password',oldPassword:p,password:np});return b;}
let rid=0;
async function mcp(token,method,params,headers={}){const r=await handlers.mcp.POST(new Request(origin+'/api/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify({jsonrpc:'2.0',id:++rid,method,params})}));return [r.status,r.status===202?null:await r.json().catch(()=>null)];}

// Yapay zekâ (MCP) katmanı uçtan uca: paket ayarı, yönetici aç/kapa, kişisel anahtar, yetki ve anonimlik, iptal.
(async()=>{
await login('admin');
let [r,b]=await req('auth');assert.equal(b.edition,'ai');
[r,b]=await req('tokens');assert.equal(b.enabled,false,'MCP varsayılan kapalı');
let [st]=await mcp('ivme_xxxxxxxxxxxxxxxxxxxxxxxx','tools/list');assert.equal(st,404,'kapalıyken uç yok gibi davranır');
[r,b]=await req('state');
[r,b]=await req('command',{action:'aiSettings',mcp:true,version:b.version});assert.equal(r.status,200);
// Çalışan bir öneri verir (anonim) ve kendine anahtar oluşturur.
await login('calisan');
[r,b]=await req('state');const op=b.state.operations[0];
[r,b]=await req('command',{action:'create',version:b.version,title:'Rampada palet birikmesi',problem:'Rampada paletler bekliyor, forklift geçemiyor.',solution:'Ara stok alanı açılsın.',operation:op,anonymous:true});
const anonId=b.id;
[r,b]=await req('tokens',{action:'create',name:'Asistan'});assert.equal(r.status,200);const tCalisan=b.token;assert.match(tCalisan,/^ivme_/);
[r,b]=await req('tokens');assert.equal(b.tokens.length,1);assert.equal(b.tokens[0].hash,undefined,'özet bile istemciye gitmez');
assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM api_tokens').all()).includes(tCalisan),'anahtar düz metin saklanmaz');
// Anahtarsız, yanlış anahtarlı ve başka siteden gelen istek reddedilir.
[st]=await mcp(null,'tools/list');assert.equal(st,401);
[st]=await mcp('ivme_yanlisyanlisyanlisyanlisyanlis','tools/list');assert.equal(st,401);
[st]=await mcp(tCalisan,'tools/list',{},{Origin:'https://kotu.example'});assert.equal(st,403);
// Protokol akışı.
let out;[st,out]=await mcp(tCalisan,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});assert.equal(st,200);assert.equal(out.result.serverInfo.name,'ivme');
const note=await handlers.mcp.POST(new Request(origin+'/api/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tCalisan},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}));assert.equal(note.status,202);
[st,out]=await mcp(tCalisan,'tools/list');assert.equal(out.result.tools.length,5);
[st,out]=await mcp(tCalisan,'tools/call',{name:'oneri_detayi',arguments:{id:anonId}});assert.equal(out.result.structuredContent.id,anonId);
// Değerlendirici: kendi anahtarıyla bekleyen işini görür, anonim önerenin adını göremez.
await login('on.degerlendirme');
[r,b]=await req('tokens',{action:'create',name:'Asistan'});const tOn=b.token;
[st,out]=await mcp(tOn,'tools/call',{name:'bekleyen_islerim',arguments:{}});assert.ok(out.result.structuredContent.oneriler.some(x=>x.id===anonId));
[st,out]=await mcp(tOn,'tools/call',{name:'oneri_detayi',arguments:{id:anonId}});
assert.equal(out.result.structuredContent.oneren,'Anonim çalışan');const calisanName=sqlite.prepare("SELECT name FROM users WHERE id='calisan'").get().name;assert.ok(!out.result.content[0].text.includes(calisanName)&&!out.result.content[0].text.includes('"calisan"'),'anonim önerenin adı modele gitmez');
// Yetkisiz kayıt: IT kullanıcısı bu öneriyi web'de göremez, MCP'de de göremez.
await login('it');[r,b]=await req('tokens',{action:'create',name:'x'});const tIt=b.token;
[st,out]=await mcp(tIt,'tools/call',{name:'oneri_detayi',arguments:{id:anonId}});assert.equal(out.result.isError,true);
// İptal edilen anahtar çalışmaz; MCP kapatılınca hiçbir anahtar çalışmaz.
[r,b]=await req('tokens');await req('tokens',{action:'revoke',id:b.tokens[0].id});
[st]=await mcp(tIt,'tools/list');assert.equal(st,401);
await login('admin');[r,b]=await req('state');await req('command',{action:'aiSettings',mcp:false,version:b.version});
[st]=await mcp(tOn,'tools/list');assert.equal(st,404);
// Süreç paketi: aynı kod, uç kapalı ve ayar değiştirilemez.
env.IVME_EDITION='surec';
[r,b]=await req('auth');assert.equal(b.edition,'surec');
[r,b]=await req('state');[r,b]=await req('command',{action:'aiSettings',mcp:true,version:b.version});assert.equal(r.status,400);
[st]=await mcp(tOn,'tools/list');assert.equal(st,404);
[r,b]=await req('tokens');assert.equal(b.enabled,false);
console.log('MCP integration passed: edition gating, admin switch, personal tokens (hashed, revocable), auth/origin checks, protocol flow, web-equal visibility, anonymity.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
