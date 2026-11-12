// Tur 11: tanımlanabilir listeler (sınıf/alt sınıf, ret ve uygulanamama nedenleri, kazanç türleri),
// puanlama kriterleri (ağırlık, ölçek, anlık saklama) ve aşama hedef süreleri.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import {
  DEFAULT_TARGET_DAYS,
  STAGES,
  STAGE_TARGET_DAYS,
  overdueDays,
} from "../lib/model";
import {
  DEFAULT_LISTS,
  activeNames,
  activeSubs,
  listOf,
  scoreTotal,
  scoringOf,
} from "../lib/definitions";

const users: any[] = DEMO_USERS.map((u) => ({
  ...u,
  directorate: "Lojistik Müdürlüğü",
  active: 1,
}));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const admin = by("admin");
const op = s.operations[0];
const today = new Date().toISOString().slice(0, 10);
const create = (o: any = {}) =>
  call(
    {
      action: "create",
      title: "Rampa önünde ara stok",
      problem: "Rampada paletler bekliyor.",
      solution: "Ara stok alanı.",
      operation: op,
      ...o,
    },
    by("calisan"),
  )!;

// Varsayılanlar: tanım yokken bugünkü listeler geçerli.
assert.deepEqual(
  activeNames(s, "categories"),
  DEFAULT_LISTS.categories.map((x) => x.name),
);
assert.equal(scoringOf(s).criteria.length, 3);

// --- Öneri sınıfları: alt sınıf, yeniden adlandırma eski kayda yansır, kullanılan silinmez ---
const cats = listOf(s, "categories").map((x) => ({ ...x }));
cats[0] = {
  ...cats[0],
  subs: [
    { id: "", name: "Bekleme israfı", active: true },
    { id: "", name: "Hareket israfı", active: true },
  ],
};
assert.throws(
  () =>
    call(
      { action: "defineList", key: "categories", items: cats },
      by("calisan"),
    ),
  /sistem yöneticisi/,
);
call({ action: "defineList", key: "categories", items: cats }, admin);
assert.deepEqual(activeSubs(s, "Verimlilik"), [
  "Bekleme israfı",
  "Hareket israfı",
]);
assert.throws(
  () => create({ category: "Verimlilik", subcategory: "Yok böyle" }),
  /Alt sınıfı/,
);
assert.throws(() => create({ category: "Uydurma" }), /sınıfını/);
const a = create({ category: "Verimlilik", subcategory: "Bekleme israfı" });
const pa = s.proposals.find((x) => x.id === a)!;
assert.equal(pa.subcategory, "Bekleme israfı");
// Yeniden adlandırma: hem sınıf hem alt sınıf eski kayıtta güncellenir.
let next: any[] = listOf(s, "categories").map((x) => ({
  ...x,
  subs: (x.subs || []).map((y) => ({ ...y })),
}));
next[0].name = "Verimlilik ve akış";
next[0].subs![0].name = "Bekleme (muda)";
call({ action: "defineList", key: "categories", items: next }, admin);
assert.equal(pa.category, "Verimlilik ve akış");
assert.equal(pa.subcategory, "Bekleme (muda)");
assert.ok(s.audit[0].text.includes("Verimlilik → Verimlilik ve akış"));
// Kullanılan madde silinemez; pasife alınır, yeni kayıtta seçilemez ama eski kayıt durur.
next = listOf(s, "categories").map((x) => ({ ...x }));
assert.throws(
  () =>
    call(
      { action: "defineList", key: "categories", items: next.slice(1) },
      admin,
    ),
  /kayıtta kullanılıyor/,
);
next[0] = { ...next[0], active: false };
call({ action: "defineList", key: "categories", items: next }, admin);
assert.ok(!activeNames(s, "categories").includes("Verimlilik ve akış"));
assert.equal(pa.category, "Verimlilik ve akış");
assert.throws(() => create({ category: "Verimlilik ve akış" }), /sınıfını/);
// Kullanılmayan madde silinebilir; tekrarlanan ad ve boş liste reddedilir.
const unused = listOf(s, "categories").filter((x) => x.name !== "Çevre");
call({ action: "defineList", key: "categories", items: unused }, admin);
assert.ok(!listOf(s, "categories").some((x) => x.name === "Çevre"));
assert.throws(
  () =>
    call(
      {
        action: "defineList",
        key: "categories",
        items: [...unused, { id: "", name: "kalite", active: true }],
      },
      admin,
    ),
  /iki kez/,
);
assert.throws(
  () => call({ action: "defineList", key: "categories", items: [] }, admin),
  /en az bir/,
);

// --- Ret nedenleri: sistem maddesi kilitli, yeni neden kullanılabilir ---
const rr = listOf(s, "rejectReasons").map((x) => ({ ...x }));
const dupIdx = rr.findIndex((x) => x.name === "Mükerrer öneri");
assert.throws(
  () =>
    call(
      {
        action: "defineList",
        key: "rejectReasons",
        items: rr.map((x, i) => (i === dupIdx ? { ...x, name: "Tekrar" } : x)),
      },
      admin,
    ),
  /sistemin kendi/,
);
assert.throws(
  () =>
    call(
      {
        action: "defineList",
        key: "rejectReasons",
        items: rr.filter((_, i) => i !== dupIdx),
      },
      admin,
    ),
  /silinemez/,
);
call(
  {
    action: "defineList",
    key: "rejectReasons",
    items: [...rr, { id: "", name: "Bütçe dönemi dışında", active: true }],
  },
  admin,
);
const b = create();
const pb = s.proposals.find((x) => x.id === b)!;
assert.throws(
  () =>
    call(
      {
        id: b,
        action: "reject",
        reasonCode: "Olmayan neden",
        reason: "Açıklama",
      },
      by(pb.owner),
    ),
  /ret nedeni/,
);
call(
  {
    id: b,
    action: "reject",
    reasonCode: "Bütçe dönemi dışında",
    reason: "Bu yıl yapılamaz",
  },
  by(pb.owner),
);
assert.equal(pb.rejectReason, "Bütçe dönemi dışında");

// --- Puanlama kriterleri: ağırlık ve ölçek; puan anlık kriterlerle saklanır ---
assert.equal(
  scoreTotal([5, 5, 4], scoringOf(s)),
  93,
  "varsayılan eşit ağırlık eski formülle aynı",
);
assert.throws(
  () =>
    call(
      {
        action: "defineScoring",
        scoring: { scale: 7, criteria: [{ name: "Etki", weight: 1 }] },
      },
      admin,
    ),
  /ölçeği/,
);
assert.throws(
  () =>
    call(
      { action: "defineScoring", scoring: { scale: 5, criteria: [] } },
      admin,
    ),
  /1 ile 6/,
);
assert.throws(
  () =>
    call(
      {
        action: "defineScoring",
        scoring: { scale: 5, criteria: [{ name: "Etki", weight: 0 }] },
      },
      admin,
    ),
  /ağırlık/,
);
call(
  {
    action: "defineScoring",
    scoring: {
      scale: 10,
      criteria: [
        { name: "Kazanç büyüklüğü", weight: 3 },
        { name: "Kalıcılık", weight: 1 },
      ],
    },
  },
  admin,
);
assert.equal(
  scoreTotal([10, 2], scoringOf(s)),
  Math.round(((1 * 3 + 0.2 * 1) / 4) * 100),
);
// Uçtan uca puanlama.
const c = create({ category: "Kalite" });
const pc = s.proposals.find((x) => x.id === c)!;
const step = (x: any) => call({ id: c, ...x }, by(pc.owner));
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
  {
    action: "actionUpdate",
    id: c,
    itemId: pc.actions[0].id,
    status: "Tamamlandı",
  },
  by("teknik"),
);
step({ action: "finish", outcome: "implemented" });
// Kazanç türü listeden; yeni tür eklenebilir, "Parasal" kilitli.
const gt = listOf(s, "gainTypes").map((x) => ({ ...x }));
assert.throws(
  () =>
    call(
      {
        action: "defineList",
        key: "gainTypes",
        items: gt.map((x) =>
          x.name === "Parasal" ? { ...x, active: false } : x,
        ),
      },
      admin,
    ),
  /sistemin kendi/,
);
call(
  {
    action: "defineList",
    key: "gainTypes",
    items: [...gt, { id: "", name: "Çevre / enerji", active: true }],
  },
  admin,
);
assert.throws(
  () =>
    step({
      action: "gain",
      amount: 0,
      cost: 0,
      period: "Yıllık",
      type: "Uydurma",
      before: "a",
      after: "b",
      explanation: "ölçüm açıklaması",
    }),
  /tür/,
);
step({
  action: "gain",
  amount: 0,
  cost: 0,
  period: "Yıllık",
  type: "Çevre / enerji",
  before: "Günde 40 kWh",
  after: "Günde 31 kWh",
  explanation: "Sayaç ölçümü bir hafta",
});
step({ action: "gainApprove" });
assert.throws(
  () => step({ action: "score", values: [5, 5, 5] }),
  /1–10/,
  "kriter sayısı ve ölçek tanıma uyar",
);
step({ action: "score", values: [8, 6] });
assert.equal(pc.score.total, scoreTotal([8, 6], scoringOf(s)));
assert.deepEqual(pc.score.criteria, [
  { name: "Kazanç büyüklüğü", weight: 3, value: 8 },
  { name: "Kalıcılık", weight: 1, value: 6 },
]);
const saved = pc.score.total;
call(
  {
    action: "defineScoring",
    scoring: { scale: 5, criteria: [{ name: "Tek kriter", weight: 1 }] },
  },
  admin,
);
assert.equal(pc.score.total, saved, "kriter değişince eski puan değişmez");
// Kazanç türü yeniden adlandırılınca kayıt da güncellenir.
const gt2 = listOf(s, "gainTypes").map((x) =>
  x.name === "Çevre / enerji" ? { ...x, name: "Enerji" } : { ...x },
);
call({ action: "defineList", key: "gainTypes", items: gt2 }, admin);
assert.equal(pc.gain.type, "Enerji");

// --- Hedef süreler ---
const d = create();
const pd = s.proposals.find((x) => x.id === d)!;
pd.stageAt = new Date(Date.now() - 4 * 86400000).toISOString();
assert.equal(overdueDays(pd), 4 - DEFAULT_TARGET_DAYS[STAGES[0]]);
assert.throws(
  () =>
    call({ action: "defineTargetDays", targetDays: { [STAGES[0]]: 0 } }, admin),
  /1–365/,
);
call({ action: "defineTargetDays", targetDays: { [STAGES[0]]: 10 } }, admin);
assert.equal(STAGE_TARGET_DAYS[STAGES[0]], 10);
assert.equal(overdueDays(pd), 0, "uzatılan hedefte gecikme kalkar");
assert.equal(
  STAGE_TARGET_DAYS[STAGES[1]],
  DEFAULT_TARGET_DAYS[STAGES[1]],
  "girilmeyen aşama varsayılan kalır",
);
// Kaydedilmiş durum yeniden yüklenince ayar yine uygulanır.
const reloaded = migrateState(JSON.parse(JSON.stringify(s)), users);
assert.equal(reloaded.settings!.targetDays![STAGES[0]], 10);
assert.equal(STAGE_TARGET_DAYS[STAGES[0]], 10);
// Başka testleri etkilememek için varsayılana dön.
call(
  { action: "defineTargetDays", targetDays: { ...DEFAULT_TARGET_DAYS } },
  admin,
);

console.log(
  "Round 11 passed: definable categories/subcategories, reject & not-implemented reasons, gain types (rename cascade, lock, deactivate, delete rules), weighted scoring with snapshot, target days.",
);
