// CSV dışa aktarımı: formül sanılabilecek metinler kesme işaretiyle etkisizleşir, sayılar ve içerik bozulmaz.
import assert from "node:assert/strict";
import { csvSafe } from "../lib/csv-cell";

for (const v of ['=HYPERLINK("http://x","tıkla")', "+1+1", "@SUM(A1)", "\t=1", "\r=1", "-2+3"]) assert.equal(csvSafe(v), "'" + v);
for (const v of ["-5", "-1.250,75", "+90", "-12%", "Mal kabul", "", "1.670.500"]) assert.equal(csvSafe(v), v);
console.log("CSV tests passed: formula-like cells neutralised, numbers kept.");
