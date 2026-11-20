"use client";
import ProposalImport from "./proposal-import";
// Tanımlar (yalnız sistem yöneticisi): bölümler, lokasyonlar, organizasyon hiyerarşisi, destek birimleri, kurum adı.
// Organizasyon: Departman → Müdürlük → (Direktörlük) → (Genel Müdürlük). Üst iki seviye isteğe bağlı açılır.
import React, { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Layers,
  MapPin,
  Network,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { CURRENCIES, OrgDefinitions, State, User } from "../lib/model";
import NotifySettings from "./notify-settings";
import QrSheet from "./qr-sheet";
import CampaignSettings from "./campaign-settings";
import RewardSettings from "./reward-settings";
import DefinitionLists from "./definition-lists";

type Props = {
  state: State;
  users: User[];
  busy: boolean;
  who: (id: string) => string;
  command: (data: any, close?: boolean, success?: string) => Promise<any>;
  openModal: (type: string, data?: any) => void;
  orgName: string;
  alert: (m: string) => void;
  /** Kurulu paket: "ai" ise yapay zekâ (MCP) ayarı görünür. */
  edition?: string;
  refresh?: () => any;
};

const emptyOrg: OrgDefinitions = {
  departments: [],
  directorates: [],
  divisions: [],
  groups: [],
  levels: { division: false, group: false },
};

// Bir seviyedeki satırları (ad + üst birim) düzenleyen tablo. Bileşen dışında tanımlıdır ki yazarken odak kaybolmasın.
function LevelTable<T extends { name: string }>({
  title,
  rows,
  parentKey,
  parentLabel,
  parents,
  onChange,
  note,
  lockRow,
}: {
  title: string;
  rows: T[];
  parentKey?: keyof T;
  parentLabel?: string;
  parents?: string[];
  onChange: (rows: T[]) => void;
  note?: (r: T) => string;
  lockRow?: (r: T) => string | null;
}) {
  return (
    <div className="level-table">
      <h3>{title}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Ad</th>
            {parentKey && <th>{parentLabel}</th>}
            <th>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const lock = lockRow?.(r);
            return (
              <tr key={i}>
                <td>
                  <input
                    aria-label={title + " adı"}
                    value={r.name}
                    maxLength={80}
                    onChange={(e) =>
                      onChange(
                        rows.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  {note && <small className="cell-sub">{note(r)}</small>}
                </td>
                {parentKey && (
                  <td>
                    <select
                      aria-label={r.name + " · " + parentLabel}
                      value={String(r[parentKey] || "")}
                      onChange={(e) =>
                        onChange(
                          rows.map((x, j) =>
                            j === i ? { ...x, [parentKey]: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option value="">Seç…</option>
                      {(parents || []).map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={r.name + " satırını sil"}
                    title={lock || "Sil"}
                    disabled={!!lock}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange([
            ...rows,
            { name: "", ...(parentKey ? { [parentKey]: "" } : {}) } as any,
          ])
        }
      >
        <Plus size={15} /> {title} ekle
      </button>
    </div>
  );
}

export default function DefinitionsPage({
  state,
  users,
  busy,
  who,
  command,
  openModal,
  orgName,
  alert,
  edition,
  refresh,
}: Props) {
  const [org, setOrg] = useState<OrgDefinitions>(
    state.settings?.org || emptyOrg,
  );
  const [locations, setLocations] = useState<string[]>(
    state.settings?.locations || [],
  );
  const [newLocation, setNewLocation] = useState("");
  const toText = (g?: string[][]) =>
    (g || []).map((x) => x.join(", ")).join("\n");
  const [synonyms, setSynonyms] = useState(toText(state.settings?.synonyms));
  const [synDirty, setSynDirty] = useState(false);
  useEffect(() => {
    if (!synDirty) setSynonyms(toText(state.settings?.synonyms));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız sunucudaki ayar değişince ve yerelde düzenleme yokken yansıt
  }, [state.settings?.synonyms]);
  const [dirty, setDirty] = useState({ org: false, loc: false });
  // Başka bir yöneticinin kaydettiği değişiklikler, yerelde düzenleme yoksa ekrana yansır.
  useEffect(() => {
    if (!dirty.org) setOrg(state.settings?.org || emptyOrg);
    if (!dirty.loc) setLocations(state.settings?.locations || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız sunucudaki ayar değişince ve yerelde düzenleme yokken yansıt
  }, [state.settings]);
  const edit = (next: OrgDefinitions) => {
    setOrg(next);
    setDirty((d) => ({ ...d, org: true }));
  };
  const usersIn = (dept: string) =>
    users.filter((u) => u.department === dept && u.active !== 0).length;
  const sortTr = (a: string, b: string) => a.localeCompare(b, "tr");

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">AYARLAR</span>
          <h1>
            Tanımlar<span className="mint-dot">.</span>
          </h1>
          <p>
            Bölümler, lokasyonlar, organizasyon yapısı ve destek birimleri.
            Formlardaki listeler buradan gelir.
          </p>
        </div>
      </div>

      <section className="panel def-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Building2 size={18} /> Bölümler
            </h2>
            <p>
              Önerinin yönlendirildiği iş alanları. Her bölümün tek sorumlusu
              Atama matrisi'nde belirlenir.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => openModal("operation", { operation: "" })}
          >
            <Plus size={17} /> Bölüm ekle
          </button>
        </div>
        <div className="def-grid">
          {state.matrix.map((r) => (
            <div key={r.operation} className="def-item">
              <b>{r.operation}</b>
              <small>Sorumlu: {who(r.operationOwner)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel def-panel">
        <div className="section-heading">
          <div>
            <h2>
              <MapPin size={18} /> Lokasyonlar
            </h2>
            <p>
              Öneri formunda "Lokasyon" listesi ve panodaki lokasyon raporu
              bunları kullanır. Boşsa alan gösterilmez.
            </p>
          </div>
          <button
            className="primary"
            disabled={!dirty.loc || busy}
            onClick={async () => {
              const ok = await command(
                { action: "defineLocations", locations },
                false,
                "Lokasyonlar kaydedildi.",
              );
              if (ok) setDirty((d) => ({ ...d, loc: false }));
            }}
          >
            <Check size={16} /> Kaydet
          </button>
        </div>
        <div className="chip-list">
          {locations.map((x) => (
            <span key={x} className="person-chip">
              {x}
              <button
                type="button"
                aria-label={x + " lokasyonunu kaldır"}
                onClick={() => {
                  setLocations(locations.filter((y) => y !== x));
                  setDirty((d) => ({ ...d, loc: true }));
                }}
              >
                ×
              </button>
            </span>
          ))}
          {!locations.length && (
            <span className="muted">Henüz lokasyon yok.</span>
          )}
        </div>
        <form
          className="inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newLocation.trim();
            if (v && !locations.includes(v)) {
              setLocations([...locations, v].sort(sortTr));
              setDirty((d) => ({ ...d, loc: true }));
            }
            setNewLocation("");
          }}
        >
          <input
            aria-label="Yeni lokasyon"
            placeholder="Örn. Rampa 3, A blok, Hat 2"
            maxLength={80}
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />
          <button className="secondary" type="submit">
            <Plus size={15} /> Ekle
          </button>
        </form>
      </section>

      <section className="panel def-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Layers size={18} /> Eş anlamlılar (benzer öneri araması)
            </h2>
            <p>
              Her satır bir grup; kelimeleri virgülle ayır. Aynı gruptaki
              kelimeler benzer öneri aramasında aynı sayılır. Örn. “palet, yük,
              istif”.
            </p>
          </div>
          <button
            className="primary"
            disabled={!synDirty || busy}
            onClick={async () => {
              const groups = synonyms
                .split("\n")
                .map((line) =>
                  line
                    .split(",")
                    .map((w) => w.trim())
                    .filter(Boolean),
                )
                .filter((g) => g.length >= 2);
              const ok = await command(
                { action: "defineSynonyms", synonyms: groups },
                false,
                "Eş anlamlılar kaydedildi.",
              );
              if (ok) setSynDirty(false);
            }}
          >
            <Check size={16} /> Kaydet
          </button>
        </div>
        <textarea
          className="synonym-box"
          aria-label="Eş anlamlı grupları"
          rows={5}
          value={synonyms}
          placeholder={
            "palet, yük\nforklift, istif makinesi, transpalet\nhata, kusur, uygunsuzluk"
          }
          onChange={(e) => {
            setSynonyms(e.target.value);
            setSynDirty(true);
          }}
        />
      </section>

      <section className="panel def-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Network size={18} /> Organizasyon yapısı
            </h2>
            <p>
              Departman → Müdürlük
              {org.levels.division ? " → Direktörlük" : ""}
              {org.levels.group ? " → Genel Müdürlük" : ""}. Kullanıcı formunda
              departman bu listeden seçilir; müdürlük otomatik gelir.
            </p>
          </div>
          <button
            className="primary"
            disabled={!dirty.org || busy}
            onClick={async () => {
              const ok = await command(
                { action: "defineOrg", org },
                false,
                "Organizasyon yapısı kaydedildi.",
              );
              if (ok) setDirty((d) => ({ ...d, org: false }));
            }}
          >
            <Check size={16} /> Kaydet
          </button>
        </div>
        <div className="level-toggles">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={org.levels.division}
              onChange={(e) =>
                edit({
                  ...org,
                  levels: {
                    division: e.target.checked,
                    group: e.target.checked && org.levels.group,
                  },
                })
              }
            />
            <span>
              <b>Direktörlük seviyesi</b>
              <small>
                Müdürlükler direktörlüklere bağlanır; "Direktör" rolü kendi
                direktörlüğünü görür.
              </small>
            </span>
            <em className={org.levels.division ? "on" : "off"}>
              {org.levels.division ? "Açık" : "Kapalı"}
            </em>
          </label>
          <label
            className={"toggle-row " + (!org.levels.division ? "disabled" : "")}
          >
            <input
              type="checkbox"
              disabled={!org.levels.division}
              checked={org.levels.group}
              onChange={(e) =>
                edit({
                  ...org,
                  levels: { ...org.levels, group: e.target.checked },
                })
              }
            />
            <span>
              <b>Genel müdürlük seviyesi</b>
              <small>
                Direktörlükler genel müdürlüklere bağlanır; "Genel müdür" rolü
                tümünü görür.
              </small>
            </span>
            <em className={org.levels.group ? "on" : "off"}>
              {org.levels.group ? "Açık" : "Kapalı"}
            </em>
          </label>
        </div>
        <div className="level-grid">
          <LevelTable
            title="Departman"
            rows={org.departments}
            parentKey="directorate"
            parentLabel="Müdürlük"
            parents={org.directorates
              .map((d) => d.name)
              .filter(Boolean)
              .sort(sortTr)}
            note={(r) => usersIn(r.name) + " aktif kullanıcı"}
            lockRow={(r) =>
              usersIn(r.name) ? "Kullanıcısı olan departman silinemez" : null
            }
            onChange={(rows) => edit({ ...org, departments: rows })}
          />
          <LevelTable
            title="Müdürlük"
            rows={org.directorates}
            parentKey={org.levels.division ? "division" : undefined}
            parentLabel="Direktörlük"
            parents={org.divisions
              .map((d) => d.name)
              .filter(Boolean)
              .sort(sortTr)}
            lockRow={(r) =>
              org.departments.some((d) => d.directorate === r.name)
                ? "Bağlı departmanı var"
                : null
            }
            onChange={(rows) => edit({ ...org, directorates: rows })}
          />
          {org.levels.division && (
            <LevelTable
              title="Direktörlük"
              rows={org.divisions}
              parentKey={org.levels.group ? "group" : undefined}
              parentLabel="Genel müdürlük"
              parents={org.groups.filter(Boolean).sort(sortTr)}
              lockRow={(r) =>
                org.directorates.some((d) => d.division === r.name)
                  ? "Bağlı müdürlüğü var"
                  : null
              }
              onChange={(rows) => edit({ ...org, divisions: rows })}
            />
          )}
          {org.levels.group && (
            <LevelTable
              title="Genel müdürlük"
              rows={org.groups.map((name) => ({ name }))}
              lockRow={(r) =>
                org.divisions.some((d) => d.group === r.name)
                  ? "Bağlı direktörlüğü var"
                  : null
              }
              onChange={(rows) =>
                edit({ ...org, groups: rows.map((r) => r.name) })
              }
            />
          )}
        </div>
        {dirty.org && <p className="muted">Kaydedilmemiş değişiklikler var.</p>}
      </section>

      <NotifySettings
        state={state}
        busy={busy}
        who={who}
        command={command}
        alert={alert}
      />

      <DefinitionLists state={state} busy={busy} command={command} />

      <CampaignSettings state={state} busy={busy} command={command} />

      <RewardSettings
        state={state}
        users={users}
        busy={busy}
        command={command}
      />

      {edition === "ai" && (
        <section className="panel def-panel" aria-labelledby="ai-setting">
          <div className="section-heading">
            <h2 id="ai-setting">Yapay zekâ erişimi (MCP)</h2>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={!!state.settings?.ai?.mcp}
              disabled={busy}
              onChange={(e) =>
                command(
                  { action: "aiSettings", mcp: e.target.checked },
                  false,
                  e.target.checked
                    ? "MCP erişimi açıldı."
                    : "MCP erişimi kapatıldı; anahtarlar çalışmaz.",
                )
              }
            />
            <span>
              Açıkken kullanıcılar kendi erişim anahtarını oluşturup kurumun{" "}
              <b>kendi sunucusundaki</b> yapay zekâyı bağlayabilir. Model
              yalnızca kişinin web'de görebildiği kayıtları okur; karar veremez,
              kayıt değiştiremez, ekleri görmez. Dış bir yapay zekâ hizmetine
              bağlamayın.
            </span>
          </label>
        </section>
      )}

      <section className="panel def-panel" aria-labelledby="currency-setting">
        <div className="section-heading">
          <h2 id="currency-setting">Para birimi</h2>
        </div>
        <label className="toggle-row">
          <select
            value={state.settings?.currency || "₺"}
            disabled={busy}
            onChange={(e) =>
              command(
                { action: "currencySettings", currency: e.target.value },
                false,
                "Para birimi güncellendi.",
              )
            }
          >
            {CURRENCIES.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
          <span>
            Kazanç, maliyet ve ödül tutarları bu simgeyle gösterilir; ekranlar,
            raporlar, e-postalar ve dışa aktarımlar dahil. Tutarlar çevrilmez,
            yalnız simge değişir.
          </span>
        </label>
      </section>

      <section className="panel def-panel" aria-labelledby="rec-setting">
        <div className="section-heading">
          <h2 id="rec-setting">Tanınma ekranı</h2>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.settings?.recognition !== false}
            disabled={busy}
            onChange={(e) =>
              command(
                { action: "recognitionSettings", enabled: e.target.checked },
                false,
                e.target.checked
                  ? "Tanınma ekranı açıldı."
                  : "Tanınma ekranı kapatıldı.",
              )
            }
          />
          <span>
            Herkes tamamlanan iyileştirmeleri (başlık, bölüm, öneren adları) ve
            departman katılım oranlarını görür; kişi kendi rozetlerini görür.
            Kişiler arası sıralama yoktur.
          </span>
        </label>
      </section>

      <ProposalImport
        refresh={refresh || (() => {})}
        alert={alert}
        state={state}
        who={who}
        openModal={openModal}
      />

      <QrSheet
        operations={state.operations}
        locations={state.settings?.locations || []}
        orgName={orgName}
      />

      <section className="panel def-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Settings2 size={18} /> Destek birimleri ve kurum adı
            </h2>
            <p>
              Bekleme işaretlerinde kullanılan birimler. Kurum adı menüde ve
              sayfa yolunda görünür: {orgName}
            </p>
          </div>
          <div className="buttons">
            <button
              className="secondary"
              onClick={() => openModal("unit", { unit: "" })}
            >
              <Plus size={17} /> Birim ekle
            </button>
            <button
              className="secondary"
              onClick={() => openModal("org", { orgName })}
            >
              Kurum adını değiştir
            </button>
          </div>
        </div>
        <div className="unit-tags">
          {state.units.map((x) => (
            <span key={x}>
              <Building2 size={16} />
              {x}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
