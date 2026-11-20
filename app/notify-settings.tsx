"use client";
import { intlLocale } from "../lib/i18n";
// Tanımlar → E-posta bildirimleri: sağlayıcı durumu, kural tablosu (aç/kapa), müdüre bildirim günü,
// test e-postası ve giden kutusu. Sağlayıcı (Outlook/Graph, web kancası) sunucu ortam değişkenlerinden seçilir.
import React, { useEffect, useState } from "react";
import { Check, Mail, RefreshCw, Send } from "lucide-react";
import { NOTIFY_RULES } from "../lib/notify";
import type { State } from "../lib/model";

type Props = {
  state: State;
  busy: boolean;
  who: (id: string) => string;
  command: (data: any, close?: boolean, success?: string) => Promise<any>;
  alert: (m: string) => void;
};

const STATUS: Record<string, string> = {
  pending: "Bekliyor",
  retry: "Tekrar denenecek",
  sent: "Gönderildi",
  failed: "Gönderilemedi",
  digest: "Özette bekliyor",
  merged: "Özete eklendi",
};

export default function NotifySettings({ state, busy, who, command, alert }: Props) {
  const [info, setInfo] = useState<any>(null);
  const [disabled, setDisabled] = useState<string[]>(state.settings?.notify?.disabled || []);
  const [days, setDays] = useState(state.settings?.notify?.escalateAfterDays ?? 5);
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState("");
  const load = () =>
    fetch("/api/notify", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ error: true }));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!dirty) {
      setDisabled(state.settings?.notify?.disabled || []);
      setDays(state.settings?.notify?.escalateAfterDays ?? 5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız sunucudaki ayar değişince ve yerelde düzenleme yokken yansıt
  }, [state.settings?.notify]);
  async function post(action: string) {
    setWorking(action);
    try {
      const r = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const b: any = await r.json();
      if (!r.ok) alert(b.error || "İşlem yapılamadı.");
      else if (action === "test")
        alert(b.sent ? "Test e-postası gönderildi." : "Test e-postası giden kutusuna yazıldı. " + (b.provider?.detail || ""));
      else if (action === "run") alert(b.ran ? "Günlük kontrol çalıştı: " + (b.reminders || 0) + " hatırlatma." : "Bugün zaten çalışmış.");
      else alert("Yeniden denendi: " + (b.sent || 0) + " gönderildi.");
      load();
    } finally {
      setWorking("");
    }
  }
  const p = info?.provider;
  return (
    <section className="panel def-panel" aria-labelledby="notify-title">
      <div className="section-heading">
        <div>
          <h2 id="notify-title">
            <Mail size={18} /> E-posta bildirimleri
          </h2>
          <p>Hangi olayda kime e-posta gideceği. Kişiler kendi tercihini (anında, günlük özet, kapalı) seçebilir.</p>
        </div>
        <button
          className="primary"
          disabled={!dirty || busy}
          onClick={async () => {
            const ok = await command(
              { action: "notifySettings", disabled, escalateAfterDays: Number(days) },
              false,
              "Bildirim kuralları kaydedildi.",
            );
            if (ok) setDirty(false);
          }}
        >
          <Check size={16} /> Kaydet
        </button>
      </div>
      <div className={"provider-box " + (p?.ready ? "ok" : "off")} role="status">
        <b>{p ? (p.ready ? "Gönderim açık" : "Gönderim kapalı") : "Durum alınıyor…"}</b>
        <span>{p?.detail}</span>
        {p && !p.ready && (
          <small>
            Açmak için sunucuda EMAIL_PROVIDER ve ilgili ayarlar tanımlanmalı (Outlook için Microsoft Graph ya da Power
            Automate web kancası). Bu sırada e-postalar giden kutusunda bekler, kaybolmaz.
          </small>
        )}
        <div className="buttons">
          <button className="secondary" disabled={!!working} onClick={() => post("test")}>
            <Send size={15} /> Kendime test e-postası
          </button>
          <button className="secondary" disabled={!!working} onClick={() => post("run")}>
            <RefreshCw size={15} /> Günlük kontrolü şimdi çalıştır
          </button>
        </div>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Bildirim kuralları">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Olay</th>
              <th>Kime</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {NOTIFY_RULES.map((r) => {
              const on = !disabled.includes(r.key);
              return (
                <tr key={r.key}>
                  <td>
                    <b>{r.title}</b>
                  </td>
                  <td>{r.to}</td>
                  <td>
                    <label className="switch-inline">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          setDisabled(e.target.checked ? disabled.filter((x) => x !== r.key) : [...disabled, r.key]);
                          setDirty(true);
                        }}
                      />
                      <span>{on ? "Açık" : "Kapalı"}</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="field inline-number">
        <span>Gecikme kaç gün sürerse sorumlunun müdürüne de bildirilsin?</span>
        <input
          type="number"
          min={1}
          max={60}
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setDirty(true);
          }}
        />
      </label>
      <h3 className="outbox-title">
        Giden kutusu{" "}
        {info?.counts?.length > 0 && (
          <small>
            {info.counts.map((c: any) => (STATUS[c.status] || c.status) + ": " + c.n).join(" · ")}
          </small>
        )}
        {info?.counts?.some((c: any) => c.status === "failed") && (
          <button className="text-button" onClick={() => post("retry")}>
            Gönderilemeyenleri yeniden dene
          </button>
        )}
      </h3>
      {!info?.rows?.length ? (
        <p className="muted">Henüz e-posta oluşmadı.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Giden kutusu">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Alıcı</th>
                <th>Konu</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {info.rows.map((r: any) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString(intlLocale())}</td>
                  <td>
                    {who(r.user_id)}
                    <small className="cell-sub">{r.email}</small>
                  </td>
                  <td>{r.subject.replace(/^\[İvme\] /, "")}</td>
                  <td className={r.status === "failed" ? "overdue" : ""}>
                    {STATUS[r.status] || r.status}
                    {r.last_error && <small className="cell-sub">{r.last_error}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
