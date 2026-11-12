// Tur 5: benzer öneri ve mükerrer bağlama, eş anlamlılar, e-posta olayları/kuralları/hatırlatmaları, tanınma.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { findSimilar, tokenize } from "../lib/similar";
import {
  buildMessages,
  buildReminders,
  combine,
  renderEmail,
} from "../lib/notify";
import { overdueDays } from "../lib/model";
import { buildRecognition, MIN_DEPARTMENT_SIZE } from "../lib/recognition";

const users: any[] = DEMO_USERS.map((u) => ({
  ...u,
  directorate: "Lojistik Müdürlüğü",
  active: 1,
  email: u.username + "@ornek.test",
  notify: "instant",
}));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => {
  const r = applyCommand(s, b, u, users);
  return r;
};
const takeEvents = () => {
  const e = (s as any)._events || [];
  delete (s as any)._events;
  return e;
};
const op = s.operations[0];

// --- Benzer öneri ---
const tk = (t: string) => [...tokenize(t)];
assert.ok(
  tk("Paletler rampada").some((x) => tk("palet rampa").includes(x)),
  "ek almış kelimeler kökte buluşur",
);
assert.equal(tk("ve bir için").length, 0, "durak kelimeleri atılır");
const a = call(
  {
    action: "create",
    title: "Rampa önünde palet birikmesi",
    problem:
      "Mal kabul rampasında paletler bekliyor, forklift trafiği tıkanıyor.",
    solution: "Ara stok alanı ve zemin çizgisi.",
    operation: op,
    category: "Verimlilik",
  },
  by("calisan"),
)!;
takeEvents();
const b = call(
  {
    action: "create",
    title: "Rampada bekleyen paletler",
    problem: "Paletler rampada birikiyor, forklift geçemiyor.",
    solution: "Rampa önüne ara stok alanı.",
    operation: op,
    category: "Verimlilik",
  },
  by("calisan"),
)!;
const c = call(
  {
    action: "create",
    title: "Kantin menüsü çeşitlensin",
    problem: "Yemek seçenekleri az.",
    solution: "Haftalık menü anketi.",
    operation: op,
    category: "İş güvenliği",
  },
  by("calisan"),
)!;
const pb = s.proposals.find((x) => x.id === b)!;
const hits = findSimilar(pb, s.proposals, []);
assert.equal(hits[0]?.proposal.id, a, "en benzer öneri ilk sırada");
assert.ok(!hits.some((h) => h.proposal.id === c), "ilgisiz öneri listelenmez");
assert.ok(!hits.some((h) => h.proposal.id === b), "kendisi listelenmez");
assert.ok(hits[0].shared.length > 0 && hits[0].sameOperation);

// Eş anlamlılar: "yük" ve "palet" aynı sayılınca eşleşme puanı artar.
const draft = {
  title: "Yükler rampada bekliyor",
  problem: "Yük yığılıyor.",
  solution: "Alan açılsın.",
  operation: op,
};
const before =
  findSimilar(draft, s.proposals, []).find((h) => h.proposal.id === a)?.score ||
  0;
assert.throws(() =>
  call(
    { action: "defineSynonyms", synonyms: [["palet", "yük"]] },
    by("calisan"),
  ),
);
call(
  { action: "defineSynonyms", synonyms: [["Palet", "yük", "yük"], ["tek"]] },
  by("admin"),
);
assert.deepEqual(
  s.settings!.synonyms,
  [["palet", "yük"]],
  "küçük harfe çevrilir, tekrarlar ve tek kelimelik gruplar atılır",
);
const after =
  findSimilar(draft, s.proposals, s.settings!.synonyms!).find(
    (h) => h.proposal.id === a,
  )?.score || 0;
assert.ok(after > before, "eş anlamlı tanımı benzerliği artırır");

// Mükerrer: yalnız sorumlu, gerekçe zorunlu, iki yönlü bağlantı, ret nedeni ve öneren(e) bildirim.
takeEvents();
const dupOwner = pb.owner;
assert.throws(() =>
  call(
    { action: "duplicate", id: b, of: a, reason: "Aynı konu" },
    by("calisan"),
  ),
);
assert.throws(() =>
  call({ action: "duplicate", id: b, of: a, reason: "" }, by(dupOwner)),
);
assert.throws(() =>
  call({ action: "duplicate", id: b, of: b, reason: "Kendisi" }, by(dupOwner)),
);
call(
  {
    action: "duplicate",
    id: b,
    of: a,
    reason: "Aynı konu orada değerlendiriliyor",
  },
  by(dupOwner),
);
assert.equal(pb.status, "Reddedildi");
assert.equal(pb.rejectReason, "Mükerrer öneri");
assert.equal(pb.duplicateOf, a);
assert.deepEqual(s.proposals.find((x) => x.id === a)!.duplicates, [b]);
let ev = takeEvents();
assert.equal(ev.length, 1);
assert.equal(ev[0].type, "rejected");
assert.equal(ev[0].actor, dupOwner);
let msgs = buildMessages(ev, s.proposals, users, {
  appUrl: "https://ivme.test",
});
assert.equal(msgs.length, 1);
assert.equal(msgs[0].userId, "calisan");
assert.ok(
  msgs[0].text.includes(a) &&
    msgs[0].html.includes("https://ivme.test/?oneri=" + b),
);

// --- E-posta kuralları ---
const pa = s.proposals.find((x) => x.id === a)!;
const pre = pa.owner;
call({ action: "accept", id: a, note: "Uygun" }, by(pre));
ev = takeEvents();
assert.equal(ev[0].type, "stage");
msgs = buildMessages(ev, s.proposals, users, { appUrl: "https://ivme.test" });
assert.ok(
  msgs.some((m) => m.userId === "calisan"),
  "öneren aşama değişikliğini alır",
);
assert.ok(
  msgs.some((m) => m.userId === pa.owner),
  "yeni sorumlu kendisinde bekleyen işi alır",
);
assert.ok(
  !msgs.some((m) => m.userId === pre),
  "işlemi yapan kişiye e-posta gitmez",
);
// Kural kapatılınca gönderilmez; tercih "off" olan ve adresi olmayan atlanır; pasif kişi atlanır.
assert.equal(
  buildMessages(ev, s.proposals, users, { appUrl: "x", disabled: ["stage"] })
    .length,
  0,
);
const quiet = users.map((u) =>
  u.id === "calisan"
    ? { ...u, notify: "off" }
    : u.id === pa.owner
      ? { ...u, email: "" }
      : u,
);
assert.equal(buildMessages(ev, s.proposals, quiet, { appUrl: "x" }).length, 0);
assert.throws(() =>
  call(
    { action: "notifySettings", disabled: [], escalateAfterDays: 3 },
    by("calisan"),
  ),
);
assert.throws(() =>
  call(
    { action: "notifySettings", disabled: [], escalateAfterDays: 0 },
    by("admin"),
  ),
);
call(
  {
    action: "notifySettings",
    disabled: ["comment", "uydurma"],
    escalateAfterDays: 3,
  },
  by("admin"),
);
assert.deepEqual(s.settings!.notify, {
  disabled: ["comment"],
  escalateAfterDays: 3,
});

// Yorum: ilgili diğer kişilere gider, yazan kişiye gitmez.
call(
  { action: "comment", id: a, text: "Ölçüm verisi ekleyebilir misin?" },
  by(pa.owner),
);
ev = takeEvents();
msgs = buildMessages(ev, s.proposals, users, { appUrl: "x" });
assert.ok(
  msgs.some((m) => m.userId === "calisan") &&
    !msgs.some((m) => m.userId === pa.owner),
);

// HTML kaçışı: başlıktaki işaretler e-postaya ham geçmez.
assert.ok(!renderEmail("<script>", ["a & b"]).html.includes("<script>"));

// Hatırlatmalar: hedef süreyi aşan öneri sorumluya; eşik geçince müdüre; aksiyon tarihi yaklaşınca sorumluya.
const old = structuredClone(pa);
old.id = "KZ-ESKI";
old.stageAt = new Date(Date.now() - 20 * 86400000).toISOString();
const owner = by(old.owner);
const withManager = users.map((u) =>
  u.id === old.owner ? { ...u, manager: "mudur" } : u,
);
let rem = buildReminders([old], withManager, {
  appUrl: "x",
  escalateAfterDays: 3,
});
// Kişi başına TEK günlük e-posta: öneri no, başlık, aşama, bekleme ve gecikme günü tabloda.
const own = rem.filter((m) => m.userId === owner.id);
assert.equal(own.length, 1);
assert.equal(own[0].eventKey, "daily");
assert.match(own[0].subject, /Günlük gecikme özeti · 1 geciken öneri/);
for (const piece of ["KZ-ESKI", old.title, old.status, "20", String(overdueDays(old))])
  assert.ok(own[0].text.includes(piece), "e-postada " + piece + " olmalı");
// Birden çok geciken öneri tek e-postada, en çok geciken üstte.
const old2 = { ...structuredClone(old), id: "KZ-ESKI2", stageAt: new Date(Date.now() - 40 * 86400000).toISOString() };
const both = buildReminders([old, old2], withManager, { appUrl: "x", escalateAfterDays: 60 }).filter((m) => m.userId === owner.id);
assert.equal(both.length, 1);
assert.ok(both[0].text.indexOf("KZ-ESKI2") < both[0].text.indexOf("KZ-ESKI |"), "gecikmesi büyük olan önce");
assert.ok(
  rem.some((m) => m.userId === "mudur"),
  "eşik aşılınca müdüre de gider",
);
rem = buildReminders([old], withManager, {
  appUrl: "x",
  escalateAfterDays: 60,
});
assert.ok(!rem.some((m) => m.userId === "mudur"));
assert.equal(
  buildReminders([old], withManager, { appUrl: "x", disabled: ["overdue"] })
    .length,
  0,
);
const withAction = structuredClone(pa);
withAction.stageAt = new Date().toISOString();
withAction.actions = [
  {
    id: "x1",
    title: "Zemin çizgisi",
    owner: "teknik",
    due: "2026-11-14",
    status: "Açık",
  },
  {
    id: "x2",
    title: "Etiket",
    owner: "teknik",
    due: "2026-11-20",
    status: "Açık",
  },
  {
    id: "x3",
    title: "Bitti",
    owner: "teknik",
    due: "2026-11-01",
    status: "Tamamlandı",
  },
];
rem = buildReminders([withAction], users, { appUrl: "x", today: "2026-11-12" });
assert.equal(rem.length, 1);
assert.ok(rem[0].text.includes("Zemin çizgisi") && rem[0].text.includes("2 gün kaldı"));
assert.ok(!rem[0].text.includes("Etiket") && !rem[0].text.includes("Bitti |"), "yalnız 2 gün içindeki açık aksiyon");
// Birleştirme: aynı kişiye giden çoklu e-posta tek özet olur.
const many = [...rem, ...rem.map((m) => ({ ...m, subject: m.subject + " 2" }))];
const merged = combine(many, "Toplu güncelleme", "x");
assert.equal(merged.length, 1);
assert.ok(merged[0].subject.includes("(2)"));

// --- Tanınma ---
call({ action: "recognitionSettings", enabled: false }, by("admin"));
assert.equal(s.settings!.recognition, false);
call({ action: "recognitionSettings", enabled: true }, by("admin"));
const done = structuredClone(pa);
done.id = "KZ-BITTI";
done.status = "Tamamlandı";
done.stageAt = new Date().toISOString();
done.coAuthors = ["operasyon"];
done.score = { total: 87, valid: true, values: [5, 4, 4] };
done.gain = {
  approved: true,
  valid: true,
  type: "Parasal",
  after: "Bekleme 8 dk",
};
const rs = { ...s, proposals: [...s.proposals, done] };
const rec = buildRecognition(rs as any, users, "calisan", new Date(), 90);
assert.equal(rec.highlights[0].id, "KZ-BITTI");
assert.deepEqual(rec.highlights[0].authors, [
  by("calisan").name,
  by("operasyon").name,
]);
const earned: string[] = rec.me.badges
  .filter((x) => x.earned)
  .map((x) => x.key);
for (const k of ["first", "completed", "gain", "team", "high", "implemented"])
  assert.ok(earned.includes(k), k);
assert.ok(
  rec.departments.every((d) => d.people >= MIN_DEPARTMENT_SIZE),
  "küçük departmanlar gizli",
);
assert.ok(rec.totals.participants >= 2);
assert.equal(
  buildRecognition(rs as any, users, "it", new Date(), 90).me.submitted,
  0,
  "kişisel özet kişiye özel",
);
assert.equal(
  buildRecognition(rs as any, users, "calisan", new Date(), 12345).windowDays,
  90,
  "geçersiz dönem 90 güne düşer",
);

console.log(
  "Round 5 passed: similar & duplicate, synonyms, e-mail events/rules/reminders/digest, recognition.",
);
