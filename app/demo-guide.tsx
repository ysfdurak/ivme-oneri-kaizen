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
}: {
  role: string;
  onNavigate: (page: string) => void;
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
