import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "İvme · Öneri ve Kaizen Merkezi",
  description: "Fikirden kalıcı iyileştirmeye. Lojistik önerileri, aksiyonlar ve doğrulanmış kazanımlar.",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  // Telefonda "Ana ekrana ekle" ile uygulama gibi açılır (PWA). Çevrimdışı çalışma yoktur; veri her zaman sunucudan gelir.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "İvme", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#6352d7" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
