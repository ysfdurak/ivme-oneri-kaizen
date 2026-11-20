"use client";
// Canlı demo rehberi: vitrin modunda ana sayfada seçilen role göre "burada neyi deneyebilirsin" kartı.
// Ziyaretçi kapatabilir; tercih bu tarayıcıda rol başına saklanır. Gerçek kurulumda (vitrin dışı) görünmez.
import React, { useState } from "react";
import { Compass, X } from "lucide-react";

type Tip = { text: string; page?: string; cta?: string };

const TIPS: Record<string, { title: string; tips: Tip[] }> = {
  employee: {
    title: "Çalışan olarak deneyebileceklerin",
    tips: [
      {
        text: "Üç adımda bir öneri gönder: sorun, çözüm, kontrol. Benzer bir öneri varsa sistem gönderimden önce uyarır.",
        page: "new",
        cta: "Öneri ver",
      },
      {
        text: "“Önerilerin nerede?” kartında önerinin hangi adımda olduğunu ve reddedilen önerinin gerekçesini incele.",
      },
      {
        text: "Sana atanan aksiyonları İşlerim'de güncelle; tamamlanınca öneri bir sonraki adıma geçer.",
        page: "tasks",
        cta: "İşlerim",
      },
    ],
  },
  pre: {
    title: "Ön değerlendirici olarak deneyebileceklerin",
    tips: [
      {
        text: "İşlerim'deki yeni bir öneriyi aç: kabul et, doğru bölüme yönlendir ya da gerekçeyle reddet.",
        page: "tasks",
        cta: "İşlerim",
      },
      {
        text: "Önerinin altındaki benzer öneri uyarısına bak; mükerrer kararını sen verirsin.",
      },
      {
        text: "Önerenin adı anonim önerilerde sana gösterilmez; bunu bir anonim öneri açarak gör.",
      },
    ],
  },
  operation: {
    title: "Bölüm sorumlusu olarak deneyebileceklerin",
    tips: [
      {
        text: "Bir öneriyi değerlendir, aksiyon planı oluştur ve aksiyonlara sorumlu ata.",
        page: "tasks",
        cta: "İşlerim",
      },
      {
        text: "Uygulama aşamasında her aksiyonu “yapıldı / yapılamadı” diye sonuçlandır; uygulanamayan öneri kazanç adımına geçmeden kapanır.",
      },
      {
        text: "“Hangi birimi bekliyoruz?” kartında IT veya Satın Alma desteği bekleyen önerileri gör.",
      },
    ],
  },
  manager: {
    title: "Müdür olarak deneyebileceklerin",
    tips: [
      {
        text: "Kazanç onayı bekleyen öneriyi aç; tutarı onayla ya da düzeltme iste.",
        page: "tasks",
        cta: "İşlerim",
      },
      {
        text: "Durum panosunda geciken adımları, katılımı ve yıllık kazancı izle.",
        page: "dashboard",
        cta: "Durum panosu",
      },
      {
        text: "Raporlar'da yıl/ay süzgeciyle kendi raporunu oluştur.",
        page: "reports",
        cta: "Raporlar",
      },
    ],
  },
  reward: {
    title: "İK olarak deneyebileceklerin",
    tips: [
      {
        text: "Tamamlanan önerilerin ödül önerilerini onayla ve ödendi olarak işaretle.",
        page: "rewards",
        cta: "Ödüller",
      },
      {
        text: "Tanınma ekranında öne çıkan önerileri ve teşekkürleri gör.",
        page: "recognition",
        cta: "Tanınma",
      },
    ],
  },
  admin: {
    title: "Sistem yöneticisi olarak deneyebileceklerin",
    tips: [
      {
        text: "Tanımlar'da bölümleri, lokasyonları, ret gerekçelerini ve kampanyaları şirketine göre düzenle.",
        page: "definitions",
        cta: "Tanımlar",
      },
      {
        text: "Kullanıcılar'da kişileri yönet; pasif bir kişinin üzerinde kalan açık işleri başkasına devret. Atama matrisinde her bölümün sorumlusunu gör.",
        page: "users",
        cta: "Kullanıcılar",
      },
      {
        text: "Eski sistemden Excel ile toplu öneri aktarımını önce deneme modunda çalıştır.",
      },
    ],
  },
};

export function DemoGuide({
  role,
  onNavigate,
  feedback,
}: {
  role: string;
  onNavigate: (page: string) => void;
  /** Yalnız vitrinde, anonim ölçüm açıkken verilir (lib/olcum.ts). */
  feedback?: (puan: number | null, metin: string) => Promise<boolean>;
}) {
  const key = "ivme-demo-guide-closed-" + role;
  // Bileşen yalnız giriş sonrası istemcide çizilir; tercihi ilk çizimde okumak yeterli.
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const guide = TIPS[role];
  if (!guide || closed) return null;
  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* depolama kapalıysa yalnız bu oturumda kapanır */
    }
  };
  return (
    <section className="demo-guide" aria-labelledby="demo-guide-title">
      <span className="metric-icon pale-purple">
        <Compass size={20} />
      </span>
      <div>
        <span className="section-kicker">CANLI DEMO REHBERİ</span>
        <h2 id="demo-guide-title">{guide.title}</h2>
        <ol>
          {guide.tips.map((t, i) => (
            <li key={i}>
              <span>{t.text}</span>
              {t.page && t.cta && (
                <button
                  type="button"
                  className="demo-guide-link"
                  onClick={() => onNavigate(t.page!)}
                >
                  {t.cta} →
                </button>
              )}
            </li>
          ))}
        </ol>
        <small>Veriler her gece sıfırlanır; istediğin gibi dene.</small>
        {feedback && <DemoFeedback send={feedback} />}
      </div>
      <button
        type="button"
        className="demo-guide-close"
        aria-label="Demo rehberini kapat"
        onClick={close}
      >
        <X size={18} />
      </button>
    </section>
  );
}

/** "Bu demo işine yaradı mı?" 1-5 puan ve isteğe bağlı kısa not. Ad, e-posta istenmez; sunucu e-posta/telefonu maskeler. */
function DemoFeedback({ send }: { send: (puan: number | null, metin: string) => Promise<boolean> }) {
  const [puan, setPuan] = useState<number | null>(null);
  const [metin, setMetin] = useState("");
  const [durum, setDurum] = useState<"" | "gidiyor" | "tamam" | "hata">("");
  if (durum === "tamam") return <p className="demo-feedback-thanks">Teşekkürler, geri bildirimin alındı.</p>;
  return (
    <form
      className="demo-feedback"
      onSubmit={async (e) => {
        e.preventDefault();
        if (puan === null && metin.trim().length < 2) return;
        setDurum("gidiyor");
        setDurum((await send(puan, metin.trim())) ? "tamam" : "hata");
      }}
    >
      <span id="demo-feedback-q">Bu demo işine yaradı mı?</span>
      <div role="radiogroup" aria-labelledby="demo-feedback-q" className="demo-feedback-scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={puan === n}
            className={puan === n ? "on" : ""}
            onClick={() => setPuan(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <input
        aria-label="Kısa not (isteğe bağlı)"
        placeholder="Kısa not (isteğe bağlı, adını yazma)"
        maxLength={500}
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
      />
      <button type="submit" className="demo-guide-link" disabled={durum === "gidiyor" || (puan === null && metin.trim().length < 2)}>
        Gönder
      </button>
      {durum === "hata" && <small role="alert">Gönderilemedi, sonra tekrar dene.</small>}
      <small className="demo-feedback-note">Anonim: çerez, ad ya da IP tutulmaz.</small>
    </form>
  );
}
