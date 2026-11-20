"use client";
import { getLocale, intlLocale, translate, untranslate } from "../lib/i18n";
// Eski sistemden toplu öneri aktarımı (yalnız yönetici, Tanımlar sayfası).
// Akış: şablonu indir → dosyayı seç (.xlsx/.csv) ya da yapıştır → sunucuda kontrol (dryRun) → özet → onayla.
// Aktarımda e-posta gitmez, ödül kaydı oluşmaz; sistemde olmayan önerenler pasif kullanıcı olarak açılır.
import React, { useState } from "react";
import { Download, History, Undo2, Upload } from "lucide-react";
import { IMPORT_COLUMNS, IMPORT_STATUSES } from "../lib/proposal-import";
import type { State } from "../lib/model";
import { download, parseText } from "./user-import";

const fold = (s: any) =>
  String(s ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[ıi̇]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
// Eski sistemlerde sık görülen başlık yazımları da kabul edilir.
const ALIASES: Record<string, string[]> = {
  legacyNo: ["öneri no", "oneri no", "no", "kayıt no"],
  created: ["tarih", "öneri tarihi", "giriş tarihi"],
  problem: ["sorun", "mevcut durum", "problem"],
  solution: ["çözüm", "öneri", "çözüm önerisi"],
  author: ["öneren", "sicil", "sicil no", "kullanıcı adı"],
  operation: ["bölüm", "operasyon", "uygulanacak bölüm"],
  category: ["sınıf", "öneri sınıfı", "iyileştirme alanı", "kategori"],
  status: ["durum", "statü"],
  score: ["puan", "kaizen puanı"],
};
// Başlıklar İngilizce de yazılabilir (şablonun İngilizce hali: lib/i18n/en.json).
const keyOf = (h: string) =>
  IMPORT_COLUMNS.find(
    (c) =>
      fold(c.label) === fold(h) ||
      fold(translate(c.label, "en")) === fold(h) ||
      (ALIASES[c.key] || []).some((a) => fold(a) === fold(h)),
  )?.key;
const english = getLocale() === "en";
/** İngilizce şablonun örnek satırları (sabit değerler İngilizce; aktarımda Türkçe koda döner). */
const TEMPLATE_EN = [
  "OLD-2023-118;14.02.2023;Direction signs in the forklift charging area;The charging area is confusing and people queue;Floor marking and signboard;ali.demir;Ali Demir;Warehouse;;Logistics;Productivity;;;Completed;30.04.2023;;;Monetary;48000;Annual;6500;40 min waiting per day;5 min per day;72;No",
  "OLD-2023-131;02.03.2023;Packing table height;Back pain complaints;Adjustable table;former.employee;Hasan Ak;Production;;Production;Occupational safety;;;Not implemented;20.05.2023;Budget / investment approval not obtained;Postponed to year end;;;;;;;;No",
  "OLD-2024-007;10.01.2024;Shared label printer;The printer is far away;A second printer on the line;ayse.kaya;;;;Production;Productivity;;;Unit evaluation;;;;;;;;;;;Yes",
];
/** Sabit listelerden gelen değerler İngilizce yazılmışsa Türkçe koduna döner (sunucu Türkçe kodlarla çalışır). */
const CODED = ["category", "subcategory", "status", "reason", "gainType", "gainPeriod", "anonymous"];

const cell = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

function toRows(table: any[][]) {
  const keys = (table[0] || []).map((h) => keyOf(String(h ?? "")));
  const missing = IMPORT_COLUMNS.filter(
    (c) => c.required && !keys.includes(c.key),
  ).map((c) => translate(c.label));
  const coded = (k: string, v: any) =>
    CODED.includes(k) && typeof v === "string"
      ? untranslate(v, k === "status" ? IMPORT_STATUSES : undefined)
      : v;
  const rows = table
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) =>
      Object.fromEntries(
        keys.flatMap((k, i) => (k ? [[k, coded(k, cell(r[i]))]] : [])),
      ),
    );
  return { rows, missing };
}

type Preview = {
  rows: number;
  ready: number;
  byStatus: Record<string, number>;
  withGain: number;
  newUsers: string[];
  bytes: number;
};

export default function ProposalImport({
  refresh,
  alert,
  state,
  who,
  openModal,
}: {
  refresh: () => any;
  alert: (m: string) => void;
  state: State;
  who: (id: string) => string;
  openModal: (type: string, draft: any) => void;
}) {
  const batches = state.importBatches || [];
  const itemsOf = (id: string) =>
    state.proposals.filter((p) => p.imported?.batch === id);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setError("");
    setErrors([]);
    setErrorCount(0);
    setPreview(null);
  }
  function load(table: any[][]) {
    reset();
    const { rows, missing } = toRows(table);
    if (missing.length) {
      setRows([]);
      return setError(
        "Başlık satırında bulunamayan zorunlu sütun: " +
          missing.join(", ") +
          ".",
      );
    }
    if (!rows.length) return setError("Başlık dışında dolu satır yok.");
    setRows(rows);
    send(rows, true);
  }
  async function onFile(f?: File) {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        // read-excel-file 9: varsayılan dışa aktarım yok; readSheet ilk sayfanın satırlarını döndürür.
        const { readSheet } = await import("read-excel-file/browser");
        load((await readSheet(f)) as any[][]);
      } else load(parseText(await f.text()));
    } catch {
      setError("Dosya okunamadı. .xlsx ya da .csv kaydedip tekrar deneyin.");
    }
  }
  async function send(list: any[], dryRun: boolean) {
    setBusy(true);
    reset();
    try {
      const r = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importProposals", rows: list, dryRun }),
      });
      const b: any = await r.json();
      if (!r.ok) {
        setError(b.error || "Aktarım yapılamadı.");
        setErrors(b.errors || []);
        setErrorCount(b.errorCount || 0);
        return;
      }
      if (dryRun) setPreview(b.preview);
      else {
        await refresh();
        alert(
          `${b.imported} öneri aktarıldı` +
            (b.newUsers ? `, ${b.newUsers} pasif kullanıcı açıldı.` : "."),
        );
        setRows([]);
        setPaste("");
        setOpen(false);
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }
  const template = () =>
    download(
      english ? "ivme-proposal-import-template.csv" : "ivme-oneri-aktarim-sablonu.csv",
      IMPORT_COLUMNS.map((c) => translate(c.label)).join(";") +
        "\n" +
        (english ? TEMPLATE_EN : [
          "ESKI-2023-118;14.02.2023;Forklift şarj alanına yön işareti;Şarj alanı karışıyor, sıra bekleniyor;Zemin işaretlemesi ve tabela;ali.demir;Ali Demir;Depo;;Lojistik;Verimlilik;;;Tamamlandı;30.04.2023;;;Parasal;48.000;Yıllık;6.500;Günde 40 dk bekleme;Günde 5 dk;72;Hayır",
          "ESKI-2023-131;02.03.2023;Paketleme masası yüksekliği;Bel ağrısı şikâyeti;Ayarlanabilir masa;eski.calisan;Hasan Ak;Üretim;;Üretim;İş güvenliği;;;Uygulanamadı;20.05.2023;Bütçe / yatırım onayı alınamadı;Yıl sonuna ertelendi;;;;;;;;Hayır",
          "ESKI-2024-007;10.01.2024;Etiket yazıcısı ortak kullanım;Yazıcı uzak;Hatta ikinci yazıcı;ayse.kaya;;;;Üretim;Verimlilik;;;Bölüm değerlendirmesi;;;;;;;;;;;Evet",
        ]).join("\n") +
        "\n",
    );
  const statusText = (p: Preview) =>
    Object.entries(p.byStatus)
      .map(([k, v]) => `${translate(k)}: ${v}`)
      .join(" · ");

  return (
    <section
      className="panel def-panel import-panel"
      aria-labelledby="pimp-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="pimp-title">
            <History size={18} /> Eski önerileri aktar
          </h2>
          <p>
            Önceki sistemdeki önerileri Excel ile tek seferde alın. Her kayda
            yeni İvme numarası verilir, eski numara saklanır ve aramada bulunur.
            E-posta gitmez, ödül kaydı oluşmaz; aktarılan kazançlar onaylı
            sayılır.
          </p>
        </div>
        <div className="buttons">
          <button className="secondary" onClick={template}>
            <Download size={16} /> Şablonu indir
          </button>
          {!open && (
            <button className="secondary" onClick={() => setOpen(true)}>
              <Upload size={16} /> Aktarımı başlat
            </button>
          )}
        </div>
      </div>
      {open && (
        <>
          <details className="import-help">
            <summary>Sütunlar ve kurallar</summary>
            <ul>
              {IMPORT_COLUMNS.map((c) => (
                <li key={c.key}>
                  <b>{c.label}</b>
                  {c.required ? " (zorunlu)" : ""}
                  {c.hint ? " — " + c.hint : ""}
                </li>
              ))}
            </ul>
            <p className="muted">
              Açık öneriler bulunduğu aşamada devam eder; sorumlusu atama
              tablosundan gelir. Sistemde olmayan öneren pasif kullanıcı olarak
              açılır (giriş yapamaz, raporlarda adı görünür). Aynı eski numara
              ikinci kez aktarılmaz.
            </p>
          </details>
          <div className="import-inputs">
            <label className="secondary file-button">
              <Upload size={16} /> Dosya seç (.xlsx / .csv)
              <input
                type="file"
                className="sr-only"
                accept=".xlsx,.csv,.txt"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="muted">
              ya da Excel'den kopyalayıp yapıştırın:
            </span>
          </div>
          <textarea
            aria-label="Excel'den yapıştırılan öneri satırları"
            rows={4}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="buttons">
            <button
              className="secondary"
              disabled={!paste.trim() || busy}
              onClick={() => load(parseText(paste))}
            >
              Yapıştırılanı kontrol et
            </button>
            <button
              className="text-button"
              onClick={() => {
                setOpen(false);
                setRows([]);
                reset();
              }}
            >
              Vazgeç
            </button>
          </div>
          {busy && (
            <p className="muted" role="status">
              Kontrol ediliyor…
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              {errors.length > 0 && (
                <ul>
                  {errors.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {errorCount > errors.length && (
                <p>
                  … ve {errorCount - errors.length} hata daha. İlkleri düzeltip
                  tekrar kontrol edin.
                </p>
              )}
            </div>
          )}
          {preview && (
            <div className="import-result" role="status">
              <p>
                <b>Kontrol tamam: {preview.ready} öneri aktarılmaya hazır.</b>{" "}
                {statusText(preview)}. Kazançlı kayıt: {preview.withGain}.
                {preview.newUsers.length > 0 &&
                  ` Pasif kullanıcı açılacak: ${preview.newUsers.join(", ")}.`}{" "}
                Veri boyutu sonrası: {(preview.bytes / 1024).toFixed(0)} KB /
                ~1.900 KB.
              </p>
              <div className="buttons">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => send(rows, false)}
                >
                  Aktarımı onayla
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {batches.length > 0 && (
        <div className="import-history">
          <h3>Aktarım geçmişi</h3>
          <div className="table-scroll">
            <table className="mini-table">
              <caption className="sr-only">Yapılan aktarımlar</caption>
              <thead>
                <tr>
                  <th>Aktarım</th>
                  <th>Tarih</th>
                  <th>Yapan</th>
                  <th>Öneri</th>
                  <th>
                    <span className="sr-only">İşlem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const left = itemsOf(b.id).length;
                  return (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{new Date(b.at).toLocaleString(intlLocale())}</td>
                      <td>{who(b.by)}</td>
                      <td>
                        {b.undone
                          ? `Geri alındı (${new Date(b.undone.at).toLocaleDateString(intlLocale())})`
                          : left === b.count
                            ? left
                            : `${left} / ${b.count} (bir kısmı silindi)`}
                      </td>
                      <td>
                        {!b.undone && left > 0 && (
                          <button
                            className="text-button danger-text"
                            onClick={() =>
                              openModal("deleteImported", {
                                batch: b.id,
                                items: itemsOf(b.id),
                              })
                            }
                          >
                            <Undo2 size={14} /> Geri al
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Tek tek silmek için Öneriler'de durum süzgecinden "Eski sistemden
            aktarılanlar"ı seçip kayıtları işaretleyin.
          </p>
        </div>
      )}
    </section>
  );
}
