# Dil desteği (Türkçe / English)

İvme'nin arayüzü Türkçe ve İngilizce çalışır. Bu belge çevirinin nasıl yapıldığını, yeni metin eklerken ne yapılacağını ve İngilizce canlı demonun nasıl yayınlandığını anlatır.

## Kısaca

- **Kaynak dil Türkçe.** Kodda bütün metinler Türkçe yazılır. İngilizcesi tek bir sözlükte durur: `lib/i18n/en.json` (`{ "Türkçe metin": "English text" }`).
- **Metinler tek tek sarılmaz.** Tarayıcıda React'in JSX çalışma zamanı `app/i18n-jsx.ts` ile sarılıdır. Ekrana giden her yazı (çocuk metinler ile `title`, `placeholder`, `aria-label`, `alt`) sözlükten geçer. Türkçe seçiliyken hiçbir şey değişmez.
- **Veri kodları Türkçe kalır.** Aşama adları ("Uygulamada"), kapanış durumları, roller ve kilitli sistem maddeleri ("Mükerrer öneri", "Parasal") veritabanında Türkçe saklanır, ekranda çevrilir. Böylece süreç kuralları (`lib/workflow.ts`) dile göre değişmez.
- **Kullanıcının yazdığı veri çevrilmez.** Öneri başlığı, kişi adı, bölüm adı olduğu gibi görünür. Bu yüzden İngilizce demo ayrı, İngilizce yazılmış örnek veriyle çalışır.

## Dil nasıl seçilir

1. Adreste `?lang=en` ya da `?lang=tr` varsa (`worker/index.ts` çereze yazar ve parametresiz adrese yönlendirir).
2. Kişinin seçimi: giriş ekranının sağ üstündeki ve menünün altındaki **TR / EN** düğmesi. `ivme_lang` çerezinde bir yıl saklanır.
3. Kurulumun varsayılanı: `IVME_LANG` (`wrangler.jsonc`).

Sunucu `app/layout.tsx` içinde `<html lang>` değerini bu sırayla yazar. Tarayıcıdaki çeviri dili bu değerden okur. Sunucuda üretilen metinler (e-postalar, MCP araç açıklamaları) her zaman kurulumun dilindedir (`IVME_LANG`).

## Çeviri nasıl eşleşir (`lib/i18n.ts`)

| Durum | Örnek | Nasıl |
|---|---|---|
| Birebir metin | `Kaydet` | Sözlükte doğrudan bulunur |
| Değişkenli metin | `3 öneri bekliyor` | Kalıp: `{0} öneri bekliyor` → `{0} {0\|proposal is\|proposals are} waiting` |
| Tekil / çoğul | `1 öneri` / `3 öneri` | `{0\|tekil\|çoğul}` sayıya göre seçer |
| İçteki sabit | `Öneri Uygulamada aşamasına geri alındı.` | Yakalanan değer (aşama adı) de sözlükten geçer |
| JSX parçaları | `<b>{n} gün gecikti</b>` | Metin ve sayı çocukları birlikte denenir; değişken kısım tam bir çocuğa denk gelmek zorunda |
| Birleşik metin | `Kazanç onay tarihi: 2026`, `2026 · Kas · Tamamlanan` | "Etiket: değer" ve ` · ` ile ayrılmış parçalar ayrı ayrı çevrilir |

JSX dışında ekrana çıkan metinler de kapsanır: `alert` / `confirm` pencereleri, form doğrulama mesajları, CSV dışa aktarımlar (`translate(...)` hücre hücre) ve Excel şablonları. Aktarımda İngilizce yazılmış sabitler (`Completed`, `Employee`, `Yes`) `untranslate()` ile Türkçe koduna döner.

Sayı ve tarih biçimi `intlLocale()` ile dile göre seçilir (`tr-TR` / `en-GB`); yüzde `pct()` ile yazılır (`%14` / `14%`).

## Yeni metin eklerken

1. Metni koda her zamanki gibi Türkçe yaz.
2. `node scripts/i18n/anahtarlar.mjs` çalıştır. Sözlükte karşılığı olmayan metinleri dosya ve satırıyla listeler.
3. İngilizcesini `lib/i18n/en.json`'a ekle. Değişkenli metinlerde `{0}`, `{1}` kullan; çoğul gerekiyorsa `{0|item|items}`.
4. Bilerek çevrilmeyen metinler (veri anahtarı, örnek veri, kişi adı) `scripts/i18n/kasitli.json` listesine girer.

`tests/i18n.test.ts` bu kontrolü `--strict` ile çalıştırır. Çevrilmemiş metin kalırsa test başarısız olur.

**Dikkat edilecek yerler:**
- Bir değeri hem ekranda gösterip hem de karşılaştırmada kullanıyorsan karşılaştırma Türkçe kodla yapılır. Çeviri yalnız ekrana çıkarken uygulanır, kodu etkilemez.
- `value` niteliği çevrilmez. Girdi kutusunda görünen bir sabiti çevirmek gerekirse `translate(...)` açıkça çağrılır (ör. Tanımlar'daki kilitli maddeler).
- Yan yana iki değişken (`"Satır " + no + ad`) belirsizdir. Bu durumda metin parça parça çevrilir.

## İngilizce canlı demo

| | Türkçe demo | İngilizce demo |
|---|---|---|
| Adres | ivme.ysfdurak.com | ivme-en.ysfdurak.com |
| Worker | `ivme` | `ivme-en` |
| Veritabanı | `ivme-db` | `ivme-en-db` |
| `IVME_LANG` | `tr` | `en` |
| Örnek veri | `lib/vitrin/*.json` | `lib/vitrin/en/*.json` |

İki demo aynı koddan derlenir. İngilizce ayarlar `wrangler.jsonc` içindeki `env.en` bölümündedir. Giriş ekranında öteki demoya bir bağlantı vardır (`IVME_ALT_DEMO_URL`).

**İngilizce örnek veriyi yeniden üretmek için:**

```sh
IVME_DIL=en IVME_OLCEK=0.4 IVME_CIKTI=lib/vitrin/en npx tsx scripts/test-verisi/uret.ts
```

Üretici, Türkçe demoyla aynı rastgele sırayı kullanır. Bu yüzden iki demonun yapısı (aşama dağılımı, kullanıcı adları) aynıdır; yalnızca metinler farklıdır. İngilizce metinler `scripts/test-verisi/veri-en.ts` dosyasındadır. Listeler (sınıflar, nedenler, kazanç türleri) ve puan kriterleri İngilizce adlarla kaydedilir. Kilitli sistem maddeleri Türkçe kod olarak kalır.

**Cloudflare'de ilk kurulum (bir kez):**
1. Workers & Pages → **Create** → **Import a repository** → `ysfdurak/ivme-oneri-kaizen`.
2. Proje adı: `ivme-en`.
3. Build command: `CLOUDFLARE_ENV=en npm run build`. Deploy command: `npx wrangler deploy`.
4. Yayın bitince Worker → **Settings → Domains & Routes → Add → Custom domain**: `ivme-en.ysfdurak.com`.

Bundan sonra `main` dalına her gönderimde iki demo da kendiliğinden güncellenir. Veritabanı (`ivme-en-db`) ilk yayında otomatik oluşur, örnek veri ilk açılışta yüklenir, her gece 03:00'te (TR) sıfırlanır.
