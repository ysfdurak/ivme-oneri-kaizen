"use client";
import { Field } from "./field";
import { intlLocale, } from "../lib/i18n";
import {
  Download,
  Building2,
  TrendingUp,
  } from "lucide-react";
import {
  STAGES,
  CLOSED,
  STAGE_TARGET_DAYS,
  overdueDays,
  Proposal,
  State,
  User,
  fmt,
  money,
  waiting,
  supportWaits,
  NOT_IMPLEMENTED,
  gainFigures,
  } from "../lib/model";
import {
  listOf,
  } from "../lib/definitions";
import ReportBuilder from "./report-builder";


/** Raporlar sayfası (Etki ve kazançlar). page.tsx'ten ayrıldı; durum App'te kalır, buraya prop olarak gelir. */
type Props = {
  state: State;
  users: User[];
  proposals: Proposal[];
  filtered: Proposal[];
  user: User;
  who: (id: string) => string;
  draft: any;
  setDraft: (d: any) => void;
  fromFilter: string;
  setFromFilter: (v: string) => void;
  toFilter: string;
  setToFilter: (v: string) => void;
  dirFilter: string;
  setDirFilter: (v: string) => void;
  deptFilter: string;
  setDeptFilter: (v: string) => void;
  authorFilter: string;
  setAuthorFilter: (v: string) => void;
  download: () => void;
};
export default function ReportsPage({
  state, users, proposals, filtered, user, who, draft, setDraft,
  fromFilter, setFromFilter, toFilter, setToFilter, dirFilter, setDirFilter,
  deptFilter, setDeptFilter, authorFilter, setAuthorFilter, download,
}: Props) {
  return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">ÖLÇÜLEBİLİR İYİLEŞTİRME</span>
            <h1>
              Etki ve kazançlar<span className="mint-dot">.</span>
            </h1>
            <p>
              Öneren, departman ve müdürlük bazında katılımı ve sonucu
              izle.
            </p>
          </div>
          <button className="secondary" onClick={download}>
            <Download size={17} /> Kayıtları dışa aktar
          </button>
        </div>
        <ReportBuilder
          proposals={proposals}
          users={users}
          operations={state.operations}
          locations={state.settings?.locations || []}
          campaigns={(state.settings?.campaigns || []).map((x) => ({
            id: x.id,
            title: x.title,
          }))}
          categories={listOf(state, "categories").map((x) => x.name)}
          userId={user.id}
        />
        <h2 className="section-title">Hazır tablolar</h2>
        <div className="report-controls panel">
          <Field label="Departman">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">Tüm departmanlar</option>
              {[...new Set(proposals.map((p) => p.department))].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Müdürlük">
            <select
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value)}
            >
              <option value="">Tüm müdürlükler</option>
              {[...new Set(proposals.map((p) => p.directorate))].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Öneren">
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
            >
              <option value="">Tüm kişiler</option>
              {users.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gönderim başlangıcı">
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
            />
          </Field>
          <Field label="Gönderim bitişi">
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
            />
          </Field>
        </div>
        <div className="kpi-grid reports-kpi">
          {["Tek seferlik", "Aylık", "Yıllık"].map((period) => (
            <div className="kpi" key={period}>
              <div>
                <span>{period} onaylı kazanç</span>
                <TrendingUp size={18} />
              </div>
              <strong>
                {money(
                  filtered
                    .filter(
                      (p) =>
                        p.gain?.valid &&
                        p.gain?.approved &&
                        !["Reddedildi", "İptal edildi"].includes(
                          p.status,
                        ) &&
                        p.gain.period === period,
                    )
                    .reduce((a, p) => a + p.gain.amount, 0),
                )}
              </strong>
              <footer>
                Brüt parasal kazanç · dönemler ayrı tutulur
              </footer>
            </div>
          ))}
        </div>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Katılım ve sonuç tablosu</h2>
              <p>
                Kazanç yalnızca geçerli ve müdür onaylı kayıtlardan
                hesaplanır. Ort. puan: 100 üzerinden, parantez içinde
                puanlanan öneri sayısı.
              </p>
            </div>
            <select
              aria-label="Gruplama"
              className="compact-select"
              value={draft.group || "department"}
              onChange={(e) =>
                setDraft({ ...draft, group: e.target.value })
              }
            >
              <option value="department">Departman bazında</option>
              <option value="directorate">Müdürlük bazında</option>
              <option value="author">Öneren bazında</option>
            </select>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tablo"
          >
            <table>
              <thead>
                <tr>
                  <th>
                    {
                      (
                        {
                          department: "Departman",
                          directorate: "Müdürlük",
                          author: "Öneren",
                        } as any
                      )[draft.group || "department"]
                    }
                  </th>
                  <th>Öneri</th>
                  {draft.group !== "author" && <th>Öneren kişi</th>}
                  <th>Açık</th>
                  <th>Tamamlanan</th>
                  <th>Ret</th>
                  <th>İptal</th>
                  <th>Tek seferlik ₺</th>
                  <th>Aylık ₺</th>
                  <th>Yıllık ₺</th>
                  <th>Maliyet ₺</th>
                  <th>İlk yıl net ₺</th>
                  <th>Ort. puan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(
                    filtered.map(
                      (p: any) => p[draft.group || "department"],
                    ),
                  ),
                ]
                  .sort(
                    (a, b) =>
                      filtered.filter(
                        (p: any) =>
                          p[draft.group || "department"] === b,
                      ).length -
                      filtered.filter(
                        (p: any) =>
                          p[draft.group || "department"] === a,
                      ).length,
                  )
                  .map((group) => {
                    const rows = filtered.filter(
                      (p: any) =>
                        p[draft.group || "department"] === group,
                    );
                    return (
                      <tr key={group}>
                        <td>
                          <b>
                            {draft.group === "author"
                              ? who(group)
                              : group}
                          </b>
                        </td>
                        <td>{rows.length}</td>
                        {draft.group !== "author" && (
                          <td>
                            {new Set(rows.map((p) => p.author)).size}
                          </td>
                        )}
                        <td>
                          {
                            rows.filter(
                              (p) => !CLOSED.includes(p.status),
                            ).length
                          }
                        </td>
                        <td>
                          {
                            rows.filter(
                              (p) => p.status === "Tamamlandı",
                            ).length
                          }
                        </td>
                        <td>
                          {
                            rows.filter(
                              (p) => p.status === "Reddedildi",
                            ).length
                          }
                        </td>
                        <td>
                          {
                            rows.filter(
                              (p) => p.status === "İptal edildi",
                            ).length
                          }
                        </td>
                        {["Tek seferlik", "Aylık", "Yıllık"].map(
                          (period) => (
                            <td key={period}>
                              {fmt(
                                rows
                                  .filter(
                                    (p) =>
                                      p.gain?.approved &&
                                      p.gain?.valid &&
                                      ![
                                        "Reddedildi",
                                        "İptal edildi",
                                      ].includes(p.status) &&
                                      p.gain.period === period,
                                  )
                                  .reduce(
                                    (a, p) => a + p.gain.amount,
                                    0,
                                  ),
                              )}
                            </td>
                          ),
                        )}
                        {(() => {
                          const approved = rows.filter(
                            (p) =>
                              p.gain?.approved &&
                              p.gain?.valid &&
                              !["Reddedildi", "İptal edildi"].includes(
                                p.status,
                              ),
                          );
                          const f = approved.map((p) =>
                            gainFigures(p.gain),
                          );
                          return (
                            <>
                              <td>
                                {fmt(f.reduce((a, x) => a + x.cost, 0))}
                              </td>
                              <td>
                                {fmt(f.reduce((a, x) => a + x.net, 0))}
                              </td>
                            </>
                          );
                        })()}
                        <td>
                          {(() => {
                            // Puan 100 üzerindendir; toplanmaz, geçerli puanların ortalaması alınır.
                            const scored = rows.filter(
                              (p) => p.score?.valid,
                            );
                            return scored.length
                              ? Math.round(
                                  scored.reduce(
                                    (a, p) => a + p.score.total,
                                    0,
                                  ) / scored.length,
                                ) +
                                  " (" +
                                  scored.length +
                                  ")"
                              : "—";
                          })()}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
        <div className="dashboard-grid report-bottom">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Durumlara göre dağılım</h2>
                <p>Filtre kapsamındaki önerilerin dağılımı</p>
              </div>
            </div>
            {[
              ...STAGES,
              "Revizyon bekliyor",
              "Kazanç düzeltmesi bekliyor",
              "Reddedildi",
              NOT_IMPLEMENTED,
              "İptal edildi",
            ].map((st) => (
              <div className="status-report" key={st}>
                <span>{st}</span>
                <div className="bar">
                  <i
                    style={{
                      width:
                        (filtered.filter((p) => p.status === st)
                          .length /
                          Math.max(filtered.length, 1)) *
                          100 +
                        "%",
                    }}
                  />
                </div>
                <b>{filtered.filter((p) => p.status === st).length}</b>
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Aşama süreleri</h2>
                <p>
                  Tamamlanan aşamaların ortalama süresi ve hedefi aşan
                  açık kayıtlar
                </p>
              </div>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label="Aşama süreleri tablosu"
            >
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Aşama</th>
                    <th>Hedef</th>
                    <th>Ort. süre</th>
                    <th>Açık</th>
                    <th>Geciken</th>
                  </tr>
                </thead>
                <tbody>
                  {[...STAGES.slice(0, 7), "Revizyon bekliyor"].map(
                    (st) => {
                      const spans = filtered.flatMap((p) =>
                        (p.stageLog || []).filter(
                          (l) => l.stage === st,
                        ),
                      );
                      const avg = spans.length
                        ? spans.reduce(
                            (a, l) =>
                              a +
                              (Date.parse(l.to) - Date.parse(l.from)),
                            0,
                          ) /
                          spans.length /
                          86400000
                        : null;
                      const open = filtered.filter(
                        (p) => p.status === st,
                      );
                      const late = open.filter(
                        (p) => overdueDays(p) > 0,
                      ).length;
                      return (
                        <tr key={st}>
                          <td>{st}</td>
                          <td>{STAGE_TARGET_DAYS[st]} gün</td>
                          <td
                            className={
                              avg !== null &&
                              avg > STAGE_TARGET_DAYS[st]
                                ? "overdue"
                                : ""
                            }
                          >
                            {avg === null
                              ? "—"
                              : avg.toLocaleString(intlLocale(), {
                                  maximumFractionDigits: 1,
                                }) + " gün"}
                          </td>
                          <td>{open.length}</td>
                          <td className={late ? "overdue" : ""}>
                            {late}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
            <p className="waiting-note">
              Ortalama süre, bu sürümden sonra aşama değiştiren
              kayıtlardan hesaplanır. Hedef süreler pilot varsayımıdır;
              şirket kurallarıyla güncellenecek.
            </p>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Ret nedenleri</h2>
                <p>
                  Reddedilen önerilerin standart nedenlere göre dağılımı
                </p>
              </div>
            </div>
            {(() => {
              const rejected = filtered.filter(
                (p) => p.status === "Reddedildi",
              );
              if (!rejected.length)
                return (
                  <p className="muted">
                    Filtre kapsamında reddedilen öneri yok.
                  </p>
                );
              return [
                ...listOf(state, "rejectReasons").map((x) => x.name),
                "Neden seçilmemiş",
              ].map((r) => {
                const n = rejected.filter(
                  (p) => (p.rejectReason || "Neden seçilmemiş") === r,
                ).length;
                if (!n) return null;
                return (
                  <div className="status-report" key={r}>
                    <span>{r}</span>
                    <div className="bar">
                      <i
                        style={{
                          width: (n / rejected.length) * 100 + "%",
                        }}
                      />
                    </div>
                    <b>{n}</b>
                  </div>
                );
              });
            })()}
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Bekleme analizi</h2>
                <p>İlerlemeyi engelleyen destek işleri</p>
              </div>
            </div>
            {state.units.map((unit) => (
              <div className="waiting-row" key={unit}>
                <span className="unit-icon">
                  <Building2 size={17} />
                </span>
                <div>
                  <b>{unit}</b>
                  <small>
                    {
                      filtered.filter((p) => waiting(p).includes(unit))
                        .length
                    }{" "}
                    öneri bu birimi bekliyor
                    {(() => {
                      const w = filtered.flatMap((p) =>
                        supportWaits(p).filter((x) => x.unit === unit),
                      );
                      const days = w
                        .filter((x) => x.days !== undefined)
                        .map((x) => x.days!);
                      const noTicket = w.filter(
                        (x) => !x.ticket,
                      ).length;
                      return (
                        <>
                          {days.length > 0 &&
                            " · ort. " +
                              Math.round(
                                days.reduce((a, c) => a + c, 0) /
                                  days.length,
                              ) +
                              " gün"}
                          {noTicket > 0 &&
                            " · " + noTicket + " talep no girilmemiş"}
                        </>
                      );
                    })()}
                  </small>
                </div>
                <strong>
                  {
                    filtered
                      .filter((p) => !CLOSED.includes(p.status))
                      .flatMap((p) =>
                        p.support.filter(
                          (a) =>
                            a.unit === unit &&
                            a.blocking &&
                            ![
                              "Tamamlandı",
                              "İptal edildi",
                              "Yapılamadı",
                            ].includes(a.status),
                        ),
                      ).length
                  }
                </strong>
                <small>iş</small>
              </div>
            ))}
            <p className="waiting-note">
              Bir öneri birden fazla birimi bekleyebilir. Kazançlar
              hesaplama dönemleriyle raporlanır; parasal olmayan
              faydalar öneri detayındadır.
            </p>
          </section>
        </div>
      </>
  );
}
