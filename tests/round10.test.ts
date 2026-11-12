// Tur 10: uygulama sonucu zorunlu seçim; uygulanamayan öneri kazanç adımına gitmez, "Uygulanamadı" ile kapanır.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import {
  CLOSED,
  NOT_IMPLEMENTED,
  NOT_IMPLEMENTED_REASONS,
  STAGES,
  overdueDays,
} from "../lib/model";
import { buildMessages } from "../lib/notify";
import { runReport, DEFAULT_CONFIG } from "../lib/report-builder";

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
const today = new Date().toISOString().slice(0, 10);
const make = (title: string) => {
  const id = call(
    {
      action: "create",
      title,
      problem: "Rampada paletler bekliyor, forklift geçemiyor.",
      solution: "Ara stok alanı.",
      operation: s.operations[0],
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
  step({ action: "addAction", title: "Levha", owner: "teknik", due: today });
  return { id, p, step };
};

assert.ok(CLOSED.includes(NOT_IMPLEMENTED));

// 1) Uygulandı: seçim zorunlu; aksiyonlar yapıldı/yapılamadı olarak sonuçlanmalı, en az biri yapılmış olmalı.
const A = make("Uygulanan öneri");
A.step({ action: "start" });
assert.throws(
  () => A.step({ action: "finish" }),
  /uygulandı mı/,
  "sonuç seçimi zorunlu",
);
assert.throws(
  () => A.step({ action: "finish", outcome: "implemented" }),
  /sonuçlanmalı/,
);
assert.throws(
  () =>
    call(
      {
        action: "actionUpdate",
        id: A.id,
        itemId: A.p.actions[1].id,
        status: "Yapılamadı",
      },
      by("teknik"),
    ),
  /gerekçe/,
);
call(
  {
    action: "actionUpdate",
    id: A.id,
    itemId: A.p.actions[1].id,
    status: "Yapılamadı",
    reason: "Levha tedarik edilemedi",
  },
  by("teknik"),
);
assert.equal(A.p.actions[1].status, "Yapılamadı");
assert.throws(
  () => A.step({ action: "finish", outcome: "implemented" }),
  /en az biri/,
  "hiçbiri yapılmadan uygulandı denemez",
);
call(
  {
    action: "actionUpdate",
    id: A.id,
    itemId: A.p.actions[0].id,
    status: "Tamamlandı",
  },
  by("teknik"),
);
A.step({ action: "finish", outcome: "implemented" });
assert.equal(A.p.status, STAGES[4], "uygulanan öneri kazanç girişine geçer");

// 2) Uygulanamadı: neden ve açıklama zorunlu; kazanca gitmez, kapalı sayılır, öneren bilgilendirilir.
const B = make("Uygulanamayan öneri");
B.step({ action: "start" });
assert.throws(
  () =>
    B.step({
      action: "finish",
      outcome: "notImplemented",
      reason: "Bütçe yok",
    }),
  /nedenini seçin/,
);
assert.throws(
  () =>
    B.step({
      action: "finish",
      outcome: "notImplemented",
      reasonCode: NOT_IMPLEMENTED_REASONS[0],
      reason: "",
    }),
  /gerekçe/,
);
assert.throws(
  () =>
    call(
      {
        id: B.id,
        action: "finish",
        outcome: "notImplemented",
        reasonCode: NOT_IMPLEMENTED_REASONS[0],
        reason: "x yok",
      },
      by("calisan"),
    ),
  /Yetkiniz/,
);
events();
B.step({
  action: "finish",
  outcome: "notImplemented",
  reasonCode: NOT_IMPLEMENTED_REASONS[0],
  reason: "Yatırım bütçesi gelecek yıla kaldı.",
});
assert.equal(B.p.status, NOT_IMPLEMENTED);
assert.equal(B.p.owner, "", "kapalı kaydın sorumlusu yok");
assert.equal(B.p.notImplemented!.reason, NOT_IMPLEMENTED_REASONS[0]);
assert.ok(
  B.p.actions.every((a: any) =>
    ["Tamamlandı", "Yapılamadı", "İptal edildi"].includes(a.status),
  ),
  "açık aksiyonlar kapanır",
);
assert.equal(overdueDays(B.p), 0);
assert.throws(() =>
  B.step({
    action: "gain",
    amount: 1,
    cost: 0,
    period: "Yıllık",
    type: "Parasal",
    before: "a",
    after: "b",
    explanation: "hesaplama açıklaması",
  }),
);
const ev = events();
assert.deepEqual(
  ev.map((e: any) => e.type),
  ["notImplemented"],
  "aşama e-postası değil, uygulanamadı bildirimi",
);
const msgs = buildMessages(ev, s.proposals, users, { appUrl: "x" });
assert.equal(msgs.length, 1);
assert.equal(msgs[0].userId, "calisan");
assert.ok(msgs[0].text.includes("Yatırım bütçesi"));
assert.throws(
  () => call({ id: B.id, action: "cancel", reason: "kapat" }, by("admin")),
  /kapalı/,
);

// 3) Aksiyon planlama aşamasında da uygulanamadı olarak kapatılabilir; "uygulandı" ise yalnız uygulamadayken.
const C = make("Planlamada kalan öneri");
assert.throws(
  () => C.step({ action: "finish", outcome: "implemented" }),
  /Yetkiniz/,
);
C.step({
  action: "finish",
  outcome: "notImplemented",
  reasonCode: "Mevzuat / iş güvenliği engeli",
  reason: "İSG kurulu onaylamadı.",
});
assert.equal(C.p.status, NOT_IMPLEMENTED);

// 4) Geri alma: yönetici uygulanamadı kaydını önceki aşamaya döndürebilir.
call(
  {
    id: C.id,
    action: "rollback",
    target: STAGES[2],
    reason: "Bütçe çıktı, yeniden planlanacak",
  },
  by("admin"),
);
assert.equal(C.p.status, STAGES[2]);

// 5) Raporlar: uygulanamayan sayısı ve nedeni.
const r = runReport(
  s.proposals,
  {
    ...DEFAULT_CONFIG,
    status: "notImplemented",
    groupBy: "notImplementedReason",
    measures: ["count", "notImplemented"],
  },
  users,
);
assert.deepEqual(
  r.rows.map((x) => [x.label, x.values.count]),
  [[NOT_IMPLEMENTED_REASONS[0], 1]],
);
assert.equal(
  runReport(
    s.proposals,
    { ...DEFAULT_CONFIG, status: "open", groupBy: "none", measures: ["count"] },
    users,
  ).rows[0].values.count,
  s.proposals.filter((p) => !CLOSED.includes(p.status)).length,
);

console.log(
  "Round 10 passed: mandatory implementation outcome, not-implemented closing (reason, notification, no gain), action can't-be-done, planning-stage close, rollback, reports.",
);
