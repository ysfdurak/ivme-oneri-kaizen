// Kasım 2026 iyileştirmelerinin süreç testleri: yorum, ret nedeni, kabul notu, aşama süreleri, görünürlük.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { initialState, DEMO_USERS } from "../lib/seed";
import { STAGES, canSee, overdueDays, REJECT_REASONS } from "../lib/model";
const users = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = initialState();
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const create = () =>
  call(
    { action: "create", title: "Görünürlük testi", problem: "Rampa önünde palet birikiyor.", solution: "Ara stok alanı.", operation: "Mal Kabul", category: "Verimlilik" },
    by("calisan"),
  )!;

// Ön değerlendirici kabul ettikten sonra kaydı görmeye devam eder; ilgisiz destek kullanıcısı görmez.
const id = create();
const p = s.proposals.find((x) => x.id === id)!;
call({ action: "accept", id, note: "Toplama'daki benzer uygulamaya bakılsın." }, by("on"));
assert.equal(p.status, STAGES[1]);
assert.ok(canSee(p, by("on")), "ön değerlendirici kabul sonrası görebilmeli");
assert.ok(!canSee(p, by("it")), "ilgisiz kullanıcı görmemeli");
assert.ok(p.history.some((h) => h.text.startsWith("Kabul notu: Toplama")));
assert.equal(p.stageLog?.[0].stage, STAGES[0]);

// Yorum: görebilen herkes yazabilir, göremeyen yazamaz, kapalı kayıtta da yazılabilir.
call({ action: "comment", id, text: "Hangi rampa?" }, by("operasyon"));
call({ action: "comment", id, text: "3 numaralı rampa." }, by("calisan"));
assert.equal(p.comments?.length, 2);
assert.throws(() => call({ action: "comment", id, text: "Merhaba" }, by("it")));
assert.throws(() => call({ action: "comment", id, text: " " }, by("calisan")));

// Ret nedeni: listeden olmalı, kayda ve geçmişe yazılır.
assert.throws(() => call({ action: "reject", id, reason: "Uygun değil", reasonCode: "Uydurma" }, by("operasyon")));
call({ action: "reject", id, reason: "Rampa düzeni zaten değişiyor.", reasonCode: REJECT_REASONS[1] }, by("operasyon"));
assert.equal(p.status, "Reddedildi");
assert.equal(p.rejectReason, "Zaten uygulanıyor");
call({ action: "comment", id, text: "Teşekkürler, anladım." }, by("calisan"));
assert.equal(p.comments?.length, 3);

// Revizyon süresi de aşama kaydına girer.
const id2 = create();
const p2 = s.proposals.find((x) => x.id === id2)!;
call({ action: "revision", id: id2, reason: "Fotoğraf ekleyin" }, by("on"));
assert.equal(p2.stageLog?.at(-1)?.stage, STAGES[0]);

// Gecikme: hedef süreyi aşan açık kayıt gecikmiş sayılır.
p2.status = STAGES[0];
p2.stageAt = new Date(Date.now() - 6 * 86400000).toISOString();
assert.equal(overdueDays(p2), 3);
console.log("Improvement checks passed: visibility after acceptance, acceptance note, comments, reject reasons, stage log, overdue.");
