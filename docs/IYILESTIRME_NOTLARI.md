# İvme · Kasım 2026 İyileştirmeleri

Bu belge, 11 Kasım 2026 incelemesinde bulunan eksiklerin nasıl giderildiğini, kodda nerede olduğunu ve nasıl test edildiğini anlatır. Her maddede "neden" kısmı da var; sorulduğunda gerekçeyi anlatabilmen için.

## Özet

| # | Konu | Durum |
|---|---|---|
| 1 | Telefon fotoğrafları 500 KB sınırına takılıyordu | Giderildi: tarayıcıda otomatik küçültme |
| 2 | Operasyon/alan önceden seçili geliyordu | Giderildi: boş başlar, seçim zorunlu |
| 3 | Gönderim sonrası mesaj belirsizdi | Giderildi: numara ve değerlendirici adı yazılır |
| 4 | Taslak kaybı | Giderildi: cihazda kullanıcıya özel taslak |
| 5 | Çalışan ana sayfası değerlendirici odaklıydı | Giderildi: "Önerilerin nerede?" paneli |
| 6 | Değerlendirici kabul ettiği kaydı göremiyordu | Giderildi: işlem yapılan kayıtlar görünür, "İşlem yaptıklarım" sekmesi |
| 7 | Kabul tek tık, not yok | Giderildi: onay penceresi ve isteğe bağlı not |
| 8 | Ret gerekçesi raporlanamıyordu | Giderildi: standart ret nedenleri + raporu |
| 9 | Soru sormanın tek yolu revizyondu | Giderildi: "Sorular ve notlar" |
| 10 | Aşama hedef süresi yoktu | Giderildi: hedef süre, gecikme işareti, "Geciken" filtresi, aşama süreleri raporu |
| 11 | Aksiyonsuz "Uygulamayı başlat" hata veriyordu | Giderildi: buton kilitli, yönlendirici metin |
| 12 | Her 30 sn'de tüm veri ekleriyle iniyordu | Giderildi: ekler ayrı uçtan, değişiklik yoksa veri inmez |
| 13 | Aynı anda farklı önerilerde işlem çakışıyordu | Giderildi: kayıt bazlı çakışma kontrolü |
| 14 | Giriş mesajı kullanıcı adını ele veriyordu | Giderildi: tek mesaj |
| 15 | Demo şifresi ve kullanıcı adları açıktaydı | Giderildi: `IVME_DEMO=0` ile kapanır, kullanıcı adları yalnızca yöneticiye gider |
| 16 | 734 renk kontrastı ihlali, çok küçük yazılar | Giderildi: 0 ihlal, en küçük yazı 11 px |
| 17 | Detay paneli/pencere erişilebilirliği | Giderildi: başlık bağlantısı, odak yönetimi, klavyeyle kaydırma, etiketler |

Ayrıca: örnek verideki geçmiş kayıtlarının bir kısmı yanlış kişiye (çalışana) yazılmıştı, düzeltildi.

Düzeltme: İlk incelemede "sol menü arka planı yarıda bitiyor" demiştim. Bu, tam sayfa ekran görüntüsünün sabit (fixed) menüyü çizme biçiminden kaynaklanan bir görüntü hatasıymış; gerçek kullanımda sorun yok.

## Maddeler

### 1. Fotoğrafların küçültülmesi
- **Nerede:** `app/page.tsx` → `shrinkImage`, `attachments`
- **Nasıl:** Fotoğraf `createImageBitmap` ile açılır, uzun kenarı en fazla 1600 px olacak şekilde canvas'a çizilir ve JPEG'e çevrilir. 500 KB altına inene kadar önce kalite (0,82 → 0,58), gerekirse boyut düşürülür. Telefonun döndürme bilgisi (EXIF) dikkate alınır.
- **Neden sunucuda değil:** Sunucuya 5 MB gönderip orada küçültmek hem mobil veriyi hem Cloudflare Worker sınırlarını zorlar. Tarayıcıda küçültmek hızlı ve ücretsiz.
- **Sınır:** PDF küçültülemez, 500 KB sınırı PDF için geçerli. 25 MB üstü fotoğraf reddedilir.
- **Test:** 11,8 MB'lık 4032×3024 fotoğraf yüklendi, 407 KB JPEG olarak kaydedildi.

### 2–4. Öneri formu
- Operasyon ve iyileştirme alanı "seç" ile boş başlar, `required` olduğu için seçilmeden 2. adıma geçilmez. Neden önemli: ön değerlendirici operasyona göre atanıyor; yanlış varsayılan, öneriyi yanlış kişiye gönderir.
- Gönderimden sonra mesaj: "KZ-2026-0013 numaralı önerin gönderildi. Ön değerlendirme için Zeynep Kaya kişisine iletildi."
- Taslak `localStorage`'da `ivme-taslak-<kullanıcı id>` anahtarıyla tutulur. Ortak tablet kullanılsa bile her kullanıcının taslağı ayrıdır. Gönderilince silinir. Ana sayfada "Yarım kalan önerin var" kartı çıkar.
- Form hataları artık formun içinde gösterilir (önceden sayfanın tepesindeydi, telefonda görünmüyordu).

### 5. Çalışan ana sayfası
- **Nerede:** `page.tsx` → `isEmployee`, `mine`, `progressOf`
- Çalışan rolünde "Hangi birimi bekliyoruz?" ve süreç dağılımı gizlenir. Yerine kendi önerileri ilerleme çubuğuyla gelir ("Adım 4/7"). Revizyon bekleyen öneri en üstte ve "sıra sende" vurgusuyla gösterilir.
- Özet kartlar çalışan için kendi önerilerini sayar.

### 6. Değerlendirici görünürlüğü
- **Nerede:** `lib/model.ts` → `canSee`. Sunucu (`/api/state`, ek dosyası, yorum) aynı fonksiyonu kullanır; kural tek yerde.
- **Kural:** Yönetici her şeyi, müdür kendi müdürlüğünü görür. Diğerleri: önerinin sahibi, şu anki sorumlusu, değerlendiricisi, aksiyon/destek sorumlusu veya geçmişinde işlem yapmış kişi görür.
- Listede "İşlem yaptıklarım" sekmesi eklendi.
- **Not:** Planlanan "benzer öneri kontrolü" için ön değerlendiricinin tüm önerilerin başlık/operasyon özetini görmesi gerekecek. Bu, ayrı bir yetki kararı (karar notlarında açık).

### 7–9. Kabul, ret ve yorum
- Kabul artık pencere açar: hangi aşamaya geçeceği ve yeni sorumlu yazar, isteğe bağlı not geçmişe "Kabul notu" olarak düşer.
- Ret penceresinde "Ret nedeni" listeden seçilir (`REJECT_REASONS`), açıklama öneri sahibine gösterilir. Kayıtta `rejectReason` alanı tutulur, raporlarda "Ret nedenleri" paneli var.
- Öneri sahibi, ret açıklamasını veya düzeltme isteğini özet sekmesinde renkli kutuda görür.
- "Sorular ve notlar": öneriyi görebilen herkes yazabilir, kapalı kayıtta da yazılabilir (ör. ret sonrası soru). Sunucu işlemi `comment`.
- Pencere butonları işi söyler: "Kaydet" yerine "Reddet", "Kabul et", "Devret" vb.

### 10. Hedef süreler ve gecikme
- **Nerede:** `lib/model.ts` → `STAGE_TARGET_DAYS`, `overdueDays`
- Varsayılan hedefler (gün): Ön değerlendirme 3, Operasyon değerlendirmesi 5, Aksiyon planlama 5, Uygulamada 30, Kazanç girişi 7, Kazanç onayı 3, Puanlama 3, Revizyon 7. **Bunlar pilot varsayımı, şirket kuralıyla değiştirilmeli.**
- Geciken kayıtlar kırmızı "X gün gecikti" ile işaretlenir; listede "Geciken" filtresi var; CSV'ye "Aşamada geçen gün" ve "Gecikme" sütunları eklendi.
- Her aşama değişiminde `stageLog` kaydı tutulur (aşama, başlangıç, bitiş). Raporlardaki "Aşama süreleri" tablosu bundan ortalama süre hesaplar. Eski kayıtlarda bu bilgi olmadığı için ortalama, bu sürümden sonraki geçişlerle dolmaya başlar.

### 12–13. Performans ve eşzamanlılık
- `/api/state` ek içeriğini göndermez, yalnızca ad/boyut/tür gönderir. Ek, `/api/attachment?id=…&i=…` ile ve yetki kontrolüyle açılır.
- İstemci elindeki sürümü (`?v=`) gönderir; değişiklik yoksa sunucu kayıtları tekrar göndermez (`unchanged: true`). 30 sn'lik yenileme artık çoğu zaman birkaç yüz bayt.
- **Çakışma kuralı (`app/api/command/route.ts`):** Her öneri en son değiştiği sürümü `rev` alanında taşır. Kullanıcının elindeki sürüm eskiyse ama işlem yaptığı öneri o sürümden sonra değişmediyse, işlem güncel veriye uygulanır. Önerinin kendisi değiştiyse 409 döner ("Başka bir kullanıcı bu kaydı güncelledi"). Yazma anında yarış olursa 3 kez yeniden denenir.
- **Hâlâ geçerli olan sınır:** Veriler tek JSON kaydında. Bu değişiklikler pilot ölçeğinde yeterli; şirket geneline geçmeden öneri/aksiyon/destek/yorum tablolarına ayrıştırma ve eklerin nesne depolamaya (R2 veya şirket sunucusu) taşınması gerekiyor.

### 14–15. Güvenlik
- Giriş hatalarında tek mesaj var: kullanıcı yok, şifre yanlış veya hesap kilitli ayırt edilemiyor.
- `IVME_DEMO` ortam değişkeni: varsayılan açık (pilot aynı kalır). Şirket kurulumunda `IVME_DEMO=0` yapılınca giriş ekranındaki demo kutusu ve başlangıç şifresi kaybolur, kullanıcı adı alanı boş gelir.
- Yönetici dışındaki roller kullanıcı listesinde kullanıcı adlarını görmez.
- **Hâlâ açık:** Yeni kullanıcılar hâlâ `Kaizen123!` ile oluşturuluyor (ilk girişte değiştirme zorunlu). Şirket kurulumunda tek kullanımlık rastgele şifre veya şirket girişi (SSO) ile değiştirilmeli.

### 16–17. Erişilebilirlik
- Düşük kontrastlı 7 renk koyulaştırıldı. axe taramasında ihlal 734'ten 0'a indi (giriş, ana sayfa, liste, detay, raporlar, form; masaüstü ve telefon).
- 8–11 px yazılar 11–12 px'e çıkarıldı.
- Detay paneli ve pencereler başlıklarıyla adlandırıldı. Açılınca klavye odağı içine taşınıyor, arkadaki menü `inert` oluyor. Detay içeriği klavyeyle kaydırılabiliyor.
- Etiketsiz seçici, boş tablo başlığı, arama kutusu ve hata kapatma butonu adlandırıldı.

## Test

```sh
./scripts/test.sh
```

Dört test grubu çalışır:
1. `tests/workflow.test.ts`: mevcut 34 süreç komutu
2. `tests/improvements.test.ts` (yeni): kabul sonrası görünürlük, kabul notu, yorum yetkisi, ret nedeni, aşama kaydı, gecikme
3. `tests/server.integration.cjs`: mevcut API testleri
4. `tests/improvements.integration.cjs` (yeni): kayıt bazlı çakışma, değişiklik yoksa veri inmemesi, eklerin ayrı ve yetkili sunulması, tek giriş mesajı, gizli kullanıcı adları

Tarayıcıda uçtan uca denenenler: çalışan (telefon) taslak, büyük fotoğraf, gönderim; ön değerlendirici kabul notu ve "İşlem yaptıklarım"; operasyon yorumu, ret nedeni, kilitli "Uygulamayı başlat", raporlar; çalışanın ret açıklamasını görmesi.

## Yayına alırken

- Mevcut canlı veriyle uyumlu: yeni alanlar (`comments`, `rejectReason`, `stageLog`, `rev`) isteğe bağlı, migrasyon gerekmez.
- Şirket kurulumunda `IVME_DEMO=0` ortam değişkenini ekle.
- Hedef süreleri ve ret nedenlerini şirket kurallarıyla `lib/model.ts` içinde güncelle.

## Kapsam dışı kalanlar

- **E-posta/SMS bildirimi:** Şirketin e-posta altyapısına (SMTP/Exchange) bağlı. Kurulum ortamı netleşince eklenebilir.
- **Benzer öneri kontrolü:** Karar notlarındaki geliştirme kapsamında, ayrı iş.
- **Veri tablolarına ayrıştırma:** Yukarıda açıklandı, şirket kurulumunun ön şartı.

---

# Durum panosu (11 Kasım 2026, ikinci tur)

Önceden öneri durumları yalnızca sayı olarak görünüyordu: ana sayfada aşama sayıları, Raporlar'da "Güncel statüler" çubukları. Hangi önerinin kimde, ne kadar süredir beklediği görünmüyordu. Bunun için **Durum panosu** sayfası eklendi.

## Kim görür
- Sistem yöneticisi tüm kayıtları görür; müdür kendi müdürlüğünün kayıtlarını görür (mevcut görünürlük kuralı).
- Çalışan ve diğer roller menüde panoyu görmez.

## Raporlar
Her rapor **Grafik / Tablo** olarak görüntülenir ve **CSV** olarak indirilebilir.

| Rapor | Ne gösterir |
|---|---|
| Öneri durumları | Açık önerilerin aşamalara dağılımı; tabloda ortalama ve en uzun bekleme, hedef süre, hedefi aşan sayısı |
| Üzerinde en çok öneri bekleyenler | Sorumlusu olduğu açık öneri sayısı, ortalama/en uzun bekleme, gecikme. Kişiye tıklayınca o kişide bekleyen öneriler listelenir |
| En çok öneri bekleyen müdürlükler | Sorumlunun müdürlüğüne göre bekleyen öneri sayısı |
| Ortalama bekleme süresi en uzun departmanlar | Sorumlunun departmanına göre ortalama bekleme günü |
| Ortalama bekleme süresi en uzun müdürlükler | Sorumlunun müdürlüğüne göre ortalama bekleme günü |
| En uzun süredir bekleyen 10 öneri | Aşamada en uzun bekleyen 10 açık öneri; tıklayınca detay açılır |
| Aksiyon durumları | Açık önerilerdeki aksiyonların durum dağılımı, hedef tarihi geçen aksiyonlar, kişi bazında açık/geciken aksiyon |

Üstte filtreler (önerinin müdürlüğü, operasyon) ve dört özet gösterge bulunur: açık öneri, hedef süreyi aşan, ortalama bekleme, geciken aksiyon.

## Hesaplama kuralları
- **Bekleme süresi:** önerinin bulunduğu aşamaya geldiği günden bugüne geçen tam gün sayısı.
- **Müdürlük/departman:** öneri şu an **kimde bekliyorsa** o kişinin birimidir (önerenin birimi değil). "Bekleyen" sorusunu doğru cevaplamak için böyle seçildi. Önerenin birimine göre bakmak gerekirse üstteki "Önerinin müdürlüğü" filtresi kullanılabilir.
- **Kapalı öneriler** (tamamlandı, reddedildi, iptal) bekleme hesaplarına girmez.
- **Geciken aksiyon:** hedef tarihi bugünden önce olan ve tamamlanmamış/iptal edilmemiş aksiyon.

Hesaplamalar `lib/dashboard.ts` dosyasında saf fonksiyonlar olarak yazıldı. Arayüzden bağımsız test ediliyorlar ve ileride MCP aracı olarak (ör. "en uzun bekleyen 10 öneri") aynen kullanılabilirler.

## Raporları pasife çekme
- Sistem yöneticisi panoda **Raporları yönet** ile istediği raporu kapatıp açabilir.
- Ayar sunucuda saklanır (`settings.disabledReports`) ve **tüm kullanıcılar** için geçerlidir; veri silinmez.
- Her değişiklik yönetici denetim kaydına "pasif/aktif" olarak yazılır.
- Yönetici dışında kimse bu ayarı değiştiremez (sunucu da kontrol eder).

## Dosyalar
- `lib/dashboard.ts`: hesaplamalar ve rapor listesi
- `app/dashboard-page.tsx`: pano ekranı
- `app/page.tsx`: menü, sorumlu filtresi, "Raporları yönet" penceresi
- `lib/workflow.ts`: `reportSettings` komutu
- `tests/dashboard.test.ts`: gruplama, ortalama, ilk 10, aksiyon özeti ve yetki testleri

## Not
Örnek veride bütün sorumlular Lojistik Müdürlüğü'nde olduğu için müdürlük grafikleri tek çubuk gösteriyor. Gerçek veride her müdürlük ayrı satır olarak görünür.

---

# Üçüncü tur: büyük veriyle bulunan eksikler (11 Kasım 2026)

300 öneri, 49 kullanıcı ve 6 müdürlükle yapılan testte bulunan eksikler giderildi ve aynı veriyle tekrar test edildi. Test verisi artık repoda: `scripts/test-verisi/` (bkz. oradaki README).

| # | Sorun | Çözüm | Tekrar test sonucu |
|---|---|---|---|
| 1 | Müdür yalnız önerenin müdürlüğünü görüyordu | Müdür ayrıca **operasyonun bağlı olduğu** ve **önerinin şu an beklediği kişinin** müdürlüğündeki önerileri görür ve yönetir. Matriste operasyona "Bağlı müdürlük" seçilebilir; boşsa operasyon sorumlusunun müdürlüğü kullanılır | Üretim müdürü 84 yerine 129 öneri görüyor |
| 2 | Pasif kullanıcıda kalan işler fark edilmiyordu | Ana sayfada yöneticiye uyarı; Kullanıcılar'da "Açık iş" sütunu, kırmızı satır ve **İşleri devret** (öneri, aksiyon ve matris görevleri tek seferde, her kayda not düşerek); matriste pasif kişi kırmızı; panoda "(pasif)" etiketi | 8 öneri + 5 aksiyon + 1 matris görevi devredildi, uyarı kalktı |
| 2b | Ayrılan kişinin yerine kimse atanmıyordu | Matriste her görev için **yedek kişi**: asıl kişi pasifse yeni işler yedeğe gider | Testle doğrulandı |
| 3 | Raporlarda "Puan" toplanıyordu | **Ortalama puan** (parantezde puanlanan öneri sayısı). Ayrıca "Öneren kişi" sütunu ve öneri sayısına göre sıralama | — |
| 4 | Liste sayfalanmıyor, sıralanamıyordu | 25/50/100 kayıtlık sayfalar, sütun başlığından sıralama, "Sırala" seçimi (telefonda da) | Sayfa yüksekliği 28.000 px → 2.900 px |
| 4b | Arama sorumluda aramıyordu | Arama: başlık, numara, öneren, **sorumlu**, operasyon, alan, yer | "Yasin Koç": 48 kayıt |
| 4c | Filtre listeleri sırasız, aynı isimler ayırt edilemiyordu | Alfabetik; aynı adlılar departmanla ayrılır; yalnız ilgili kişiler listelenir. Yeni filtreler: **Sorumlu**, **İyileştirme alanı**, "Hedef süreyi aşanlar". Etkin filtre sayısı düğmede görünür | — |
| 4d | İşlerim sayaçları tutmuyordu | Sayaçlar yalnız senden bekleyen işlerden hesaplanır; yalnız dolu aşamalar görünür; varsayılan sıralama en uzun bekleyen önce | 46 iş, ilk satır 69 gün bekleyen |
| 5 | Pano grafiklerinde taşma, her yerde kırmızı, kesilen adlar, yanıltıcı ortalama | Ad ve değer üstte, çubuk altta; **yalnız gecikmiş kısım kırmızı**; adlar kesilmiyor; 3'ten az kayıtlı gruplar sona alınıp "az kayıt" diye işaretlenir | — |
| 5b | "Önerini düzenle" başkalarına da görünüyordu | Sıra sendeyse emir kipi ("Öneriyi değerlendir"), başkasındaysa durum ("Operasyon değerlendirmesi bekleniyor") | — |
| 6 | Tutarsız isimler, "Lojistik" sabit | Aşağıdaki sözlük uygulandı; kurum adı Atama matrisi sayfasından değiştirilebilir | — |
| 7 | Eksik alanlar | Öneri: **Nerede?**, **Vardiya**, **Ne kazanırız?**, **Birlikte öneren** (en fazla 5; onlar da görür). Aksiyon: **Açıklama** ve tamamlanırken **Sonuç / kanıt** notu | Yeni alanlarla öneri gönderildi |

## Terim sözlüğü (artık her yerde aynı)

| Kullanılan | Yerine kullanılmayan |
|---|---|
| Öneriler | Tüm öneriler, Öneri havuzu |
| Durum | Statü, Güncel durum |
| Departman | Bölüm |
| Sorumlu | Mevcut sorumlu, Şu anda |
| Revizyon isteği | Düzeltme isteği |
| Kazanç | Kazanım (rapor başlığında) |
| Saha Operasyonu (destek birimi, yeni kurulumda) | Operasyon (iş alanı ve rolle karışıyordu) |

Not: Mevcut pilotta "Operasyon" adlı destek birimi kayıtlı veride olduğu için yerinde kalır; yeni kurulumlarda "Saha Operasyonu" gelir.

## Yeni dosyalar ve testler
- `tests/round3.test.ts`: müdür görünürlüğü, ortak öneri sahibi, yeni alanlar, yedek atama, toplu devir, aksiyon kanıtı, kurum adı
- `scripts/test-verisi/uret.ts`, `yukle.mjs`, `README.md`: büyük test verisi
- Erişilebilirlik taraması (masaüstü + telefon, 7 sayfa + form): ihlal yok

## Bilmen gerekenler
- **Görünürlük kuralı tek yerde:** `lib/model.ts` → `managesProposal` ve `canSee`. Sunucu (liste, ek dosya, yorum) ve süreç yetkileri (iptal, devir, geri alma) aynı kuralı kullanır.
- **Toplu devir** sadece sistem yöneticisindedir ve geri alınamaz; her kayıtta "Kullanıcı devri" notu ve denetim kaydında özet kalır.
- **Yedek kişi** yalnız yeni atamalarda devreye girer; zaten pasif kişide duran işler için "İşleri devret" kullanılır.

---

# Dördüncü tur: sorumluluk, devir, tanımlar ve hiyerarşi (11 Kasım 2026)

## Statü geri alma (soru)
Vardı ve duruyor: öneri detayında **Süreç işlemleri → Önceki aşamaya geri al**. Sistem yöneticisi ve öneriyi yöneten müdür/direktör/genel müdür kullanabilir; gerekçe zorunlu, geçmiş silinmez, sonraki onaylar yeniden alınır.

## Yapılanlar

| İstek | Uygulama |
|---|---|
| "Bölüm" = Operasyon | Ekranlarda "Operasyon" her yerde **Bölüm** oldu. "Operasyon değerlendirmesi" aşaması **Bölüm değerlendirmesi** oldu; kayıtlı veri ilk okumada otomatik dönüştürülür (`lib/migrate.ts`). Rol adı: **Bölüm sorumlusu**. |
| Devredilen işler geri alınabilmeli | Her devir kaydedilir: kullanıcı devri, tekli/toplu devir, kişiye/bölüme yönlendirme, matris değişikliğiyle devir. Kullanıcılar sayfasında **Devir geçmişi**; "Geri al" ile kayıtlar önceki sorumluya döner. Devirden sonra başkası tarafından değiştirilmiş kayıt **atlanır**, üzerine yazılmaz; sonuç mesajında kaç kayıt döndüğü/atlandığı yazar. Toplu devir tek satırda görünür ve tek seferde geri alınır. |
| Pasife alma için alternatif zorunlu olmamalı | Açık işi olan kullanıcı artık pasife alınabilir (önceden engelliyordu). İşler kişide kalır; formda kaç iş kaldığı bilgisi çıkar. O kişinin bölümüne yeni gelen işler **müdürüne**, müdürü yoksa sistem yöneticisine yönlenir ve kayda not düşülür. |
| Bölüm sorumlusu tek olmalı | Önceki turda eklenen "yedek kişi" kaldırıldı; her aşamada tek sorumlu. Gerektiğinde **İşleri devret** ile üzerindeki işler yönlendirilir. |
| Değerlendirmeye gelen öneri başkasına yönlendirilebilmeli | "Yönlendir" penceresinde iki seçenek: **Başka bölüme** (sorumlu matristen gelir) veya **Başka kişiye** (bölüm aynı kalır). Ön değerlendirme ve bölüm değerlendirmesinde kullanılabilir; geri alınabilir. |
| Bölüm tanım alanında, listeden seçilmeli | Yeni **Tanımlar** sayfası (yalnız yönetici): bölümler, lokasyonlar, organizasyon yapısı, destek birimleri, kurum adı. Öneri formunda bölüm, lokasyon; kullanıcı formunda departman bu listelerden seçilir. |
| Çok kişili öneride kişiler listeden / yazdıkça | **Kişi seçici**: ad yazdıkça süzülen liste, her satırda ad + departman + rol; klavyeyle seçilebilir. Ortak öneren, devir, yönlendirme, aksiyon sorumlusu, matris ve yönetici seçimlerinde kullanılıyor. |
| Vardiya gerekmiyor | Kaldırıldı. |
| Yer yerine Lokasyon, panolarda da | **Lokasyon** listeden seçilir (Tanımlar'dan yönetilir; liste boşsa alan görünmez). Panoda **Lokasyonlara göre açık öneriler** raporu ve lokasyon filtresi; öneri listesinde lokasyon filtresi. |
| Müdürlükten sonra direktörlük, genel müdürlük; istenirse aktifleştirilebilir | Tanımlar'da iki anahtar: **Direktörlük seviyesi** ve **Genel müdürlük seviyesi** (varsayılan kapalı). Açılınca müdürlükler direktörlüğe, direktörlükler genel müdürlüğe bağlanır; **Direktör** ve **Genel müdür** rolleri kendi kapsamındaki tüm önerileri görür ve yönetir. Panoda müdürlük raporları **Hiyerarşi seviyesi** seçimiyle direktörlük/genel müdürlük bazında gösterilir. |

## Kurallar (sorulduğunda)
- **Kapsam:** Müdür → kendi müdürlüğü; Direktör → direktörlüğüne bağlı müdürlükler; Genel müdür → genel müdürlüğe bağlı tüm müdürlükler. Öneri; önerenin, bölümün, şu an beklediği kişinin veya değerlendiricinin müdürlüğü kapsamdaysa görünür. Tek fonksiyon: `lib/model.ts` → `scopeDirectorates`, `managesProposal`, `canSee`.
- **Tanım silme kuralları:** Aktif kullanıcısı olan departman, bağlı departmanı olan müdürlük, bağlı müdürlüğü olan direktörlük silinemez. Seviye açıkken her alt birim bir üst birime bağlanmalıdır.
- **Departmanın müdürlüğü değişirse** o departmandaki kullanıcıların müdürlük bilgisi de güncellenir.
- **Geri alma** yalnız devri yapan kişi veya sistem yöneticisi tarafından, bir kez yapılabilir.

## Testler
`tests/round3.test.ts` bu turun kurallarını sınar: müdür/direktör/genel müdür kapsamı, seviye kapalıyken kapsam olmaması, tanım doğrulamaları, lokasyon listesi, kişiye yönlendirme ve geri alma, pasif sorumluda müdüre yönlenme, kullanıcı devri ve sonradan değişen kaydın atlanması, toplu devrin tek seferde geri alınması. Test verisi (`scripts/test-verisi`) artık hiyerarşi, lokasyonlar, bir direktör (`direktor`) ve bir genel müdür (`genelmudur`) içeriyor.

# Beşinci tur: benzer öneri, e-posta bildirimleri, QR ve tanınma (12 Kasım 2026)

## 1. Benzer öneri ve mükerrer işaretleme
- Ön değerlendirme ve bölüm değerlendirmesi aşamasında öneri detayında **Benzer öneriler** listesi çıkar: numara, başlık, bölüm, durum ve hangi kelimelerde eşleştiği. Ücretli yapay zekâ yok; Türkçe ekleri kırpan kelime eşleştirmesi kullanılır (`lib/similar.ts`).
- Sorumlu **Mükerrer işaretle** ile öneriyi eskisine bağlar; gerekçe zorunludur, öneri "Mükerrer öneri" nedeniyle sonuçlanır, iki kayıt birbirine bağlantı gösterir.
- Çalışan öneri yazarken 3. adımda benzer kayıt varsa uyarı görür (göndermeyi engellemez).
- Tanımlar > **Eş anlamlılar**: "palet, yük" gibi gruplar eşleşmeyi güçlendirir.

## 2. E-posta bildirimleri (Outlook ama esnek)
Her olay kurala göre ilgili kişilere gider; kurallar Tanımlar > **E-posta bildirimleri**'nden tek tek kapatılır.

| Olay | Kime |
|---|---|
| Öneri gönderildi | Öneren (alındı) + ön değerlendirici |
| Kabul / aşama değişti | Öneren, birlikte önerenler, yeni sorumlu |
| Revizyon / ret / mükerrer | Öneren ve birlikte önerenler (gerekçeyle) |
| Tamamlandı | Öneren ve birlikte önerenler |
| Yorum | Öneriyle ilgili diğer kişiler |
| Devir / yönlendirme | Eski ve yeni sorumlu |
| Aksiyon atandı | Aksiyon sorumlusu |
| Hedef süre aşıldı | Sorumlu; N gün daha geçerse müdürü (N ayarlanır) |
| Aksiyon tarihi yaklaştı/geçti | Aksiyon sorumlusu |

- İşlemi yapan kişiye e-posta gitmez. Pasif kişiye ve adresi olmayana gitmez.
- Her kişi menüdeki zil simgesinden **Anında / Günlük özet / Kapalı** seçer. Bir işlemde birine 3'ten fazla e-posta düşerse tek "Toplu güncelleme" gider.
- E-postalar önce **giden kutusuna** yazılır, sonra gönderilir; gönderim hata verirse 5 kez denenir. Hiçbir işlem e-posta yüzünden başarısız olmaz. Giden kutusu Tanımlar'da görünür.
- E-postadaki **Öneriyi aç** bağlantısı (`/?oneri=KZ-…`) giriş sonrası doğrudan o öneriyi açar.

### Kurulum: üç yoldan biri (ortam değişkenleri)
1. **Microsoft 365 / Outlook (önerilen)** – `EMAIL_PROVIDER=graph`
   - Entra ID (Azure AD) > Uygulama kayıtları > Yeni kayıt. API izinleri: Microsoft Graph > **Application** > `Mail.Send`, yönetici onayı verilir.
   - Gizli anahtar oluşturulur. Gönderen olarak bir paylaşılan posta kutusu (ör. `ivme@firma.com`) önerilir; BT, `New-ApplicationAccessPolicy` ile uygulamayı yalnız bu kutuyla sınırlayabilir.
   - Değişkenler: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER`.
2. **Webhook (BT uygulama kaydı vermezse)** – `EMAIL_PROVIDER=webhook`, `EMAIL_WEBHOOK_URL`, isteğe bağlı `EMAIL_WEBHOOK_SECRET` (X-Ivme-Secret başlığında gelir). Gövde: `{to, subject, html, text}`. Power Automate'te "HTTP isteği alındığında" → "E-posta gönder (V2)" akışı yeter; Zapier, n8n ya da bir SMTP köprüsü de olur.
3. **Kapalı (varsayılan)** – `EMAIL_PROVIDER` yoksa hiçbir şey gönderilmez, e-postalar giden kutusunda görünür. Pilot öncesi kuralları denemek için idealdir.

Diğer: `APP_URL` (e-postadaki bağlantıların adresi; yoksa isteğin adresi), `NOTIFY_CRON_SECRET` (günlük işleri dışarıdan tetiklemek için).

### Günlük işler (gecikme hatırlatması, özetler)
Uygulama kullanıldıkça günde bir kez, 07:00'den (TR) sonraki ilk istekte kendiliğinden çalışır. Kimse girmediği günler için garanti istenirse bir zamanlayıcı her sabah şunu çağırır:
`POST /api/notify` gövde `{"action":"run"}`, başlık `X-Ivme-Cron: <NOTIFY_CRON_SECRET>`. Power Automate "Yinelenme" + "HTTP" adımıyla kurulur.
> Not: Barındırma platformu zamanlanmış görev garantisi vermiyor. Kesin saatli hatırlatma kritikse ya bu dış zamanlayıcı kullanılır ya da uygulama cron destekleyen bir sunucuya (VPS / Cloudflare hesabı) taşınır.

## 3. Kullanıcıların e-posta adresi
- Kullanıcı formunda **E-posta** alanı (benzersiz).
- Kullanıcılar > **Excel'den yükle**: .xlsx, .csv ya da Excel'den kopyala-yapıştır. Sütunlar: Ad soyad, Kullanıcı adı, Departman (zorunlu), E-posta, Rol, Yönetici kullanıcı adı. Önce kontrol edilir (hatalı satırlar satır numarasıyla listelenir, hiçbir şey kaydedilmez), sonra onaylanır.
- Var olan kullanıcı adı güncellenir; boş bırakılan e-posta ve yönetici hücresi eski değeri korur, şifreye dokunulmaz.
- Yeni kişilere rastgele tek kullanımlık şifre verilir; liste bir kez indirilir, ilk girişte değiştirme zorunludur.
- Direktör ve genel müdür Excel'den eklenmez (Tanımlar'daki birime bağlanmaları gerekir).

## 4. QR ile doğrudan erişim
- Tanımlar > **QR kodları**: her bölüm, her lokasyon ya da tek kart. **Yazdır** ile A4'e 3 sütun kart basılır.
- Okutan kişi giriş yapar (oturum açıksa doğrudan) ve öneri formu bölüm/lokasyon dolu açılır. Bağlantı giriş ekranında kaybolmaz.
- QR görseli tarayıcıda üretilir; adres hiçbir dış servise gitmez. Uygulama adresi değişirse kartlar yeniden basılır.
- Telefonda **Ana ekrana ekle** ile uygulama gibi açılır (manifest + simge). Çevrimdışı çalışma yoktur.

## 5. Tanınma ekranı
- Menüde **Tanınma**: dönem özeti (öneri, tamamlanan, katkı veren kişi, katılım oranı), öne çıkan tamamlanmış iyileştirmeler (öneren adlarıyla), departman katılımı, kişinin kendi rozetleri.
- Bilinçli olarak **kişiler arası sıralama yok**. 3 kişiden küçük departmanların oranı gösterilmez (tek kişiyi ele vermesin). Kişisel sayılar ve rozetler yalnız kişinin kendisine görünür.
- Tanımlar'dan kapatılabilir.

## Diğer düzeltmeler
- Mobil menü kısa ekranlarda kaydırılabilir; profil, bildirim tercihi ve çıkış düğmesine artık ulaşılıyor (önceden 700 px yükseklikte ekran dışında kalıyordu).

## Testler
- `tests/round5.test.ts`: benzerlik, eş anlamlılar, mükerrer bağlama ve yetkiler, olay → e-posta kuralları (işlemi yapana gitmeme, kapalı kural, tercih, pasif/adressiz kişi), hatırlatma ve müdüre yükseltme, birleştirme, HTML kaçışı, tanınma ve rozetler.
- `tests/round5.integration.cjs`: eski veritabanında e-posta sütunlarının kendiliğinden eklenmesi, Excel yükleme (deneme, hatalar, geçici şifre, korunan alanlar), kişisel tercih, öneri oluşturunca giden kutusu, benzer öneri ve tanınma uçları, yetkiler.
- `./scripts/test.sh` → 8 grup geçti. 300 öneri / 51 kullanıcılık veriyle masaüstü ve mobilde tarayıcı testi, axe erişilebilirlik taraması: yeni ekranlarda 0 ihlal.

## Yeni dosyalar
`lib/similar.ts`, `lib/notify.ts`, `lib/mailer.ts`, `lib/outbox.ts`, `lib/recognition.ts`, `app/similar-panel.tsx`, `app/notify-settings.tsx`, `app/user-import.tsx`, `app/qr-sheet.tsx`, `app/recognition-page.tsx`, `app/api/similar`, `app/api/notify`, `app/api/recognition`, `drizzle/0001_bildirimler.sql`, `public/manifest.webmanifest` ve simgeler.

# Altıncı tur: oneri.io'ya göre eksiklerin kapatılması + destek talep numarası (12 Kasım 2026)

## Destek birimi talep numarası (değerlendirici için)
- Bir öneri IT, Teknik İşler, Satın Alma gibi bir birimi beklerken, Destek sekmesinde her bekleme için **Talep no** alanı var (ör. `INC-10293`, `İE-2026-77`). Numara o birimin kendi sistemindeki kayıttır; İvme o sistemle bağlantı kurmaz, takip numarayla yapılır.
- Bekleme başladığı an kaydedilir; **kaç gündür beklendiği** öneri detayında, listede ve Raporlar > Bekleme analizinde (birim ortalaması, talep no girilmemiş sayısı) görünür. Dışa aktarılan Excel'de "Destek talep no" sütunu var.
- Gecikme e-postası talep numarasını taşır. Müdüre giden gecikme e-postası "Gecikme destek biriminde: Teknik İşler · Talep İE-… · 12 gün" der: müdür, sorumluyu değil destek birimini hızlandırması gerektiğini görür.
- Numarayı yalnız öneri sorumlusu (veya yönetici) girer/siler; kapanan beklemeye numara girilmez; harf, rakam ve `- _ / # .` kullanılabilir.

## Anonim öneri
- Formda "Adımı gizle (anonim öneri)". Anonim öneride ortak öneren eklenemez.
- Önerenin adı, öneren dışındaki **herkesten** (değerlendirici, müdür, sistem yöneticisi ekranı) gizlenir. Gizleme sunucuda yapılır: istemciye giden kayıtta öneren, geçmişteki ve yorumlardaki adı, revizyonda sorumlu olarak görünmesi "Anonim çalışan" olur. E-postalarda da ad geçmez.
- Öneren önerisini adıyla görür, bildirim ve ödül ona gider, revizyon isterse kendisi düzenler. Gerçek kayıt veritabanında tutulur (yetki ve bildirim için); bunu formdaki açıklama da söyler.
- Departman bilgisi raporlarda kalır (formda belirtilir). Küçük bir departmanda bu, kişiyi tahmin ettirebilir.

## Önce / sonra görselleri
- Öneriyle gelen fotoğraflar "önce" görseli olur. Uygulama başladıktan sonra öneren, birlikte önerenler, sorumlu ve aksiyon sorumluları detaydan **Sonra fotoğrafı ekle** ile görsel ekler (telefonda kamera ya da galeri; otomatik küçültülür). Önerinin toplam ek sayısı en fazla 6.
- Detayda "Görseller ve ekler" bölümünde önce ve sonra yan yana görünür; PDF'ler bağlantı olarak kalır.

## Öneri kampanyaları
- Tanımlar > **Öneri kampanyaları**: ad, başlangıç–bitiş, odak alanı, bölüm, açıklama, ödül notu. Öneri bağlı kampanya silinemez (bitiş tarihi değiştirilir).
- Açık kampanya öneri formunun başında görünür; çalışan "Kampanyaya katıl" seçerse odak alanı ve bölüm kendiliğinden dolar.
- Tanınma ekranında kampanya başına öneri, katılan kişi, tamamlanan ve kişinin kendi önerisi sayısı; sıralama yok.

## Bilinçli olarak yapılmayanlar
- **SMS ve telefon bildirimi (push):** SMS ücretli bir sağlayıcı ister; e-posta webhook'u (Power Automate) üzerinden SMS'e yönlendirmek mümkündür. Push, kalıcı sunucu ve ek kurulum ister; pilot sonrası değerlendirilmeli.
- **Anlam bazlı (yapay zekâ) benzerlik:** Ücretli model gerektirir; kelime + eş anlamlı yaklaşımı pilotta yeterli mi bakılmalı.

## Diğer düzeltmeler
- Bildirim balonunun yazısı zeminle aynı renkteydi, okunmuyordu; düzeltildi.
- Öneren artık "Önerin alındı" e-postasını (öneri numarasıyla) alıyor; önceden "işlemi yapana e-posta gitmez" kuralı bunu da engelliyordu.

## Testler
- `tests/round6.test.ts`, `tests/round6.integration.cjs` (anonim önerenin sunucu yanıtında değerlendiriciden ve yöneticiden gizlendiği gerçek API üzerinden doğrulanır).
- `./scripts/test.sh` → 10 grup geçti. 300 öneri ile tarayıcı testi; axe taraması yeni ekranlarda 0 ihlal.

# Yedinci tur: iki paket ve yapay zekâ (MCP) katmanı (12 Kasım 2026)
- **Paket ayarı:** `IVME_EDITION` (`surec` varsayılan, `ai`). `scripts/paketle.mjs` süreç paketinden MCP dosyalarını çıkarır.
- **Benzerlik arayüzü:** `lib/similarity.ts`; kelime sağlayıcısı varsayılan, hata olursa ona dönülür.
- **MCP katmanı (salt okuma):** 5 araç, kişisel erişim anahtarları, Tanımlar'dan aç/kapa. Ayrıntı: `MCP_REHBERI.md`.
- Testler: 12 grup geçti; süreç paketi ayrıca derlendi ve test edildi; 300 öneriyle gerçek uçtan araç çağrısı denendi.

# Sekizinci tur: katılım, net kazanç ve otomatik ödül (12 Kasım 2026)

## Öneri katılımı (Durum panosu)
- Kapsamdaki aktif çalışanlar dört gruba ayrılır: **hiç öneri vermedi, 1 öneri, 2–4 öneri, 5 ve üzeri** (kişi sayısı ve yüzde). Dönem: son 3 ay / son 12 ay / tümü.
- **En çok öneri verenler** ilk 10: öneri, uygulamaya alınan ve tamamlanan sayısıyla. Birlikte önerenler de sayılır.
- Kapsam: müdür kendi müdürlüğünü (direktör/genel müdür kendi birimlerini), sistem yöneticisi herkesi görür; pano filtresi uygulanır.
- **Anonim öneriler kimseye yazılmaz**, ayrıca sayılır. Yazılsaydı "1 önerisi var ama hiçbiri görünmüyor" çıkarımıyla anonimlik bozulurdu.
- Sıralama yalnız yönetim panosunda; çalışanların gördüğü Tanınma ekranında kişi sıralaması yine yok.

## Net kazanç
- Kazançta uygulama maliyeti zaten vardı; artık **ilk yıl net kazanç** (ilk yıl brüt − maliyet) ve **maliyetin geri dönüş süresi** (ay) hesaplanır: kazanç sekmesinde, kazanç girerken anlık önizlemede ve Raporlar tablosunda (Maliyet ₺, İlk yıl net ₺).
- İlk yıl brüt: aylık × 12, yıllık olduğu gibi, tek seferlik olduğu gibi.

## Fotoğraf
- Kapanışta fotoğraf zorunlu değildir; "sonra" fotoğrafı isteğe bağlıdır (testle doğrulandı).

## Otomatik ödül
- **Kurallar** (Tanımlar > Ödül kuralları): en az puan + isteğe bağlı en az ilk yıl net kazanç → ödül türü (maaş katı / tutar / hediye-belge), değer ve ad. Yüksek eşik önce denenir; uyan ilk kural uygulanır. Birlikte önerenlerde değer eşit bölünür ya da herkes tamamını alır.
- Örnek kurallar: 85+ puan ve 100.000 ₺+ net → 0,5 brüt maaş · 70+ → 5.000 ₺ · 50+ → 1.500 ₺ hediye çeki · altı → teşekkür belgesi.
- **Akış:** puanlama kaydedilince öneri "Tamamlandı" olur ve ödül kaydı otomatik oluşur → "Ödül sorumlusu (İK)" rolüne e-posta → İK **Ödüller** sayfasında onaylar (değeri gerekçeyle değiştirebilir) ya da reddeder (gerekçe zorunlu) → bordro döneminde "Ödendi" işaretler. Onay ve ödeme öneren ile birlikte önerenlere bildirilir.
- **Bordro listesi:** onaylanan ve ödenen ödüller kişi başı satırla Excel'e alınır (ad, kullanıcı adı, departman, ödül, dönem).
- **Maaş bilgisi tutulmaz:** "0,5 brüt maaş" talimattır; tutarı bordro sistemi hesaplar. Ödül türü ve değeri öneri geçmişine ve e-postalara yazılmaz; yalnız İK, sistem yöneticisi ve ödülü alan kişi görür.
- Puanlama penceresinde, kaydetmeden önce hangi kuralın uygulanacağı gösterilir.
- Öneri geri alınır ya da iptal edilirse ödenmemiş ödül iptal olur; **ödenmiş ödülü olan öneri geri alınamaz**.
- Anonim öneri ödül alırsa önerenin adı yalnız ödeme için İK'ya görünür; formdaki açıklama bunu söyler.
- İK, ödül kararı için tamamlanan önerileri görebilir; diğer önerileri göremez.

## Testler
- `tests/round8.test.ts` (net kazanç, kural doğrulama ve seçimi, paylaştırma, uçtan uca ödül akışı, yetki, değer değişikliği gerekçesi, ödeme, geri alma ve iptal, bildirimlerde maaş bilgisi olmaması, katılım raporu ve anonimlik) ve ödül görünürlüğü için API testi. `./scripts/test.sh` → 13 grup geçti; tarayıcı ve erişilebilirlik kontrolü yapıldı.

# Dokuzuncu tur: günlük gecikme e-postası, esnek katılım, rapor oluşturucu (12 Kasım 2026)

## Günlük gecikme e-postası
- Değerlendirici (sorumlu) her sabah **tek e-posta** alır; içinde tablo: **öneri no, başlık, aşama, kaç gündür beklediği, kaç gün geciktiği, destek birimi / talep no**. En çok geciken üstte.
- Aynı e-postada hedef tarihi yaklaşan ya da geçen aksiyonları da ayrı tablo olarak gelir.
- Müdüre, ekibinde gecikmesi belirlenen günü aşan öneriler yine tek e-postada, sorumlu adıyla gider.
- Gecikme yoksa e-posta gitmez. Bildirim tercihi "kapalı" olan kişiye gitmez.

## Öneri katılımı: esnek eşik
- Durum panosundaki katılım kartında **üst grup eşiği** (ör. 5 ya da 7 ve üzeri) ve **listelenecek kişi sayısı** (10, 15, 20 ya da istenen sayı) girilir; gruplar eşiğe göre kendiliğinden değişir (ör. 7 seçilirse: hiç, 1, 2–6, 7 ve üzeri).
- Dönem: son 1 / 3 / 6 / 12 ay ya da tümü.

## Rapor oluşturucu (Raporlar sayfasının başında)
- **Dönem:** tarih türü (öneri tarihi / tamamlanma tarihi / kazanç onay tarihi), yıl, ay.
- **Filtre:** durum (açık, uygulamaya alınan, tamamlanan, reddedilen), bölüm, müdürlük, departman, iyileştirme alanı, lokasyon, kampanya.
- **Grupla:** ay, çeyrek, yıl, bölüm, müdürlük, departman, alan, lokasyon, kampanya, öneren kişi, durum ya da toplam.
- **Ölçüler (istenenler seçilir):** öneri, açık, uygulamaya alınan, tamamlanan, reddedilen, öneren kişi sayısı, ilk yıl kazanç ₺, uygulama maliyeti ₺, ilk yıl net kazanç ₺, ortalama puan, ortalama sonuçlanma süresi, parasal olmayan kazanç.
- Sıralama ölçüsü, ilk N satır, grafik/tablo görünümü, toplam satırı, Excel'e aktarma.
- **Hazır raporlar:** tamamlanan iyileştirmelerin aylık tutarı, bölümlere göre onaylı kazanç, müdürlüklere göre katılım, iyileştirme alanına göre sonuç.
- **Raporlarım:** kişi kendi kurduğu raporu adıyla kaydeder (bu cihazda, yalnız kendine görünür), tek tıkla tekrar açar.
- Tutarlar yalnız onaylanmış ve geçerli kazançlardan hesaplanır; anonim öneriler kişi gruplamasında tek satırda toplanır. Hesap kişinin görebildiği önerilerle yapılır.

## Testler
- `tests/round9.test.ts`; günlük e-posta testleri `tests/round5.test.ts` içinde. `./scripts/test.sh` → 14 grup geçti; tarayıcı ve erişilebilirlik (masaüstü + mobil) kontrolü 0 ihlal.

# Onuncu tur: uygulama sonucu zorunlu, "Uygulanamadı" durumu (12 Kasım 2026)
- **Uygulamayı sonuçlandır** (Uygulamada aşaması): "Öneri uygulandı mı?" sorusu zorunlu seçimdir.
  - **Uygulandı** → Kazanç girişine geçer. Şart: tüm aksiyonlar "yapıldı" ya da "yapılamadı" olarak sonuçlanmış, en az biri yapılmış olmalı.
  - **Uygulanamadı** → Kazanç adımına gitmez; **"Uygulanamadı"** durumunda kapanır. Standart neden (bütçe/yatırım, teknik, malzeme/tedarik, süreç/organizasyon değişti, mevzuat/İSG, maliyet > fayda, diğer) ve önerenin göreceği açıklama zorunlu. Açık aksiyonlar ve destek beklemeleri kapanır; öneren ve birlikte önerenlere "Önerin uygulanamadı" e-postası gider (kural Tanımlar'dan kapatılabilir).
- **Aksiyon planlama** aşamasında da "Uygulanamadı olarak kapat" düğmesi vardır (uygulamaya hiç başlanamayan öneriler için).
- **Aksiyon kapanışı da zorunlu seçim:** her aksiyon "Sonuçlandır" ile **Yapıldı** (sonuç/kanıt isteğe bağlı) ya da **Yapılamadı** (neden zorunlu) olarak kapanır.
- Uygulanamadı kapalı bir durumdur: gecikmeye, açık iş sayılarına, kazanca ve ödüle girmez; iptal edilemez; yönetici gerekirse "geri al" ile önceki aşamaya döndürebilir.
- Detayda nedeni "Uygulanamadı" notu olarak görünür; listede ve filtrelerde ayrı durumdur.
- Rapor oluşturucuda **Uygulanamayan** ölçüsü, durum filtresi ve **Uygulanamama nedeni** gruplaması var (hangi nedenle kaç öneri kaldı).
- Testler: `tests/round10.test.ts`; `./scripts/test.sh` → 15 grup geçti. Ek olarak iki eski erişilebilirlik bulgusu düzeltildi (yönlendirme kutusu ve "Gecikti" etiketi kontrastı, detay alt çubuğunun yinelenen landmark'ı).

# On birinci tur: tanımlanabilir listeler, puanlama ve hedef süreler (12 Kasım 2026)
Tanımlar sayfasına eklenen bölümler (kurallar `lib/definitions.ts`, ekran `app/definition-lists.tsx`):
- **Öneri sınıfları** (alt sınıflarıyla; alt sınıf varsa formda seçilir), **Ret nedenleri**, **Uygulanamama nedenleri**, **Kazanç türleri**.
  - Varsayılan değerlerle gelir. Sıra değiştirilebilir, madde eklenir.
  - **Yeniden adlandırma eski kayıtlara da yansır** (kayıtlar maddenin adını taşır, kaydedince hepsi güncellenir; denetim kaydına kaç kaydın değiştiği yazılır).
  - **Kullanılan madde silinmez**, pasife alınır: yeni kayıtta seçilmez, eski kayıtta ve raporda görünür. Her maddenin yanında kaç kayıtta kullanıldığı yazar.
  - **Kilitli maddeler:** "Mükerrer öneri" (mükerrer işaretleme bunu kullanır) ve "Parasal" (tutar alan tek kazanç türü): adı değişmez, pasife alınmaz, silinmez.
- **Puanlama kriterleri:** 1–6 kriter, her birine ağırlık (1–100) ve açıklama, ölçek 1–3 / 4 / 5 / 10. Puan = Σ (puan / ölçek × ağırlık) / Σ ağırlık × 100. Puan, verildiği andaki kriterlerle saklanır; kriterler değişse de eski puan ve ödül değişmez. Detayda kriter kırılımı görünür.
- **Aşama hedef süreleri:** her aşama için gün. Kaydetmeden önce "gecikmiş açık öneri X → Y" uyarısı çıkar. Gecikme hesapları, günlük e-posta ve panolar bu süreleri kullanır.
- Kampanya odak alanı, rapor oluşturucu filtresi ve liste filtreleri tanımlı sınıfları kullanır.
- Testler: `tests/round11.test.ts`; `./scripts/test.sh` → 16 grup geçti; tarayıcı ve erişilebilirlik kontrolü 0 ihlal.

# On ikinci tur: eski önerilerin toplu aktarımı (12 Kasım 2026)
Tanımlar → **Eski önerileri aktar** (yalnız sistem yöneticisi). Ayrıntılı kullanım: `AKTARIM_REHBERI.md`. Kurallar `lib/proposal-import.ts`, sunucu `app/api/command/route.ts → importProposals`, ekran `app/proposal-import.tsx`.
- Kararlar: kapalı ve açık öneriler aktarılır (açık olan aşamasında devam eder, sorumlusu atama tablosundan gelir) · İvme yeni KZ numarası verir, **eski no** saklanır ve aramada bulunur · sistemde olmayan öneren **pasif kullanıcı** olarak açılır (giriş yapamaz) · **e-posta gitmez, ödül kaydı oluşmaz** · aktarılan kazanç onaylı sayılır · eski puan 100 üzerinden tek sayı (kriter kırılımı yok).
- Akış: şablon → dosya (.xlsx/.csv) ya da yapıştır → sunucuda kontrol (satır numaralı hata listesi, hiçbir şey yazılmaz) → özet (duruma göre sayılar, kazançlı kayıt, açılacak pasif kullanıcılar, aktarım sonrası veri boyutu) → onay. Aynı eski no ikinci kez aktarılmaz. Tek seferde en fazla 2000 satır.
- **Boyut koruması:** bu kurulum çalışma alanını tek kayıtta tutar (Cloudflare D1 satır sınırı 2 MB). Aktarım sonrası veri ~1,9 MB'ı geçecekse aktarım reddedilir ve hiçbir şey değişmez. Çok sayıda eski öneri için kurum sunucusuna (VPS, tablolara ayrılmış veri) geçilmelidir.
- Detayda "Aktarım: Eski sistemden aktarıldı · eski no …", puan kartında "Eski sistemden aktarılan puan" yazar. Rapor oluşturucuda **Aktarılan öneriler** süzgeci: dahil / hariç / yalnız aktarılanlar (yalnız aktarılmış kayıt varsa görünür).
- Testler: `tests/round12.test.ts`, `tests/round12.integration.cjs`; `./scripts/test.sh` → 18 grup geçti; tarayıcı ve erişilebilirlik kontrolü 0 ihlal (bu turda eski bir kontrast bulgusu da düzeltildi: detaydaki "Süreç işlemleri" bağlantısı).

## Ek: aktarılanları süzme, silme ve geri alma
- **Öneriler → Filtre → Durum: "Eski sistemden aktarılanlar"** (yalnız aktarılmış kayıt varsa görünür). Bu süzgeçte yönetici kapalı kayıtları da seçebilir; seçim çubuğunda **Seçilenleri sil** çıkar.
- Detayda "Aktarım" satırında yöneticiye **Aktarılan kaydı sil** düğmesi.
- **Tanımlar → Eski önerileri aktar → Aktarım geçmişi:** her aktarım bir paket kimliğiyle (AKT-…) listelenir; **Geri al** paketteki kalan tüm kayıtları siler. Kısmen silinmiş paket "2 / 3" olarak görünür.
- Onay penceresi silinecek eski numaraları ve aktarımdan sonra üzerinde işlem yapılmış (aşama, aksiyon, yorum) kayıt sayısını gösterir. Silme kalıcıdır; aynı dosya yeniden aktarılabilir.
- Kurallar: yalnız yönetici; yalnız eski sistemden gelen kayıtlar (İvme'de açılan öneri bu yolla silinmez); ödülü **ödenmiş** kayıt silinmez, bekleyen ödül kaydı birlikte silinir; mükerrer bağlantıları temizlenir; denetim kaydına eski numaralarla yazılır.
- Paket tamamen silinince, o aktarımla açılan pasif kullanıcılar başka hiçbir kayıtta geçmiyorsa veritabanından silinir.
- Testler `tests/round12.test.ts` ve `tests/round12.integration.cjs` içinde genişletildi; 18 grup geçti, tarayıcı ve erişilebilirlik kontrolü 0 ihlal.

# Yayın: GitHub ve canlı vitrin demosu (13 Kasım 2026)
- **Canlı demo (ivme.ysfdurak.com):** `IVME_VITRIN=1` iken giriş ekranında altı rol düğmesi var (Çalışan, Ön değerlendirme, Bölüm sorumlusu, Müdür, İK, Sistem yöneticisi). Giriş şifresiz. Demo kullanıcılarının şifresi yoktur, şifreyle giriş ve şifre değiştirme kapalıdır. Kenar çubuğunda "Canlı demo · her gece sıfırlanır" yazar.
- **Örnek veri:** `lib/vitrin/` altında 120 öneri ve 53 kullanıcı var. `IVME_OLCEK=0.4 IVME_CIKTI=lib/vitrin npx tsx scripts/test-verisi/uret.ts` ile üretilir. Ücretsiz Workers planının istek başına CPU sınırına uysun diye 300 değil 120 öneri. Yönetici adı demoda kurgusaldır.
- **Gece sıfırlama:** her gece 00:00 UTC'de (03:00 TR) cron çalışır (`wrangler.jsonc → triggers`, `worker/index.ts → scheduled`). Sıfırlamada veri yeniden yazılır, oturumlar, giden kutusu ve erişim anahtarları silinir. Bütün tarihler o güne kaydırılır (`lib/vitrin.ts → rebase`), böylece gecikmeler ve kampanyalar hep güncel görünür.
- **Boş veritabanında kurulum:** `lib/server.ts → ensureBaseSchema` temel tabloları kendisi kurar. İlk yayında ayrıca göç (migration) çalıştırmak gerekmez.
- **Yayın ayarı:** kök dizindeki `wrangler.jsonc` dosyası. İçinde Worker adı `ivme`, kimliksiz D1 bağlaması (ilk yayında otomatik oluşur), değişkenler ve cron var. `vite.config.ts` içindeki yer tutucu bağlamalar artık yalnız yerel geliştirmede kullanılıyor.
- **Belgeler:** belgeler `docs/` klasörüne taşındı, README baştan yazıldı. Lisans "tüm hakları saklıdır": kod incelenebilir ama izinsiz kurulamaz ve ticari amaçla kullanılamaz.
- **Testler:** `tests/vitrin.test.ts` eklendi (tarih kaydırma, veri boyutu, roller). 19 grup geçti. Temiz bir kopyada `pnpm install` → `npm run build` → `wrangler deploy --dry-run` sorunsuz çalıştı (gzip ile 381 KB).
