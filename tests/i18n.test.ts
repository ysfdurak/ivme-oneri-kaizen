// Dil desteği (lib/i18n.ts) ve İngilizce vitrin verisi.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  translate,
  translateParts,
  untranslate,
  localeFrom,
  setLocale,
  pct,
  t,
} from "../lib/i18n";
import { STAGES, CLOSED, ROLES, CATEGORY_LIST, REJECT_REASONS, NOT_IMPLEMENTED_REASONS } from "../lib/model";
import { renderEmail } from "../lib/notify";
import { IMPORT_STATUSES } from "../lib/proposal-import";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const en: Record<string, string> = read("../lib/i18n/en.json");

// 1) Sözlük bütünlüğü: her çeviri, anahtardaki yer tutucuları aynen kullanır.
const ph = (s: string) => [...new Set((s.match(/\{\d+/g) || []).map((x) => x.slice(1)))].sort().join(",");
for (const [k, v] of Object.entries(en)) assert.equal(ph(k), ph(v), "yer tutucu farkı: " + k);

// 2) Sabit listelerin hepsi İngilizcede karşılık bulur (aşamalar, kapanışlar, roller, varsayılan listeler).
for (const s of [...STAGES, ...CLOSED, ...Object.values(ROLES), ...CATEGORY_LIST, ...REJECT_REASONS, ...NOT_IMPLEMENTED_REASONS, "Revizyon bekliyor", "Kazanç düzeltmesi bekliyor"])
  assert.notEqual(translate(s as string, "en"), s, "çevrilmemiş sabit: " + s);

// 3) Çeviri kuralları
assert.equal(translate("Tamamlandı", "tr"), "Tamamlandı", "Türkçede metin değişmez");
assert.equal(translate("  Kaydet ", "en"), "  Save ", "baştaki ve sondaki boşluk korunur");
assert.equal(translate("3 öneri", "en"), "3 proposals");
assert.equal(translate("1 öneri", "en"), "1 proposal", "tekil / çoğul");
assert.equal(translate("Öneri Uygulamada aşamasına geri alındı.", "en"), "The proposal was returned to the In implementation stage.", "yakalanan aşama adı da çevrilir");
assert.equal(translate("Ali Veli", "en"), "Ali Veli", "sözlükte olmayan metin aynen kalır");
assert.equal(translate("bölüm", "en"), "unit", "küçük harfle başlayan metin");
assert.equal(translate("Kazanç onay tarihi: 2026", "en"), "Savings approval date: 2026", "etiket: değer");
assert.equal(translate("2026 · Kas · Tamamlanan", "en"), "2026 · Nov · Completed", "· ile ayrılmış parçalar");
// JSX çocukları: değişken kısım tam bir çocuğa denk gelmeli.
assert.equal(translateParts(["3", " öneri"], "en"), "3 proposals");
assert.equal(translateParts([" · ", "5", " gün gecikti"], "en"), " · 5 days overdue", "boşluk korunur");
assert.equal(translateParts(["· ort. 17 gün", " · 1 talep no girilmemiş"], "en"), null, "kalıp başka parçaya taşmaz");
assert.equal(translateParts(["Toplam ", "5", " öneri"], "en"), null);
// Geri çeviri (Excel aktarımında İngilizce sabitler)
assert.equal(untranslate("Completed", IMPORT_STATUSES), "Tamamlandı");
assert.equal(untranslate("Employee"), "Çalışan");
assert.equal(untranslate("yes"), "Evet");
assert.equal(untranslate("Something else"), "Something else");
assert.equal(localeFrom("EN-gb"), "en");
assert.equal(localeFrom("de"), null);

// 4) Sunucu tarafı: e-posta kurulumun dilinde üretilir.
setLocale("en");
const mail = renderEmail("Önerin alındı", ["Numaran: KZ-2026-0001"], { url: "https://x", label: "Öneriyi aç" });
assert.match(mail.html, /Your proposal was received/);
assert.match(mail.html, /Your number: KZ-2026-0001/);
assert.match(mail.html, /Open the proposal/);
assert.match(mail.html, /Suggestion and Kaizen Centre/);
assert.doesNotMatch(mail.html, /[çğışöü]/, "İngilizce e-postada Türkçe kalmaz");
assert.equal(pct(14), "14%");
assert.equal(t("{0} öneri", 2), "2 proposals");
setLocale("tr");
assert.equal(pct(14), "%14");
assert.match(renderEmail("Önerin alındı", []).html, /Önerin alındı/);

// 5) İngilizce vitrin verisi: Türkçe demoyla aynı yapı, metinler İngilizce, sistem kodları Türkçe.
const trState = read("../lib/vitrin/state.json"), enState = read("../lib/vitrin/en/state.json");
const trUsers = read("../lib/vitrin/users.json"), enUsers = read("../lib/vitrin/en/users.json");
assert.equal(enState.proposals.length, trState.proposals.length);
assert.equal(enUsers.length, trUsers.length);
assert.deepEqual(enState.proposals.map((p: any) => p.status), trState.proposals.map((p: any) => p.status), "aynı aşama dağılımı");
assert.deepEqual(enUsers.map((u: any) => u.username), trUsers.map((u: any) => u.username), "aynı vitrin kullanıcı adları");
const TR = /[çğışöüÇĞİŞÖÜ]/;
for (const p of enState.proposals) {
  for (const f of ["title", "problem", "solution", "operation", "category", "department", "directorate"])
    assert.doesNotMatch(String(p[f] ?? ""), TR, `İngilizce veride Türkçe: ${p.id} ${f}`);
  assert.ok(STAGES.includes(p.status) || CLOSED.includes(p.status) || ["Revizyon bekliyor", "Kazanç düzeltmesi bekliyor"].includes(p.status), "aşama kodu Türkçe kalır");
}
for (const u of enUsers) assert.doesNotMatch(u.name + u.department, TR, "İngilizce kişi ve departman");
assert.equal(enState.settings.lists.rejectReasons[0].name, "Mükerrer öneri", "kilitli sistem maddesi kod olarak kalır");
assert.ok(enState.settings.lists.rejectReasons[0].locked);
assert.equal(enState.settings.lists.gainTypes[0].name, "Parasal");

// 6) Kapsam: kaynak koddaki her Türkçe metnin İngilizcesi var (bilerek çevrilmeyenler scripts/i18n/kasitli.json).
execFileSync(process.execPath, [new URL("../scripts/i18n/anahtarlar.mjs", import.meta.url).pathname, "--strict"], { stdio: "pipe" });

console.log(`i18n tests passed: ${Object.keys(en).length} dictionary entries, placeholders, plurals, joined JSX parts, reverse lookup, e-mail language, English showcase data, source coverage.`);
