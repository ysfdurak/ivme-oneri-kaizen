// Tur 14: para birimi (Tanımlar → Para birimi). Varsayılan Türk lirası; seçilince tutarlar ve "₺" yazan metinler değişir.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { currency, money, setCurrency, withCurrency } from "../lib/model";
import { rewardText } from "../lib/rewards";
import { translate, setLocale } from "../lib/i18n";

const users: any[] = DEMO_USERS.map((u) => ({ ...u, directorate: "Lojistik Müdürlüğü", active: 1 }));
const by = (id: string) => users.find((u) => u.id === id)!;
const s = migrateState(initialState(), users);
const call = (b: any, u: any) => applyCommand(s, b, u, users);

// Varsayılan: ayar yoksa Türk lirası
assert.equal(currency(), "₺");
assert.match(money(1500), /^₺1.500$/);
assert.equal(withCurrency("Yıllık ₺"), "Yıllık ₺");

// Yalnız yönetici değiştirir, listede olmayan simge reddedilir
assert.throws(() => call({ action: "currencySettings", currency: "€" }, by("calisan")));
assert.throws(() => call({ action: "currencySettings", currency: "¥" }, by("admin")));
call({ action: "currencySettings", currency: "€" }, by("admin"));
assert.equal(s.settings!.currency, "€");

// Okunan veride simge uygulanır (sunucu: e-posta, MCP, dışa aktarım)
migrateState(s, users);
assert.equal(currency(), "€");
assert.match(money(1500), /^€/);
assert.equal(withCurrency("Uygulama maliyeti (₺)"), "Uygulama maliyeti (€)");
assert.match(rewardText("amount", 5000, ""), /€$/);
// İngilizce çeviriden sonra da simge değişir (sözlük anahtarları "₺" ile kalır)
setLocale("en");
assert.equal(withCurrency(translate("Yıllık ₺")), "Annual €");
setLocale("tr");

// Bilinmeyen kayıtlı değer güvenli biçimde ₺'ye döner
setCurrency("X");
assert.equal(currency(), "₺");
console.log("Round 14 tests passed: default Turkish lira, admin-only currency setting, validation, symbol in money/rewards/labels, English labels.");
