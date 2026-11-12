"use client";
// QR kodları: panoya/makineye asılacak kartlar. Okutan kişi giriş yapar ve öneri formu bölüm/lokasyon dolu açılır.
// Kod tamamen tarayıcıda üretilir; hiçbir dış servise adres gönderilmez.
import React, { useEffect, useState } from "react";
import { Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";

type Card = {
  key: string;
  title: string;
  sub: string;
  url: string;
  svg?: string;
};

export function qrUrl(base: string, bolum = "", lokasyon = "") {
  const q = new URLSearchParams({ yeni: "1" });
  if (bolum) q.set("bolum", bolum);
  if (lokasyon) q.set("lokasyon", lokasyon);
  return base.replace(/\/+$/, "") + "/?" + q.toString();
}

export default function QrSheet({
  operations,
  locations,
  orgName,
}: {
  operations: string[];
  locations: string[];
  orgName: string;
}) {
  const [base, setBase] = useState("");
  const [mode, setMode] = useState<"one" | "byOperation" | "byLocation">(
    "byOperation",
  );
  const [bolum, setBolum] = useState("");
  const [lokasyon, setLokasyon] = useState("");
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => setBase(window.location.origin), []);

  useEffect(() => {
    if (!base) return;
    const list: Card[] =
      mode === "one"
        ? [
            {
              key: "one",
              title: bolum || "Genel",
              sub: lokasyon,
              url: qrUrl(base, bolum, lokasyon),
            },
          ]
        : mode === "byOperation"
          ? operations.map((o) => ({
              key: o,
              title: o,
              sub: lokasyon,
              url: qrUrl(base, o, lokasyon),
            }))
          : locations.map((l) => ({
              key: l,
              title: l,
              sub: bolum,
              url: qrUrl(base, bolum, l),
            }));
    let live = true;
    Promise.all(
      list.map(async (c) => ({
        ...c,
        svg: await QRCode.toString(c.url, {
          type: "svg",
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#222a42", light: "#ffffff" },
        }),
      })),
    ).then((x) => live && setCards(x));
    return () => {
      live = false;
    };
  }, [base, mode, bolum, lokasyon, operations.join("|"), locations.join("|")]);

  return (
    <section className="panel def-panel qr-panel" aria-labelledby="qr-title">
      <div className="section-heading">
        <h2 id="qr-title">
          <QrCode size={18} /> QR kodları
        </h2>
        <button
          className="secondary"
          disabled={!cards.length}
          onClick={() => window.print()}
        >
          <Printer size={16} /> Yazdır
        </button>
      </div>
      <p className="muted">
        Panolara, makinelere ya da dinlenme alanına asın. Okutan kişi telefonda
        giriş yapar (oturumu açıksa doğrudan) ve öneri formu seçili bölüm ve
        lokasyonla açılır. Uygulama adresi değişirse kartları yeniden basın.
      </p>
      <div className="qr-controls">
        <label className="field">
          <span>Kart türü</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="byOperation">Her bölüm için bir kart</option>
            <option value="byLocation" disabled={!locations.length}>
              Her lokasyon için bir kart
            </option>
            <option value="one">Tek kart</option>
          </select>
        </label>
        {mode !== "byOperation" && (
          <label className="field">
            <span>Bölüm (isteğe bağlı)</span>
            <select value={bolum} onChange={(e) => setBolum(e.target.value)}>
              <option value="">— Okutan seçsin —</option>
              {operations.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
        {mode !== "byLocation" && locations.length > 0 && (
          <label className="field">
            <span>Lokasyon (isteğe bağlı)</span>
            <select
              value={lokasyon}
              onChange={(e) => setLokasyon(e.target.value)}
            >
              <option value="">— Okutan seçsin —</option>
              {locations.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field qr-base">
          <span>Uygulama adresi</span>
          <input
            value={base}
            onChange={(e) => setBase(e.target.value.trim())}
            inputMode="url"
          />
        </label>
      </div>
      <div className="qr-print" aria-label="Yazdırılacak QR kartları">
        {cards.map((c) => (
          <figure key={c.key} className="qr-card">
            <figcaption>
              <small>{orgName}</small>
              <b>Fikrin mi var?</b>
              <span>Okut, 2 dakikada öner.</span>
            </figcaption>
            <div
              className="qr-img"
              role="img"
              aria-label={"QR kodu: " + c.title}
              dangerouslySetInnerHTML={{ __html: c.svg || "" }}
            />
            <div className="qr-meta">
              <b>{c.title}</b>
              {c.sub && <span>{c.sub}</span>}
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
