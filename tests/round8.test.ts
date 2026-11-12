// Tur 8: katılım raporu, net kazanç, otomatik ödül (kurallar, İK kararı, ödeme, iptal, bildirim, gizlilik).
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { canSee, gainFigures, STAGES } from "../lib/model";
import { participation } from "../lib/dashboard";
import {
  DEFAULT_REWARD_SETTINGS,
  buildReward,
  pickRule,
  rewardText,
  shares,
  validateRewardSettings,
} from "../lib/rewards";
import { buildMessages } from "../lib/notify";

const users: any[] = DEMO_USERS.map((u) => ({
  ...u,
  directorate: "Lojistik Müdürlüğü",
  active: 1,
  email: u.username + "@ornek.test",
  notify: "instant",
}));
users.push({
  id: "ik",
  username: "ik",
  name: "İK Uzmanı",
  department: "İnsan Kaynakları",
  directorate: "İK Müdürlüğü",
  role: "reward",
  manager: "",
  active: 1,
  email: "ik@ornek.test",
  notify: "instant",
});
users.push({
  id: "c2",
  username: "c2",
  name: "İkinci Çalışan",
  department: "Depo",
  directorate: "Lojistik Müdürlüğü",
  role: "employee",
  manager: "mudur",
  active: 1,
  email: "c2@ornek.test",
  notify: "instant",
});
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const events = () => {
  const e = (s as any)._events || [];
  delete (s as any)._events;
  return e;
};
const op = s.operations[0];
const today = new Date().toISOString().slice(0, 10);

// --- Net kazanç ---
assert.deepEqual(gainFigures({ amount: 10000, cost: 30000, period: "Aylık" }), {
  annual: 120000,
  cost: 30000,
  net: 90000,
  paybackMonths: 3,
});
assert.deepEqual(gainFigures({ amount: 120000, cost: 0, period: "Yıllık" }), {
  annual: 120000,
  cost: 0,
  net: 120000,
  paybackMonths: null,
});
assert.equal(
  gainFigures({ amount: 5000, cost: 8000, period: "Tek seferlik" }).net,
  -3000,
);
assert.equal(gainFigures(null).net, 0);

// --- Kural doğrulama ve seçim ---
assert.throws(
  () =>
    validateRewardSettings({
      rules: [{ minScore: 120, kind: "amount", value: 1, label: "x1" }],
    }),
  /0–100/,
);
assert.throws(
  () =>
    validateRewardSettings({
      rules: [{ minScore: 50, kind: "salary", value: 20, label: "Çok" }],
    }),
  /maaş katı/,
);
assert.throws(
  () =>
    validateRewardSettings({
      rules: [{ minScore: 50, kind: "amount", value: 100, label: "" }],
    }),
  /ad/,
);
const rs = validateRewardSettings({
  ...DEFAULT_REWARD_SETTINGS,
  enabled: true,
  rules: [...DEFAULT_REWARD_SETTINGS.rules].reverse(),
});
assert.deepEqual(
  rs.rules.map((r) => r.minScore),
  [85, 70, 50, 0],
  "yüksek eşik önce",
);
const g = (net: number) => ({
  approved: true,
  valid: true,
  amount: net,
  cost: 0,
  period: "Yıllık",
});
assert.equal(
  pickRule({ score: { total: 90, valid: true }, gain: g(150000) } as any, rs)
    .rule!.label,
  "Yarım maaş ikramiye",
);
assert.equal(
  pickRule({ score: { total: 90, valid: true }, gain: g(50000) } as any, rs)
    .rule!.label,
  "Başarı ödülü",
  "net kazanç şartı tutmazsa alt kural",
);
assert.equal(
  pickRule({ score: { total: 55, valid: true }, gain: g(0) } as any, rs).rule!
    .label,
  "Hediye çeki",
);
assert.equal(
  pickRule({ score: { total: 10, valid: true } } as any, rs).rule!.kind,
  "gift",
);
assert.equal(
  pickRule({ score: { total: 10, valid: true } } as any, {
    ...rs,
    rules: rs.rules.slice(0, 3),
  }).rule,
  null,
);
assert.equal(rewardText("salary", 0.25), "0,25 brüt maaş");
assert.equal(rewardText("amount", 5000), "5.000 ₺");
assert.deepEqual(shares("salary", 0.5, ["a", "b"], "equal"), [
  { userId: "a", value: 0.25 },
  { userId: "b", value: 0.25 },
]);
assert.deepEqual(
  shares("amount", 5000, ["a", "b"], "each").map((x) => x.value),
  [5000, 5000],
);
assert.deepEqual(
  shares("gift", 0, ["a", "b"], "equal").map((x) => x.value),
  [0, 0],
);
assert.equal(
  buildReward(
    { id: "KZ-1", author: "a", score: { total: 90, valid: true } } as any,
    { ...rs, enabled: false },
    today,
  ),
  null,
  "kapalıyken kayıt yok",
);

// --- Uçtan uca: puanlama → otomatik ödül → İK kararı → ödeme ---
assert.throws(() =>
  call({ action: "rewardSettings", settings: rs }, by("calisan")),
);
call(
  {
    action: "rewardSettings",
    settings: { ...rs, enabled: true, split: "equal" },
  },
  by("admin"),
);
const id = call(
  {
    action: "create",
    title: "Rampa önünde ara stok alanı",
    problem: "Rampada paletler bekliyor, forklift geçemiyor.",
    solution: "Ara stok alanı.",
    operation: op,
    coAuthors: ["c2"],
  },
  by("calisan"),
)!;
const p = s.proposals.find((x) => x.id === id)!;
const step = (b: any) => call({ id, ...b }, by(p.owner));
step({ action: "accept", note: "Uygun" });
step({ action: "accept", note: "Uygun" });
step({
  action: "addAction",
  title: "Zemin çizgisi",
  owner: "teknik",
  due: today,
});
step({ action: "start" });
call(
  { action: "actionUpdate", id, itemId: p.actions[0].id, status: "Tamamlandı" },
  by("teknik"),
);
step({ action: "finish", outcome: "implemented" });
assert.equal(
  p.status,
  STAGES[4],
  "sonra fotoğrafı olmadan kapanış ilerler (zorunlu değil)",
);
step({
  action: "gain",
  amount: 15000,
  cost: 30000,
  period: "Aylık",
  type: "Parasal",
  before: "Bekleme 20 dk",
  after: "Bekleme 8 dk",
  explanation: "Günde 12 dk × 22 gün × saat ücreti",
});
step({ action: "gainApprove" });
assert.equal(
  canSee(p, by("ik"), { users, matrix: s.matrix }),
  false,
  "İK tamamlanmamış öneriyi görmez",
);
events();
step({ action: "score", values: [5, 5, 4] }); // 93 puan, ilk yıl net 150.000 ₺
assert.equal(p.status, "Tamamlandı");
assert.equal(
  canSee(p, by("ik"), { users, matrix: s.matrix }),
  true,
  "İK tamamlanan öneriyi görür",
);
const r = s.rewards!.find((x) => x.proposalId === id)!;
assert.equal(r.ruleLabel, "Yarım maaş ikramiye");
assert.deepEqual(r.basis, { score: 93, net: 150000 });
assert.deepEqual(r.recipients, [
  { userId: "calisan", value: 0.25 },
  { userId: "c2", value: 0.25 },
]);
assert.ok(
  !p.history.some((h: any) => /maaş|₺/.test(h.text) && /Ödül/.test(h.text)),
  "geçmişe ödül değeri yazılmaz",
);
let msgs = buildMessages(events(), s.proposals, users, { appUrl: "x" });
assert.ok(
  msgs.some(
    (m) => m.userId === "ik" && m.subject.includes("Ödül onayı bekliyor"),
  ),
);
assert.ok(
  !msgs.some((m) => m.userId === "ik" && /maaş/.test(m.text)),
  "e-postada maaş bilgisi yok",
);

// Yetki: İK ya da sistem yöneticisi karar verir.
assert.throws(
  () =>
    call(
      { action: "rewardDecide", rewardId: r.id, decision: "approve" },
      by("mudur"),
    ),
  /İK/,
);
assert.throws(
  () =>
    call({ action: "rewardPaid", rewardId: r.id, period: "2026-11" }, by("ik")),
  /onaylanmış/,
);
// Değer değişirse gerekçe zorunlu; paylar yeniden hesaplanır.
assert.throws(
  () =>
    call(
      { action: "rewardDecide", rewardId: r.id, decision: "approve", total: 1 },
      by("ik"),
    ),
  /gerekçe/,
);
call(
  {
    action: "rewardDecide",
    rewardId: r.id,
    decision: "approve",
    total: 1,
    reason: "Etki tüm tesise yayıldı",
  },
  by("ik"),
);
assert.equal(r.status, "Onaylandı");
assert.deepEqual(
  r.recipients.map((x) => x.value),
  [0.5, 0.5],
);
assert.match(r.note!, /0,5 brüt maaş → 1 brüt maaş/);
msgs = buildMessages(events(), s.proposals, users, { appUrl: "x" });
assert.deepEqual(
  msgs.map((m) => m.userId).sort(),
  ["c2", "calisan"],
  "onay öneren ve birlikte önerene gider",
);
assert.throws(
  () =>
    call(
      {
        action: "rewardDecide",
        rewardId: r.id,
        decision: "reject",
        reason: "x yok",
      },
      by("ik"),
    ),
  /zaten/,
);
assert.throws(
  () =>
    call({ action: "rewardPaid", rewardId: r.id, period: "11.2026" }, by("ik")),
  /YYYY-AA/,
);
call({ action: "rewardPaid", rewardId: r.id, period: "2026-11" }, by("ik"));
assert.equal(r.status, "Ödendi");
assert.equal(r.payrollPeriod, "2026-11");
// Ödenmiş ödülü olan öneri geri alınamaz.
assert.throws(
  () =>
    call(
      { action: "rollback", id, target: STAGES[5], reason: "Kazanç yanlış" },
      by("admin"),
    ),
  /ödenmiş/,
);

// Geri alma ödenmemiş ödülü iptal eder; ret gerekçe ister.
const id2 = call(
  {
    action: "create",
    title: "Etiket yazıcısı yeri değişsin",
    problem: "Etiket yazıcısı uzakta, yürüme kaybı var.",
    solution: "Masaya taşınsın.",
    operation: op,
  },
  by("calisan"),
)!;
const p2 = s.proposals.find((x) => x.id === id2)!;
const step2 = (b: any) => call({ id: id2, ...b }, by(p2.owner));
step2({ action: "accept", note: "Uygun" });
step2({ action: "accept", note: "Uygun" });
step2({ action: "addAction", title: "Taşı", owner: "teknik", due: today });
step2({ action: "start" });
call(
  {
    action: "actionUpdate",
    id: id2,
    itemId: p2.actions[0].id,
    status: "Tamamlandı",
  },
  by("teknik"),
);
step2({ action: "finish", outcome: "implemented" });
step2({
  action: "gain",
  amount: 0,
  cost: 0,
  period: "Tek seferlik",
  type: "Ergonomi",
  before: "Günde 2 km yürüme",
  after: "Yürüme yok",
  explanation: "Ölçüm adımsayarla yapıldı",
});
step2({ action: "gainApprove" });
step2({ action: "score", values: [3, 3, 3] }); // 60 puan → Hediye çeki
const r2 = s.rewards!.find((x) => x.proposalId === id2)!;
assert.equal(r2.ruleLabel, "Hediye çeki");
assert.equal(r2.recipients[0].value, 1500);
call(
  {
    action: "rollback",
    id: id2,
    target: STAGES[6],
    reason: "Puan yeniden verilecek",
  },
  by("admin"),
);
assert.equal(r2.status, "İptal edildi");
step2({ action: "score", values: [2, 2, 2] }); // 40 → teşekkür belgesi, yeni kayıt
const r3 = s.rewards!.filter((x) => x.proposalId === id2).at(-1)!;
assert.equal(r3.kind, "gift");
assert.throws(() =>
  call(
    { action: "rewardDecide", rewardId: r3.id, decision: "reject", reason: "" },
    by("ik"),
  ),
);
call(
  {
    action: "rewardDecide",
    rewardId: r3.id,
    decision: "reject",
    reason: "Belge yerine sözlü teşekkür",
  },
  by("ik"),
);
assert.equal(r3.status, "Reddedildi");

// --- Katılım raporu ---
const people = users.filter((u) => !["admin"].includes(u.role));
const anonId = call(
  {
    action: "create",
    title: "Anonim öneri denemesi",
    problem: "Mola alanı küçük, sıkışıklık oluyor.",
    solution: "Genişletilsin.",
    operation: op,
    anonymous: true,
  },
  by("it"),
)!;
const part = participation(s.proposals, people);
const row = (id: string) => part.top.find((x) => x.user.id === id);
assert.equal(
  row("calisan")!.count,
  s.proposals.filter(
    (x) =>
      !x.anonymous &&
      (x.author === "calisan" || (x.coAuthors || []).includes("calisan")) &&
      x.status !== "İptal edildi",
  ).length,
);
assert.equal(row("c2")!.count, 1, "birlikte öneren de sayılır");
assert.equal(row("it"), undefined, "anonim öneri kişiye yazılmaz");
assert.ok(part.anonymous >= 1);
assert.equal(
  part.buckets.reduce((a, b) => a + b.count, 0),
  people.length,
  "her kişi tek bir grupta",
);
assert.equal(part.buckets.find((b) => b.key === "one")!.count >= 1, true);
assert.ok(
  part.top.every((x, i, a) => i === 0 || a[i - 1].count >= x.count),
  "sıralı",
);
const future = participation(s.proposals, people, "2999-01-01");
assert.equal(
  future.buckets.find((b) => b.key === "none")!.count,
  people.length,
  "dönem filtresi",
);
void anonId;

console.log(
  "Round 8 passed: net gain, participation report, reward rules, automatic reward after scoring, HR decision/override/payment, rollback cancel, notifications without salary data.",
);
