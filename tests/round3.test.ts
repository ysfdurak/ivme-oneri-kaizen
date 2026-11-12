// Organizasyon ve sorumluluk kuralları: yönetici kapsamı (müdür/direktör/genel müdür), pasif sorumluda iş akışı,
// kişiye yönlendirme, devir ve geri alma, tanımlar (departman, lokasyon), yeni öneri alanları, kurum adı.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { STAGES, canSee, managesProposal } from "../lib/model";

const users: any[] = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const add = (u: any) => users.push({ manager: "", active: 1, ...u });
add({
  id: "mud2",
  username: "mudur.uretim",
  name: "Üretim Müdürü",
  department: "Üretim Yönetimi",
  directorate: "Üretim Müdürlüğü",
  role: "manager",
});
add({
  id: "op2",
  username: "op.uretim",
  name: "Montaj Sorumlusu",
  department: "Montaj",
  directorate: "Üretim Müdürlüğü",
  role: "operation",
  manager: "mud2",
});
add({
  id: "op3",
  username: "op.uretim2",
  name: "İkinci Sorumlu",
  department: "Montaj",
  directorate: "Üretim Müdürlüğü",
  role: "operation",
  manager: "mud2",
});
add({
  id: "dir1",
  username: "direktor",
  name: "Operasyon Direktörü",
  department: "Operasyon Direktörlüğü",
  directorate: "Operasyon Direktörlüğü",
  role: "director",
});
add({
  id: "gm1",
  username: "gm",
  name: "Genel Müdür",
  department: "Genel Müdürlük",
  directorate: "Genel Müdürlük",
  role: "gm",
});
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const admin = by("admin");
const ctx = () => ({ users, matrix: s.matrix, org: s.settings?.org });

// Tanımlar: migrasyon departmanları kullanıcılardan çıkarır; hiyerarşi isteğe bağlı açılır.
assert.ok(
  s.settings!.org!.departments.some((d) => d.name === "Montaj" && d.directorate === "Üretim Müdürlüğü"),
);
const org = structuredClone(s.settings!.org!);
org.levels = { division: true, group: true };
org.groups = ["Genel Müdürlük"];
org.divisions = [{ name: "Operasyon Direktörlüğü", group: "Genel Müdürlük" }];
org.directorates = org.directorates.map((d) => ({
  ...d,
  division: d.name === "Üretim Müdürlüğü" ? "Operasyon Direktörlüğü" : "",
}));
assert.throws(() => call({ action: "defineOrg", org }, admin), "her müdürlük bir direktörlüğe bağlanmalı");
org.directorates = org.directorates.map((d) => ({ ...d, division: "Operasyon Direktörlüğü" }));
call({ action: "defineOrg", org }, admin);
assert.equal(s.settings!.org!.levels.group, true);
const noMontaj = structuredClone(s.settings!.org!);
noMontaj.departments = noMontaj.departments.filter((d) => d.name !== "Montaj");
assert.throws(
  () => call({ action: "defineOrg", org: noMontaj }, admin),
  "kullanıcısı olan departman silinemez",
);
call({ action: "defineLocations", locations: ["Hat 2", "Rampa 3", "Hat 2", " "] }, admin);
assert.deepEqual(s.settings!.locations, ["Hat 2", "Rampa 3"]);

// Bölüm (operasyon) ve matris
call({ action: "operation", operation: "Montaj Hattı" }, admin);
call(
  {
    action: "matrix",
    operation: "Montaj Hattı",
    pre: "on",
    operationOwner: "op2",
    gain: "kazanc",
    score: "puan",
    directorate: "Üretim Müdürlüğü",
  },
  admin,
);

// Öneri: lokasyon listeden, ortak öneren; vardiya alanı kaldırıldı.
assert.throws(() =>
  call(
    {
      action: "create",
      title: "Serbest lokasyon",
      problem: "Uzun bir açıklama metni.",
      solution: "Çözüm",
      operation: "Montaj Hattı",
      location: "Bilinmeyen yer",
    },
    by("calisan"),
  ),
);
const id = call(
  {
    action: "create",
    title: "Montaj hattında tork kontrolü",
    problem: "Tork elle kontrol ediliyor, hata kaçıyor.",
    solution: "Tork anahtarına sayaç.",
    operation: "Montaj Hattı",
    category: "Kalite",
    location: "Hat 2",
    coAuthors: ["operasyon"],
    expectedBenefit: "Ayda 5 hata önlenir",
  },
  by("calisan"),
)!;
const p = s.proposals.find((x) => x.id === id)!;
assert.equal(p.location, "Hat 2");
assert.deepEqual(p.coAuthors, ["operasyon"]);

// Yönetici kapsamı: önerenin müdürü, bölümün müdürü, direktör ve genel müdür görür; başka direktörlük görmez.
assert.ok(canSee(p, by("operasyon"), ctx()), "ortak öneren görür");
assert.ok(canSee(p, by("mudur"), ctx()), "önerenin müdürü görür");
assert.ok(managesProposal(p, by("mud2"), ctx()), "bölümün müdürü yönetir");
assert.ok(managesProposal(p, by("dir1"), ctx()), "direktör yönetir");
assert.ok(managesProposal(p, by("gm1"), ctx()), "genel müdür yönetir");
const off = structuredClone(s.settings!.org!);
off.levels = { division: false, group: false };
assert.ok(!managesProposal(p, by("dir1"), { ...ctx(), org: off }), "seviye kapalıyken direktör kapsamı yok");

// Kişiye yönlendirme: değerlendirmeye gelen öneri başka kişiye verilebilir; geri alınabilir.
call({ action: "accept", id }, by("on"));
assert.equal(p.status, STAGES[1]);
assert.equal(p.status, "Bölüm değerlendirmesi");
assert.equal(p.owner, "op2");
call({ action: "forward", id, toUser: "op3", reason: "Montaj ikinci vardiya konusu" }, by("op2"));
assert.equal(p.owner, "op3");
assert.equal(p.operation, "Montaj Hattı", "bölüm değişmez");
const fwd = s.transfers![0];
call({ action: "undoTransfer", transferId: fwd.id }, admin);
assert.equal(p.owner, "op2", "yönlendirme geri alındı");
assert.throws(() => call({ action: "undoTransfer", transferId: fwd.id }, admin), "iki kez geri alınamaz");

// Pasife alınan sorumlu: yedek zorunlu değil, yeni iş müdürüne gider ve kayıt düşülür.
by("op2").active = 0;
const id2 = call(
  {
    action: "create",
    title: "İkinci montaj önerisi",
    problem: "Malzeme hatta geç geliyor.",
    solution: "Kanban kartı.",
    operation: "Montaj Hattı",
    category: "Verimlilik",
  },
  by("calisan"),
)!;
call({ action: "accept", id: id2 }, by("on"));
const p2 = s.proposals.find((x) => x.id === id2)!;
assert.equal(p2.owner, "mud2", "pasif sorumlunun işi müdürüne gider");
assert.ok(p2.history.some((h) => h.text.includes("pasif olduğu için")));

// Toplu devir ve geri alma
by("op2").active = 1;
call({ action: "accept", id }, by("op2"));
call(
  {
    action: "addAction",
    id,
    title: "Sayaç tak",
    owner: "op2",
    due: "2026-12-01",
    description: "Tüm tork anahtarlarına",
  },
  by("op2"),
);
assert.equal(p.actions[0].description, "Tüm tork anahtarlarına");
by("op2").active = 0;
assert.throws(
  () => call({ action: "reassignUser", from: "op2", to: "op3", reason: "Ayrıldı" }, by("mud2")),
  "yalnız yönetici",
);
const r: any = call({ action: "reassignUser", from: "op2", to: "op3", reason: "Görev değişikliği" }, admin);
const row = s.matrix.find((x: any) => x.operation === "Montaj Hattı");
assert.equal(p.owner, "op3");
assert.equal(p.actions[0].owner, "op3");
assert.equal(row.operationOwner, "op3");
assert.ok(r.proposals >= 1 && r.actions === 1 && r.matrixSlots >= 1);
const userTransfer = s.transfers!.find((t) => t.kind === "user")!;
// Devirden sonra bir kayıt elle değiştirilirse geri almada atlanır.
p.actions[0].owner = "operasyon";
const undo: any = call({ action: "undoTransfer", transferId: userTransfer.id }, admin);
assert.equal(p.owner, "op2");
assert.equal(row.operationOwner, "op2");
assert.equal(p.actions[0].owner, "operasyon", "sonradan değişen kayıt korunur");
assert.equal(undo.skipped, 1);
assert.ok(userTransfer.undone);

// Toplu (batch) devir ve tek seferde geri alma
by("op2").active = 1;
call({ action: "transfer", id, owner: "op3", reason: "Toplu devir", batch: "B1" }, admin);
call({ action: "transfer", id: id2, owner: "op3", reason: "Toplu devir", batch: "B1" }, admin);
assert.equal(p.owner, "op3");
call({ action: "undoTransfer", batch: "B1" }, admin);
assert.equal(p.owner, "op2");
assert.equal(p2.owner, "mud2");

// Aksiyon kanıtı ve kurum adı
call({ action: "start", id }, by("op2"));
call(
  {
    action: "actionUpdate",
    id,
    itemId: p.actions[0].id,
    status: "Tamamlandı",
    evidence: "10 anahtara sayaç takıldı",
  },
  by("op2"),
);
assert.equal(p.actions[0].evidence, "10 anahtara sayaç takıldı");
assert.throws(() => call({ action: "orgSettings", orgName: "Üretim" }, by("mud2")));
call({ action: "orgSettings", orgName: "Üretim ve Lojistik" }, admin);
assert.equal(s.settings?.orgName, "Üretim ve Lojistik");
console.log(
  "Organization checks passed: manager/director/GM scope, optional hierarchy, definitions, locations, forward to person, inactive owner fallback, reassignment, undo (single, user, batch), action evidence, org name.",
);
