# Büyük test verisi

Programı çok sayıda ve çeşitli kayıtla denemek içindir. **Canlı ortamda kullanmayın**: yükleme, yerel veritabanındaki kullanıcıları ve önerileri siler.

```sh
# 1) Veriyi üret (state.json ve users.json oluşur)
node $(ls node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs) scripts/test-verisi/uret.ts
# 2) Yerel sunucu kapalıyken yükle (önce bir kez npm run build ve migrasyon yapılmış olmalı)
node scripts/test-verisi/yukle.mjs
# 3) Sunucuyu başlat
npm start
```

Giriş: tüm hesaplarda şifre `Kaizen123!`. Örnek kullanıcı adları: `admin` (yönetici), `mudur.lojistik`, `mudur.uretim` (müdürler), `on.lojistik` (ön değerlendirici), `op.lojistik` (operasyon sorumlusu), `calisan` (çalışan). Diğerleri `k3`, `k4`… biçimindedir.

İçerik: 49 kullanıcı, 6 müdürlük, 9 operasyon, 300 öneri; her durumda kayıt, yorumlar, standart ret nedenleri, geciken aksiyonlar, uzun başlık, aynı isimli kişiler, işleri üzerinde kalmış pasif bir kullanıcı.

Öneri içerikleri `katalog.ts` dosyasından gelir: her başlığın sınıfı, sorunu, çözümü, beklenen faydası, aksiyonları ve kazanç ölçümü birbiriyle uyumludur. Parasal kazanç tutarı ölçümden hesaplanır (zaman: vardiya başına dakika × 2 vardiya × 250 gün × dakika maliyeti; hata: aylık azalma × 12 × hata maliyeti; malzeme: aylık azalma × 12 × birim fiyat) ve açıklama aynı hesabı anlatır. İngilizce demo aynı ölçümleri dolarla (yaklaşık 1/20) kullanır.

