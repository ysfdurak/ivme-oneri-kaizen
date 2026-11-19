import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { LANG_COOKIE, localeFrom, setLocale } from "../lib/i18n";

/** Sunucuda üretilen metinlerin (e-posta, MCP) dili kurulumun varsayılanıdır: IVME_LANG (tr | en). */
const serverLocale = (env: Cloudflare.Env) => setLocale(localeFrom((env as any).IVME_LANG) ?? "tr");

/** Adresteki ?lang=en|tr seçimi çereze yazılır ve parametresiz adrese yönlendirilir. */
function languageRedirect(request: Request): Response | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const lang = localeFrom(url.searchParams.get("lang"));
  if (!url.searchParams.has("lang")) return null;
  url.searchParams.delete("lang");
  // "//kotu-site.com/?lang=en" gibi bir adreste pathname "//kotu-site.com/" olur ve tarayıcı
  // Location'ı başka siteye giden adres sayar (açık yönlendirme). Baştaki eğik çizgiler teke indirilir.
  const path = "/" + url.pathname.replace(/^[/\\]+/, "");
  const headers = new Headers({ Location: path + url.search + url.hash, "Cache-Control": "no-store" });
  if (lang)
    headers.append("Set-Cookie", `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
  return new Response(null, { status: 302, headers });
}

// Worker'ın ürettiği her yanıta temel güvenlik başlıkları; statik dosyalar aynılarını
// public/_headers ile alır. Uygulamanın kendi koyduğu başlığın üzerine yazılmaz.
const GUVENLIK_BASLIKLARI: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};
function guvenlikBasliklari(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(GUVENLIK_BASLIKLARI)) if (!out.headers.has(k)) out.headers.set(k, v);
  return out;
}

const worker = {
  async fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    return guvenlikBasliklari(await uygulama(request, env, ctx));
  },
  // Zamanlanmış görev (wrangler.jsonc → triggers.crons): vitrin demosunda her gece veriyi sıfırlar.
  async scheduled(
    _event: ScheduledController,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ) {
    serverLocale(env);
    if (String((env as any).IVME_VITRIN ?? "0") !== "1") return;
    const { resetShowcase } = await import("../lib/vitrin");
    ctx.waitUntil(resetShowcase());
  },
};

async function uygulama(
  request: Request,
  env: Cloudflare.Env,
  ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
) {
    serverLocale(env);
    const redirect = languageRedirect(request);
    if (redirect) return redirect;
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt)
            return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: "request_context_expired",
              message: "This request has expired. Please try again.",
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () =>
      handler.fetch(request, env, ctx),
    );
}

export default worker;
