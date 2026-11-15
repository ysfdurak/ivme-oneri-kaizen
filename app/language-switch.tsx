"use client";
// Arayüz dili seçimi (TR / EN). Seçim çereze yazılır, sayfa yeni dille yeniden yüklenir.
// Veri (öneri metinleri, kişi ve bölüm adları) olduğu gibi kalır; sabit listeler ve aşamalar çevrilir.
import { LANG_COOKIE, getLocale, type Locale } from "../lib/i18n";

export function chooseLocale(l: Locale) {
  document.cookie = `${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.location.reload();
}

export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const current = getLocale();
  return (
    <div className={"lang-switch " + className} role="group" aria-label="Dil / Language">
      {(["tr", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={current === l}
          className={current === l ? "active" : ""}
          onClick={() => current !== l && chooseLocale(l)}
          title={l === "tr" ? "Türkçe" : "English"}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
