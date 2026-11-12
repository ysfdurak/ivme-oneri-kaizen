"use client";
// Yapay zekâ (MCP) erişim anahtarları: kişi kendi anahtarını oluşturur, şirket içi yapay zekâ istemcisine girer.
// Yalnız yapay zekâ paketinde ve sistem yöneticisi MCP'yi açtıysa görünür. Süreç paketinde bu dosya yer tutucuyla değişir.
import React, { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";

const day = (t?: number) => (t ? new Date(t).toLocaleDateString("tr-TR") : "—");

export default function McpAccess() {
  const [data, setData] = useState<{
    enabled: boolean;
    days?: number;
    tokens: any[];
  } | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: any) => setData(b))
      .catch(() => setError("Anahtarlar yüklenemedi."));
  useEffect(() => {
    load();
  }, []);
  if (!data?.enabled) return null;

  async function post(body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b: any = await r.json();
      if (!r.ok) throw Error(b.error);
      if (b.token) setFresh(b.token);
      await load();
    } catch (e: any) {
      setError(e.message || "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const url =
    typeof window !== "undefined"
      ? window.location.origin + "/api/mcp"
      : "/api/mcp";
  return (
    <div className="mcp-access">
      <h3>
        <KeyRound size={17} aria-hidden /> Yapay zekâ erişimi (MCP)
      </h3>
      <p className="muted">
        Kurumunuzun kendi yapay zekâsı, bu anahtarla yalnızca senin görebildiğin
        kayıtları okuyabilir; karar veremez, kayıt değiştiremez. Adres:{" "}
        <code>{url}</code>
      </p>
      {fresh && (
        <div className="mcp-fresh" role="status">
          <b>Anahtarın (yalnız şimdi gösterilir):</b>
          <code>{fresh}</code>
          <button
            type="button"
            className="text-button"
            onClick={() => navigator.clipboard?.writeText(fresh)}
          >
            Kopyala
          </button>
        </div>
      )}
      {data.tokens.length > 0 && (
        <ul className="mcp-tokens">
          {data.tokens.map((t) => (
            <li key={t.id}>
              <span>
                <b>{t.name}</b>
                <small>
                  {day(t.created_at)} · son kullanım {day(t.last_used_at)} ·{" "}
                  {t.expires_at < Date.now()
                    ? "süresi doldu"
                    : "geçerlilik " + day(t.expires_at)}
                </small>
              </span>
              <button
                type="button"
                className="text-button danger-text"
                disabled={busy}
                onClick={() => post({ action: "revoke", id: t.id })}
                aria-label={t.name + " anahtarını iptal et"}
              >
                <Trash2 size={15} /> İptal et
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mcp-new">
        <label className="field">
          <span>Anahtar adı</span>
          <input
            value={name}
            maxLength={60}
            placeholder="Ör. Şirket asistanı"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            post({ action: "create", name: name || "Anahtar" });
            setName("");
          }}
        >
          Anahtar oluştur
        </button>
      </div>
      <small className="muted">
        {data.days} gün geçerlidir. Ayrılırsan ya da hesabın pasife alınırsa
        anahtar çalışmaz.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
