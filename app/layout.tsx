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
