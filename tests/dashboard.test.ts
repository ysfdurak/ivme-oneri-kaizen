// Durum panosu hesaplamaları ve rapor ayarı testleri.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { initialState, DEMO_USERS } from "../lib/seed";
import {
  byOwner,
  byOwnerUnit,
  mostPending,
  longestAvg,
  longestWaiting,
  statusSummary,
  actionSummary,
  actionLateDays,
  REPORT_IDS,
} from "../lib/dashboard";
const users = DEMO_USERS.map((u) => ({
  ...u,
  directorate: u.id === "it" ? "Bilgi Teknolojileri Müdürlüğü" : "Lojistik Müdürlüğü",
  active: 1,
}));
const s = initialState();
const day = 86400000;
// Bekleme sürelerini sabitle: i. açık öneri i+1 gündür bekliyor.
s.proposals.forEach((p, i) => (p.stageAt = new Date(Date.now() - (i + 1) * day - 3600000).toISOString()));
const open = s.proposals.filter((p) => !["Tamamlandı", "Reddedildi", "İptal edildi"].includes(p.status));

const owners = byOwner(s.proposals, users);
assert.equal(
  owners.reduce((a, r) => a + r.count, 0),
  open.length,
  "tüm açık öneriler bir sorumluda sayılmalı",
);
assert.equal(owners[0].key, "operasyon", "en çok bekleyen operasyon sorumlusu");
assert.ok(
  owners.every((r, i) => i === 0 || owners[i - 1].count >= r.count),
  "sayıya göre azalan",
);

const dirs = mostPending(byOwnerUnit(s.proposals, users, "directorate"));
assert.equal(dirs[0].label, "Lojistik Müdürlüğü");
const depts = longestAvg(byOwnerUnit(s.proposals, users, "department"));
const reliable = depts.filter((r) => !r.lowSample);
const firstLow = depts.findIndex((r) => r.lowSample);
assert.ok(firstLow === -1 || depts.slice(firstLow).every((r) => r.lowSample), "az kayıtlı gruplar sonda");
assert.ok(
  reliable.every((r, i) => i === 0 || reliable[i - 1].avgDays >= r.avgDays),
  "ortalamaya göre azalan",
);
const opRow = byOwner(s.proposals, users).find((r) => r.key === "operasyon")!;
const opDays = open
  .filter((p) => p.owner === "operasyon")
  .map((p) => Math.floor((Date.now() - Date.parse(p.stageAt)) / day));
assert.equal(opRow.avgDays, Math.round((opDays.reduce((a, b) => a + b, 0) / opDays.length) * 10) / 10);
assert.equal(opRow.maxDays, Math.max(...opDays));

const top = longestWaiting(s.proposals, 10);
assert.ok(top.length <= 10 && top.every((p, i) => i === 0 || top[i - 1].stageAt <= p.stageAt));
assert.ok(top.every((p) => !["Tamamlandı", "Reddedildi", "İptal edildi"].includes(p.status)));

const st = statusSummary(s.proposals);
assert.equal(
  st.reduce((a, r) => a + r.count, 0),
  open.length,
);

const a0 = open.find((p) => p.actions.length)!;
a0.actions[0].due = new Date(Date.now() - 4 * day).toISOString().slice(0, 10);
a0.actions[0].status = "Devam ediyor";
assert.equal(actionLateDays(a0.actions[0]), 4);
const acts = actionSummary(s.proposals, users);
assert.ok(acts.late.some((a) => a.id === a0.actions[0].id));
assert.equal(
  acts.byStatus.reduce((a, r) => a + r.count, 0),
  acts.total,
);

// Rapor ayarı: yalnızca yönetici, yalnızca bilinen raporlar.
const admin = users[0],
  manager = users.find((u) => u.id === "mudur")!;
assert.throws(() =>
  applyCommand(s, { action: "reportSettings", disabledReports: ["owners"] }, manager, users),
);
assert.throws(() => applyCommand(s, { action: "reportSettings", disabledReports: ["yok"] }, admin, users));
applyCommand(s, { action: "reportSettings", disabledReports: ["owners", "dirWait"] }, admin, users);
assert.deepEqual(s.settings?.disabledReports, ["owners", "dirWait"]);
assert.ok(s.audit[0].text.includes("pasif"));
applyCommand(s, { action: "reportSettings", disabledReports: [] }, admin, users);
assert.ok(s.audit[0].text.includes("aktif"));
assert.equal(REPORT_IDS.length, 9);
console.log(
  "Dashboard checks passed: owner/directorate/department grouping, averages, top 10, status and action summaries, report settings.",
);
