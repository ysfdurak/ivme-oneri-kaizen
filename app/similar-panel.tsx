"use client";
// Benzer öneriler listesi: ön değerlendirmede önerinin altında ve çalışan gönderim öncesinde gösterilir.
// Uyarı amaçlıdır; gönderimi ya da değerlendirmeyi durdurmaz. Mükerrer kararını insan verir.
import React, { useEffect, useState } from "react";
import { Copy, ExternalLink, Layers } from "lucide-react";

export type SimilarItem = {
  id: string;
  title: string;
  operation: string;
  status: string;
  created: string;
  score: number;
  shared: string[];
  sameOperation: boolean;
  canOpen: boolean;
};

type Props = {
  /** Kayıtlı öneri için id; gönderim öncesi kontrol için form alanları. */
  id?: string;
  draft?: { title: string; problem: string; solution: string; operation: string; category: string };
  onOpen?: (id: string) => void;
  onDuplicate?: (item: SimilarItem) => void;
  compact?: boolean;
};

export default function SimilarPanel({ id, draft, onOpen, onDuplicate, compact }: Props) {
  const [items, setItems] = useState<SimilarItem[] | null>(null);
  const key = id || JSON.stringify(draft);
  useEffect(() => {
    let alive = true;
    setItems(null);
    const req = id
      ? fetch("/api/similar?id=" + encodeURIComponent(id), { cache: "no-store" })
      : fetch("/api/similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
    req
      .then((r) => r.json())
      .then((b: any) => alive && setItems(b.items || []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [key]);

  if (items === null) return <p className="muted similar-loading">Benzer öneriler aranıyor…</p>;
  if (!items.length)
    return compact ? null : (
      <section className="similar-panel empty-similar" aria-label="Benzer öneriler">
        <h4>
          <Layers size={16} /> Benzer öneri bulunamadı
        </h4>
      </section>
    );
  return (
    <section className="similar-panel" aria-labelledby={"similar-" + (id || "draft")}>
      <h4 id={"similar-" + (id || "draft")}>
        <Layers size={16} /> {compact ? "Buna benzer öneriler var" : "Benzer öneriler"} <small>{items.length}</small>
      </h4>
      {compact && (
        <p className="muted">
          Aynı konu daha önce önerilmiş olabilir. Yine de gönderebilirsin; değerlendirici karar verir.
        </p>
      )}
      <ul>
        {items.map((x) => (
          <li key={x.id}>
            <div className="similar-main">
              <small>
                {x.id} · {x.operation} · {x.status}
              </small>
              <b>{x.title}</b>
              {!compact && (
                <small className="similar-reason">
                  Ortak kelimeler: {x.shared.join(", ") || "—"}
                  {x.sameOperation ? " · aynı bölüm" : ""} · benzerlik %{Math.round(x.score * 100)}
                </small>
              )}
            </div>
            {!compact && (
              <div className="similar-actions">
                {x.canOpen && onOpen && (
                  <button type="button" className="text-button" onClick={() => onOpen(x.id)}>
                    <ExternalLink size={14} /> Aç
                  </button>
                )}
                {onDuplicate && x.status !== "Reddedildi" && (
                  <button type="button" className="text-button" onClick={() => onDuplicate(x)}>
                    <Copy size={14} /> Mükerrer işaretle
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
