import { current, db, json, users } from "../../../lib/server";
import { canSee } from "../../../lib/model";
import { migrateState } from "../../../lib/migrate";
import { buildRecognition } from "../../../lib/recognition";
/** Tanınma ekranı: GET /api/recognition?gun=30|90|365
 * Herkes tamamlanmış iyileştirmeleri ve departman katılımını görür; kişisel özet yalnız kişinin kendisine döner.
 * Tanımlar'dan kapatıldıysa { enabled: false } döner. */
export async function GET(req: Request) {
  const u = await current(req);
  if (!u) return json({ error: "Oturum açın." }, 401);
  if (u.must_change) return json({ error: "Önce şifrenizi değiştirin." }, 403);
  const row = await db()
    .prepare("SELECT data FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  const allUsers = await users();
  const state = migrateState(JSON.parse(row.data), allUsers);
  if (state.settings?.recognition === false) return json({ enabled: false });
  const days = Number(new URL(req.url).searchParams.get("gun")) || 90;
  const r = buildRecognition(state, allUsers as any, u.id, new Date(), days);
  const ctx = {
    users: allUsers,
    matrix: state.matrix,
    org: state.settings?.org,
  };
  const byId = new Map(state.proposals.map((p) => [p.id, p]));
  return json({
    enabled: true,
    ...r,
    highlights: r.highlights.map((h) => ({
      ...h,
      canOpen: canSee(byId.get(h.id)!, u, ctx),
    })),
  });
}
