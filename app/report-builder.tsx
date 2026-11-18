"use client";
import { intlLocale, translate } from "../lib/i18n";
// Rapor oluştur: filtre, gruplama ve ölçüleri kullanıcı seçer; hazır raporlarla başlar, kendi raporunu kaydeder.
// Hesaplar lib/report-builder.ts içindedir. Kayıtlı raporlar bu tarayıcıda kişiye özel saklanır.
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Table2,
  Trash2,
} from "lucide-react";
import type { Proposal, User } from "../lib/model";
import { currency } from "../lib/model";
import {
  DATE_BASES,
  DEFAULT_CONFIG,
  GROUPS,
  MEASURES,
  monthNames,
  ReportConfig,
  dateOf,
  describe,
  presets,
  runReport,
} from "../lib/report-builder";

type Props = {
  proposals: Proposal[];
  users: User[];
  operations: string[];
  locations: string[];
  campaigns: { id: string; title: string }[];
  /** Öneri sınıfları (Tanımlar'dan; pasifler dahil, eski kayıtlar için). */
  categories: string[];
  userId: string;
};

// Para, uygulamanın geri kalanıyla aynı biçimde: sembol önde (₺1.670.500 / $1,670,500).
const fmt = (n: number, money?: boolean) =>
  money
    ? currency() + n.toLocaleString(intlLocale(), { maximumFractionDigits: 0 })
    : n.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });

function csv(name: string, rows: (string | number)[][]) {
  const text =
    "﻿" +
    rows
      .map((r) =>
        r
          .map(
            (x) =>
              '"' +
              translate(String(x ?? ""))
                .replace(/"/g, '""')
                .replace(/^[=+@-]/, "'") +
              '"',
          )
          .join(";"),
      )
      .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ReportBuilder({
  proposals,
  users,
  operations,
  locations,
  campaigns,
  categories,
  userId,
}: Props) {
  const thisYear = String(new Date().getFullYear());
  const [c, setC] = useState<ReportConfig>(presets(thisYear)[0].config);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [saved, setSaved] = useState<ReportConfig[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const key = "ivme-raporlarim-" + userId;
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {}
  }, [key]);
  const persist = (list: ReportConfig[]) => {
    setSaved(list);
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  };
  const set = (patch: Partial<ReportConfig>) => setC({ ...c, ...patch });
  const years = useMemo(
    () =>
      [
        ...new Set(
          proposals
            .map((p) => dateOf(p, c.dateBasis)?.slice(0, 4))
            .filter(Boolean) as string[],
        ),
      ]
        .sort()
        .reverse(),
    [proposals, c.dateBasis],
  );
  const directorates = useMemo(
    () =>
      [...new Set(proposals.map((p) => p.directorate).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    [proposals],
  );
  const departments = useMemo(
    () =>
      [
        ...new Set(
          proposals
            .filter((p) => !c.directorate || p.directorate === c.directorate)
            .map((p) => p.department)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [proposals, c.directorate],
  );
  const hasImported = useMemo(
    () => proposals.some((p: any) => p.legacyNo),
    [proposals],
  );
  const result = useMemo(
    () => runReport(proposals, c, users, campaigns),
    [proposals, c, users, campaigns],
  );
  const primary =
    result.columns.find((x) => x.id === c.sortBy) || result.columns[0];
  const max = Math.max(
    1,
    ...result.rows.map((r) => Math.abs(r.values[primary.id] || 0)),
  );
  const groupLabel = GROUPS.find((g) => g.id === c.groupBy)!.label;
  const toggleMeasure = (id: any) => {
    const has = c.measures.includes(id);
    const measures = has
      ? c.measures.filter((m) => m !== id)
      : [...c.measures, id];
    if (!measures.length) return;
    set({ measures, sortBy: has && c.sortBy === id ? measures[0] : c.sortBy });
  };
  const exportCsv = () =>
    csv("ivme-rapor-" + new Date().toISOString().slice(0, 10) + ".csv", [
      [c.name || "İvme raporu", describe(c)],
      [],
      [groupLabel, ...result.columns.map((x) => x.label)],
      ...result.rows.map((r) => [
        r.label,
        ...result.columns.map((x) => r.values[x.id]),
      ]),
      ["Toplam", ...result.columns.map((x) => result.total[x.id])],
    ]);
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
    all = "Tümü",
  ) => (
    <label className="field compact-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{all}</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="panel report-builder" aria-labelledby="rb-title">
      <div className="rb-head">
        <div>
          <h2 id="rb-title">
            <SlidersHorizontal size={18} aria-hidden /> Rapor oluştur
          </h2>
          <p className="muted">
            Hazır bir raporla başla ya da filtre, gruplama ve ölçüleri kendin
            seç. Yalnız görebildiğin öneriler hesaplanır.
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          {showFilters ? "Ayarları gizle" : "Ayarları göster"}
        </button>
      </div>

      <div className="rb-presets" role="group" aria-label="Hazır raporlar">
        {presets(thisYear).map((p) => (
          <button
            key={p.id}
            type="button"
            className={
              "chip" +
              (c.name === undefined &&
              JSON.stringify(c) === JSON.stringify(p.config)
                ? " active"
                : "")
            }
            onClick={() => setC(p.config)}
          >
            {p.title}
          </button>
        ))}
        {saved.map((s, i) => (
          <span key={i} className="chip saved">
            <button type="button" onClick={() => setC(s)}>
              {s.name}
            </button>
            <button
              type="button"
              className="chip-x"
              aria-label={s.name + " raporunu sil"}
              onClick={() => persist(saved.filter((_, j) => j !== i))}
            >
              <Trash2 size={13} />
            </button>
          </span>
        ))}
      </div>

      {showFilters && (
        <div className="rb-settings">
          <fieldset>
            <legend>Dönem</legend>
            <label className="field compact-field">
              <span>Tarih türü</span>
              <select
                aria-label="Tarih türü"
                value={c.dateBasis}
                onChange={(e) => set({ dateBasis: e.target.value as any })}
              >
                {DATE_BASES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            {select(
              "Yıl",
              c.year,
              (v) => set({ year: v }),
              years.map((y) => [y, y]),
              "Tüm yıllar",
            )}
            {select(
              "Ay",
              c.month,
              (v) => set({ month: v }),
              monthNames().map((m, i) => [String(i + 1), m]),
              "Tüm aylar",
            )}
          </fieldset>
          <fieldset>
            <legend>Filtre</legend>
            <label className="field compact-field">
              <span>Durum</span>
              <select
                aria-label="Durum"
                value={c.status}
                onChange={(e) => set({ status: e.target.value as any })}
              >
                <option value="all">Hepsi (iptal hariç)</option>
                <option value="open">Açık</option>
                <option value="implemented">Uygulamaya alınan</option>
                <option value="completed">Tamamlanan</option>
                <option value="rejected">Reddedilen</option>
                <option value="notImplemented">Uygulanamayan</option>
              </select>
            </label>
            {select(
              "Bölüm",
              c.operation,
              (v) => set({ operation: v }),
              operations.map((o) => [o, o]),
            )}
            {select(
              "Müdürlük",
              c.directorate,
              (v) => set({ directorate: v, department: "" }),
              directorates.map((d) => [d, d]),
            )}
            {select(
              "Departman",
              c.department,
              (v) => set({ department: v }),
              departments.map((d) => [d, d]),
            )}
            {select(
              "İyileştirme alanı",
              c.category,
              (v) => set({ category: v }),
              categories.map((x) => [x, x]),
            )}
            {locations.length > 0 &&
              select(
                "Lokasyon",
                c.location,
                (v) => set({ location: v }),
                locations.map((x) => [x, x]),
              )}
            {campaigns.length > 0 &&
              select(
                "Kampanya",
                c.campaign,
                (v) => set({ campaign: v }),
                campaigns.map((x) => [x.id, x.title]),
              )}
            {hasImported &&
              select(
                "Aktarılan öneriler",
                c.imported || "",
                (v) => set({ imported: v as any }),
                [
                  ["exclude", "Hariç tut"],
                  ["only", "Yalnız aktarılanlar"],
                ],
                "Dahil",
              )}
          </fieldset>
          <fieldset>
            <legend>Görünüm</legend>
            <label className="field compact-field">
              <span>Grupla</span>
              <select
                aria-label="Grupla"
                value={c.groupBy}
                onChange={(e) => set({ groupBy: e.target.value as any })}
              >
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field compact-field">
              <span>Sırala / grafikte göster</span>
              <select
                aria-label="Sırala / grafikte göster"
                value={c.sortBy}
                onChange={(e) => set({ sortBy: e.target.value as any })}
              >
                {result.columns.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="label">Ada göre</option>
              </select>
            </label>
            <label className="field compact-field">
              <span>İlk kaç satır</span>
              <input
                aria-label="İlk kaç satır"
                type="number"
                min={0}
                max={500}
                list="rb-limit"
                value={c.limit || ""}
                placeholder="Hepsi"
                onChange={(e) =>
                  set({ limit: Math.max(0, Number(e.target.value) || 0) })
                }
              />
              <datalist id="rb-limit">
                <option value={5} />
                <option value={10} />
                <option value={15} />
                <option value={20} />
              </datalist>
            </label>
          </fieldset>
          <fieldset className="rb-measures">
            <legend>Ölçüler</legend>
            {MEASURES.map((m) => (
              <label
                key={m.id}
                className={
                  "chip" + (c.measures.includes(m.id) ? " active" : "")
                }
                title={m.hint}
              >
                <input
                  type="checkbox"
                  checked={c.measures.includes(m.id)}
                  onChange={() => toggleMeasure(m.id)}
                />
                {m.label}
              </label>
            ))}
          </fieldset>
        </div>
      )}

      <div className="rb-toolbar">
        <p className="muted">
          <b>{result.matched}</b> öneri · {describe(c)}
        </p>
        <div className="buttons">
          <div
            className="segmented small"
            role="group"
            aria-label="Rapor görünümü"
          >
            <button
              type="button"
              className={view === "chart" ? "active" : ""}
              onClick={() => setView("chart")}
            >
              <BarChart3 size={15} /> Grafik
            </button>
            <button
              type="button"
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              <Table2 size={15} /> Tablo
            </button>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={exportCsv}
            disabled={!result.rows.length}
          >
            <Download size={15} /> Excel
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setC({ ...DEFAULT_CONFIG })}
          >
            <RotateCcw size={14} /> Sıfırla
          </button>
        </div>
      </div>

      {!result.rows.length ? (
        <p className="muted rb-empty">
          Bu seçimlerle öneri yok. Yılı, ayı ya da tarih türünü değiştirmeyi
          dene.
        </p>
      ) : view === "chart" ? (
        <ol
          className="hbars rb-chart"
          aria-label={
            primary.label +
            ", " +
            groupLabel.toLocaleLowerCase("tr") +
            " bazında"
          }
        >
          {result.rows.map((r) => {
            const v = r.values[primary.id] || 0;
            return (
              <li key={r.key}>
                <div className="hbar-static">
                  <span className="hbar-head">
                    <span className="hbar-label">
                      <b>{r.label}</b>
                      <small>
                        {result.columns
                          .filter((x) => x.id !== primary.id)
                          .map(
                            (x) =>
                              translate(x.label.replace(/ ₺$/, "")) +
                              " " +
                              fmt(r.values[x.id], x.money),
                          )
                          .join(" · ")}
                      </small>
                    </span>
                    <span className="hbar-value">{fmt(v, primary.money)}</span>
                  </span>
                  <span className="hbar-track" aria-hidden="true">
                    <i
                      className={v < 0 ? "negative" : ""}
                      style={{ width: (Math.abs(v) / max) * 100 + "%" }}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Rapor tablosu"
        >
          <table className="mini-table rb-table">
            <thead>
              <tr>
                <th>{groupLabel}</th>
                {result.columns.map((x) => (
                  <th key={x.id} className="num">
                    {x.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  {result.columns.map((x) => (
                    <td key={x.id} className="num">
                      {fmt(r.values[x.id], x.money)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Toplam</th>
                {result.columns.map((x) => (
                  <th key={x.id} className="num">
                    {fmt(result.total[x.id], x.money)}
                  </th>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <form
        className="rb-save"
        onSubmit={(e) => {
          e.preventDefault();
          const name = saveName.trim();
          if (!name) return;
          persist(
            [...saved.filter((s) => s.name !== name), { ...c, name }].slice(
              -20,
            ),
          );
          setC({ ...c, name });
          setSaveName("");
        }}
      >
        <label className="field compact-field">
          <span>Bu raporu kaydet</span>
          <input
            aria-label="Bu raporu kaydet"
            value={saveName}
            maxLength={50}
            placeholder="Ör. Lojistik aylık kazanç"
            onChange={(e) => setSaveName(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={!saveName.trim()}>
          <Save size={15} /> Kaydet
        </button>
        <small className="muted">
          Kayıtlı raporlar bu cihazda, yalnız sana görünür.
        </small>
      </form>
    </section>
  );
}
