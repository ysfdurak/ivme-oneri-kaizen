# Mülakatta sorulabilecek sorular · İvme

Bu kart, projeyi kendi ağzınla anlatabilmen için. Cevaplar kısa tutuldu; ayrıntısı belirtilen belgede. Kod yapay zekâ (Claude) ile yazıldı; kapsam, öncelik ve aşağıdaki kararlar senin. Bunu saklama, açıkça söyle: "Ürünü ve kararları ben belirledim, kodu yapay zekâyla yazdım, her kararın nedenini anlatabilirim."

**1. Bu proje ne yapıyor?**
Çalışanın sahadan verdiği iyileştirme önerisini değerlendirme, aksiyon, kazanç, puan ve ödüle kadar tek akışta yöneten web uygulaması. Telefondan öneri verilir, masaüstünden yönetilir.

**2. Öneri sistemleri neden genelde ölür?**
Öneren ne olduğunu göremez, öneri bekler, geri bildirim gelmez. İvme her öneride son işlemi, sıradaki sorumluyu, bekleme süresini ve ret ya da devir gerekçesini gösteriyor.

**3. Anonim öneri nasıl çalışıyor?**
Öneren adı değerlendiricilere ve yöneticilere, geçmiş kayıtları dahil gösterilmiyor; ödül hak ederse yalnız ödeme için İK görüyor. Küçük ekipte içerikten tahmin edilebileceğini arayüzde açıkça yazıyoruz.

**4. Anonimliği nasıl doğruladın?**
Sentetik bir kayıtla devir ve yönlendirme senaryosu: öneren adı geçmiş metinlerine sızıyordu. Düzelttim ve eski kodda başarısız olan bir test ekledim.

**5. Puan ve ödül oyunlaştırma mı?**
Kişiler arası sıralama bilerek yok; amaç yarış değil katkıyı görünür kılmak. Ödül modülü varsayılan kapalı, tanınma ekranı kapatılabilir.

**6. Kazanç nasıl hesaplanıyor?**
Öneri tamamlanınca yıllık net kazanç girilir; ödül kuralları puan ve kazanç eşiklerine göre çalışır, İK onaylar. Hesap tanımlarının kullanıcıya açık bir açıklama sayfası henüz yok.

**7. Teknik yapı?**
Cloudflare Workers ve D1. Süreç kuralları saf bir komut işleyicide (lib/workflow.ts › applyCommand); bütün yetki ve durum geçişleri orada ve test ediliyor.

**8. Ölçek sınırı?**
Bütün çalışma alanı tek kayıtta duruyor; D1'in satır sınırı nedeniyle fotoğrafsız yaklaşık 600 öneriye kadar uygun. Gerçek kullanımda veri tablolara ayrılıp kurum sunucusuna taşınmalı.

**9. Canlı demoda veri güvenliği?**
Her ziyaretçiye 45 önerilik örnekle kendi alanı açılıyor ("v:<uuid>" çalışma alanı kaydı, alan çerezi); iki ziyaretçi birbirinin önerisini ve ekini göremiyor, bunu bir entegrasyon testi sınıyor. Kullanıcı tablosu ortak olduğu için kişi ekleme, aktarım ve şifre işlemleri demoda kapalı. Günde 600, IP başına saatte 20 alan sınırı; her gece silme. Fotoğrafların konum bilgisi yüklemeden önce siliniyor.

**10. Neyi farklı yapardın?**
Veriyi baştan tablolara ayırırdım; hem ölçek sınırı hem ziyaretçiye özel demo alanı bundan dolayı zor.


## Bu projede verdiğim kararlar (sorun → karar → bedel)

- **Denetim izi:** Onaylanan kazanç onay anındaki para birimi ve onay notuyla saklanıyor; puan verildiği andaki kriterlerle. Tanımlar sonradan değişince eski kararın yeniden kurulabildiğini tests/audit.test.ts sınıyor.
- **Anonim adın sızması:** Devir geçmişinde ad görünüyordu → geçmiş metinleri de temizleniyor ve test var → sınır: içerikten tahmin engellenemez.
- **Ziyaretçiye özel demo alanı:** Ortak demoda ziyaretçi gerçek saha fotoğrafı ekleyebilirdi; önce yalnız uyarı koymuştum, dış inceleme bunun yetmediğini gösterdi → her ziyaretçiye küçültülmüş örnekle kendi alanı (tam kopya ~360 KB yerine ~160 KB), kullanıcı tanımları demoda kilitli → demoda kişi yönetimi denenemiyor.
- **Şirket kurulumu:** Cloudflare yurt dışında veri işleyebilir → KVKK notunda belirtildi, VPS önerildi → kurum karar vermeli.

---
Son güncelleme: 19 Kasım 2026.
