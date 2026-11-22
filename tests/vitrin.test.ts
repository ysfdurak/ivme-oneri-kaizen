// Vitrin demosu: tarihlerin bugüne kaydırılması ve örnek verinin geçerliliği.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const DAY = 86400000;
// lib/vitrin.ts sunucu modüllerini (cloudflare:workers) içe aktardığı için rebase burada kaynak metinden alınır.
const src = readFileSync(new URL("../lib/vitrin.ts", import.meta.url), "utf8");
const body = src.slice(src.indexOf("export function rebase"), src.indexOf("export async function resetShowcase"));
const rebase = new Function("DAY", body.replace("export function rebase", "return function rebase").replace(/: string|: number|\?: string/g, ""))(DAY);
const raw = JSON.stringify({ a: "2026-01-10T08:00:00.000Z", b: "2026-01-20", c: "metin 2026-01-10", d: "2026-10" });
const out = JSON.parse(rebase(raw, "2026-01-01T00:00:00.000Z", Date.parse("2026-01-11T00:00:00.000Z")));
assert.equal(out.a, "2026-01-20T08:00:00.000Z");
assert.equal(out.b, "2026-01-30");
assert.equal(out.c, "metin 2026-01-10", "metin içindeki tarih değişmez");
assert.equal(out.d, "2026-10");
const state = JSON.parse(readFileSync(new URL("../lib/vitrin/state.json", import.meta.url), "utf8"));
const users = JSON.parse(readFileSync(new URL("../lib/vitrin/users.json", import.meta.url), "utf8"));
assert.ok(state._builtAt);
assert.ok(state.proposals.length >= 100 && state.proposals.length <= 150);
assert.ok(JSON.stringify(state).length < 600_000, "vitrin verisi ücretsiz plan için küçük kalmalı");
for (const u of ["calisan", "on.lojistik", "op.lojistik", "mudur.lojistik", "ik", "admin"])
  assert.ok(users.some((x: any) => x.username === u && x.active), u + " vitrinde olmalı");
assert.ok(!JSON.stringify(users).includes("Yusuf"), "vitrinde gerçek kişi adı yok");
// Sunucu vitrinde myPrefs'i reddeder; arayüz bildirim tercihi düğmesini vitrinde göstermemeli.
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const prefsButton = page.indexOf('aria-label="Bildirim tercihim"');
assert.ok(prefsButton > 0);
assert.ok(page.lastIndexOf("{!showcase && (", prefsButton) > page.lastIndexOf("</div>", prefsButton), "bildirim tercihi düğmesi vitrinde gizli olmalı");
console.log("Vitrin tests passed: date rebasing, demo data size and roles.");
