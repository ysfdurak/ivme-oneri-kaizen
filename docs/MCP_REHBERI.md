# İvme · Yapay zekâ (MCP) katmanı rehberi

## Özet
- İvme iki paket olarak teslim edilir; kod tektir.
  - **Süreç paketi** (`IVME_EDITION` boş ya da `surec`): yapay zekâ bağlantı kodu pakete hiç konmaz.
  - **Yapay zekâ paketi** (`IVME_EDITION=ai`): MCP ucu var, ama sistem yöneticisi Tanımlar'dan açana kadar kapalıdır.
- MCP yalnızca **kurumun kendi sunucusundaki** yapay zekâya bağlanmak içindir. Dış bir yapay zekâ hizmetine bağlanmaz.
- Model **salt okur**: kabul, ret, devir gibi kararlar web'de kalır. Ekleri (fotoğraf, PDF) görmez.
- Model, anahtar sahibinin web'de görebildiğinden fazlasını göremez; anonim önerenin adı burada da gizlidir.

## Nasıl çalışır (kendi kelimelerinle anlatabilmen için)
```
Şirket içi yapay zekâ istemcisi ──POST /api/mcp (Bearer anahtar)──▶ app/api/mcp/route.ts
   1. Paket "ai" mi, Tanımlar'dan açık mı?  değilse 404 (uç yokmuş gibi)
   2. Anahtar → kullanıcı (lib/tokens.ts)  geçersiz/süresi dolmuş/kişi pasif → 401
   3. JSON-RPC mesajı → lib/mcp-protocol.ts (initialize, tools/list, tools/call, ping)
   4. Araç → lib/mcp-tools.ts → ÇEKİRDEK: canSee, redactProposal, overdueDays, supportWaits, findSimilarSafe
```
Çekirdek web arayüzüyle aynıdır; MCP için kural kopyalanmadı. Bir yetki kuralı değişirse iki taraf birlikte değişir.

## Araçlar (hepsi salt okuma)
| Araç | Ne döner |
|---|---|
| `bekleyen_islerim` | Kişinin üzerindeki açık öneriler ve aksiyonlar; gün, hedef, gecikme, destek talep no |
| `oneri_detayi` `{id}` | Tek öneri: sorun, çözüm, aşama, aksiyonlar, kazanç, son 10 hareket ve yorum |
| `benzer_oneriler` `{id}` ya da `{baslik, sorun, cozum, bolum}` | Benzer öneriler: numara, başlık, durum, puan, ortak kelimeler, açabilir mi |
| `gecikenler` `{en_az_gun?, mudurluk?}` | Hedef süreyi aşanlar; sorumlu ve müdürlük kırılımı |
| `kazanc_ozeti` `{baslangic?, bitis?, bolum?}` | Onaylı kazanç; dönem, tür, bölüm kırılımı (onay tarihine göre) |

Örnek sorular: "Bende bekleyen ne var, hangisi gecikti?", "Lojistik Müdürlüğü'nde 10 günden fazla geciken öneriler kimde?",
"KZ-2026-0073'e benzeyen öneri var mı?", "Bu ay onaylanan yıllık kazanç ne kadar?"

## Kurulum
1. Sunucuda `IVME_EDITION=ai` ortam değişkenini ver (yerelde: `npm start -- --var IVME_EDITION:ai`).
2. Sistem yöneticisi: Tanımlar > **Yapay zekâ erişimi (MCP)** kutusunu işaretler.
3. Kullanıcı: menüde zil simgesi (Bildirim tercihim) > **Anahtar oluştur**. Anahtar bir kez gösterilir; 90 gün geçerli, kişi başına en fazla 3.
4. Şirket içi istemcide (MCP destekli sohbet arayüzü) yeni MCP sunucusu ekle:
   - Tür: Streamable HTTP · Adres: `https://<ivme-adresi>/api/mcp`
   - Başlık: `Authorization: Bearer ivme_…`
5. Deneme (komut satırı):
```sh
curl -s https://<ivme-adresi>/api/mcp -H "Authorization: Bearer ivme_…" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"bekleyen_islerim","arguments":{}}}'
```

## Güvenlik kuralları
- Anahtar veritabanında düz metin tutulmaz (SHA-256 özeti). Kişi pasife alınırsa, şifresini henüz belirlemediyse, anahtar iptal edilirse ya da MCP kapatılırsa anahtar çalışmaz.
- Başka bir siteden tarayıcı üzerinden gelen istek (yabancı `Origin`) reddedilir.
- Model ekleri görmez; önerinin yalnız ad ve türünü (önce/sonra/belge) görür.
- **Önerilerin dış bir yapay zekâya gitmemesi kurumun istemci tarafındaki kararıdır.** İvme, anahtarın hangi istemciye girildiğini bilemez; Tanımlar'daki açıklama ve bu rehber bunu açıkça söyler. Satış öncesi müşteriden yazılı yapay zekâ politikası alınır.

## Paket hazırlama
```sh
node scripts/paketle.mjs surec   # paket/ivme-surec.zip: MCP dosyaları yok, arayüz bileşeni boş yer tutucu
node scripts/paketle.mjs ai      # paket/ivme-ai.zip: tam kod
```
Süreç paketinden çıkarılanlar: `app/api/mcp`, `app/api/tokens`, `lib/mcp-tools.ts`, `lib/mcp-protocol.ts`, `lib/tokens.ts`, MCP testleri.
Süreç paketi ayrıca derlenip test edildi (10 test grubu, derleme başarılı).

## Benzer öneri için yapay zekâ (hazırlık yapıldı, sağlayıcı yazılmadı)
`lib/similarity.ts` benzer öneri bulmayı tek bir arayüzün arkasına aldı. Bugün tek sağlayıcı kelime eşleştirmesi.
Müşteri isterse şirket içi modelle çalışan sağlayıcı aynı arayüzle eklenir; model hata verirse otomatik olarak
kelime eşleştirmesine dönülür. Hem web'deki liste hem `benzer_oneriler` aracı bu arayüzü kullanır.

## Bilinçli sınırlar
- Giriş kişisel anahtarla; OAuth (tek tıkla bağlanma) yok. Şirket içi istemciler için anahtar yeterli; gerekirse sonradan eklenir.
- Sunucudan istemciye akış (SSE) yok; her istek tek yanıt. Araçlar kısa sürdüğü için gerek yok.
- Yazma aracı yok (yorum, talep no girme vb.). Pilot isterse, her işlemde onay soran şekilde eklenir.

## Testler
`tests/mcp.test.ts` (araçlar, yetki, anonimlik, protokol) ve `tests/mcp.integration.cjs` (paket ayarı, aç/kapa,
anahtar, yetki ve kaynak kontrolü, uçtan uca akış, süreç paketinde ucun kapalı olduğu). `./scripts/test.sh` → 12 grup.
