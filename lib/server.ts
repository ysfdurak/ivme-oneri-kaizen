import { env } from "cloudflare:workers";
import { DEMO_USERS, initialState } from "./seed";
import { editionFrom } from "./edition";
/** Kurulu ürün paketi (lib/edition.ts). */
export const edition = () => editionFrom((env as any).IVME_EDITION);
export const db = () => {
  if (!env.DB) throw new Error("Veri tabanı bağlantısı bulunamadı.");
  return env.DB;
};
const enc = new TextEncoder();
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
/** Tek kullanımlık geçici şifre: karışmayan harf ve rakamlardan 6 karakter + tire + 3 rakam (ör. "k7pm2x-418").
 * Kişi ilk girişte kendi şifresini belirlemek zorundadır (must_change=1). Şifre yalnızca bir kez, yöneticiye gösterilir. */
export function tempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const head = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => chars[x % chars.length]).join("");
  return head + "-" + (100 + (crypto.getRandomValues(new Uint16Array(1))[0] % 900));
}
export async function password(s: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(s),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return (
    salt +
    ":" +
    Array.from(new Uint8Array(bits))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}
let baseReady = false;
/** Boş bir D1 veritabanında temel tabloları kurar (drizzle/0000 göçüyle aynı yapı).
 * Böylece ilk yayında ayrıca "migrations apply" çalıştırmak gerekmez. */
export async function ensureBaseSchema() {
  if (baseReady) return;
  await db().batch([
    db().prepare(
      "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, expires INTEGER NOT NULL)",
    ),
    db().prepare(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, department TEXT NOT NULL, directorate TEXT NOT NULL, role TEXT NOT NULL, manager TEXT, password TEXT NOT NULL, must_change INTEGER DEFAULT 1 NOT NULL, active INTEGER DEFAULT 1 NOT NULL, failures INTEGER DEFAULT 0 NOT NULL, locked_until INTEGER DEFAULT 0 NOT NULL, email TEXT, notify TEXT DEFAULT 'instant' NOT NULL)",
    ),
    db().prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)",
    ),
    db().prepare(
      "CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, version INTEGER DEFAULT 1 NOT NULL)",
    ),
  ]);
  baseReady = true;
}
export async function seed() {
  await ensureBaseSchema();
  const found = await db()
    .prepare("SELECT id FROM workspace WHERE id=?")
    .bind("main")
    .first();
  if (found) return;
  if (showcase()) {
    const { resetShowcase } = await import("./vitrin");
    return void (await resetShowcase());
  }
  const pass = await password("Kaizen123!");
  await db().batch([
    ...DEMO_USERS.map((u) =>
      db()
        .prepare(
          "INSERT OR IGNORE INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until) VALUES (?,?,?,?,?,?,?,?,1,1,0,0)",
        )
        .bind(
          u.id,
          u.username,
          u.name,
          u.department,
          "Lojistik Müdürlüğü",
          u.role,
          u.manager,
          pass,
        ),
    ),
    db()
      .prepare(
        "INSERT OR IGNORE INTO workspace (id,data,version) VALUES (?,?,1)",
      )
      .bind("main", JSON.stringify(initialState())),
  ]);
}
export function publicUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    department: u.department,
    directorate: u.directorate,
    role: u.role,
    manager: u.manager,
    mustChange: u.must_change,
    active: u.active,
    email: u.email || "",
    notify: u.notify || "instant",
  };
}
// Vitrin: her ziyaretçinin kendi çalışma alanı var. Alan kimliği ayrı bir çerezde (ivme_alan) rastgele bir UUID'dir;
// çalışma alanı kaydı "v:<uuid>" adıyla tutulur. Şirket kurulumunda tek kayıt vardır: "main".
const SCOPE_RE = /(?:^|;\s*)ivme_alan=([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:;|$)/;
export function visitorScope(req: Request) {
  return req.headers.get("cookie")?.match(SCOPE_RE)?.[1] || null;
}
/** Bu isteğin çalışma alanı kaydı. Vitrinde alan çerezi yoksa hiçbir kayıtla eşleşmeyen bir ad döner. */
export function wsId(req: Request) {
  if (!showcase()) return "main";
  const scope = visitorScope(req);
  return scope ? "v:" + scope : "v:yok";
}
export function scopeCookie(scope: string, age = 43200) {
  return `ivme_alan=${scope}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
}
export async function current(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|; )ivme_session=([^;]+)/)?.[1];
  if (!token) return null;
  // Vitrinde oturum, ziyaretçinin kendi çalışma alanı varken geçerlidir (gece sıfırlamasında ikisi birlikte silinir).
  if (showcase()) {
    const ws = await db().prepare("SELECT id FROM workspace WHERE id=?").bind(wsId(req)).first();
    if (!ws) return null;
  }
  return db()
    .prepare(
      "SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>? AND users.active=1",
    )
    .bind(await hash(token), Date.now())
    .first<any>();
}
export async function users() {
  return (await db().prepare("SELECT * FROM users").all()).results.map(
    publicUser,
  );
}
export function json(v: any, status = 200, extra: any = {}) {
  return Response.json(v, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  return !o || o === new URL(req.url).origin;
}
export function cookie(token: string, age = 43200) {
  return `ivme_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
}

/** Demo modu: giriş ekranında örnek roller ve başlangıç şifresi gösterilir.
 * Şirket kurulumunda ortam değişkeni IVME_DEMO=0 yapılarak kapatılır. */
/** Canlı vitrin (portföy) demosu: rol düğmesiyle şifresiz giriş, örnek veri, her gece sıfırlama, e-posta yok.
 * Yalnız herkese açık tanıtım kurulumunda IVME_VITRIN=1 yapılır; şirket kurulumunda asla açılmaz. */
export function showcase() {
  return String((env as any).IVME_VITRIN ?? "0") === "1";
}
export function demoMode() {
  if (showcase()) return false;
  return String((env as any).IVME_DEMO ?? "1") !== "0";
}
