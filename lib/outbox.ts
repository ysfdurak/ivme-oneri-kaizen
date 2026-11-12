// Giden kutusu: bildirimler önce veritabanına yazılır, sonra gönderilir. Gönderim başarısız olursa
// en fazla 5 kez tekrar denenir; hiçbir işlem e-posta yüzünden başarısız olmaz.
// Kişinin tercihi "digest" ise e-postalar bekletilir ve günde bir kez özet olarak gider.
// Günlük işler (özet, gecikme hatırlatması) "tick" ile çalışır: uygulama kullanıldıkça kendiliğinden
// tetiklenir; istenirse /api/notify/run adresi bir zamanlayıcıyla (cron, Power Automate) çağrılabilir.
import { db } from "./server";
import { sendMail, providerInfo } from "./mailer";
import { buildMessages, buildReminders, combine, Message, NotifyEvent, Recipient } from "./notify";
import type { Proposal, State } from "./model";

let schemaReady = false;
/** Eski kurulumlarda eksik tablo ve sütunları tamamlar (migrasyon dosyasıyla aynı yapı). */
export async function ensureSchema() {
  if (schemaReady) return;
  const run = async (sql: string) => {
    try {
      await db().prepare(sql).run();
    } catch {
      /* sütun zaten var */
    }
  };
  await run("ALTER TABLE users ADD COLUMN email TEXT");
  await run("ALTER TABLE users ADD COLUMN notify TEXT NOT NULL DEFAULT 'instant'");
  await run(
    "CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, user_id TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, text TEXT NOT NULL, event_key TEXT NOT NULL, proposal_id TEXT, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, sent_at INTEGER)",
  );
  await run("CREATE INDEX IF NOT EXISTS outbox_status ON outbox(status, created_at)");
  await run("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  schemaReady = true;
}

async function recipients(): Promise<Recipient[]> {
  return (await db().prepare("SELECT id,name,email,active,manager,notify,role FROM users").all<any>()).results;
}

/** E-postaları giden kutusuna yazar. Özet tercihi olanlarınki "digest" durumunda bekler. */
export async function enqueue(messages: Message[]) {
  if (!messages.length) return;
  const prefs = new Map((await recipients()).map((r) => [r.id, r.notify || "instant"]));
  await db().batch(
    messages.map((m) =>
      db()
        .prepare(
          "INSERT INTO outbox (id,created_at,user_id,email,subject,html,text,event_key,proposal_id,status,attempts) VALUES (?,?,?,?,?,?,?,?,?,?,0)",
        )
        .bind(crypto.randomUUID(), Date.now(), m.userId, m.email, m.subject, m.html, m.text, m.eventKey, m.proposalId || null,
          prefs.get(m.userId) === "digest" && !["test", "account", "daily"].includes(m.eventKey) ? "digest" : "pending"),
    ),
  );
}

/** Bekleyen e-postaları gönderir. Sağlayıcı ayarlı değilse dokunmaz (kayıtlar bekler). */
export async function processOutbox(limit = 20) {
  if (!providerInfo().ready) return { sent: 0, failed: 0 };
  const rows = (
    await db()
      .prepare("SELECT * FROM outbox WHERE status IN ('pending','retry') AND attempts < 5 ORDER BY created_at LIMIT ?")
      .bind(limit)
      .all<any>()
  ).results;
  let sent = 0,
    failed = 0;
  for (const r of rows) {
    try {
      await sendMail({ to: r.email, subject: r.subject, html: r.html, text: r.text });
      await db().prepare("UPDATE outbox SET status='sent', sent_at=?, attempts=attempts+1, last_error=NULL WHERE id=?").bind(Date.now(), r.id).run();
      sent++;
    } catch (err: any) {
      await db()
        .prepare("UPDATE outbox SET status=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'retry' END, attempts=attempts+1, last_error=? WHERE id=?")
        .bind(String(err?.message || err).slice(0, 300), r.id)
        .run();
      failed++;
    }
  }
  return { sent, failed };
}

/** Süreç olaylarını e-postalara çevirip kuyruğa ekler ve hemen göndermeyi dener. */
export async function notifyEvents(events: NotifyEvent[], state: State, appUrl: string) {
  if (!events.length) return;
  await ensureSchema();
  const msgs = buildMessages(events, state.proposals, await recipients(), {
    disabled: state.settings?.notify?.disabled,
    appUrl,
  });
  // Toplu devir gibi tek işlemde birine çok e-posta düşecekse tek özet e-postada birleştir.
  const byUser = new Map<string, number>();
  for (const m of msgs) byUser.set(m.userId, (byUser.get(m.userId) || 0) + 1);
  const many = msgs.filter((m) => (byUser.get(m.userId) || 0) > 3);
  const few = msgs.filter((m) => (byUser.get(m.userId) || 0) <= 3);
  await enqueue([...few, ...combine(many, "Toplu güncelleme", appUrl)]);
  await processOutbox(10);
}

const trDate = (t = Date.now()) => new Date(t + 3 * 3600_000).toISOString().slice(0, 10); // Türkiye saati (UTC+3)
const trHour = (t = Date.now()) => new Date(t + 3 * 3600_000).getUTCHours();

/** Günlük işler: 07:00'den sonra günde bir kez gecikme hatırlatmaları ve özet e-postalar.
 * Her çağrıda en fazla bir kez çalışır (kv tablosunda son çalışma günü tutulur). */
export async function tick(state: State, appUrl: string, force = false) {
  await ensureSchema();
  const today = trDate();
  const last = await db().prepare("SELECT v FROM kv WHERE k='daily'").first<any>();
  if (!force && (last?.v === today || trHour() < 7)) {
    await processOutbox(10);
    return { ran: false };
  }
  await db().prepare("INSERT INTO kv (k,v) VALUES ('daily',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(today).run();
  const people = await recipients();
  const reminders = buildReminders(state.proposals as Proposal[], people, {
    disabled: state.settings?.notify?.disabled,
    appUrl,
    escalateAfterDays: state.settings?.notify?.escalateAfterDays ?? 5,
    today,
  });
  // Hatırlatmalar zaten kişi başına tek e-posta (tablolu günlük gecikme özeti).
  await enqueue(reminders);
  // Özet tercihli kişilerin bekleyen e-postaları tek e-postada birleşir.
  const waiting = (await db().prepare("SELECT * FROM outbox WHERE status='digest' ORDER BY created_at").all<any>()).results;
  if (waiting.length) {
    const asMsgs: Message[] = waiting.map((r: any) => ({ userId: r.user_id, email: r.email, subject: r.subject, html: r.html, text: r.text, eventKey: r.event_key }));
    const digests = combine(asMsgs, "Günlük özet", appUrl).map((m) => (m.eventKey === "digest" ? m : { ...m, eventKey: "digest" }));
    await db().batch(waiting.map((r: any) => db().prepare("UPDATE outbox SET status='merged' WHERE id=?").bind(r.id)));
    await db().batch(
      digests.map((m) =>
        db()
          .prepare("INSERT INTO outbox (id,created_at,user_id,email,subject,html,text,event_key,proposal_id,status,attempts) VALUES (?,?,?,?,?,?,?,?,?,'pending',0)")
          .bind(crypto.randomUUID(), Date.now(), m.userId, m.email, m.subject, m.html, m.text, "digest", null),
      ),
    );
  }
  await processOutbox(30);
  return { ran: true, reminders: reminders.length, digests: waiting.length };
}

export async function recentOutbox(limit = 40) {
  await ensureSchema();
  const rows = (
    await db()
      .prepare("SELECT id,created_at,user_id,email,subject,event_key,status,attempts,last_error,sent_at FROM outbox ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all<any>()
  ).results;
  const counts = (await db().prepare("SELECT status, COUNT(*) AS n FROM outbox GROUP BY status").all<any>()).results;
  return { rows, counts };
}
