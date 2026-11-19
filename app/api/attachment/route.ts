import { current, db, json, users, wsId } from "../../../lib/server";
import { canSee } from "../../../lib/model";
import { migrateState } from "../../../lib/migrate";
/** Bir önerinin ek dosyasını, kullanıcı o öneriyi görebiliyorsa döner: /api/attachment?id=KZ-2026-0001&i=0 */
export async function GET(req: Request) {
  const u = await current(req);
  if (!u) return json({ error: "Oturum açın." }, 401);
  if (u.must_change) return json({ error: "Önce şifrenizi değiştirin." }, 403);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const index = Number(url.searchParams.get("i"));
  const row = await db().prepare("SELECT data FROM workspace WHERE id=?").bind(wsId(req)).first<any>();
  const allUsers = await users();
  const state = migrateState(JSON.parse(row.data), allUsers);
  const p = state.proposals.find((p: any) => p.id === id);
  const a = p && canSee(p, u, { users: allUsers, matrix: state.matrix, org: state.settings?.org }) ? p.attachments?.[index] : null;
  if (!a) return json({ error: "Dosya bulunamadı." }, 404);
  const match = /^data:([^;]+);base64,(.*)$/.exec(a.data || "");
  if (!match) return json({ error: "Dosya okunamadı." }, 500);
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(a.name),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
