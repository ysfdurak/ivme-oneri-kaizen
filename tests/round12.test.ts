// Tur 12: eski sistemden toplu öneri aktarımı (doğrulama, numara, pasif öneren, kazanç/puan, rapor süzgeci).
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { STAGES } from "../lib/model";
import { planImport, parseDate, parseNum } from "../lib/proposal-import";
import { runReport, DEFAULT_CONFIG } from "../lib/report-builder";
import { gainFigures } from "../lib/model";

const users: any[] = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const s = migrateState(initialState(), users);
const admin = users.find((u) => u.id === "admin");
const op = s.operations[0];
const dept = s.settings!.org!.departments[0].name;

// Ayrıştırıcılar
assert.equal(parseDate("12.03.2025")!.slice(0, 10), "2025-03-12");
assert.equal(parseDate("2025-03-12")!.slice(0, 10), "2025-03-12");
assert.equal(parseDate("2025-03-12T00:00:00.000Z")!.slice(0, 10), "2025-03-12");
assert.equal(parseDate("31.02.2025"), null);
assert.equal(parseNum("12.500,50"), 12500.5);
assert.equal(parseNum("48.000"), 48000, "Türkçe binlik ayıracı");
assert.equal(parseNum("₺ 6 500"), 6500);
assert.equal(parseNum(1234.5), 1234.5);

const base = (o: any = {}) => ({
  legacyNo: "E-1",
  created: "14.02.2023",
  title: "Forklift şarj alanı işareti",
  problem: "Şarj alanı karışık.",
  solution: "Zemin işaretlemesi.",
  author: "calisan",
  operation: op,
  category: "Verimlilik",
  status: "Tamamlandı",
  stageAt: "30.04.2023",
  gainType: "Parasal",
  gainAmount: "48.000",
  gainPeriod: "Yıllık",
  gainCost: "6.500",
  score: "72",
  ...o,
});

// Hata satırları: satır numarasıyla, tümü birlikte raporlanır.
{
  const r = planImport(
    [
      base(),
      base({ legacyNo: "E-1" }),
      base({ legacyNo: "E-2", status: "Bilinmiyor" }),
      base({ legacyNo: "E-3", status: "Uygulanamadı", reason: "", gainType: "", gainAmount: "", gainCost: "", score: "" }),
      base({ legacyNo: "E-4", author: "yok.kisi" }),
      base({ legacyNo: "E-5", status: "Tamamlandı", gainType: "", gainAmount: "", gainCost: "" }),
      base({ legacyNo: "E-6", status: "Puanlama" }),
      base({ legacyNo: "E-7", created: "2099-01-01" }),
    ],
    s,
    users,
  );
  const has = (t: string) => assert.ok(r.errors.some((e) => e.includes(t)), "beklenen hata: " + t + "\n" + r.errors.join("\n"));
  has("Satır 3: eski no E-1 dosyada iki kez var");
  has("Satır 4: durum tanınmadı");
  has("Satır 5: uygulanamama nedeni");
  has("Satır 6: yok.kisi sistemde yok; pasif kullanıcı için öneren adı gerekli");
  has("Satır 7: Tamamlandı durumundaki öneride kazanç bilgisi gerekli");
  has("Satır 8: puan yalnız Tamamlandı");
  has("Satır 9: öneri tarihi gelecekte");
  assert.equal(r.plan.length, 1, "yalnız hatasız satır plana girer");
}

// Geçerli aktarım: kapalı + açık + pasif öneren + anonim.
const rows = [
  base(),
  base({ legacyNo: "E-2", author: "eski.calisan", authorName: "Hasan Ak", authorDepartment: dept, status: "Reddedildi", reason: "Mükerrer öneri", reasonNote: "Aynısı var", gainType: "", gainAmount: "", gainCost: "", score: "" }),
  base({ legacyNo: "E-3", status: "Uygulanamadı", reason: "Bütçe / yatırım onayı alınamadı", gainType: "", gainAmount: "", gainCost: "", score: "" }),
  base({ legacyNo: "E-4", status: STAGES[1], created: "10.01.2024", stageAt: "", gainType: "", gainAmount: "", gainCost: "", score: "", anonymous: "Evet" }),
  base({ legacyNo: "E-5", status: STAGES[5], score: "" }),
];
const r = planImport(rows, s, users);
assert.deepEqual(r.errors, [], r.errors.join("\n"));
assert.equal(r.newUsers.length, 1);
assert.equal(r.newUsers[0].username, "eski.calisan");
assert.deepEqual(r.summary.byStatus, { Tamamlandı: 1, Reddedildi: 1, Uygulanamadı: 1, [STAGES[1]]: 1, [STAGES[5]]: 1 });

// Yalnız yönetici aktarır.
assert.throws(() => applyCommand(structuredClone(s), { action: "importProposals", plan: r.plan }, users[1], users), /yönetici/);

const all = [...users, { id: "u-eski", username: "eski.calisan", name: "Hasan Ak", department: dept, directorate: "Lojistik Müdürlüğü", role: "employee", active: 0 }];
const before = s.proposals.length;
const maxBefore = Math.max(...s.proposals.map((p) => Number(p.id.split("-").at(-1))));
const n = applyCommand(s, { action: "importProposals", plan: r.plan, newUserIds: ["u-eski"] }, admin, all);
assert.equal(n, 5);
assert.equal(s.proposals.length, before + 5);
assert.equal((s as any)._events, undefined, "aktarım e-posta olayı üretmez");
assert.equal((s.rewards || []).length, 0, "aktarım ödül kaydı üretmez");
const get = (no: string) => s.proposals.find((p) => p.legacyNo === no)!;
const done = get("E-1");
assert.ok(Number(done.id.split("-").at(-1)) > maxBefore, "yeni İvme numarası verilir");
assert.equal(done.imported!.by, "admin");
assert.equal(done.owner, "");
assert.equal(done.gain.approved, true, "aktarılan kazanç onaylı sayılır");
assert.equal(gainFigures(done.gain).net, 41500);
assert.equal(done.score.total, 72);
assert.equal(done.score.imported, true);
assert.equal(done.created.slice(0, 10), "2023-02-14");
assert.equal(get("E-2").author, "u-eski", "pasif öneren kullanıcıya bağlanır");
assert.equal(get("E-2").rejectReason, "Mükerrer öneri");
assert.equal(get("E-3").notImplemented!.reason, "Bütçe / yatırım onayı alınamadı");
const open = get("E-4");
assert.equal(open.status, STAGES[1]);
assert.equal(open.owner, "operasyon", "açık öneri atama tablosundaki sorumluya düşer");
assert.equal(open.anonymous, true);
const g = get("E-5");
assert.equal(g.gain.approved, false, "Kazanç onayı aşamasındaki kazanç onay bekler");
assert.equal(g.owner, "mudur", "kazanç onayı değerlendirenin müdürüne düşer");
assert.ok(s.audit[0].text.includes("5 öneri"));

// Aynı dosya ikinci kez aktarılamaz.
assert.ok(planImport(rows, s, all).errors.some((e) => e.includes("daha önce aktarılmış")));

// Rapor süzgeci: dahil / hariç / yalnız aktarılanlar.
const cfg = { ...DEFAULT_CONFIG, groupBy: "none" as const, measures: ["count" as const], status: "all" as const };
const count = (imported: any) => runReport(s.proposals, { ...cfg, imported }, all).rows.reduce((a: number, x: any) => a + x.values.count, 0);
const total = count(""), only = count("only"), excl = count("exclude");
assert.equal(only, 5);
assert.equal(total, only + excl);
// Silme ve geri alma
{
  const batch = s.importBatches![0];
  assert.equal(batch.count, 5);
  assert.ok(batch.id.startsWith("AKT-"));
  assert.ok(s.proposals.filter((p) => p.imported?.batch === batch.id).length === 5);
  const native = s.proposals.find((p) => !p.legacyNo)!;
  assert.throws(() => applyCommand(s, { action: "deleteImported", ids: [native.id] }, admin, all), /Yalnız eski sistemden/);
  assert.throws(() => applyCommand(s, { action: "deleteImported", ids: [get("E-1").id] }, users[1], all), /yönetici/);
  // Ödenmiş ödülü olan kayıt silinemez
  const e1 = get("E-1");
  s.rewards = [{ id: "OD-X", proposalId: e1.id, status: "Ödendi" } as any];
  assert.throws(() => applyCommand(s, { action: "deleteImported", ids: [e1.id] }, admin, all), /Ödülü ödenmiş/);
  s.rewards = [{ id: "OD-Y", proposalId: e1.id, status: "Onay bekliyor" } as any];
  // Mükerrer bağlantısı temizlenir
  native.duplicateOf = e1.id;
  const r1: any = applyCommand(s, { action: "deleteImported", ids: [e1.id] }, admin, all);
  assert.equal(r1.removed, 1);
  assert.equal(s.proposals.some((p) => p.legacyNo === "E-1"), false);
  assert.equal(s.rewards.length, 0, "silinen kaydın ödül kaydı da kalkar");
  assert.equal(native.duplicateOf, undefined);
  assert.equal(batch.undone, undefined, "paket kısmen silinince geri alınmış sayılmaz");
  assert.deepEqual(r1.userCandidates, []);
  // Paketi geri al: kalan 4 kayıt silinir, pasif kullanıcı silinmeye aday olur
  const r2: any = applyCommand(s, { action: "deleteImported", batch: batch.id }, admin, all);
  assert.equal(r2.removed, 4);
  assert.equal(s.proposals.some((p) => p.legacyNo), false);
  assert.ok(batch.undone);
  assert.deepEqual(r2.userCandidates, batch.newUsers);
  assert.throws(() => applyCommand(s, { action: "deleteImported", batch: batch.id }, admin, all), /zaten geri alındı/);
  // Geri alınan dosya yeniden aktarılabilir
  assert.deepEqual(planImport(rows, s, all).errors, []);
}
console.log("Round 12 tests passed: import parsing, row errors, numbering, passive authors, gains, scores, no mail/reward, report filter, delete & undo.");
