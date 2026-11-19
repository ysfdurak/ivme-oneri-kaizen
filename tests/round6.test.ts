// Tur 6: destek talep numarası ve bekleme süresi, anonim öneri, önce/sonra görseli, öneri kampanyaları.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import {
  ANON,
  STAGES,
  activeCampaigns,
  redactProposal,
  supportWaits,
  supportWaitText,
} from "../lib/model";
import { buildMessages, buildReminders } from "../lib/notify";
import { buildRecognition } from "../lib/recognition";

const users: any[] = DEMO_USERS.map((u) => ({
  ...u,
  directorate: "Lojistik Müdürlüğü",
  active: 1,
  email: u.username + "@ornek.test",
  notify: "instant",
}));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const events = () => {
  const e = (s as any)._events || [];
  delete (s as any)._events;
  return e;
};
const op = s.operations[0];
const img = "data:image/jpeg;base64," + Buffer.from("jpeg").toString("base64");
const pdf =
  "data:application/pdf;base64," + Buffer.from("%PDF").toString("base64");
const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const day = (n: number) =>
  new Date(Date.now() + 3 * 3600_000 + n * 86400000).toISOString().slice(0, 10);

// --- Kampanya ---
assert.throws(() =>
  call({ action: "defineCampaigns", campaigns: [] }, by("calisan")),
);
assert.throws(() =>
  call(
    {
      action: "defineCampaigns",
      campaigns: [{ title: "Ters tarih", start: day(5), end: day(1) }],
    },
    by("admin"),
  ),
);
assert.throws(() =>
  call(
    {
      action: "defineCampaigns",
      campaigns: [
        { title: "Alan", start: today, end: day(3), category: "Uydurma" },
      ],
    },
    by("admin"),
  ),
);
call(
  {
    action: "defineCampaigns",
    campaigns: [
      {
        title: "İş güvenliği ayı",
        start: day(-3),
        end: day(10),
        category: "İş güvenliği",
        reward: "Hediye çeki",
      },
      { title: "Gelecek kampanya", start: day(5), end: day(20) },
    ],
  },
  by("admin"),
);
const [open1, future] = s.settings!.campaigns!;
assert.match(open1.id, /^k-/);
assert.deepEqual(
  activeCampaigns(s.settings!.campaigns).map((c) => c.id),
  [open1.id],
);
const base = {
  action: "create",
  problem: "Forklift yolunda işaretleme yok, yayalar karışıyor.",
  solution: "Yaya yolu çizilsin.",
  operation: op,
  category: "İş güvenliği",
};
assert.throws(
  () =>
    call(
      { ...base, title: "Kapalı kampanya", campaign: future.id },
      by("calisan"),
    ),
  /açık değil/,
);
const a = call(
  {
    ...base,
    title: "Yaya yolu işaretlemesi",
    campaign: open1.id,
    attachments: [
      { name: "once.jpg", data: img },
      { name: "plan.pdf", data: pdf },
    ],
  },
  by("calisan"),
)!;
const pa = s.proposals.find((p) => p.id === a)!;
assert.equal(pa.campaign, open1.id);
// Fotoğraf "önce" görseli olarak işaretlenir, PDF işaretsiz kalır.
assert.deepEqual(
  pa.attachments.map((x: any) => x.kind),
  ["before", ""],
);
// Öneri bağlı kampanya silinemez; tarih değiştirilebilir.
assert.throws(
  () => call({ action: "defineCampaigns", campaigns: [future] }, by("admin")),
  /bitiş tarihini/,
);
call(
  {
    action: "defineCampaigns",
    campaigns: [{ ...open1, end: day(12) }, future],
  },
  by("admin"),
);
assert.equal(s.settings!.campaigns![0].id, open1.id, "kimlik korunur");

// --- Anonim öneri ---
assert.throws(() =>
  call(
    {
      ...base,
      title: "Anonim ortaklı",
      anonymous: true,
      coAuthors: ["operasyon"],
    },
    by("calisan"),
  ),
);
events();
const b = call(
  {
    ...base,
    title: "Raf arası aydınlatma yetersiz",
    category: "Ergonomi",
    anonymous: true,
  },
  by("calisan"),
)!;
const pb = s.proposals.find((p) => p.id === b)!;
assert.equal(pb.anonymous, true);
assert.equal(
  pb.author,
  "calisan",
  "gerçek kayıtta öneren saklı (yetki ve bildirim için)",
);
const created = buildMessages(events(), s.proposals, users, { appUrl: "x" });
const toOwner = created.find((m) => m.userId === pb.owner)!;
assert.ok(
  toOwner.text.includes("Anonim") && !toOwner.text.includes(by("calisan").name),
  "değerlendiriciye giden e-postada ad yok",
);
assert.ok(
  created.some((m) => m.userId === "calisan"),
  "öneren alındı bilgisini yine alır",
);
// İstemciye giden kopya: öneren dışındaki herkese ad gizli; önerenin kendisine açık.
const evaluatorView = redactProposal(pb, pb.owner);
assert.equal(evaluatorView.author, ANON);
assert.ok(evaluatorView.history.every((h: any) => h.actor !== "calisan"));
assert.equal(redactProposal(pb, "calisan").author, "calisan");
assert.equal(
  redactProposal(pb, "admin").author,
  ANON,
  "yönetici ekranında da gizli",
);
// Öneren yorum yazınca e-postada adı yerine "Öneren" yazar; revizyonda sorumlu olarak da gizlenir.
call(
  { action: "comment", id: b, text: "Gece vardiyasında daha belirgin." },
  by("calisan"),
);
const cm = buildMessages(events(), s.proposals, users, { appUrl: "x" });
assert.ok(
  cm.length &&
    cm.every(
      (m) =>
        m.subject.includes("Öneren") && !m.subject.includes(by("calisan").name),
    ),
);
assert.equal(redactProposal(pb, pb.owner).comments![0].actor, ANON);
call({ action: "revision", id: b, reason: "Hangi raflar?" }, by(pb.owner));
assert.equal(pb.owner, "calisan");
assert.equal(redactProposal(pb, "admin").owner, ANON);
// Önerenin işleri devredilince (ör. işten ayrıldı) geçmiş metninde adı yazılmaz; eski kayıtlarda ad varsa
// istemciye giden kopyada metinden de silinir. Ayrı bir kopya üzerinde denenir, ana akış etkilenmez.
{
  const s2 = structuredClone(s);
  const name = by("calisan").name;
  const to = users.find((x) => x.id !== "calisan" && x.role !== "admin" && x.active !== 0)!.id;
  applyCommand(s2, { action: "reassignUser", from: "calisan", to, reason: "İşten ayrıldı" }, by("admin"), users);
  const p2 = s2.proposals.find((p: any) => p.id === b)!;
  assert.ok(p2.history.some((h: any) => h.text.startsWith("Kullanıcı devri")), "devir kaydı yazıldı");
  assert.ok(p2.history.every((h: any) => !h.text.includes(name)), "devir metninde önerenin adı yok");
  // Eski kayıt: ad metne yazılmış olsa bile istemciye giden kopyada görünmez; önerenin kendisi görür.
  p2.history.unshift({ at: new Date().toISOString(), actor: "admin", text: "Kullanıcı devri: " + name + " → X" });
  assert.ok(redactProposal(p2, to, name).history.every((h: any) => !h.text.includes(name)), "eski metin de temizlenir");
  assert.ok(redactProposal(p2, "calisan", name).history.some((h: any) => h.text.includes(name)), "önerene açık");
}
call(
  {
    action: "resubmit",
    id: b,
    title: pb.title,
    problem: pb.problem + " B blok 3-7.",
    solution: pb.solution,
  },
  by("calisan"),
);
// Tanınma: anonim tamamlanan öneride ad yerine "Anonim çalışan"; önerenin kendisine adı görünür.
const done = {
  ...structuredClone(pb),
  id: "KZ-ANON",
  status: "Tamamlandı",
  stageAt: new Date().toISOString(),
  score: { total: 90, valid: true },
};
const rs = { ...s, proposals: [...s.proposals, done] } as any;
assert.deepEqual(
  buildRecognition(rs, users, "admin").highlights.find(
    (h) => h.id === "KZ-ANON",
  )!.authors,
  ["Anonim çalışan"],
);
assert.deepEqual(
  buildRecognition(rs, users, "calisan").highlights.find(
    (h) => h.id === "KZ-ANON",
  )!.authors,
  [by("calisan").name],
);
const camp = buildRecognition(rs, users, "calisan").campaigns.find(
  (c) => c.id === open1.id,
)!;
assert.equal(camp.status, "Açık");
assert.equal(camp.submitted, 1);
assert.equal(camp.mine, 1);

// --- Önce/sonra görseli ---
assert.throws(
  () =>
    call(
      {
        action: "addAttachment",
        id: a,
        attachment: { name: "sonra.jpg", data: img },
      },
      by("calisan"),
    ),
  /uygulama başladıktan/,
);
const pre = pa.owner;
call({ action: "accept", id: a, note: "Uygun" }, by(pre));
const opOwner = pa.owner;
call({ action: "accept", id: a, note: "Uygun" }, by(opOwner));
call(
  {
    action: "addAction",
    id: a,
    title: "Zemin çizgisi",
    owner: "teknik",
    due: day(7),
  },
  by(pa.owner),
);
call({ action: "start", id: a }, by(pa.owner));
assert.equal(pa.status, STAGES[3]);
assert.throws(
  () =>
    call(
      {
        action: "addAttachment",
        id: a,
        attachment: { name: "x.jpg", data: img },
      },
      by("it"),
    ),
  /yetki/,
);
assert.throws(() =>
  call(
    {
      action: "addAttachment",
      id: a,
      attachment: {
        name: "x.exe",
        data: "data:application/x-msdownload;base64,AA",
      },
    },
    by("calisan"),
  ),
);
call(
  {
    action: "addAttachment",
    id: a,
    attachment: { name: "sonra.jpg", data: img },
  },
  by("calisan"),
);
call(
  {
    action: "addAttachment",
    id: a,
    attachment: { name: "sonra2.jpg", data: img },
  },
  by("teknik"),
);
assert.deepEqual(
  pa.attachments.map((x: any) => x.kind),
  ["before", "", "after", "after"],
);
call(
  { action: "addAttachment", id: a, attachment: { name: "s3.jpg", data: img } },
  by(pa.owner),
);
call(
  { action: "addAttachment", id: a, attachment: { name: "s4.jpg", data: img } },
  by(pa.owner),
);
assert.throws(
  () =>
    call(
      {
        action: "addAttachment",
        id: a,
        attachment: { name: "s5.jpg", data: img },
      },
      by(pa.owner),
    ),
  /en fazla 6/,
);

// --- Destek talep numarası ---
call(
  { action: "supportFlag", id: a, unit: "IT", selected: true },
  by(pa.owner),
);
const it = pa.support.find((x: any) => x.unit === "IT")!;
assert.ok(it.since, "bekleme başlangıcı kaydedilir");
assert.throws(
  () =>
    call(
      { action: "supportTicket", id: a, itemId: it.id, ticket: "INC-1" },
      by("calisan"),
    ),
  /sorumlusu/,
);
assert.throws(() =>
  call(
    { action: "supportTicket", id: a, itemId: it.id, ticket: "<script>" },
    by(pa.owner),
  ),
);
call(
  { action: "supportTicket", id: a, itemId: it.id, ticket: " INC-10293 " },
  by(pa.owner),
);
assert.equal(it.ticket, "INC-10293");
assert.ok(pa.history[0].text.includes("INC-10293"));
it.since = new Date(Date.now() - 6 * 86400000).toISOString();
const w = supportWaits(pa);
assert.deepEqual(
  w.map((x) => [x.unit, x.ticket, x.days]),
  [["IT", "INC-10293", 6]],
);
assert.equal(supportWaitText(w[0]), "IT bekleniyor · Talep INC-10293 · 6 gün");
// Gecikme e-postası talep numarasını taşır; müdüre giden e-posta gecikmenin destek biriminde olduğunu söyler.
const late = structuredClone(pa);
late.stageAt = new Date(Date.now() - 60 * 86400000).toISOString();
const mgr = users.map((u) =>
  u.id === late.owner ? { ...u, manager: "mudur" } : u,
);
const rem = buildReminders([late], mgr, { appUrl: "x", escalateAfterDays: 3 });
assert.ok(
  rem.find((m) => m.userId === late.owner)!.text.includes("IT · INC-10293 · 6 g"),
  "günlük e-postada destek birimi, talep no ve bekleme günü",
);
assert.ok(
  rem
    .find((m) => m.userId === "mudur")!
    .text.includes("Teknik İşler · INC-10293") ||
    rem.find((m) => m.userId === "mudur")!.text.includes("IT · INC-10293"),
);
// Numara silinebilir; kapanan beklemeye numara girilemez.
call(
  { action: "supportTicket", id: a, itemId: it.id, ticket: "" },
  by(pa.owner),
);
assert.equal(it.ticket, undefined);
call(
  { action: "supportFlag", id: a, unit: "IT", selected: false },
  by(pa.owner),
);
assert.throws(
  () =>
    call(
      { action: "supportTicket", id: a, itemId: it.id, ticket: "INC-2" },
      by(pa.owner),
    ),
  /Açık bir destek/,
);
assert.equal(supportWaits(pa).length, 0);

console.log(
  "Round 6 passed: campaigns, anonymous proposals (redaction, e-mail, recognition), before/after images, support ticket numbers and wait days.",
);
