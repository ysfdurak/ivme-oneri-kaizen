"use client";
import { intlLocale, pct, translate } from "../lib/i18n";
// Durum panosu: açık önerilerin kimde, hangi birimde ve ne kadar süredir beklediğini gösterir.
// Her rapor grafik veya tablo olarak görülebilir, CSV olarak indirilebilir.
// Hesaplamalar lib/dashboard.ts içindedir; bu dosya yalnızca gösterimden sorumludur.
import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Clock,
  Download,
  ListChecks,
  Settings2,
  Table2,
  Users,
  X,
} from "lucide-react";
import {
  OrgDefinitions,
  Proposal,
  User,
  STAGE_TARGET_DAYS,
  age,
  overdueDays,
  date,
  scopeDirectorates,
} from "../lib/model";
import {
  REPORTS,
  GroupRow,
  byOwner,
  byOwnerUnit,
  byOwnerLevel,
  byLocation,
  unitAt,
  OrgLevel,
  mostPending,
  longestAvg,
  longestWaiting,
  statusSummary,
  actionSummary,
  actionLateDays,
  openOf,
  participation,
} from "../lib/dashboard";

type Props = {
  proposals: Proposal[];
  users: User[];
  operations: string[];
  disabled: string[];
  org?: OrgDefinitions;
  admin: boolean;
  onOpenProposal: (id: string) => void;
  onOpenOwner: (userId: string) => void;
  onManage: () => void;
  /** Panoyu açan kişi: katılım raporunun kişi kapsamı (yönetici → kendi müdürlükleri, sistem yöneticisi → herkes). */
  viewer: { id: string; role: string; directorate: string };
};

function csv(name: string, rows: (string | number)[][]) {
  const body =
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
      .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([body], { type: "text/csv;charset=utf-8" }),
  );
  a.download = "ivme-" + name + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Grafik/tablo geçişli rapor kartı. */
function Card({
  id,
  wide,
  table,
  chart,
  rows,
  empty,
  title,
}: {
  id: string;
  title?: string;
  wide?: boolean;
  chart: React.ReactNode;
  table: React.ReactNode;
  rows: (string | number)[][];
  empty: boolean;
}) {
  const meta = REPORTS.find((r) => r.id === id)!;
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section
      className={"panel dash-card " + (wide ? "wide" : "")}
      aria-labelledby={"r-" + id}
    >
      <div className="dash-card-head">
        <div>
          <h2 id={"r-" + id}>{title || meta.title}</h2>
          <p>{meta.hint}</p>
        </div>
        <div className="dash-tools">
          <div
            className="segmented small"
            role="group"
            aria-label={meta.title + " görünümü"}
          >
            <button
              type="button"
              className={view === "chart" ? "active" : ""}
              aria-pressed={view === "chart"}
              onClick={() => setView("chart")}
            >
              <BarChart3 size={14} /> Grafik
            </button>
            <button
              type="button"
              className={view === "table" ? "active" : ""}
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <Table2 size={14} /> Tablo
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={meta.title + " CSV indir"}
            title="CSV indir"
            disabled={empty}
            onClick={() => csv(id, rows)}
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      {empty ? (
        <p className="muted dash-empty">Bu filtrede gösterilecek kayıt yok.</p>
      ) : view === "chart" ? (
        chart
      ) : (
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label={meta.title + " tablosu"}
        >
          {table}
        </div>
      )}
    </section>
  );
}

/** Yatay çubuk grafik: üstte ad ve değer, altta çubuk. Değerler metin olarak da yazılır.
 * splitLate=true ise çubuğun gecikmiş kısmı (gecikmiş / toplam) kırmızı gösterilir. */
function Bars({
  rows,
  value,
  format,
  extra,
  onSelect,
  splitLate = false,
  limit = 8,
}: {
  rows: GroupRow[];
  value: (r: GroupRow) => number;
  format: (r: GroupRow) => string;
  extra?: (r: GroupRow) => React.ReactNode;
  onSelect?: (r: GroupRow) => void;
  splitLate?: boolean;
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map(value));
  return (
    <ol className="hbars">
      {shown.map((r) => {
        const width = (value(r) / max) * 100;
        const lateShare = splitLate && r.count ? r.overdue / r.count : 0;
        const inner = (
          <>
            <span className="hbar-head">
              <span className="hbar-label">
                <b className={r.inactive ? "overdue" : ""}>{r.label}</b>
                {r.sub && <small>{r.sub}</small>}
              </span>
              <span className="hbar-value">
                {format(r)}
                {r.lowSample && <em className="low-chip">az kayıt</em>}
                {extra && extra(r)}
              </span>
            </span>
            <span
              className={"hbar-track " + (r.lowSample ? "faded" : "")}
              aria-hidden="true"
            >
              <i style={{ width: width + "%" }}>
                {lateShare > 0 && (
                  <s style={{ width: lateShare * 100 + "%" }} />
                )}
              </i>
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(r)}>
                {inner}
              </button>
            ) : (
              <div>{inner}</div>
            )}
          </li>
        );
      })}
      {rows.length > limit && (
        <li className="muted more">
          +{rows.length - limit} satır daha · tabloda tümü
        </li>
      )}
    </ol>
  );
}

function GroupTable({
  rows,
  first,
  onSelect,
}: {
  rows: GroupRow[];
  first: string;
  onSelect?: (r: GroupRow) => void;
}) {
  return (
    <table className="mini-table">
      <thead>
        <tr>
          <th>{first}</th>
          <th>Bekleyen</th>
          <th>Ort. bekleme</th>
          <th>En uzun</th>
          <th>Hedefi aşan</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>
              {onSelect ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => onSelect(r)}
                >
                  {r.label}
                </button>
              ) : (
                r.label
              )}
              {r.sub && <small className="cell-sub">{r.sub}</small>}
            </td>
            <td>{r.count}</td>
            <td>
              {fmtDays(r.avgDays)}
              {r.lowSample && <em className="low-chip">az kayıt</em>}
            </td>
            <td>{r.maxDays} gün</td>
            <td className={r.overdue ? "overdue" : ""}>{r.overdue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
const fmtDays = (n: number) =>
  n.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) + " gün";
const groupCsv = (first: string, rows: GroupRow[]) => [
  [
    first,
    "Bekleyen öneri",
    "Ortalama bekleme (gün)",
    "En uzun (gün)",
    "Hedefi aşan",
  ],
  ...rows.map((r) => [r.label, r.count, r.avgDays, r.maxDays, r.overdue]),
];

export default function DashboardPage(props: Props) {
  const { users, disabled, admin } = props;
  const [dir, setDir] = useState("");
  const [op, setOp] = useState("");
  const [loc, setLoc] = useState("");
  // Müdürlük raporlarının seviyesi: Tanımlar'da açıksa direktörlük veya genel müdürlük seçilebilir.
  const [level, setLevel] = useState<OrgLevel>("directorate");
  const org = props.org;
  const levelName = {
    directorate: "Müdürlük",
    division: "Direktörlük",
    group: "Genel müdürlük",
  }[level];
  const directorates = Array.from(
    new Set(props.proposals.map((p) => p.directorate)),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const locations = Array.from(
    new Set(props.proposals.map((p) => p.location || "").filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const ps = useMemo(
    () =>
      props.proposals.filter(
        (p) =>
          (!dir ||
            unitAt(p.directorate, level, org) === dir ||
            p.directorate === dir) &&
          (!op || p.operation === op) &&
          (!loc || (p.location || "") === loc),
      ),
    [props.proposals, dir, op, loc, level, org],
  );
  const who = (id: string) => users.find((u) => u.id === id);
  const on = (id: string) => !disabled.includes(id);

  const open = openOf(ps);
  const owners = byOwner(ps, users);
  const dirRows = byOwnerLevel(ps, users, level, org);
  const locRows = byLocation(ps);
  const deptRows = byOwnerUnit(ps, users, "department");
  const status = statusSummary(ps);
  const longest = longestWaiting(ps, 10);
  const acts = actionSummary(ps, users);
  const avgAll = open.length
    ? open.reduce((a, p) => a + age(p.stageAt), 0) / open.length
    : 0;
  const lateCount = open.filter((p) => overdueDays(p) > 0).length;
  // Katılım: kapsamdaki aktif çalışanlar (yöneticiler ve sistem rolleri hariç), pano filtresindeki birime göre.
  const [period, setPeriod] = useState(365);
  const [threshold, setThreshold] = useState(5);
  const [topN, setTopN] = useState(10);
  const scope = admin ? null : scopeDirectorates(props.viewer, org);
  const people = users.filter(
    (u) =>
      u.active !== 0 &&
      !["admin", "director", "gm"].includes(u.role) &&
      (!scope || scope.includes(u.directorate)) &&
      (!dir ||
        unitAt(u.directorate, level, org) === dir ||
        u.directorate === dir),
  );
  const from = period
    ? new Date(Date.now() - period * 86400000).toISOString()
    : "";
  const part = participation(ps, people, from, threshold, topN);
  const lateBadge = (r: GroupRow) =>
    r.overdue ? <em className="late-chip">{r.overdue} gecikmiş</em> : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CANLI DURUM</span>
          <h1>
            Durum panosu<span className="mint-dot">.</span>
          </h1>
          <p>
            Açık öneriler kimde, hangi birimde ve ne kadar süredir bekliyor?
          </p>
        </div>
        {admin && (
          <button className="secondary" onClick={props.onManage}>
            <Settings2 size={17} /> Raporları yönet
          </button>
        )}
      </div>
      <div className="report-controls panel dash-filters">
        {org?.levels.division && (
          <label className="field">
            <span>Hiyerarşi seviyesi</span>
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value as OrgLevel);
                setDir("");
              }}
            >
              <option value="directorate">Müdürlük</option>
              <option value="division">Direktörlük</option>
              {org.levels.group && (
                <option value="group">Genel müdürlük</option>
              )}
            </select>
          </label>
        )}
        <label className="field">
          <span>
            {
              {
                directorate: "Önerenin müdürlüğü",
                division: "Önerenin direktörlüğü",
                group: "Önerenin genel müdürlüğü",
              }[level]
            }
          </span>
          <select value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="">Tümü</option>
            {[
              ...new Set(
                directorates.map((d) => unitAt(d, level, org)).filter(Boolean),
              ),
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Bölüm</span>
          <select value={op} onChange={(e) => setOp(e.target.value)}>
            <option value="">Tüm bölümler</option>
            {props.operations.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {locations.length > 0 && (
          <label className="field">
            <span>Lokasyon</span>
            <select value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">Tüm lokasyonlar</option>
              {locations.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        )}
        {(dir || op || loc) && (
          <button
            className="text-button"
            onClick={() => {
              setDir("");
              setOp("");
              setLoc("");
            }}
          >
            <X size={14} /> Filtreleri temizle
          </button>
        )}
      </div>
      <div className="dash-kpis">
        <div className="panel">
          <span>Açık öneri</span>
          <strong>{open.length}</strong>
        </div>
        <div className="panel">
          <span>Hedef süreyi aşan</span>
          <strong className={lateCount ? "overdue" : ""}>{lateCount}</strong>
        </div>
        <div className="panel">
          <span>Ortalama bekleme</span>
          <strong>{fmtDays(Math.round(avgAll * 10) / 10)}</strong>
        </div>
        <div className="panel">
          <span>Geciken aksiyon</span>
          <strong className={acts.late.length ? "overdue" : ""}>
            {acts.late.length}
          </strong>
        </div>
      </div>
      {admin && disabled.length > 0 && (
        <div className="info-strip dash-note">
          <AlertCircle size={16} /> {disabled.length} rapor pasif ve
          kullanıcılara gösterilmiyor.
        </div>
      )}
      <div className="dash-grid">
        {on("status") && (
          <Card
            id="status"
            empty={!open.length}
            rows={[
              [
                "Aşama",
                "Açık öneri",
                "Ortalama bekleme (gün)",
                "En uzun (gün)",
                "Hedef (gün)",
                "Hedefi aşan",
              ],
              ...status.map((r) => [
                r.label,
                r.count,
                r.avgDays,
                r.maxDays,
                STAGE_TARGET_DAYS[r.key] ?? "",
                r.overdue,
              ]),
            ]}
            chart={
              <Bars
                rows={status.filter((r) => r.count)}
                splitLate
                value={(r) => r.count}
                format={(r) => r.count + " öneri"}
                extra={lateBadge}
                limit={9}
              />
            }
            table={
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Aşama</th>
                    <th>Açık</th>
                    <th>Ort. bekleme</th>
                    <th>En uzun</th>
                    <th>Hedef</th>
                    <th>Hedefi aşan</th>
                  </tr>
                </thead>
                <tbody>
                  {status.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td>{r.count}</td>
                      <td>{r.count ? fmtDays(r.avgDays) : "—"}</td>
                      <td>{r.count ? r.maxDays + " gün" : "—"}</td>
                      <td>{STAGE_TARGET_DAYS[r.key]} gün</td>
                      <td className={r.overdue ? "overdue" : ""}>
                        {r.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          />
        )}
        {on("owners") && (
          <Card
            id="owners"
            empty={!owners.length}
            rows={[
              [
                "Kişi",
                "Departman",
                "Bekleyen öneri",
                "Ortalama bekleme (gün)",
                "En uzun (gün)",
                "Hedefi aşan",
              ],
              ...owners.map((r) => [
                r.label,
                r.sub || "",
                r.count,
                r.avgDays,
                r.maxDays,
                r.overdue,
              ]),
            ]}
            chart={
              <Bars
                rows={owners}
                splitLate
                value={(r) => r.count}
                format={(r) => r.count + " öneri · ort. " + fmtDays(r.avgDays)}
                extra={lateBadge}
                onSelect={(r) => props.onOpenOwner(r.key)}
              />
            }
            table={
              <GroupTable
                rows={owners}
                first="Kişi"
                onSelect={(r) => props.onOpenOwner(r.key)}
              />
            }
          />
        )}
        {on("directorates") && (
          <Card
            id="directorates"
            title={
              level === "directorate"
                ? undefined
                : "En çok öneri bekleyen " +
                  (level === "division"
                    ? "direktörlükler"
                    : "genel müdürlükler")
            }
            empty={!dirRows.length}
            rows={groupCsv(levelName, mostPending(dirRows))}
            chart={
              <Bars
                rows={mostPending(dirRows)}
                value={(r) => r.count}
                format={(r) => r.count + " öneri"}
                extra={lateBadge}
              />
            }
            table={<GroupTable rows={mostPending(dirRows)} first={levelName} />}
          />
        )}
        {on("deptWait") && (
          <Card
            id="deptWait"
            empty={!deptRows.length}
            rows={groupCsv("Departman", longestAvg(deptRows))}
            chart={
              <Bars
                rows={longestAvg(deptRows)}
                value={(r) => r.avgDays}
                format={(r) =>
                  "ort. " + fmtDays(r.avgDays) + " · " + r.count + " öneri"
                }
              />
            }
            table={<GroupTable rows={longestAvg(deptRows)} first="Departman" />}
          />
        )}
        {on("dirWait") && (
          <Card
            id="dirWait"
            title={
              level === "directorate"
                ? undefined
                : "Ortalama bekleme süresi en uzun " +
                  (level === "division"
                    ? "direktörlükler"
                    : "genel müdürlükler")
            }
            empty={!dirRows.length}
            rows={groupCsv(levelName, longestAvg(dirRows))}
            chart={
              <Bars
                rows={longestAvg(dirRows)}
                value={(r) => r.avgDays}
                format={(r) =>
                  "ort. " + fmtDays(r.avgDays) + " · " + r.count + " öneri"
                }
              />
            }
            table={<GroupTable rows={longestAvg(dirRows)} first={levelName} />}
          />
        )}
        {on("locations") && (
          <Card
            id="locations"
            empty={!locRows.length}
            rows={groupCsv("Lokasyon", locRows)}
            chart={
              <Bars
                rows={locRows}
                splitLate
                value={(r) => r.count}
                format={(r) => r.count + " öneri · ort. " + fmtDays(r.avgDays)}
                extra={lateBadge}
              />
            }
            table={<GroupTable rows={locRows} first="Lokasyon" />}
          />
        )}
        {on("longest") && (
          <Card
            id="longest"
            wide
            empty={!longest.length}
            rows={[
              [
                "Öneri no",
                "Başlık",
                "Aşama",
                "Sorumlu",
                "Sorumlu departmanı",
                "Öneren",
                "Aşamada (gün)",
                "Hedef (gün)",
                "Gecikme (gün)",
              ],
              ...longest.map((p) => [
                p.id,
                p.title,
                p.status,
                who(p.owner)?.name || "",
                who(p.owner)?.department || "",
                who(p.author)?.name || "",
                age(p.stageAt),
                STAGE_TARGET_DAYS[p.status] ?? "",
                overdueDays(p),
              ]),
            ]}
            chart={
              <ol className="hbars">
                {longest.map((p) => {
                  const max = Math.max(
                    1,
                    ...longest.map((x) => age(x.stageAt)),
                  );
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => props.onOpenProposal(p.id)}
                      >
                        <span className="hbar-head">
                          <span className="hbar-label">
                            <b>{p.title}</b>
                            <small>
                              {p.id} · {p.status} · {who(p.owner)?.name || "—"}
                              {who(p.owner)?.active === 0 ? " (pasif)" : ""}
                            </small>
                          </span>
                          <span className="hbar-value">
                            {age(p.stageAt)} gün
                            {overdueDays(p) > 0 && (
                              <em className="late-chip">
                                {overdueDays(p)} gün gecikti
                              </em>
                            )}
                          </span>
                        </span>
                        <span className="hbar-track" aria-hidden="true">
                          <i
                            style={{
                              width: (age(p.stageAt) / max) * 100 + "%",
                            }}
                          >
                            {overdueDays(p) > 0 && (
                              <s
                                style={{
                                  width:
                                    (overdueDays(p) /
                                      Math.max(1, age(p.stageAt))) *
                                      100 +
                                    "%",
                                }}
                              />
                            )}
                          </i>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            }
            table={
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Öneri</th>
                    <th>Aşama</th>
                    <th>Sorumlu</th>
                    <th>Öneren</th>
                    <th>Aşamada</th>
                    <th>Gecikme</th>
                  </tr>
                </thead>
                <tbody>
                  {longest.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => props.onOpenProposal(p.id)}
                        >
                          {p.title}
                        </button>
                        <small className="cell-sub">
                          {p.id} · {p.operation}
                        </small>
                      </td>
                      <td>{p.status}</td>
                      <td>
                        {who(p.owner)?.name || "—"}
                        <small className="cell-sub">
                          {who(p.owner)?.department}
                        </small>
                      </td>
                      <td>{who(p.author)?.name || "—"}</td>
                      <td>{age(p.stageAt)} gün</td>
                      <td className={overdueDays(p) ? "overdue" : ""}>
                        {overdueDays(p) ? overdueDays(p) + " gün" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          />
        )}
        {on("participation") && (
          <Card
            id="participation"
            wide
            empty={!part.people}
            rows={[
              ["Grup", "Kişi", "Pay (%)"],
              ...part.buckets.map((b) => [b.label, b.count, b.share]),
              [],
              [
                "Sıra",
                "Ad",
                "Departman",
                "Öneri",
                "Uygulamaya alınan",
                "Tamamlanan",
              ],
              ...part.top.map((r, i) => [
                i + 1,
                r.user.name,
                r.user.department,
                r.count,
                r.implemented,
                r.completed,
              ]),
            ]}
            chart={
              <div className="participation">
                <div className="part-controls">
                  <label className="field compact-field">
                    <span>Dönem</span>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(Number(e.target.value))}
                    >
                      <option value={30}>Son 1 ay</option>
                      <option value={90}>Son 3 ay</option>
                      <option value={180}>Son 6 ay</option>
                      <option value={365}>Son 12 ay</option>
                      <option value={0}>Tümü</option>
                    </select>
                  </label>
                  <label className="field compact-field">
                    <span>Üst grup: kaç ve üzeri öneri</span>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={threshold}
                      onChange={(e) =>
                        setThreshold(Math.max(2, Number(e.target.value) || 2))
                      }
                    />
                  </label>
                  <label className="field compact-field">
                    <span>Listelenecek kişi sayısı</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      list="part-topn"
                      value={topN}
                      onChange={(e) =>
                        setTopN(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                    <datalist id="part-topn">
                      <option value={10} />
                      <option value={15} />
                      <option value={20} />
                      <option value={50} />
                    </datalist>
                  </label>
                </div>
                <ul className="part-buckets">
                  {part.buckets.map((b) => (
                    <li key={b.key} className={"pb-" + b.key}>
                      <b>{b.count}</b>
                      <span>{b.label}</span>
                      <small>{pct(b.share)}</small>
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  {part.people} aktif çalışan · {part.contributors} kişi en az
                  bir öneri verdi · {part.atOrAbove} kişi {part.threshold} ve
                  üzeri öneri verdi
                  {part.anonymous > 0 &&
                    " · " + part.anonymous + " anonim öneri kişiye yazılmadı"}
                </p>
                {part.top.length > 0 && (
                  <>
                    <h3 className="part-h">
                      En çok öneri veren {part.top.length} kişi
                    </h3>
                    <ol className="hbars">
                      {part.top.map((r) => (
                        <li key={r.user.id}>
                          <div className="hbar-static">
                            <span className="hbar-head">
                              <span className="hbar-label">
                                <b>{r.user.name}</b>
                                <small>{r.user.department}</small>
                              </span>
                              <span className="hbar-value">
                                {r.count} öneri · {r.implemented}{" "}
                                uygulamada/tamam
                              </span>
                            </span>
                            <span className="hbar-track" aria-hidden="true">
                              <i
                                style={{
                                  width:
                                    (r.count / part.top[0].count) * 100 + "%",
                                }}
                              />
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            }
            table={
              <div className="table-scroll">
                <table className="mini-table">
                  <caption className="sr-only">En çok öneri verenler</caption>
                  <thead>
                    <tr>
                      <th>Sıra</th>
                      <th>Ad</th>
                      <th>Departman</th>
                      <th>Öneri</th>
                      <th>Uygulamaya alınan</th>
                      <th>Tamamlanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.top.map((r, i) => (
                      <tr key={r.user.id}>
                        <td>{i + 1}</td>
                        <td>{r.user.name}</td>
                        <td>{r.user.department}</td>
                        <td>{r.count}</td>
                        <td>{r.implemented}</td>
                        <td>{r.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
        {on("actions") && (
          <Card
            id="actions"
            wide
            empty={!acts.total}
            rows={[
              [
                "Öneri no",
                "Öneri",
                "Aksiyon",
                "Sorumlu",
                "Durum",
                "Hedef tarih",
                "Gecikme (gün)",
              ],
              ...openOf(ps).flatMap((p) =>
                p.actions.map((a) => [
                  p.id,
                  p.title,
                  a.title,
                  who(a.owner)?.name || "",
                  a.status,
                  a.due,
                  actionLateDays(a),
                ]),
              ),
            ]}
            chart={
              <div className="action-dash">
                <div className="action-status">
                  {acts.byStatus.map((x) => (
                    <div
                      key={x.status}
                      className={"action-pill s-" + x.status.replace(/\s/g, "")}
                    >
                      <span>{x.status}</span>
                      <strong>{x.count}</strong>
                    </div>
                  ))}
                  <div
                    className={
                      "action-pill late " + (acts.late.length ? "" : "zero")
                    }
                  >
                    <span>Hedef tarihi geçen</span>
                    <strong>{acts.late.length}</strong>
                  </div>
                </div>
                {acts.byOwner.length > 0 && (
                  <>
                    <h3 className="dash-sub">
                      <Users size={15} /> Açık aksiyonu olan kişiler
                    </h3>
                    <Bars
                      splitLate
                      rows={acts.byOwner.map((r) => ({
                        key: r.key,
                        label: r.label,
                        sub: r.sub,
                        count: r.open,
                        avgDays: 0,
                        maxDays: 0,
                        overdue: r.late,
                      }))}
                      value={(r) => r.count}
                      format={(r) => r.count + " açık aksiyon"}
                      extra={(r) =>
                        r.overdue ? (
                          <em className="late-chip">{r.overdue} gecikmiş</em>
                        ) : null
                      }
                      limit={6}
                    />
                  </>
                )}
                {acts.late.length > 0 && (
                  <>
                    <h3 className="dash-sub">
                      <Clock size={15} /> Geciken aksiyonlar
                    </h3>
                    <ul className="late-actions">
                      {acts.late.slice(0, 5).map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => props.onOpenProposal(a.proposal.id)}
                          >
                            <b>{a.title}</b>
                            <small>
                              {a.proposal.id} · {who(a.owner)?.name || "—"} ·
                              hedef {date(a.due)}
                            </small>
                            <em className="late-chip">
                              {actionLateDays(a)} gün gecikti
                            </em>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            }
            table={
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Aksiyon</th>
                    <th>Öneri</th>
                    <th>Sorumlu</th>
                    <th>Durum</th>
                    <th>Hedef</th>
                    <th>Gecikme</th>
                  </tr>
                </thead>
                <tbody>
                  {openOf(ps)
                    .flatMap((p) =>
                      p.actions.map((a) => ({ ...a, proposal: p })),
                    )
                    .sort((a, b) => actionLateDays(b) - actionLateDays(a))
                    .map((a) => (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => props.onOpenProposal(a.proposal.id)}
                          >
                            {a.proposal.id}
                          </button>
                        </td>
                        <td>{who(a.owner)?.name || "—"}</td>
                        <td>{a.status}</td>
                        <td>{date(a.due)}</td>
                        <td className={actionLateDays(a) ? "overdue" : ""}>
                          {actionLateDays(a) ? actionLateDays(a) + " gün" : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            }
          />
        )}
      </div>
      {REPORTS.every((r) => !on(r.id)) && (
        <div className="panel empty">
          <ListChecks size={26} />
          <h3>Tüm raporlar pasif</h3>
          <p>
            {admin
              ? "“Raporları yönet” ile en az bir raporu açabilirsin."
              : "Yönetici raporları kapatmış."}
          </p>
        </div>
      )}
      <div className="bottom-note">
        Ortalama sıralamalarında 3'ten az önerisi olan gruplar sona alınır ve
        “az kayıt” ile işaretlenir. Bekleme süresi, önerinin bulunduğu aşamaya
        geldiği günden bugüne sayılır. Müdürlük ve departman, öneri şu an kimde
        bekliyorsa o kişinin birimine göre hesaplanır.
      </div>
    </>
  );
}
