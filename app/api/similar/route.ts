import { current, db, json, users, sameOrigin } from "../../../lib/server";
import { canSee } from "../../../lib/model";
import { migrateState } from "../../../lib/migrate";
import { findSimilarSafe } from "../../../lib/similarity";
/** Benzer öneriler.
 * GET  /api/similar?id=KZ-...   → kayıtlı bir önerinin benzerleri (öneriyi görebilen herkes).
 * POST /api/similar {title, problem, solution, operation, category} → gönderim öncesi uyarı.
 * Benzer kayıtlardan yalnızca özet bilgi döner (numara, başlık, bölüm, durum, eşleşme nedeni);
 * detayı açabilme bilgisi (canOpen) kullanıcının görme yetkisine göre verilir. */
async function run(req: Request, input: any) {
  const u = await current(req);
  if (!u) return json({ error: "Oturum açın." }, 401);
  if (u.must_change) return json({ error: "Önce şifrenizi değiştirin." }, 403);
  const row = await db().prepare("SELECT data FROM workspace WHERE id=?").bind("main").first<any>();
  const allUsers = await users();
  const state = migrateState(JSON.parse(row.data), allUsers);
  const ctx = { users: allUsers, matrix: state.matrix, org: state.settings?.org };
  let target = input;
  if (input.id) {
    const p = state.proposals.find((x: any) => x.id === input.id);
    if (!p || !canSee(p, u, ctx)) return json({ error: "Öneri bulunamadı." }, 404);
    target = p;
  }
  if (!target?.title) return json({ items: [] });
  const { hits } = await findSimilarSafe(target, state.proposals, state.settings?.synonyms || []);
  return json({
    items: hits.map((h) => ({
      id: h.proposal.id,
      title: h.proposal.title,
      operation: h.proposal.operation,
      status: h.proposal.status,
      created: h.proposal.created,
      score: h.score,
      shared: h.shared,
      sameOperation: h.sameOperation,
      canOpen: canSee(h.proposal, u, ctx),
    })),
  });
}
export async function GET(req: Request) {
  return run(req, { id: new URL(req.url).searchParams.get("id") });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Geçersiz istek." }, 403);
  const b: any = await req.json().catch(() => ({}));
  return run(req, {
    title: String(b.title || "").slice(0, 200),
    problem: String(b.problem || "").slice(0, 3000),
    solution: String(b.solution || "").slice(0, 3000),
    operation: String(b.operation || ""),
    category: String(b.category || ""),
  });
}
