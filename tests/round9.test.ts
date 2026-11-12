// Tur 9: rapor oluşturucu (filtre, gruplama, tutar bazında ölçüler, yıl/ay) ve esnek katılım raporu.
import assert from "node:assert/strict";
import {
  runReport,
  DEFAULT_CONFIG,
  presets,
  dateOf,
  describe,
} from "../lib/report-builder";
import { participation } from "../lib/dashboard";

const P = (o: any) => ({
  id: o.id,
  title: o.id,
  problem: "",
  solution: "",
  operation: o.op || "Mal Kabul",
  category: o.cat || "Verimlilik",
  author: o.author || "a",
  coAuthors: o.co || [],
  department: o.dept || "Depo",
  directorate: o.dir || "Lojistik",
  status: o.status || "Tamamlandı",
  owner: "",
  created: o.created || "2026-01-10T08:00:00Z",
  stageAt: o.stageAt || "2026-03-15T08:00:00Z",
  due: "",
  actions: [],
  support: [],
  history: [],
  attachments: [],
  gain: o.gain,
  score: o.score,
  anonymous: o.anonymous,
  location: o.loc || "",
  campaign: o.campaign,
});
const gain = (
  amount: number,
  cost: number,
  period: string,
  approvedAt: string,
  extra: any = {},
) => ({
  amount,
  cost,
  period,
  type: "Parasal",
  approved: true,
  valid: true,
  approvedAt,
  ...extra,
});
const ps: any[] = [
  P({
    id: "A",
    gain: gain(1000, 3000, "Aylık", "2026-03-10T00:00:00Z"),
    score: { total: 80, valid: true },
    stageAt: "2026-03-15T00:00:00Z",
  }),
  P({
    id: "B",
    op: "Sevkiyat",
    gain: gain(50000, 10000, "Yıllık", "2026-03-20T00:00:00Z"),
    score: { total: 60, valid: true },
    stageAt: "2026-03-25T00:00:00Z",
    author: "b",
  }),
  P({
    id: "C",
    op: "Sevkiyat",
    gain: gain(20000, 0, "Tek seferlik", "2026-04-02T00:00:00Z"),
    score: { total: 70, valid: true },
    stageAt: "2026-04-05T00:00:00Z",
    author: "b",
    co: ["c"],
  }),
  P({
    id: "D",
    status: "Uygulamada",
    created: "2026-04-01T00:00:00Z",
    author: "c",
  }),
  P({
    id: "E",
    status: "Reddedildi",
    created: "2025-12-01T00:00:00Z",
    stageAt: "2025-12-05T00:00:00Z",
  }),
  P({ id: "F", status: "İptal edildi", created: "2026-02-01T00:00:00Z" }),
  // Onaylanmamış kazanç tutarlara girmez; parasal olmayan kazanç ayrı sayılır.
  P({
    id: "G",
    gain: {
      ...gain(99999, 0, "Yıllık", "2026-03-01T00:00:00Z"),
      approved: false,
    },
    stageAt: "2026-03-28T00:00:00Z",
  }),
  P({
    id: "H",
    gain: {
      ...gain(0, 500, "Tek seferlik", "2026-04-10T00:00:00Z"),
      type: "Ergonomi",
    },
    stageAt: "2026-04-12T00:00:00Z",
    anonymous: true,
    author: "anonim",
  }),
];
const users: any[] = [
  {
    id: "a",
    name: "Ayşe",
    department: "Depo",
    directorate: "Lojistik",
    role: "employee",
    active: 1,
  },
  {
    id: "b",
    name: "Bora",
    department: "Depo",
    directorate: "Lojistik",
    role: "employee",
    active: 1,
  },
  {
    id: "c",
    name: "Cem",
    department: "Sevkiyat",
    directorate: "Lojistik",
    role: "employee",
    active: 1,
  },
  {
    id: "d",
    name: "Deniz",
    department: "Sevkiyat",
    directorate: "Lojistik",
    role: "employee",
    active: 1,
  },
];
const run = (o: any) => runReport(ps, { ...DEFAULT_CONFIG, ...o }, users);

// Tarih türü: öneri / tamamlanma / kazanç onay tarihi.
assert.equal(
  dateOf(ps[3], "completed"),
  null,
  "tamamlanmamış öneri tamamlanma raporuna girmez",
);
assert.equal(
  dateOf(ps[6], "gainApproved"),
  null,
  "onaysız kazanç onay tarihine girmez",
);

// Tamamlananların aylık tutarı (2026): Mart ve Nisan, tarih sırasıyla.
let r = run({
  dateBasis: "completed",
  status: "completed",
  year: "2026",
  groupBy: "month",
  measures: ["completed", "gross", "cost", "net"],
  sortBy: "net",
});
assert.deepEqual(
  r.rows.map((x) => x.label),
  ["Mar 2026", "Nis 2026"],
  "zaman grupları kronolojik",
);
const mar = r.rows[0].values;
assert.equal(mar.completed, 3); // A, B, G
assert.equal(mar.gross, 12000 + 50000, "aylık × 12 + yıllık; onaysız G hariç");
assert.equal(mar.cost, 3000 + 10000);
assert.equal(mar.net, 49000);
assert.equal(r.total.net, 49000 + 20000 - 500);
assert.equal(r.matched, 5);

// Ay filtresi.
r = run({
  dateBasis: "completed",
  year: "2026",
  month: "4",
  groupBy: "none",
  measures: ["count", "nonMonetary"],
});
assert.equal(r.rows[0].values.count, 2); // C, H
assert.equal(r.rows[0].values.nonMonetary, 1);

// Bölüme göre, net kazanca göre sıralı ve ilk N.
r = run({
  dateBasis: "gainApproved",
  groupBy: "operation",
  measures: ["count", "net"],
  sortBy: "net",
});
assert.deepEqual(
  r.rows.map((x) => x.label),
  ["Sevkiyat", "Mal Kabul"],
);
assert.equal(r.rows[0].values.net, 60000);
assert.equal(
  run({
    dateBasis: "gainApproved",
    groupBy: "operation",
    measures: ["net"],
    sortBy: "net",
    limit: 1,
  }).rows.length,
  1,
);

// Durum filtresi ve iptal hariç tutma.
assert.equal(
  run({ groupBy: "none", measures: ["count"] }).total.count,
  7,
  "iptal edilen sayılmaz",
);
assert.equal(
  run({ status: "rejected", groupBy: "none", measures: ["count"] }).total.count,
  1,
);
assert.equal(
  run({ status: "open", groupBy: "none", measures: ["count"] }).total.count,
  1,
);
assert.equal(
  run({ year: "2025", groupBy: "none", measures: ["count"] }).total.count,
  1,
);

// Kişiye göre: anonim öneriler tek satırda; birlikte önerenler "öneren kişi" ölçüsüne girer.
r = run({ groupBy: "author", measures: ["count", "authors"] });
assert.ok(r.rows.some((x) => x.label === "Anonim öneriler"));
assert.equal(r.total.authors, 3, "a, b, c (anonim hariç)");
// Ortalama puan ve sonuçlanma süresi.
r = run({
  status: "completed",
  groupBy: "none",
  measures: ["avgScore", "avgDays"],
});
assert.equal(r.total.avgScore, 70);
assert.ok(r.total.avgDays > 0);
// Hazır raporlar ve özet metni.
assert.equal(presets("2026").length, 4);
assert.ok(
  presets("2026").every(
    (p) => runReport(ps, p.config, users).columns.length > 0,
  ),
);
assert.match(
  describe({
    ...DEFAULT_CONFIG,
    year: "2026",
    month: "3",
    status: "completed",
  }),
  /2026 Mar · tamamlanan/,
);

// Katılım: eşik ve listelenecek kişi sayısı esnek.
const people: any[] = users;
const many = [
  ...Array.from({ length: 7 }, (_, i) =>
    P({ id: "x" + i, author: "a", status: "Uygulamada" }),
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    P({ id: "y" + i, author: "b", status: "Uygulamada" }),
  ),
  P({ id: "z", author: "c", status: "Uygulamada" }),
];
let part = participation(many as any, people, "", 5, 10);
assert.deepEqual(
  part.buckets.map((b) => [b.label, b.count]),
  [
    ["Hiç öneri vermedi", 1],
    ["1 öneri", 1],
    ["2–4 öneri", 0],
    ["5 ve üzeri öneri", 2],
  ],
);
part = participation(many as any, people, "", 7, 1);
assert.equal(part.buckets.at(-1)!.label, "7 ve üzeri öneri");
assert.equal(part.atOrAbove, 1);
assert.equal(part.buckets.find((b) => b.key === "some")!.label, "2–6 öneri");
assert.equal(part.top.length, 1, "ilk N kişi");
assert.equal(
  participation(many as any, people, "", 3, 10).buckets.find(
    (b) => b.key === "some",
  )!.label,
  "2 öneri",
);
assert.equal(
  participation(many as any, people, "", 2, 10).buckets.length,
  3,
  "eşik 2 ise ara grup yok",
);

console.log(
  "Round 9 passed: report builder (date basis, year/month, status, grouping, money measures, sort/limit, anonymity, presets), flexible participation thresholds.",
);
