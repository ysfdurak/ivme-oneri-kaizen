"use client";
// Vitrin demosunda kullanım ölçümü ve geri bildirim (ortak servis: olcum.ysfdurak.com).
//
// Yalnızca herkese açık vitrin demosunda (IVME_VITRIN=1) ve OLCUM_URL / OLCUM_PROJE tanımlıysa çalışır.
// Şirket kurulumunda /api/auth bu ayarı hiç göndermez: betik yüklenmez, hiçbir olay gönderilmez.
// Gönderilenler: ekran adı, aktif süre, işlem adı (ör. "islem:create"). Öneri metni, kişi ve bölüm adı gönderilmez.
// Kaynak ve gizlilik kararları: github.com/ysfdurak/ysfdurak.com → sunucu/olcum/README.md

export type OlcumAyari = { url: string; proje: string };

type Cagri = [string, ...unknown[]];
declare global {
  interface Window {
    olcum?: Record<string, (...a: unknown[]) => void> & { surum?: number };
    olcumKuyruk?: { push: (c: Cagri) => void } | Cagri[];
  }
}

let yuklendi = false;

/**
 * Ortak ölçüm betiğini bir kez yükler. Köşe düğmesi kapalıdır; geri bildirim İvme'nin kendi düğmesinden açılır.
 * `hazir`, betik yüklenince çağrılır: servis erişilemezse düğme hiç görünmez (tıklanıp çalışmayan düğme olmasın).
 */
export function olcumBaslat(ayar: OlcumAyari | null, hazir?: () => void) {
  if (!ayar || yuklendi || typeof document === "undefined") return;
  yuklendi = true;
  const s = document.createElement("script");
  s.src = ayar.url.replace(/\/+$/, "") + "/olcum.js";
  s.defer = true;
  s.dataset.proje = ayar.proje;
  s.dataset.dugme = "yok";
  s.dataset.renk = "#6352d7";
  s.onload = () => window.olcum?.surum && hazir?.();
  document.head.appendChild(s);
}

/** Betik yüklenmeden yapılan çağrılar kuyrukta bekler, yüklenince sırayla işlenir. */
export function olc(islev: "ekran" | "olay" | "geriBildirimAc", ...arg: unknown[]) {
  if (!yuklendi || typeof window === "undefined") return;
  const k = (window.olcumKuyruk ||= []);
  k.push([islev, ...arg]);
}

export const olcumAcik = () => yuklendi;
