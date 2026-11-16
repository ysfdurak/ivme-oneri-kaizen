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
