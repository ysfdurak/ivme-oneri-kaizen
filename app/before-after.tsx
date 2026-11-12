"use client";
// Öneri ekleri: önce / sonra fotoğrafları yan yana, diğer dosyalar bağlantı olarak.
// Sonra fotoğrafı uygulama başladıktan sonra öneren, sorumlu ya da aksiyon sorumlusu tarafından eklenir.
import React, { useState } from "react";
import { Camera, Download, Paperclip } from "lucide-react";

type Att = {
  index?: number;
  name: string;
  kind?: string;
  type?: string;
  size?: number;
};

export default function BeforeAfter({
  id,
  attachments,
  canAddAfter,
  prepare,
  onAdd,
}: {
  id: string;
  attachments: Att[];
  canAddAfter: boolean;
  /** Fotoğrafı küçültüp data URL'e çeviren yardımcı (sayfadaki ortak fonksiyon). */
  prepare: (f: File) => Promise<string>;
  onAdd: (attachment: { name: string; data: string }) => Promise<any>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = (a: Att, i: number) =>
    "/api/attachment?id=" + encodeURIComponent(id) + "&i=" + (a.index ?? i);
  const list = attachments.map((a, i) => ({ ...a, href: url(a, i) }));
  const isImage = (a: Att) => (a.type || "").startsWith("image/");
  const before = list.filter((a) => isImage(a) && a.kind !== "after");
  const after = list.filter((a) => isImage(a) && a.kind === "after");
  const files = list.filter((a) => !isImage(a));
  if (!list.length && !canAddAfter) return null;

  async function add(f?: File) {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const data = await prepare(f);
      await onAdd({ name: f.name, data });
    } catch (e: any) {
      setError(e?.message || "Dosya eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  const Gallery = ({
    title,
    items,
    empty,
  }: {
    title: string;
    items: typeof list;
    empty: string;
  }) => (
    <figure className="ba-col">
      <figcaption>{title}</figcaption>
      {items.length ? (
        <div className="ba-thumbs">
          {items.map((a) => (
            <a
              key={a.href}
              href={a.href}
              target="_blank"
              rel="noopener"
              aria-label={title + ": " + a.name}
            >
              <img
                src={a.href}
                alt={title + " fotoğrafı: " + a.name}
                loading="lazy"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </figure>
  );

  return (
    <div className="text-section">
      <h3>Görseller ve ekler</h3>
      {(before.length > 0 || after.length > 0 || canAddAfter) && (
        <div className="ba-grid">
          <Gallery title="Önce" items={before} empty="Önce fotoğrafı yok." />
          <Gallery
            title="Sonra"
            items={after}
            empty={
              canAddAfter
                ? "Uygulamadan sonraki hali ekle."
                : "Henüz eklenmedi."
            }
          />
        </div>
      )}
      {canAddAfter && (
        <label className={"secondary file-button" + (busy ? " is-busy" : "")}>
          <Camera size={16} /> {busy ? "Ekleniyor…" : "Sonra fotoğrafı ekle"}
          <input
            type="file"
            className="sr-only"
            accept="image/*,application/pdf"
            disabled={busy || attachments.length >= 6}
            onChange={(e) => {
              add(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {files.map((a) => (
        <a
          className="attachment"
          key={a.href}
          href={a.href}
          target="_blank"
          rel="noopener"
        >
          <Paperclip size={15} />
          {a.name}
          <Download size={15} />
        </a>
      ))}
    </div>
  );
}
