// Kişisel MCP erişim anahtarları (yapay zekâ paketi).
// Anahtar yalnızca oluşturulduğu an bir kez gösterilir; veritabanında özeti (SHA-256) tutulur.
// Anahtar, sahibinin yetkisiyle çalışır: kişi pasife alınırsa ya da MCP kapatılırsa anahtar da çalışmaz.
import { db, hash } from "./server";

export const TOKEN_DAYS = 90;
export const MAX_TOKENS = 3;
let ready = false;
export async function ensureTokenSchema() {
  if (ready) return;
  await db()
    .prepare(
      "CREATE TABLE IF NOT EXISTS api_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_used_at INTEGER)",
    )
    .run();
  await db()
    .prepare(
      "CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens(user_id)",
    )
    .run();
  ready = true;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    "ivme_" +
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}

export async function listTokens(userId: string) {
  await ensureTokenSchema();
  return (
    await db()
      .prepare(
        "SELECT id,name,created_at,expires_at,last_used_at FROM api_tokens WHERE user_id=? ORDER BY created_at DESC",
      )
      .bind(userId)
      .all<any>()
  ).results;
}

export async function createToken(userId: string, name: string) {
  await ensureTokenSchema();
  const now = Date.now();
  const live = (await listTokens(userId)).filter(
    (t: any) => t.expires_at > now,
  );
  if (live.length >= MAX_TOKENS)
    throw new Error(
      "En fazla " +
        MAX_TOKENS +
        " geçerli anahtarın olabilir; önce birini iptal et.",
    );
  const token = randomToken();
  const id = crypto.randomUUID();
  await db()
    .prepare(
      "INSERT INTO api_tokens (id,user_id,hash,name,created_at,expires_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(
      id,
      userId,
      await hash(token),
      name.slice(0, 60) || "Anahtar",
      now,
      now + TOKEN_DAYS * 86400000,
    )
    .run();
  return { id, token, expires_at: now + TOKEN_DAYS * 86400000 };
}

export async function revokeToken(userId: string, id: string) {
  await ensureTokenSchema();
  const r = await db()
    .prepare("DELETE FROM api_tokens WHERE id=? AND user_id=?")
    .bind(id, userId)
    .run();
  return r.meta.changes > 0;
}

/** Bearer anahtarından aktif kullanıcıyı bulur (süresi geçmemiş, kişi aktif ve şifresini belirlemiş). */
export async function userFromToken(req: Request) {
  const m = req.headers
    .get("authorization")
    ?.match(/^Bearer\s+(ivme_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  await ensureTokenSchema();
  const h = await hash(m[1]);
  const u = await db()
    .prepare(
      "SELECT users.*, api_tokens.id AS token_id FROM api_tokens JOIN users ON users.id=api_tokens.user_id WHERE api_tokens.hash=? AND api_tokens.expires_at>? AND users.active=1 AND users.must_change=0",
    )
    .bind(h, Date.now())
    .first<any>();
  if (u)
    await db()
      .prepare("UPDATE api_tokens SET last_used_at=? WHERE id=?")
      .bind(Date.now(), u.token_id)
      .run();
  return u;
}
