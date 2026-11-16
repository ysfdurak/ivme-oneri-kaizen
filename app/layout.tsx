import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import "./globals.css";
import { LANG_COOKIE, localeFrom, translate, type Locale } from "../lib/i18n";

/** Arayüz dili: kişinin seçimi (çerez) → kurulumun varsayılanı (IVME_LANG) → Türkçe. */
async function pageLocale(): Promise<Locale> {
  let chosen: Locale | null = null;
  try {
    chosen = localeFrom((await cookies()).get(LANG_COOKIE)?.value);
  } catch {
    /* derleme sırasında çerez yok */
  }
  return chosen ?? localeFrom((env as any)?.IVME_LANG) ?? "tr";
}

/** Herkese açık vitrin demosunda (IVME_VITRIN=1) arama ve paylaşım etiketleri. Şirket kurulumunda eklenmez. */
function vitrinMetadata(l: Locale): Partial<Metadata> {
  const e = env as any;
  const url = e?.IVME_VITRIN === "1" ? (e?.IVME_PUBLIC_URL as string | undefined) : undefined;
  if (!url) return {};
  const alt = e?.IVME_ALT_DEMO_URL as string | undefined;
  const title = translate("İvme · Kaizen ve çalışan öneri sistemi", l);
  const description = translate(
    "Çalışan önerisini değerlendirmeden aksiyona, kazanca, puana ve ödüle kadar tek akışta yöneten ücretsiz öneri ve kaizen sistemi. Rolle girip örnek verili demoyu deneyin.",
    l,
  );
  const tr = l === "tr" ? url : alt;
  const en = l === "en" ? url : alt;
  const image = "https://ysfdurak.com/img/ivme/og.jpg";
  return {
    title,
    description,
    metadataBase: new URL(url),
    alternates: {
      canonical: "/",
      languages: { ...(tr ? { tr, "x-default": tr } : {}), ...(en ? { en } : {}) },
    },
    openGraph: {
      type: "website",
      siteName: "ysfdurak.com",
      title,
      description,
      url,
      locale: l === "en" ? "en_GB" : "tr_TR",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const l = await pageLocale();
  return {
    title: translate("İvme · Öneri ve Kaizen Merkezi", l),
    description: translate(
      "Fikirden kalıcı iyileştirmeye. Lojistik önerileri, aksiyonlar ve doğrulanmış kazanımlar.",
      l,
    ),
    icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
    // Telefonda "Ana ekrana ekle" ile uygulama gibi açılır (PWA). Çevrimdışı çalışma yoktur; veri her zaman sunucudan gelir.
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "İvme", statusBarStyle: "default" },
    ...vitrinMetadata(l),
  };
}
export const viewport: Viewport = { themeColor: "#6352d7" };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tarayıcıdaki çeviri (app/i18n-jsx.ts) dili bu lang değerinden okur.
  return (
    <html lang={await pageLocale()}>
      <body>{children}</body>
    </html>
  );
}
