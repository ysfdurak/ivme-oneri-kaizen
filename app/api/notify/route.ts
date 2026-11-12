import { current, db, json, sameOrigin, users } from "../../../lib/server";
import { migrateState } from "../../../lib/migrate";
import { providerInfo } from "../../../lib/mailer";
import { enqueue, processOutbox, recentOutbox, tick, ensureSchema } from "../../../lib/outbox";
import { renderEmail } from "../../../lib/notify";
import { env } from "cloudflare:workers";
/** E-posta bildirim yönetimi.
 * GET  (yönetici): sağlayıcı durumu ve son e-postalar (giden kutusu).
 * POST {action:"test"} (yönetici): yöneticinin kendi adresine test e-postası.
 * POST {action:"run"}: günlük işleri hemen çalıştırır. Yönetici oturumu ya da X-Ivme-Cron başlığında
 *      NOTIFY_CRON_SECRET ile dış zamanlayıcıdan (cron, Power Automate) çağrılabilir.
 * POST {action:"retry"} (yönetici): başarısız e-postaları yeniden kuyruğa alır. */
const appUrl = (req: Request) => String((env as any).APP_URL || new URL(req.url).origin).replace(/\/$/, "");
export async function GET(req: Request) {
  const u = await current(req);
  if (!u || u.role !== "admin") return json({ error: "Yetkiniz yok." }, 403);
  return json({ provider: providerInfo(), ...(await recentOutbox(40)), cron: !!(env as any).NOTIFY_CRON_SECRET });
}
export async function POST(req: Request) {
  const b: any = await req.json().catch(() => ({}));
  const secret = (env as any).NOTIFY_CRON_SECRET;
  const viaCron = b.action === "run" && secret && req.headers.get("x-ivme-cron") === secret;
  const u = viaCron ? null : await current(req);
  if (!viaCron && (!sameOrigin(req) || !u || u.role !== "admin")) return json({ error: "Yetkiniz yok." }, 403);
  await ensureSchema();
  if (b.action === "test") {
    const me: any = await db().prepare("SELECT id,email FROM users WHERE id=?").bind(u.id).first();
    if (!me?.email) return json({ error: "Önce Kullanıcılar sayfasından kendi e-posta adresini gir." }, 400);
    const { html, text } = renderEmail("Test e-postası", ["İvme e-posta bildirimleri çalışıyor.", "Sağlayıcı: " + providerInfo().detail], { url: appUrl(req), label: "İvme'yi aç" });
    await enqueue([{ userId: me.id, email: me.email, subject: "[İvme] Test e-postası", html, text, eventKey: "test" }]);
    const r = await processOutbox(5);
    return json({ ok: true, ...r, provider: providerInfo() });
  }
  if (b.action === "retry") {
    await db().prepare("UPDATE outbox SET status='retry', attempts=0 WHERE status='failed'").run();
    return json({ ok: true, ...(await processOutbox(30)) });
  }
  if (b.action === "run") {
    const row = await db().prepare("SELECT data FROM workspace WHERE id=?").bind("main").first<any>();
    const state = migrateState(JSON.parse(row.data), await users());
    return json({ ok: true, ...(await tick(state, appUrl(req), true)) });
  }
  return json({ error: "Geçersiz işlem." }, 400);
}
