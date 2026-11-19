// Canlı vitrin demosu (ivme.ysfdurak.com). Örnek veri lib/vitrin/*.json dosyalarındadır; üretmek için:
//   IVME_OLCEK=0.4 IVME_CIKTI=lib/vitrin npx tsx scripts/test-verisi/uret.ts
// Sıfırlamada tüm tarihler bugüne kaydırılır (veri hep "güncel" görünür), kullanıcılar ve oturumlar yeniden yazılır.
// Vitrin kullanıcılarının şifresi yoktur: giriş yalnız rol düğmesiyle yapılır.
import { db, ensureBaseSchema } from "./server";
import { ensureSchema } from "./outbox";
import { ensureTokenSchema } from "./tokens";
import { getLocale } from "./i18n";
import demoState from "./vitrin/state.json";
import demoUsers from "./vitrin/users.json";
// İngilizce demo (IVME_LANG=en): aynı yapıda, İngilizce metinli örnek veri.
//   IVME_DIL=en IVME_OLCEK=0.4 IVME_CIKTI=lib/vitrin/en npx tsx scripts/test-verisi/uret.ts
import demoStateEn from "./vitrin/en/state.json";
import demoUsersEn from "./vitrin/en/users.json";
/** Kurulumun diline göre vitrin verisi. */
export const showcaseData = () =>
  getLocale() === "en"
    ? { state: demoStateEn as any, users: demoUsersEn as any[] }
    : { state: demoState as any, users: demoUsers as any[] };

export const SHOWCASE_ROLES: {
  username: string;
  label: string;
  hint: string;
}[] = [
  {
    username: "calisan",
    label: "Çalışan",
    hint: "Öneri ver, durumunu izle, teşekkür al",
  },
  {
    username: "on.lojistik",
    label: "Ön değerlendirme",
    hint: "Gelen önerileri kabul et, yönlendir ya da reddet",
  },
  {
    username: "op.lojistik",
    label: "Bölüm sorumlusu",
    hint: "Değerlendir, aksiyon planla, uygula",
  },
  {
    username: "mudur.lojistik",
    label: "Müdür",
    hint: "Kazanç onayı, ekibin gecikmeleri, pano",
  },
  {
    username: "ik",
    label: "İK · ödül",
    hint: "Ödül önerilerini onayla, ödendi işaretle",
  },
  {
    username: "admin",
    label: "Sistem yöneticisi",
    hint: "Tanımlar, raporlar, eski öneri aktarımı",
  },
];
export const SHOWCASE_USERNAMES = new Set(
  SHOWCASE_ROLES.map((r) => r.username),
);

const DAY = 86400000;
/** JSON metnindeki tüm tarihleri delta kadar ileri kaydırır (ISO zaman ve YYYY-AA-GG biçimleri). */
export function rebase(raw: string, from: string, now = Date.now()) {
  const delta = now - Date.parse(from);
  const days = Math.round(delta / DAY);
  return raw.replace(
    /"(\d{4}-\d\d-\d\d)(T\d\d:\d\d:\d\d(?:\.\d+)?Z)?"/g,
    (_m, d: string, t?: string) =>
      t
        ? '"' + new Date(Date.parse(d + t) + delta).toISOString() + '"'
        : '"' +
          new Date(Date.parse(d + "T12:00:00Z") + days * DAY)
            .toISOString()
            .slice(0, 10) +
          '"',
  );
}

export async function resetShowcase(now = Date.now()) {
  await ensureBaseSchema();
  await ensureSchema();
  await ensureTokenSchema();
  const demo = showcaseData();
  const { _builtAt, ...state } = demo.state;
  const data = rebase(JSON.stringify(state), _builtAt, now);
  const ins = (u: any) =>
    db()
      .prepare(
        "INSERT INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until,email,notify) VALUES (?,?,?,?,?,?,?,?,0,?,0,0,NULL,'instant')",
      )
      // "vitrin:" ile başlayan değer hiçbir şifreyle eşleşmez: giriş yalnız rol düğmesiyle.
      .bind(
        u.id,
        u.username,
        u.name,
        u.department,
        u.directorate,
        u.role,
        u.manager || "",
        "vitrin:yok",
        u.active ?? 1,
      );
  await db().batch([
    db().prepare("DELETE FROM sessions"),
    db().prepare("DELETE FROM users"),
    db().prepare("DELETE FROM workspace"),
    db().prepare("DELETE FROM outbox"),
    db().prepare("DELETE FROM api_tokens"),
    db().prepare("DELETE FROM kv"),
    ...demo.users.map(ins),
    db()
      .prepare("INSERT INTO workspace (id,data,version) VALUES ('main',?,1)")
      .bind(data),
    db()
      .prepare("INSERT INTO kv (k,v) VALUES ('vitrin_sifirlama',?)")
      .bind(new Date(now).toISOString()),
  ]);
}

// ---- Ziyaretçiye özel çalışma alanı ----
// Ortak vitrinde bir ziyaretçinin yazdığı öneri ve eklediği fotoğraf başka ziyaretçiye görünüyordu. Artık her ziyaretçi
// kendi alanında çalışır: "main" kaydı yalnız şablondur; ziyaretçiye ondan küçültülmüş bir kopya (VISITOR_PROPOSALS öneri)
// "v:<uuid>" adıyla açılır. Kullanıcı tablosu ortak kalır; onu değiştiren işlemler vitrinde kapalıdır (api/command).
export const VISITOR_PROPOSALS = 45;
export const MAX_VISITOR_SPACES_DAY = 600;
export const MAX_VISITOR_SPACES_IP_HOUR = 20;

/** Şablondan ziyaretçi alanı için küçük ama dolu bir örnek. Önce demo rollerinin (çalışan, değerlendirici, müdür, İK…)
 * önünde iş olan ya da yazdığı öneriler ve ödüllü öneriler alınır; kalan yer her durumdan sırayla doldurulur. */
export function trimState(state: any, roleIds: Set<string> = showcaseRoleIds(), n = VISITOR_PROPOSALS) {
  const all: any[] = state.proposals || [];
  const rewarded = new Set((state.rewards || []).map((r: any) => r.proposalId));
  const kept: any[] = [],
    ids = new Set<string>();
  const take = (p: any) => {
    if (kept.length < n && !ids.has(p.id)) {
      kept.push(p);
      ids.add(p.id);
    }
  };
  for (const p of all) if (roleIds.has(p.author) || roleIds.has(p.owner)) take(p);
  for (const p of all) if (rewarded.has(p.id)) take(p);
  const byStatus = new Map<string, any[]>();
  for (const p of all) byStatus.set(p.status, [...(byStatus.get(p.status) || []), p]);
  const groups = [...byStatus.values()];
  for (let i = 0; kept.length < n && groups.some((g) => g.length > i); i++) for (const g of groups) if (g[i]) take(g[i]);
  kept.sort((a, b) => String(a.created).localeCompare(String(b.created)));
  return {
    ...state,
    proposals: kept,
    rewards: (state.rewards || []).filter((r: any) => ids.has(r.proposalId)),
    _events: (state._events || []).filter((e: any) => !e.proposalId || ids.has(e.proposalId)),
  };
}
/** Rol düğmeleriyle girilen demo kullanıcılarının kimlikleri. */
export function showcaseRoleIds() {
  return new Set(showcaseData().users.filter((u: any) => SHOWCASE_USERNAMES.has(u.username)).map((u: any) => u.id));
}

async function ipKey(ip: string, now: number) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ivme-vitrin:" + ip));
  const h = Array.from(new Uint8Array(d).slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
  return `vitrin_ip:${h}:${Math.floor(now / 3600000)}`;
}

/** Ziyaretçi alanını yoksa kurar. Dönüş: "ok" ya da "full" (kötüye kullanım sınırı doldu). */
export async function ensureVisitorWorkspace(scope: string, ip = "", now = Date.now()) {
  const id = "v:" + scope;
  if (await db().prepare("SELECT id FROM workspace WHERE id=?").bind(id).first()) return "ok";
  const count = await db().prepare("SELECT COUNT(*) AS n FROM workspace WHERE id LIKE 'v:%'").first<any>();
  if ((count?.n || 0) >= MAX_VISITOR_SPACES_DAY) return "full";
  if (ip) {
    const key = await ipKey(ip, now);
    const row = await db()
      .prepare("INSERT INTO kv (k,v) VALUES (?, '1') ON CONFLICT(k) DO UPDATE SET v=CAST(v AS INTEGER)+1 RETURNING v")
      .bind(key)
      .first<any>();
    if (Number(row?.v) > MAX_VISITOR_SPACES_IP_HOUR) return "full";
  }
  let tpl = await db().prepare("SELECT data FROM workspace WHERE id='main'").first<any>();
  if (!tpl) {
    await resetShowcase(now);
    tpl = await db().prepare("SELECT data FROM workspace WHERE id='main'").first<any>();
  }
  const data = JSON.stringify(trimState(JSON.parse(tpl.data)));
  await db().prepare("INSERT OR IGNORE INTO workspace (id,data,version) VALUES (?,?,1)").bind(id, data).run();
  return "ok";
}
