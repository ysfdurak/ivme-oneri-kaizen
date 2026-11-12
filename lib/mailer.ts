// E-posta gönderim sağlayıcıları. Hangisinin kullanılacağı ortam değişkeniyle seçilir; kod değişmez.
//
// EMAIL_PROVIDER=graph   → Microsoft 365 / Outlook (Microsoft Graph, uygulama izni Mail.Send)
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER (ör. ivme@firma.com)
// EMAIL_PROVIDER=webhook → Herhangi bir HTTP uç noktası: Power Automate (Outlook bağlayıcısı), Zapier, n8n
//   veya şirket içi bir SMTP aktarıcısı. EMAIL_WEBHOOK_URL, isteğe bağlı EMAIL_WEBHOOK_SECRET
//   Gövde: { to, subject, html, text } · Başlık: X-Ivme-Secret
// EMAIL_PROVIDER=log     → (varsayılan) gönderim yapılmaz; e-postalar giden kutusunda "gönderilmedi" olarak görünür.
import { env } from "cloudflare:workers";

export type Mail = { to: string; subject: string; html: string; text: string };
export type ProviderInfo = { provider: string; ready: boolean; detail: string };

const e = () => env as any;

export function providerInfo(): ProviderInfo {
  const p = String(e().EMAIL_PROVIDER || "log").toLowerCase();
  if (p === "graph") {
    const ready = !!(e().GRAPH_TENANT_ID && e().GRAPH_CLIENT_ID && e().GRAPH_CLIENT_SECRET && e().GRAPH_SENDER);
    return { provider: "graph", ready, detail: ready ? "Outlook (Microsoft Graph) · gönderen: " + e().GRAPH_SENDER : "Graph ayarları eksik" };
  }
  if (p === "webhook") {
    const ready = !!e().EMAIL_WEBHOOK_URL;
    return { provider: "webhook", ready, detail: ready ? "Web kancası (Power Automate / Zapier / SMTP aktarıcı)" : "EMAIL_WEBHOOK_URL eksik" };
  }
  return { provider: "log", ready: false, detail: "Gönderim kapalı: e-postalar yalnızca giden kutusuna yazılır" };
}

let graphToken: { value: string; until: number } | null = null;
async function graphAccessToken() {
  if (graphToken && graphToken.until > Date.now() + 60_000) return graphToken.value;
  const r = await fetch(`https://login.microsoftonline.com/${e().GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e().GRAPH_CLIENT_ID,
      client_secret: e().GRAPH_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const b: any = await r.json().catch(() => ({}));
  if (!r.ok || !b.access_token) throw new Error("Graph oturumu alınamadı: " + (b.error_description || r.status));
  graphToken = { value: b.access_token, until: Date.now() + (b.expires_in || 3000) * 1000 };
  return graphToken.value;
}

/** Tek e-posta gönderir. Hata durumunda istisna fırlatır (giden kutusu tekrar dener). */
export async function sendMail(m: Mail, timeoutMs = 8000): Promise<void> {
  const info = providerInfo();
  if (!info.ready) throw new Error(info.detail);
  const signal = AbortSignal.timeout(timeoutMs);
  if (info.provider === "graph") {
    const token = await graphAccessToken();
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(e().GRAPH_SENDER)}/sendMail`, {
      method: "POST",
      signal,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: m.subject,
          body: { contentType: "HTML", content: m.html },
          toRecipients: [{ emailAddress: { address: m.to } }],
        },
        saveToSentItems: false,
      }),
    });
    if (!r.ok) throw new Error("Graph gönderim hatası " + r.status + ": " + (await r.text()).slice(0, 200));
    return;
  }
  const r = await fetch(e().EMAIL_WEBHOOK_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...(e().EMAIL_WEBHOOK_SECRET ? { "X-Ivme-Secret": e().EMAIL_WEBHOOK_SECRET } : {}) },
    body: JSON.stringify(m),
  });
  if (!r.ok) throw new Error("Web kancası hatası " + r.status);
}
