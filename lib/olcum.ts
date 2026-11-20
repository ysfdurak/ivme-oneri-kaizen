// Anonim kullanım ölçümü (olcum.ysfdurak.com, ysfdurak.com deposu → olcum/README.md).
// YALNIZCA canlı vitrinde açılır: sunucu /api/auth yanıtında adresi yalnız IVME_VITRIN=1 iken verir ve
// Worker yalnız o zaman CSP connect-src'ye ekler. Şirket kurulumunda adres boş kalır, hiçbir istek gitmez.
// Gönderilenler: proje adı, olay adı, ekran adı (/reports gibi), dil. Kimlik, çerez, öneri içeriği yok.
let kok: string | null = null;

const kapali = () => {
  if (typeof navigator === "undefined") return true;
  const n: any = navigator;
  return n.doNotTrack === "1" || (window as any).doNotTrack === "1" || n.globalPrivacyControl === true;
};

/** /api/auth yanıtındaki adres; geçerli bir https adresi değilse ölçüm kapalı kalır. */
export function olcumAyarla(url: unknown) {
  kok = typeof url === "string" && /^https:\/\/[a-z0-9.-]+$/i.test(url) ? url : null;
}
export const olcumAcik = () => !!kok && !kapali();

function gonder(yol: "/e" | "/g", veri: Record<string, unknown>) {
  if (!kok || kapali()) return Promise.resolve(false);
  return fetch(kok + yol, {
    method: "POST",
    // text/plain: ön kontrol isteği (preflight) gerekmez.
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ p: "ivme", ...veri }),
    credentials: "omit",
    keepalive: true,
  }).then(
    (r) => r.ok,
    () => false,
  );
}

/** Olay sayacı. Ekran değişiminde olay "gorunum", sayfa "/ekran-adi". */
export function olc(olay: string, sayfa = "") {
  void gonder("/e", {
    e: olay,
    s: sayfa,
    d: (typeof document !== "undefined" ? document.documentElement.lang : "").slice(0, 2),
  });
}

/** Demo geri bildirimi: 1-5 puan ve/veya kısa not. */
export function geriBildirim(puan: number | null, metin: string, sayfa = "") {
  return gonder("/g", { r: puan ?? undefined, t: metin.slice(0, 500), s: sayfa });
}
