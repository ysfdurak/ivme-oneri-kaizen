// Tur 16 (26 Kasım 2026 örneklem bulguları): anonim adın yalnız tam kelime olarak gizlenmesi
// ve yetki hatalarının ayrı işaretlenmesi (sunucu 403 döner).
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { ANON_LABEL, redactProposal, scrubName } from "../lib/model";

// scrubName: tam ad değişir, adı içeren başka ad bozulmaz.
assert.equal(scrubName("Kullanıcı devri: Ali Kaya → Ayşe", "Ali Kaya"), `Kullanıcı devri: ${ANON_LABEL} → Ayşe`);
assert.equal(scrubName("Ali Kaya'ya iletildi", "Ali Kaya"), `${ANON_LABEL}'ya iletildi`);
assert.equal(scrubName("Ali Kayalı'ya devredildi", "Ali Kaya"), "Ali Kayalı'ya devredildi");
assert.equal(scrubName("Vali Kaya onayladı", "Ali Kaya"), "Vali Kaya onayladı");
assert.equal(scrubName("Ali Kaya ve Ali Kaya", "Ali Kaya"), `${ANON_LABEL} ve ${ANON_LABEL}`);
// Düzenli ifade karakterleri ad içinde sorun çıkarmaz.
assert.equal(scrubName("A.B (test) geldi", "A.B (test)"), `${ANON_LABEL} geldi`);
assert.equal(scrubName("metin", ""), "metin");

// redactProposal okurken de aynı kuralı uygular.
const p: any = {
  id: "x",
  anonymous: true,
  author: "a1",
  history: [{ at: "", actor: "b", text: "Ali Kayalı'ya yönlendirildi; Ali Kaya bilgilendirildi" }],
  actions: [],
  support: [],
};
const seen = redactProposal(p, "viewer", "Ali Kaya");
assert.equal(seen.history[0].text, `Ali Kayalı'ya yönlendirildi; ${ANON_LABEL} bilgilendirildi`);

// Yetki hatası işaretlenir (route 403 döner), kural hatası işaretlenmez (400).
const users: any[] = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);
const id = call(
  { action: "create", title: "Rampa önü işaretleme", problem: "Araçlar karışıyor.", solution: "Zemin çizgisi.", operation: s.operations[0] },
  by("calisan"),
)!;
let err: any;
try {
  call({ action: "accept", id }, by("calisan"));
} catch (e) {
  err = e;
}
assert.equal(err?.message, "Yetkiniz yok.");
assert.equal(err?.status, 403);
err = null;
try {
  call({ action: "comment", id, text: "" }, by("calisan"));
} catch (e) {
  err = e;
}
assert.ok(err, "boş yorum reddedilmeli");
assert.notEqual(err.status, 403, "kural hatası 403 değil");

console.log("round16 tests passed");
