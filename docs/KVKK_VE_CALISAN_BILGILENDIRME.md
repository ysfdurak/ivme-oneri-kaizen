# İvme · KVKK ve çalışan bilgilendirme

> **Not:** Bu belge bir başlangıç şablonudur, hukuki görüş değildir. Kullanmadan önce kurumunun hukuk ya da KVKK sorumlusuna onaylat. Veri sorumlusu uygulamayı kuran kurumdur; bu depo yalnızca aracı sağlar.

İvme, çalışanların iyileştirme önerilerini ve bu önerilerin değerlendirme, aksiyon, kazanç, puan ve ödül sürecini yönetir. Öneren, değerlendiren ve ödül alan kişiye ait bilgiler kişisel veridir.

## Hangi kişisel veriler işleniyor?

| Veri | Nereden gelir | Neden gerekir |
|---|---|---|
| Kullanıcı: ad, kullanıcı adı, e-posta (varsa), rol, bölüm, parola özeti | Yönetici tanımlar ya da Excel'den aktarır | Giriş, yetki ve onay akışı |
| Öneri: öneren, metin, ekler (fotoğraf, PDF), tarih | Çalışan girer | Öneriyi değerlendirmek ve uygulamak |
| Değerlendirme, yorum, aksiyon sorumlusu, kazanç hesabı | Değerlendiriciler girer | Kararı ve etkiyi kayıt altına almak |
| Puan ve ödül (açıksa ödülün bordroya giden tutarı) | Kurallara göre hesaplanır, İK onaylar | Takdir ve ödül |
| İşlem geçmişi | Uygulama otomatik yazar | Kimin neyi ne zaman yaptığını izlemek |

## Nerede durur, kim görür, ne kadar kalır?

- **Yer:** Bu sürüm Cloudflare Workers ve D1 üzerinde çalışır. Cloudflare yurt dışında veri işleyebilir; bu, **kişisel verinin yurt dışına aktarılması** demektir. Şirket kurulumunda ya kurumun hukuk birimiyle aktarım şartlarını (KVKK 9. madde) sağla ya da uygulamayı kurum sunucusuna (VPS, PostgreSQL) taşı. README bunu zaten önerir.
- **Kim görür:** Öneriyi öneren, ilgili değerlendirici ve yöneticiler; yetki kuralları `lib/workflow.ts` içinde.
- **Ne kadar:** Uygulama öneriyi kendiliğinden silmez. Saklama süresini kurum belirlemeli (ör. kapanmış öneriler için [n] yıl, sonra anonimleştir).
- **Fotoğraflar:** Telefonla çekilen fotoğrafların konum bilgisi (EXIF) yüklemeden önce silinir; fotoğrafın kendisinde yüz, yaka kartı ya da ekran görüntüsü olabilir.

## Kurumun yapması gerekenler

1. **Aydınlatma:** Çalışanlara, verinin hangi amaçla, hangi hukuki sebeple, kimler tarafından ve ne kadar süre işlendiğini yazılı olarak bildir (aşağıdaki duyuru şablonu başlangıç olabilir).
2. **Amaçla sınırla:** Toplanan veri yalnız yazılan amaç için kullanılır. Başka bir amaca (ör. disiplin, bireysel performans sıralaması) kaydırılacaksa yeniden değerlendir ve çalışanı bilgilendir.
3. **Erişimi daralt:** Yalnız işi gereği görmesi gerekenlere hesap aç; ayrılanların hesabını aynı gün kapat.
4. **Saklama süresini yaz ve uygula:** Süre dolan kayıtları sil ya da anonimleştir; silme tarihini kayıt altına al.
5. **Kayıt envanteri:** Bu işlemeyi kurumun kişisel veri envanterine ekle; VERBİS kaydı gerekiyorsa güncelle.
6. **Talepler:** Çalışanın KVKK 11. madde kapsamındaki taleplerine (bilgi, düzeltme, silme) kimin, kaç gün içinde cevap vereceğini belirle.

## İvme'ye özel noktalar

- **Anonim öneri:** Öneren adı değerlendiricilere ve geçmiş kayıtlarına gösterilmez. Ama küçük ekipte kimin yazdığı içerikten tahmin edilebilir; duyuruda "adın gösterilmez" de, "kimse bilemez" deme.
- **Puan ve sıralama:** Puanlar gönüllü katılımı ölçmek içindir. Puanı bireysel performans notuna çevirmek ya da herkese açık sıralama yapmak çalışanın katılımını azaltabilir; kurumun kültürüne göre karar ver. Ödül modülü varsayılan olarak kapalıdır.
- **Ödül ve bordro:** Ödül tutarı bordroya gidiyorsa bu veri İK ve bordro sorumlusuyla sınırlı kalmalı.
- **Ekler:** Çalışanlara gerçek kişi, müşteri belgesi ya da ekranında kişisel veri olan fotoğraf eklememelerini söyle.

## Çalışan duyurusu (şablon)

Köşeli parantezli yerleri doldur.

> [Kurum adı] olarak iyileştirme önerilerini İvme uygulamasıyla topluyor ve değerlendiriyoruz. Öneri verdiğinde adın, bölümün, önerinin metni ve eklediğin fotoğraflar kaydedilir. Bunları öneriyi değerlendiren kişiler ve yöneticiler görür; anonim seçeneğini işaretlersen adın değerlendiricilere gösterilmez. Kayıtlar [yer: ör. kurum sunucusu / Cloudflare] üzerinde [süre] saklanır. Öneri puanları katılımı görmek içindir; [ödül kuralları]. Fotoğraflarda kişi yüzü, müşteri belgesi ya da ekranında kişisel bilgi olmamasına dikkat et. Soruların ve KVKK kapsamındaki talepler için: [kişi / e-posta].

---
Son güncelleme: 19 Kasım 2026.
