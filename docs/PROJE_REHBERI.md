# İvme · Proje rehberi (hâkimiyet dokümanı)

Bu belge projenin "her şeyi tek yerde" kopyasıdır: ne yaptık, neden böyle yaptık, kod nerede ne iş görüyor, nasıl yayınlanıyor, nasıl test ediliyor, mülakatta ne sorulur. Kodu yapay zekâ (Claude) yazdı; ürün kararları senin. Bu belgenin amacı, yardım almadan projeyi anlatıp savunabilmen.

- **Ortak altyapı** (GitHub iş akışı, Cloudflare, VPS, güvenlik, lisans) ayrı bir el kitabında anlatılır; burada yalnız İvme'ye özgü kısımlar var.
- **[doğrulanacak]** işaretli satırlar depodan ya da sohbetlerden kesinleştirilemedi. Kontrol edince işareti kaldır.
- Ayrıntılı tarihçe: [IYILESTIRME_NOTLARI.md](IYILESTIRME_NOTLARI.md) · kısa mülakat kartı: [MULAKAT.md](MULAKAT.md) · ilk pilot kararları: [KABUL_VE_KARAR_NOTLARI.md](KABUL_VE_KARAR_NOTLARI.md)

---

## 1. Bir bakışta

| | |
|---|---|
| **Ne** | Çalışan önerisi ve kaizen yönetimi: öneriden ödüle tek akış |
| **Kimin için** | Öneren çalışan (telefon), değerlendirici ve müdür (masaüstü), İK (ödül), sistem yöneticisi |
| **Canlı demo** | [ivme.ysfdurak.com](https://ivme.ysfdurak.com) (TR) · [ivme-en.ysfdurak.com](https://ivme-en.ysfdurak.com) (EN). Rol seçerek şifresiz giriş, her gece sıfırlanır |
| **Depo** | github.com/ysfdurak/ivme-oneri-kaizen (herkese açık, PolyForm Shield 1.0.0) |
| **Durum** | Tamamlandı (15 Kasım 2026), İngilizce sürüm 16 Kasım 2026. Yalnız portföyde; pilot bir şirket isterse |
| **İlk commit** | 12 Kasım 2026 · Kasım sonu itibarıyla 45 commit, 19 PR |

## 2. Sorun ve senin kararların

**Sorun:** Öneri sistemleri genelde şu yüzden ölür: öneren ne olduğunu göremez, öneri birinin masasında bekler, kazanç ölçülmez, geri bildirim gelmez. Şirketindeki mevcut sistemin sorunlarını gördün ve "bir öneri sistemi nasıl olmalı" sorusuna genel bir ürünle cevap verdin. İçinde şirketine ait hiçbir şey yok.

**Senin koyduğun kurallar** (mülakatta "bunu ben belirledim" diyebileceğin yerler):
- "Bölüm" kişinin organizasyondaki departmanı değil, önerinin gittiği iş alanıdır (Mal Kabul, Depolama…). Her bölümün tek sorumlusu var.
- Devir geri alınabilir olmalı. Kullanıcıyı pasife almak için yerine birini göstermek zorunlu olmamalı.
- Vardiya alanı yok; yerine Lokasyon (panolarda da).
- Organizasyon: müdürlük → direktörlük → genel müdürlük; üst seviyeler isteğe bağlı açılır.
- Aksiyon aşamasında "uygulandı / uygulanmadı" seçimi zorunlu. Uygulanamayan öneri kazanç adımına gitmez, ayrı durumda kapanır.
- Öneri içeriği hiçbir dış yapay zekâya gitmez, maskeli bile. MCP yalnız kurumun kendi yapay zekâsına bağlanır.
- İki sürüm, tek çekirdek: süreç sürümü (MCP yok) ve MCP'li sürüm.
- Mağaza uygulaması yok; telefonda web yeterli.
- Kuruma özgü listeler (öneri sınıfı, ret nedeni, kazanç türü, puan kriterleri, para birimi) Tanımlar ekranından yönetilir. Varsayılan para birimi TL.
- Canlı demoda şifresiz rol seçimi, örnek veri, gece sıfırlama.
- İngilizce sürüm için ayrı bir İngilizce demo şirketi ve her şeyin (e-postalar dahil) çevirisi.

## 3. Mimari ve veri akışı

```
Telefon / tarayıcı (React arayüzü, app/page.tsx)
        │  fetch  /api/state  /api/command  /api/attachment ...
        ▼
Cloudflare Worker (worker/index.ts)
   ├─ güvenlik başlıkları (CSP, HSTS...), ?lang= yönlendirmesi
   ├─ API uçları (app/api/*/route.ts)
   │     oturum + origin denetimi (lib/server.ts)
   │     ▼
   │   ÇEKİRDEK: lib/workflow.ts → applyCommand(durum, komut, kullanıcı, kullanıcılar)
   │             lib/model.ts    → canSee, redactProposal (görünürlük, anonimlik)
   │     ▼
   │   D1 (SQLite): users · sessions · workspace(data JSON, version) · outbox · kv
   ├─ /api/mcp  → lib/mcp-protocol.ts → lib/mcp-tools.ts (salt okuma, aynı çekirdek)
   └─ scheduled (her gece 00:00 UTC): vitrin verisini sıfırla
```

**Akıştaki en önemli fikir:** Arayüz bir "komut" gönderir (`{action: "accept", id: "KZ-2026-0013", version: 41}`). Sunucu çalışma alanını okur, `applyCommand` ile kuralları uygular, sürüm tutuyorsa yazar. Bütün yetki ve durum geçişleri tek bir saf fonksiyonda; bu yüzden sunucuya ve arayüze dokunmadan test edilebiliyor.

**Aşamalar** (`lib/model.ts → STAGES`): Ön değerlendirme → Bölüm değerlendirmesi → Aksiyon planlama → Uygulamada → Kazanç girişi → Kazanç onayı → Puanlama → Tamamlandı. Kapanış durumları: Tamamlandı, Reddedildi, İptal edildi, Uygulanamadı.

## 4. Teknoloji seçimleri: ne, neden, alternatif

| Seçim | Neden | Elenen alternatif ve nedeni |
|---|---|---|
| **Cloudflare Workers + D1** | Ücretsiz katmanda çalışır, sunucu yönetimi yok, alan adı zaten Cloudflare'de, GitHub'a gönderince kendiliğinden yayınlanır | VPS + PostgreSQL: gerçek şirket kullanımı için önerilen yol (README'de yazıyor), ama demo için gereksiz yük |
| **React + Vinext** (Next.js uyumlu, Vite tabanlı) | Next.js tarzı `app/api/.../route.ts` yapısını Workers üzerinde çalıştırır | Saf Next.js: Workers'ta çalıştırmak daha zahmetli |
| **TypeScript** | Kural kodunda tür hataları erken yakalanır | — |
| **Tek kayıtta çalışma alanı** (workspace.data JSON) | Pilotu hızlı kurmak, geri alma ve geçmişi kolay tutmak | Tablolara ayrılmış model: doğru olan bu, ama baştan yapılmadı (bkz. 8. bölüm) |
| **PBKDF2 şifre** (Web Crypto, 100.000 tur) | Workers'ta ek kütüphane gerekmeden çalışır | bcrypt/argon2: Workers'ta yerel destek yok |
| **Anahtar kelime benzerliği** (Jaccard) | Ücretli yapay zekâ yok, öneri içeriği dışarı çıkmaz | Gömme (embedding) modelleri: içerik dış servise gider; kuralına aykırı |
| **Giden kutusu (outbox) ile e-posta** | E-posta sağlayıcısı çökse de bildirim kaybolmaz, tekrar denenir | Doğrudan gönderim: hata olursa bildirim kaybolur |

## 5. Kod turu (kritik dosyalar)

Her satırı bilmen gerekmiyor. Şu dosyaların ne yaptığını ve neden orada olduğunu anlatabilmen yeterli.

| Dosya | Ne yapar | Bilmen gereken |
|---|---|---|
| `lib/workflow.ts` (≈1800 satır) | `applyCommand`: 50'ye yakın komut (accept, reject, transfer, undoTransfer, gain, gainApprove, score, rollback, endorse…) | Her komut önce yetki ve aşama kontrol eder (`assert`), sonra durumu değiştirir ve geçmişe yazar (`log`). Anonim öneride geçmiş metninden önerenin adı çıkarılır (`anonText`) |
| `lib/model.ts` | Veri türleri, aşamalar, `canSee` (kim neyi görür), `redactProposal` (anonimi gizle), gecikme hesabı | Görünürlük kuralı **tek yerde**: web, ek dosyaları, yorumlar ve MCP hepsi `canSee` kullanır |
| `app/api/command/route.ts` | Komut ucu: oturum, origin, boyut sınırı, demo kısıtları, sürüm denetimi, yazma | **İyimser eşzamanlılık:** `UPDATE ... WHERE version=?`. İki kişi aynı öneride aynı anda işlem yaparsa ikincisi 409 alır; farklı önerilerde çakışma olmaz (kayıt bazlı `rev`) |
| `lib/server.ts` | Veritabanı, şifre özeti, oturum çerezi, `sameOrigin`, vitrin/demo bayrakları, tablo kurulumu | Oturum çerezi HttpOnly + Secure + SameSite=Strict. Oturum belirteci veritabanında özetlenmiş (SHA-256) tutulur |
| `worker/index.ts` | Worker giriş noktası: güvenlik başlıkları, dil yönlendirmesi, gece görevi | CSP yalnız kendi adresine izin verir; vitrinde ölçüm servisi için tek istisna açılır. `?lang=` yönlendirmesinde açık yönlendirme açığı kapatıldı |
| `lib/vitrin.ts` | Canlı demo: ziyaretçiye özel alan (`v:<uuid>`), 45 öneri, günde 600 / IP başına saatte 20 alan sınırı, gece sıfırlama | Ziyaretçiler birbirinin verisini göremez; kullanıcı tablosu ortak olduğu için kişi ekleme demoda kapalı |
| `lib/similar.ts` | Benzer öneri: küçük harf → dolgu kelimeleri at → ilk 5 harfle kök → eş anlamlılar → Jaccard; başlık 2 kat ağırlıklı | Türkçe ekler sonda olduğu için "ilk 5 harf" basit ama işe yarar bir kökleme |
| `lib/outbox.ts`, `lib/notify.ts`, `lib/mailer.ts` | Bildirimler önce giden kutusuna yazılır, sonra gönderilir (Microsoft Graph ya da webhook) | Günlük tek gecikme e-postası; kişi "anında / günlük / kapalı" seçer |
| `lib/rewards.ts` | Puandan ve kazançtan ödül önerisi; İK onayı | Maaş bilgisi tutulmaz ("0,5 maaş" gibi kural yazılır). Paylar tam kuruşa yuvarlanır, toplam onaylanan tutara eşit |
| `lib/proposal-import.ts` | Eski önerileri Excel/CSV ile aktarma: önce kontrol, sonra onay, sonradan geri alma | CSV formül enjeksiyonuna karşı `csvSafe` |
| `lib/mcp-tools.ts`, `app/api/mcp/route.ts` | 5 salt okuma MCP aracı: bekleyen_islerim, oneri_detayi, benzer_oneriler, gecikenler, kazanc_ozeti | Kişisel erişim anahtarı (özetli saklanır, iptal edilebilir). Model, anahtar sahibinin web'de gördüğünden fazlasını göremez |
| `lib/i18n.ts`, `lib/i18n/en.json` | TR/EN metinler | Yeni metin ekleme kuralı: [DIL_DESTEGI.md](DIL_DESTEGI.md) |
| `app/page.tsx` (≈6500 satır) | Arayüzün büyük kısmı | Fazla büyük; bkz. 8. bölüm |

## 6. Yayın: GitHub → Cloudflare

**Akış:** Değişiklik ayrı dalda yapılır → PR açılır → GitHub Actions testleri çalıştırır (`.github/workflows/test.yml`) → testler yeşil değilse birleştirilemez (dal koruması) → `main`'e birleşince Cloudflare Workers Builds derler ve yayınlar.

- **Cloudflare Workers projesi:** `ivme` (TR) ve `ivme-en` (EN). Aynı depo, iki Worker, iki ayrı D1 veritabanı (`ivme-db`, `ivme-en-db`). EN Worker'da derleme değişkeni `CLOUDFLARE_ENV = en`.
- **Ayarlar:** `wrangler.jsonc`. Önemli değişkenler: `IVME_VITRIN` (1 = herkese açık demo), `IVME_DEMO`, `IVME_EDITION` (`ai` / `surec`), `EMAIL_PROVIDER` (`log` = gönderme), `IVME_LANG`, `OLCUM_URL`/`OLCUM_PROJE`.
- **Alan adı:** ivme.ysfdurak.com Worker'a özel alan adı olarak bağlandı (Cloudflare panelinden).
- **Veritabanı:** İlk yayında kendiliğinden oluşur; tablolar ilk açılışta kurulur (`ensureBaseSchema`), ayrıca migration çalıştırmaya gerek yok.
- **Gece görevi:** `triggers.crons: "0 0 * * *"` (TR saatiyle 03:00) vitrin verisini siler.
- **Ölçüm:** Yalnız vitrinde, VPS'teki ortak servis olcum.ysfdurak.com'a ekran adı ve süre gider; öneri metni ve kişi adı gitmez.
- **Bağımlılık güncellemeleri:** Dependabot haftalık PR açar; testler yeşilse birleştirilir.
- **Şirkete kurulum:** `IVME_VITRIN=0`, `IVME_DEMO=0`, `npx wrangler secret put IVME_ILK_SIFRE` (en az 12 karakter; yoksa uygulama açılmaz). Gerçek kullanımda VPS + PostgreSQL önerilir.
- [doğrulanacak] ivme ve ivme-en alan adlarının Cloudflare'de turuncu bulut (proxy açık) olup olmadığı. Workers özel alan adları normalde proxy'lidir.

## 7. Testler

**Otomatik testler:** `./scripts/test.sh` 18 birim testi (`tests/*.test.ts`) ve 9 entegrasyon testi (`tests/*.integration.cjs`) çalıştırır; toplam 27 grup. Entegrasyon testleri API uçlarını gerçek bir SQLite üzerinde çağırır.

Neyi sınıyorlar (örnekler):
- Süreç kuralları ve yetkiler (`workflow.test.ts`, `round*.test.ts`)
- Denetim izi: tanımlar sonradan değişse de eski kazanç ve puan kararı yeniden kurulabiliyor (`audit.test.ts`)
- Anonimlik: devir ve yönlendirme geçmişinde ad sızmıyor (eski kodda başarısız olan test)
- MCP: sürüm kapısı, anahtar, origin, web ile aynı görünürlük (`mcp.integration.cjs`)
- Vitrin: ziyaretçi alanları birbirinden ayrı, IP sınırı, gece sıfırlama (`vitrin.integration.cjs`)
- Aktarım: kuru çalıştırma, satır hataları, tekrar yüklemede çift kayıt yok, geri alma

**Elle yapılan testler** (geliştirme sırasında): Ekranlar axe ile erişilebilirlik taramasından geçti (734 kontrast ihlali → 0). 11,8 MB'lık telefon fotoğrafı tarayıcıda 407 KB'a küçültüldü. Ekran görüntüleri: `docs/ekranlar/`.

**Örneklem testi kaydı**

| Tarih | Adım | Beklenen | Gözlenen | Durum |
|---|---|---|---|---|
| 24.11.2026 | `./scripts/test.sh` (temiz kurulum, `pnpm install --frozen-lockfile`) | 27 grup geçer | 27 grup geçti | ✔ |
| 24.11.2026 | Canlı demo ana sayfası açılıyor mu (sunucu tarafı HTML) | Sayfa yanıt verir | Yanıt veriyor; içerik tarayıcıda JavaScript ile çiziliyor, ham HTML'de yalnız "İvme açılıyor…" var | ✔ (not: 8. bölüm) |
| — | Telefonda öneri ver → ön değerlendiricide gör → kabul et | Öneri sıradaki kişiye geçer | Senin yapman gerekiyor | bekliyor |
| — | Hatalı form: bölüm seçmeden ilerlemeye çalış | 2. adıma geçmez | Senin yapman gerekiyor | bekliyor |

## 8. Bilinen sınırlar ve sonraki adımlar

- **Ölçek:** Bütün çalışma alanı tek kayıtta; D1'in 2 MB satır sınırı yüzünden fotoğrafsız ≈600 öneri. Gerçek kullanımda veri tablolara ayrılmalı (öneri, aksiyon, geçmiş, ek ayrı) ve kurum sunucusuna taşınmalı.
- **`app/page.tsx` çok büyük** (≈6500 satır). Ekranlara bölünmesi bakımı kolaylaştırır. Raporlar sayfası ayrıldı; diğerleri sırada.
- **Arama motoru görünürlüğü:** Sayfa içeriği tarayıcıda çiziliyor. Meta etiketleri var, ama ham HTML'de içerik yok.
- **Anonimlik sınırı:** Küçük ekipte içerikten tahmin engellenemez; arayüzde bu açıkça yazıyor.
- **KVKK:** Cloudflare yurt dışında veri işleyebilir; kurum karar vermeli. KVKK şablonu hukukçu onayı bekliyor.

## 9. Mülakat soruları

Kısa cevaplı 10 soru: [MULAKAT.md](MULAKAT.md). Ek olarak teknik derinlik soruları:

1. **"İki kişi aynı anda aynı öneriyi kabul ederse ne olur?"** Komut, okuduğu sürüm numarasıyla gelir. Yazma `WHERE version=?` ile yapılır; sürüm değişmişse ikinci kişi "kayıt değişti, yenileyin" uyarısı (409) alır. Farklı öneriler üzerinde çalışanlar birbirini engellemez, çünkü her önerinin kendi `rev` değeri var.
2. **"Yetki kuralı değişirse kaç yeri değiştirirsin?"** Bir yeri: `canSee` ve `applyCommand`. Web, ek dosyaları ve MCP aynı fonksiyonları kullanır.
3. **"Benzer öneriyi nasıl buluyorsun, neden yapay zekâ kullanmadın?"** Kelime kümesi benzerliği (Jaccard), Türkçe için basit kökleme ve eş anlamlı listesi. Yapay zekâ kullansaydım öneri içeriği dış servise giderdi; bu benim koyduğum kurala aykırı. Uyarı gönderimi durdurmaz, karar insanda.
4. **"Şifreleri nasıl saklıyorsun?"** PBKDF2, SHA-256, kişiye özel tuz, 100.000 tur. Beş hatalı girişte geçici kilit. Yeni hesaba tek kullanımlık geçici şifre; ilk girişte değiştirmek zorunlu.
5. **"Canlı demoda biri zararlı içerik yüklerse?"** Her ziyaretçinin alanı ayrı, başkası göremez; gece silinir; günlük ve IP başına alan sınırı var. Fotoğrafların konum bilgisi yüklemeden önce silinir.
6. **"Bu projeyi baştan yapsan neyi değiştirirdin?"** Veriyi baştan tablolara ayırırdım ve arayüzü ekranlara bölerdim.
7. **"Kazanç ve ödül nasıl denetlenir?"** Kazanç beklenen → gerçekleşen → onaylı zinciriyle ilerler. Onay anındaki para birimi ve not saklanır; puan, verildiği andaki kriterlerle saklanır. Tanımlar sonradan değişse de eski karar yeniden kurulabilir.
8. **"CI'da ne çalışıyor?"** Her PR'da ve main'e gönderimde 27 test grubu. Dal koruması yüzünden testler geçmeden birleştirme yapılamıyor.

## 10. Kendini test et

Cevapları yukarıda; önce kendin cevapla, sonra kontrol et.

1. Uygulanamayan bir öneri neden kazanç adımına gitmiyor ve hangi durumda kapanıyor?
2. `applyCommand` neden "saf" bir fonksiyon olarak yazıldı? Bunun test açısından faydası ne?
3. Vitrin demosunda bir ziyaretçinin verisi diğerinden nasıl ayrılıyor? Hangi çerez ve hangi kayıt adı?
4. MCP sürümüyle süreç sürümü arasındaki fark ne, hangi ortam değişkeniyle seçiliyor?
5. Şirkete kurarken uygulama hangi ayar yoksa açılmaz?
6. Ölçüm servisine hangi veriler gidiyor, hangileri gitmiyor?
7. Türkçe kökleme neden "ilk 5 harf" ile yapılıyor, zayıf yanı ne?
8. CSP nedir, İvme'de neye izin veriyor?

## 11. Elle yapılacak alıştırma

**Koda küçük bir değişiklik (yaklaşık 30 dakika):** `lib/model.ts` içindeki `CATEGORY_LIST` listesine "Enerji" alanını ekle. Yerelde `npm run build && npm start` ile aç, öneri formunda yeni alanın göründüğünü kontrol et, `./scripts/test.sh` çalıştır. Bunu bir dalda yap ve PR aç. Mülakatta "koda kendim de dokundum" diyebilmen için.

**5 dakikalık demo akışı:**
1. Giriş: "Rol seçerek giriyoruz; her ziyaretçiye kendi örnek alanı açılıyor." (30 sn)
2. Çalışan rolü, telefon görünümü: öneri ver, gönderim mesajında numarayı ve değerlendiriciyi göster. (1 dk)
3. Değerlendirici: çalışma merkezi, gecikme işareti, kabul penceresi ve not. (1 dk)
4. Aksiyon ve destek beklemesi: IT talep numarası, "uygulandı/uygulanmadı" zorunluluğu. (1 dk)
5. Kazanç → puan → ödül önerisi, İK onayı. (1 dk)
6. Durum panosu ve rapor oluşturucu; "Bu sayılar nasıl hesaplanır?" (30 sn)

## 12. Değişiklik günlüğü

| Tarih | Değişiklik |
|---|---|
| 12.11.2026 | İlk sürüm GitHub'a yüklendi |
| 15.11.2026 | Canlı demo, TR/EN arayüz |
| 16.11.2026 | İngilizce demo, geçici şifre ve şifre sıfırlama, para birimi ayarı, SEO etiketleri |
| 17.11.2026 | PolyForm Shield lisansı |
| 18.11.2026 | CI testleri, kazanç onay zinciri, yerel yazı tipleri |
| 19.11.2026 | Güvenlik turu (RSC açığı, açık yönlendirme, CSP, HSTS), ziyaretçiye özel demo alanı, KVKK belgesi, mülakat kartı |
| 20.11.2026 | Fikre destek, CSV formül koruması, ortak ölçüm ve geri bildirim |
| 22–23.11.2026 | Tablo taşma düzeltmesi, ödül paylarının kuruş hassasiyeti |
| 24.11.2026 | Bu rehber yazıldı; örneklem testi (27/27 geçti) |
