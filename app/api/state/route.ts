import { current, db, json, users } from "../../../lib/server";
import { canSee, redactProposal } from "../../../lib/model";
import { migrateState } from "../../../lib/migrate";
import { tick } from "../../../lib/outbox";
import { env } from "cloudflare:workers";
/** Çalışma alanını kullanıcının görme yetkisine göre süzerek döner.
 * - Ek dosyaların içeriği gönderilmez; yalnızca adı ve boyutu gider (içerik /api/attachment ile istenir).
 * - İstemci elindeki sürümü (?v=) gönderirse ve değişiklik yoksa kayıtlar tekrar gönderilmez. */
export async function GET(req: Request) {
  const u = await current(req);
  if (!u) return json({ error: "Oturum açın." }, 401);
  if (u.must_change) return json({ error: "Önce şifrenizi değiştirin." }, 403);
  const known = Number(new URL(req.url).searchParams.get("v"));
  const allUsers = await users();
  // Yönetici dışındaki roller kullanıcı adlarını görmez; seçim listeleri için ad ve rol yeterli.
  const visibleUsers =
    u.role === "admin"
      ? allUsers
      : allUsers.map(({ username, mustChange, email, notify, ...rest }: any) =>
          rest.id === u.id
            ? { ...rest, email, notify }
            : // Ödül sorumlusu (İK) bordro listesi için kullanıcı adını (sicil) görür.
              u.role === "reward"
              ? { ...rest, username }
              : rest,
        );
  const head = await db()
    .prepare("SELECT version FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  if (known && head && known === head.version)
    return json({
      unchanged: true,
      version: head.version,
      users: visibleUsers,
    });
  const row = await db()
    .prepare("SELECT * FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  const state = migrateState(JSON.parse(row.data), allUsers);
  // Günlük bildirim işleri (gecikme hatırlatması, özet) uygulama kullanıldıkça kendiliğinden çalışır.
  try {
    await tick(
      state,
      String((env as any).APP_URL || new URL(req.url).origin).replace(
        /\/$/,
        "",
      ),
    );
  } catch (err) {
    console.error("Günlük bildirim hatası", err);
  }
  state.proposals = state.proposals
    .filter((p: any) =>
      canSee(p, u, {
        users: allUsers,
        matrix: state.matrix,
        org: state.settings?.org,
      }),
    )
    .map((p: any) => ({
      // Anonim önerilerde önerenin kimliği yalnızca önerenin kendisine gider.
      ...redactProposal(p, u.id),
      attachments: (p.attachments || []).map((a: any, i: number) => ({
        index: i,
        name: a.name,
        kind: a.kind || "",
        size: Math.round(((a.data || "").length * 3) / 4),
        type: (a.data || "").slice(5, (a.data || "").indexOf(";")),
      })),
    }));
  if (u.role !== "admin") state.audit = [];
  // Ödül kayıtları: ödül sorumlusu (İK) ve sistem yöneticisi hepsini, diğerleri yalnız kendilerine ait olanları görür.
  if (!["admin", "reward"].includes(u.role))
    state.rewards = (state.rewards || []).filter((r) =>
      r.recipients.some((x) => x.userId === u.id),
    );
  return json({ state, version: row.version, users: visibleUsers });
}
