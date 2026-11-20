// Tur 15: fikre destek (endorse). Kural: açık öneri, kendi/ortak önerin değil, aç/kapa;
// görme yetkisi gerekmez; kimlikler istemciye gitmez (endorseView), geçmişe yazılmaz.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { canEndorse, canSee, endorseView, redactProposal } from "../lib/model";

const users: any[] = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const id = call(
  {
    action: "create",
    title: "Forklift şarj alanı düzeni",
    problem: "Şarj sırası karışıyor.",
    solution: "Sıra panosu.",
    operation: s.operations[0],
  },
  by("calisan"),
)!;
const p = s.proposals.find((x) => x.id === id)!;
const historyBefore = p.history.length;

// Kendi önerisini destekleyemez.
assert.throws(() => call({ action: "endorse", id, on: true }, by("calisan")), /Kendi önerini/);
assert.equal(canEndorse(p, "calisan"), false);

// Başka bir kullanıcı görmese de destekleyebilir; iki kez desteklemek sayıyı artırmaz.
const other = users.find((u) => u.id !== "calisan" && u.role !== "admin" && !canSee(p, u, { users, matrix: s.matrix, org: s.settings?.org }));
if (other) {
  call({ action: "endorse", id, on: true }, other);
  call({ action: "endorse", id, on: true }, other);
  assert.equal(p.endorsements!.length, 1);
}
call({ action: "endorse", id, on: true }, by("mudur"));
const count = p.endorsements!.length;
assert.ok(count >= 1);
assert.equal(p.history.length, historyBefore, "destek geçmişe yazılmaz");

// Geri alma.
call({ action: "endorse", id, on: false }, by("mudur"));
assert.equal(p.endorsements!.length, count - 1);
call({ action: "endorse", id, on: true }, by("mudur"));

// Dışarı giden kopya: kimlik yok, sayı ve "ben destekledim mi" var.
const v = endorseView(redactProposal(p, "calisan"), "calisan") as any;
assert.equal(v.endorsements, undefined);
assert.equal(v.endorseCount, count);
assert.equal(v.endorsedByMe, false);
assert.equal((endorseView(p, "mudur") as any).endorsedByMe, true);
assert.ok(!JSON.stringify(v).includes('"endorsements"'));

// Ortak öneren de destekleyemez.
p.coAuthors = ["teknik"];
assert.throws(() => call({ action: "endorse", id, on: true }, by("teknik")), /Kendi önerini/);

// Kapalı öneriye destek verilmez.
p.status = "Reddedildi";
assert.equal(canEndorse(p, "puan"), false);
assert.throws(() => call({ action: "endorse", id, on: true }, by("puan")), /Kapalı kayıtta/);

console.log("round15 passed");
