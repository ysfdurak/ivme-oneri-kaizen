"use client";
// Tanınma: tamamlanan iyileştirmeleri görünür kılar, departman katılımını gösterir, kişiye kendi rozetlerini verir.
// Kişiler arası sıralama bilerek yoktur; amaç yarış değil, katkıyı görünür kılmak.
import React, { useEffect, useState } from "react";
import { Award, Lock, Megaphone, Sparkles, Users } from "lucide-react";
import type { Recognition } from "../lib/recognition";

type Data =
  | (Omit<Recognition, "highlights"> & {
      enabled: true;
      highlights: (Recognition["highlights"][number] & { canOpen: boolean })[];
    })
  | { enabled: false };

export default function RecognitionPage({
  onOpen,
  admin,
}: {
  onOpen: (id: string) => void;
  admin: boolean;
}) {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    fetch("/api/recognition?gun=" + days, { cache: "no-store" })
      .then(async (r) => {
        const b: any = await r.json();
        if (!r.ok) throw Error(b.error);
        if (live) setData(b);
      })
      .catch((e) => live && setError(e.message || "Yüklenemedi."));
    return () => {
      live = false;
    };
  }, [days]);

  if (error)
    return (
      <div className="error" role="alert">
        {error}
      </div>
    );
  if (!data) return <p className="muted">Yükleniyor…</p>;
  if (!data.enabled)
    return (
      <div className="panel empty">
        <p>
          Tanınma ekranı kapalı.{admin && " Tanımlar sayfasından açabilirsin."}
        </p>
      </div>
    );
  const t = data.totals;
  return (
    <div className="recognition">
      <div className="page-heading">
        <div>
          <h1>
            Tanınma<span className="mint-dot">.</span>
          </h1>
          <p>
            Hayata geçen iyileştirmeler ve katkılar. Kişiler arasında sıralama
            yapılmaz.
          </p>
        </div>
        <label className="field compact-field">
          <span>Dönem</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
            <option value={365}>Son 1 yıl</option>
          </select>
        </label>
      </div>

      <div className="rec-totals" role="list" aria-label="Dönem özeti">
        {[
          [t.submitted, "öneri verildi"],
          [t.completed, "iyileştirme tamamlandı"],
          [t.participants, "kişi katkı verdi"],
          ["%" + t.participation, "katılım oranı"],
        ].map(([v, l]) => (
          <div key={String(l)} role="listitem" className="rec-total">
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      {data.campaigns.length > 0 && (
        <section className="panel" aria-labelledby="rec-camp">
          <h2 id="rec-camp" className="rec-h">
            <Megaphone size={18} /> Kampanyalar
          </h2>
          <ul className="rec-campaigns">
            {data.campaigns.map((c) => (
              <li key={c.id}>
                <div>
                  <b>{c.title}</b>{" "}
                  <span className={"camp-status s-" + c.status}>
                    {c.status}
                  </span>
                  <small>
                    {c.start.split("-").reverse().join(".")} –{" "}
                    {c.end.split("-").reverse().join(".")}
                    {c.reward && " · Ödül: " + c.reward}
                  </small>
                </div>
                <p>
                  <b>{c.submitted}</b> öneri · <b>{c.participants}</b> kişi ·{" "}
                  <b>{c.completed}</b> tamamlandı
                  {c.mine > 0 && " · senin " + c.mine + " önerin"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel" aria-labelledby="rec-hl">
        <h2 id="rec-hl" className="rec-h">
          <Sparkles size={18} /> Öne çıkan iyileştirmeler
        </h2>
        {data.highlights.length ? (
          <div className="rec-cards">
            {data.highlights.map((h) => (
              <article key={h.id} className="rec-card">
                <small>
                  {h.id} · {h.operation}
                </small>
                <h3>{h.title}</h3>
                {h.benefit && <p className="rec-benefit">{h.benefit}</p>}
                <p className="rec-authors">
                  <Users size={14} aria-hidden /> {h.authors.join(", ")}
                </p>
                <div className="rec-tags">
                  {h.score !== undefined && (
                    <span className="rec-tag">Puan {h.score}</span>
                  )}
                  {h.gainType && (
                    <span className="rec-tag">{h.gainType} kazanç</span>
                  )}
                  {h.canOpen && (
                    <button
                      className="text-button"
                      onClick={() => onOpen(h.id)}
                    >
                      Aç
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Bu dönemde tamamlanan iyileştirme yok.</p>
        )}
      </section>

      <div className="rec-grid">
        <section className="panel" aria-labelledby="rec-me">
          <h2 id="rec-me" className="rec-h">
            <Award size={18} /> Benim katkım
          </h2>
          <p className="rec-me-line">
            <b>{data.me.submitted}</b> öneri · <b>{data.me.coAuthored}</b> ortak
            öneri · <b>{data.me.implemented}</b> uygulamaya alındı ·{" "}
            <b>{data.me.completed}</b> tamamlandı
          </p>
          <ul className="badges">
            {data.me.badges.map((b) => (
              <li key={b.key} className={b.earned ? "badge earned" : "badge"}>
                {b.earned ? (
                  <Award size={18} aria-hidden />
                ) : (
                  <Lock size={16} aria-hidden />
                )}
                <span>
                  <b>{b.label}</b>
                  <small>
                    {b.desc}
                    {!b.earned && " (henüz değil)"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">Bu bölümü yalnızca sen görürsün.</p>
        </section>

        <section className="panel" aria-labelledby="rec-dept">
          <h2 id="rec-dept" className="rec-h">
            <Users size={18} /> Departman katılımı
          </h2>
          {data.departments.length ? (
            <ul className="rec-depts">
              {data.departments.map((d) => (
                <li key={d.name}>
                  <div className="rec-dept-head">
                    <b>{d.name}</b>
                    <span>
                      %{d.rate} · {d.contributors}/{d.people} kişi
                      {d.completed > 0 && " · " + d.completed + " tamamlanan"}
                    </span>
                  </div>
                  <div className="rec-bar" aria-hidden>
                    <i style={{ width: Math.max(2, d.rate) + "%" }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Gösterilecek departman yok.</p>
          )}
          <p className="muted">
            3 kişiden küçük departmanlar gizlenir. Oran: dönemde öneri veren ya
            da ortak olan kişi / aktif kişi.
          </p>
        </section>
      </div>
    </div>
  );
}
