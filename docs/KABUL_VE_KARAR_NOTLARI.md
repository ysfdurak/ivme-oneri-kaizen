# İvme · Öneri ve Kaizen Merkezi

Teslim tarihi 11 Kasım 2026. İlk pilot teslimi (Tur 1–4). Sonraki turlar: IYILESTIRME_NOTLARI.md.


## Teslim içeriği

| Dosya veya klasör | İçerik |
|---|---|
| `README.md` | Pilot kullanımı, geliştirme bilgileri, örnek hesaplar ve bilinen sınırlar |
| `app/` | Mobil ve masaüstü arayüz, oturum ve uygulama API'leri |
| `lib/workflow.ts`, `lib/model.ts`, `lib/seed.ts` | Süreç kuralları, veri modeli ve sentetik pilot verileri |
| `db/`, `drizzle/` | Veri tabanı şeması ve başlangıç migrasyonu |
| `tests/` | Süreç ve API testleri |
| `package.json`, `pnpm-lock.yaml`, `scripts/` | Bağımlılıklar ve geliştirme betikleri |

ZIP, yayımlanan kaynak kodun kopyasıdır. Kurulum ve geliştirme bilgileri README'dedir. Paket kaynak dosyalarıyla birlikte sentetik örnek verileri içerir. Canlı veri tabanı ve kişisel oturum bilgileri paket dışındadır. Yerel çalıştırma ve şirket kurulumu ayrı adımlardır. Bu teslimde yeni bir kurulum veya canlı ortam testi yapılmadı.

## Pilotun kararları ve kabul kriterleri

| Konu | Kabul kriteri |
|---|---|
| Öneri girişi | Çalışan telefondan veya bilgisayardan sorun, çözüm ve ilgili operasyonu girer. Kontrol adımı gönderim öncesinde bilgileri ve ön değerlendiriciyi gösterir. |
| Süreç sırası | Ön değerlendirme, operasyon değerlendirmesi, aksiyon planlama, uygulama, kazanç girişi, kazanç onayı, puanlama ve kapanış birbirini izler. Yetkili kullanıcı uygun aşamada kabul, gerekçeli ret, revizyon veya yönlendirme yapabilir. |
| Yetki ve görünürlük | Çalışan kendi ve atanmış kayıtlarını, müdür kendi müdürlüğünün kayıtlarını, sistem yöneticisi tümünü görür. Atama matrisi değiştiğinde etkilenen açık işlerin devri yöneticiye sorulur. Tekli ve toplu devir yapılabilir. |
| Aksiyon ve destek | Aksiyon sorumlusu ve hedef tarihi gerekçeli değiştirilebilir. Destekte IT, Teknik İşler veya tanımlı birimler işaretlenir. Seçim otomatik kaydedilir. İşaret kalkınca ilgili birim açık bekleme raporundan çıkar. Açık engelleyici bekleme veya bitmemiş aksiyon varken uygulama tamamlanamaz. |
| Kazanç ve puanlama | Kazancı operasyon değerlendirmesini kabul eden kişinin kayıtlı müdürü onaylar. Parasal ve parasal olmayan kazanımlar kaydedilebilir. Onaylı ve geçerli kazançlar dönem bazında raporlanır. Uygulama maliyeti ayrı tutulur, gösterilen kazanç brüttür. Pilot puanı etki, kalıcılık ve yaygınlaştırılabilirlik için eşit ağırlıklı 1–5 değerlendirmeden 100 üzerinden hesaplanır. |
| Geri alma ve iptal | Yetkili kullanıcı tamamlanan Kaizen dahil uygun kayıtların süreç işlemlerine ekrana sığan pencereden ulaşır. Geri alma gerekçesi ve hedef aşama kaydedilir. Önceki kararlar geçmişte kalır, hedef aşama ve sonrasındaki ilgili onaylar yeniden alınır. Geçersiz kazançlar rapor toplamından çıkar. |
| Raporlar | Statü, kişi, bölüm, müdürlük, operasyon, tarih ve beklenen birim filtreleri uygulanabilir. Mobilde öneriler kartlarla ve alt menüyle erişilebilir. |

## Geliştirme kapsamına alınan kararlar

| Karar | Kabul kriteri |
|---|---|
| Şirket sunucusu seçeneği | Uygulama, veri tabanı, ekler ve yedekler şirketin belirlediği ortamda çalışabilmeli. Bulut seçeneği de kurulum alternatifi olarak değerlendirilecek. Personelin erişimi şirketin giriş ve ağ politikasına göre kurulmalı. |
| Veri yapısı ve kapasite | Öneriler ayrı kayıtlar hâlinde saklanmalı. Aksiyon, onay ve geçmiş öneriye bağlanmalı, fotoğraf ve belgeler ayrı dosya alanında tutulmalı. Pilotta öneriler ve geçmiş tek çalışma alanı kaydında bulunduğundan, şirket kullanımına geçmeden bu yapı ayrıştırılmalı. |
| Şirketteki mevcut önerileri taşıma | Kaynakta bulunan öneri numarası, metin, kişi ve organizasyon, statü, sorumlu, tarihler, aksiyonlar, kararlar, kazanç, puan, geçmiş ve ekler korunmalı. Açık kayıtlar eşlenen aşamadan devam etmeli. Tamamlanan kayıtlar yeniden onaya girmemeli. |
| Aktarım doğrulaması | Önce maskelenmiş örnekle alan ve statü eşlemesi denenmeli. Kayıt sayıları, statüler, sorumlular, kazanç toplamları ve erişilebilen ekler karşılaştırılmalı. Kaynakta eksik alanlar raporlanmalı. Aynı kaynak kayıt yeniden yüklenince ikinci bir öneri oluşmamalı. Gerçek şirket verisi şirket ortamında işlenmeli. |
| Benzer öneri kontrolü | Ücretli yapay zekâ API'si gerektirmeden şirket ortamında çalışmalı. Başlık ve açıklama benzerliği, operasyon, kategori ve tanımlı eş anlamlılardan yararlanmalı. Ön değerlendirici önerinin altında adayın numarasını, başlığını, operasyonunu, statüsünü ve eşleşme nedenini görüp yetkisi dahilinde detayını açabilmeli. Mükerrer kararı gerekçeli ve insan onaylı olmalı, eski kayıtla bağlantı saklanmalı. Benzerlik uyarısı tek başına gönderimi veya incelemeyi durdurmamalı. |
| Personel erişimi | QR kod şirketin uygulama adresini açmalı. Giriş ve yetki kuralları geçerli olmalı. Ana ekrana eklenebilen web uygulaması veya mobil uygulama, erişim ihtiyacına göre seçilecek. |

## Açık kararlar

- Paylaşacağın mevcut şirket ekranları üzerinden alanlar, terimler ve işlem sırası kesinleştirilecek.
- Ön değerlendirme ataması pilotta operasyon matrisine göre yapılır. Öneren çalışanın bölümünün atamayı nasıl etkileyeceği açık.
- Nihai puanlama kriterleri ve ağırlıkları şirket kurallarıyla belirlenecek.
- Şirket sunucusunun kurulumu, telefonların ağ erişimi, kullanıcı girişi ve yedekleme şirket IT ekibiyle netleşecek.
- Aktarım formatı, statü eşlemesi ve ek dosyaların alınma yöntemi kaynak sistemin çıktısına bağlı.
- Benzerlik eşiği ve sıralama, örnek önerilerle doğrulanacak. Çalışana gönderim öncesi uyarı gösterilmesi opsiyonel, ön değerlendirme listesiyse kararlaştırılan kapsam.
