# Eski önerileri İvme'ye aktarma rehberi

Önceki sistemdeki (Excel, eski yazılım, form) önerileri İvme'ye bir kerede almak içindir. Yalnız **sistem yöneticisi** yapar.

## Önce hazırlık
1. **Tanımlar** sayfasında bölümler, departmanlar, öneri sınıfları, ret ve uygulanamama nedenleri, kazanç türleri, lokasyonlar eksiksiz olsun. Dosyadaki değerler bu listelerle birebir eşleşmelidir.
2. **Atama tablosu** her bölüm için dolu olsun: açık öneriler sorumlularını buradan alır.
3. Önerenler mümkünse önce **Kullanıcılar → Excel'den yükle** ile eklensin. Ayrılmış ya da bulunamayan kişiler için aktarım dosyasına ad ve departman yazmak yeterli: pasif kullanıcı olarak açılır.

## Şablon
Tanımlar → Eski önerileri aktar → **Şablonu indir** (`ivme-oneri-aktarim-sablonu.csv`, Excel'de açılır). Aynı şablon `sablonlar/oneri-aktarim-sablonu.csv` dosyasında da var. Başlık satırı değiştirilmemeli; sütun sırası serbesttir, gereksiz sütun yok sayılır.

| Sütun | Zorunlu | Not |
|---|---|---|
| Eski no | ✔ | Eski sistemdeki numara. Aynı numara iki kez aktarılmaz. |
| Öneri tarihi | ✔ | GG.AA.YYYY ya da YYYY-AA-GG (Excel tarih hücresi de olur) |
| Başlık, Mevcut durum, Çözüm önerisi | ✔ | |
| Öneren kullanıcı adı | ✔ | Sistemde yoksa **Öneren adı** ve **Öneren departmanı** da gerekir → pasif kullanıcı |
| Birlikte önerenler | | Kullanıcı adları, `;` ile (en fazla 5) |
| Bölüm | ✔ | Önerinin uygulandığı bölüm |
| Öneri sınıfı, Alt sınıf, Lokasyon | | Boş sınıf → listedeki ilk sınıf |
| Durum | ✔ | Ön değerlendirme … Tamamlandı, Reddedildi, Uygulanamadı, İptal edildi |
| Durum tarihi | | Kapanış ya da bulunduğu aşamaya giriş tarihi; boşsa öneri tarihi |
| Neden, Açıklama | | Reddedildi için isteğe bağlı, **Uygulanamadı için neden zorunlu** |
| Kazanç türü, tutarı, dönemi, Uygulama maliyeti, Önce, Sonra | | Kazanç onayı, Puanlama ve Tamamlandı durumlarında zorunlu, diğerlerinde girilmez |
| Puan | | 0–100, yalnız Tamamlandı |
| Anonim | | Evet / Hayır |

Tutarlar Türkçe yazımla okunur: `48.000` = kırk sekiz bin, `12.500,50` = on iki bin beş yüz virgül elli.

## Aktarım
1. **Aktarımı başlat** → dosyayı seç ya da Excel'den kopyalayıp yapıştır.
2. İvme dosyayı kontrol eder; **hiçbir şey yazılmaz**. Hata varsa satır numarasıyla listelenir (ör. `Satır 14: bölüm Tanımlar'da yok (Sevkiyat)`). Düzeltip tekrar seçin.
3. Hata yoksa özet çıkar: kaç öneri, hangi durumda, kaç kazançlı kayıt, açılacak pasif kullanıcılar ve aktarım sonrası veri boyutu.
4. **Aktarımı onayla**.

## Aktarımdan sonra
- Her öneriye yeni İvme numarası verilir; eski numara detayda "Aktarım" satırında görünür ve listede aranabilir.
- **E-posta gitmez, ödül kaydı oluşmaz.** Açık öneriler sorumlularının iş listesine düşer; bunu ekibe önceden haber verin.
- Aktarılan kazanç onaylı sayılır ve raporlara girer. Rapor oluşturucudaki **Aktarılan öneriler** süzgeciyle dahil/hariç/yalnız aktarılanlar seçilir.
- Eski puan kriter kırılımı olmadan saklanır.
- **Aktarılanları bulmak:** Öneriler → Filtre → Durum: "Eski sistemden aktarılanlar".
- **Silmek:** bu süzgeçte kayıtları işaretleyip **Seçilenleri sil**, ya da detayda **Aktarılan kaydı sil**.
- **Geri almak:** Tanımlar → Eski önerileri aktar → **Aktarım geçmişi** → ilgili aktarımda **Geri al**. Paketin kalan tüm kayıtları silinir; o aktarımla açılan pasif kullanıcılar başka kayıtta geçmiyorsa onlar da silinir. Ardından düzeltilmiş dosya yeniden aktarılabilir.
- Silme kalıcıdır. Ödülü ödenmiş kayıt silinemez. İvme'de açılmış öneriler bu yolla silinmez.

## Sınır
Bu kurulum (Cloudflare D1) tüm çalışma alanını tek kayıtta tutar; sınır 2 MB'tır. Fotoğrafsız yaklaşık 300 öneri ≈ 0,9 MB. Aktarım sonrası veri ~1,9 MB'ı aşacaksa aktarım reddedilir. Binlerce eski öneri için kurum sunucusuna (VPS) geçiş ve verinin tablolara ayrılması gerekir.
