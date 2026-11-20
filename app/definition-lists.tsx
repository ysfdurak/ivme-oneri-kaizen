"use client";
import { t, translate } from "../lib/i18n";
// Tanımlar: öneri sınıfları (alt sınıflarıyla), ret ve uygulanamama nedenleri, kazanç türleri,
// puanlama kriterleri ve aşama hedef süreleri. Kurallar lib/definitions.ts içinde; burası yalnız düzenleme ekranı.
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Lock,
  Plus,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  CLOSED,
  DEFAULT_TARGET_DAYS,
  Proposal,
  State,
  age,
} from "../lib/model";
import {
  LIST_META,
  ListItem,
  ListKey,
  Scoring,
  TARGET_STAGES,
  listOf,
  scoreTotal,
  scoringOf,
  usageCount,
} from "../lib/definitions";

type Cmd = (data: any, close?: boolean, success?: string) => Promise<any>;
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

function ItemRows({
  items,
  onChange,
  usage,
  label,
}: {
  items: ListItem[];
  onChange: (x: ListItem[]) => void;
  usage: (it: ListItem) => number;
  label: string;
}) {
  const set = (i: number, patch: Partial<ListItem>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <ul className="def-items">
      {items.map((it, i) => {
        const used = it.id ? usage(it) : 0;
        return (
          <li
            key={it.id || "yeni-" + i}
            className={it.active ? "" : "inactive"}
          >
            <input
              aria-label={t("{0} · {1}. madde adı", label, i + 1)}
              value={it.locked ? translate(it.name) : it.name}
              maxLength={60}
              disabled={it.locked}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <label className="def-active">
              <input
                type="checkbox"
                checked={it.active}
                disabled={it.locked}
                onChange={(e) => set(i, { active: e.target.checked })}
              />
              Aktif
            </label>
            <small className="muted">
              {it.locked
                ? "sistem maddesi"
                : used
                  ? used + " kayıtta"
                  : "kullanılmadı"}
            </small>
            <span className="def-tools">
              <button
                type="button"
                className="icon-button"
                aria-label={it.name + " yukarı"}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={it.name + " aşağı"}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              {it.locked ? (
                <span
                  className="icon-button"
                  role="img"
                  aria-label="Kilitli sistem maddesi"
                  title="Sistem maddesi: adı değişmez, silinmez"
                >
                  <Lock size={14} />
                </span>
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={it.name + " sil"}
                  disabled={used > 0}
                  title={
                    used > 0
                      ? "Kullanılan madde silinmez; pasife alın."
                      : undefined
                  }
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ListSettings({
  k,
  state,
  busy,
  command,
}: {
  k: ListKey;
  state: State;
  busy: boolean;
  command: Cmd;
}) {
  const meta = LIST_META[k];
  const saved = listOf(state, k);
  const [items, setItems] = useState<ListItem[]>(saved);
  const [open, setOpen] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sunucudaki kayıt içerik olarak değişince yansıt (dizi kimliği her çizimde yeni)
  useEffect(() => setItems(saved), [JSON.stringify(saved)]);
  const dirty = !same(items, saved);
  const ps = state.proposals as Proposal[];
  const nameOf = (id: string) => saved.find((x) => x.id === id)?.name;
  return (
    <section className="panel def-panel" aria-labelledby={"def-" + k}>
      <div className="section-heading">
        <div>
          <h2 id={"def-" + k}>
            <ListChecks size={18} aria-hidden /> {meta.title}
          </h2>
          <p className="muted">
            {meta.hint} Kullanılan madde silinmez, pasife alınır; yeniden
            adlandırma eski kayıtlara da yansır.
          </p>
        </div>
      </div>
      <div className="def-body">
        <ItemRows
          items={items}
          label={meta.title}
          onChange={setItems}
          usage={(it) => usageCount(ps, k, nameOf(it.id) || it.name)}
        />
        {meta.subs && (
          <div className="def-subs">
            {items.map((it, i) => (
              <details
                key={it.id || i}
                open={open === it.id}
                onToggle={(e) =>
                  e.currentTarget.open
                    ? setOpen(it.id)
                    : open === it.id && setOpen(null)
                }
              >
                <summary>
                  {it.name} · alt sınıflar ({(it.subs || []).length})
                </summary>
                <ItemRows
                  items={it.subs || []}
                  label={it.name + " alt sınıfı"}
                  onChange={(subs) =>
                    setItems(
                      items.map((x, j) => (j === i ? { ...x, subs } : x)),
                    )
                  }
                  usage={(sub) =>
                    usageCount(
                      ps,
                      k,
                      (saved.find((x) => x.id === it.id)?.subs || []).find(
                        (x) => x.id === sub.id,
                      )?.name || sub.name,
                      nameOf(it.id) || it.name,
                    )
                  }
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setItems(
                      items.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              subs: [
                                ...(x.subs || []),
                                { id: "", name: "", active: true },
                              ],
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <Plus size={14} /> Alt sınıf ekle
                </button>
              </details>
            ))}
          </div>
        )}
      </div>
      <div className="buttons">
        <button
          type="button"
          className="secondary"
          disabled={items.length >= meta.max}
          onClick={() =>
            setItems([
              ...items,
              {
                id: "",
                name: "",
                active: true,
                ...(meta.subs ? { subs: [] } : {}),
              },
            ])
          }
        >
          <Plus size={16} /> Madde ekle
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !dirty}
          onClick={() =>
            command(
              { action: "defineList", key: k, items },
              false,
              meta.title + " kaydedildi.",
            )
          }
        >
          Kaydet
        </button>
        {dirty && (
          <span className="muted">Kaydedilmemiş değişiklikler var.</span>
        )}
      </div>
    </section>
  );
}

function ScoringSettings({
  state,
  busy,
  command,
}: {
  state: State;
  busy: boolean;
  command: Cmd;
}) {
  const saved = scoringOf(state);
  const [sc, setSc] = useState<Scoring>(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sunucudaki kayıt içerik olarak değişince yansıt (dizi kimliği her çizimde yeni)
  useEffect(() => setSc(saved), [JSON.stringify(saved)]);
  const dirty = !same(sc, saved);
  const set = (i: number, patch: any) =>
    setSc({
      ...sc,
      criteria: sc.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });
  const wsum =
    sc.criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 1;
  const example = sc.criteria.map(() => Math.ceil(sc.scale * 0.8));
  return (
    <section className="panel def-panel" aria-labelledby="def-scoring">
      <div className="section-heading">
        <div>
          <h2 id="def-scoring">
            <Trophy size={18} aria-hidden /> Puanlama kriterleri
          </h2>
          <p className="muted">
            Puan = her kriterde (verilen puan / ölçek) × ağırlık, toplam
            ağırlığa bölünür, 100 üzerinden. Kriterler değişirse önceki puanlar
            değişmez; verildiği andaki kriterlerle saklanır. Ödül kuralları bu
            puanı kullanır.
          </p>
        </div>
      </div>
      <div className="def-body">
        <label className="field compact-field">
          <span>Ölçek</span>
          <select
            aria-label="Ölçek"
            value={sc.scale}
            onChange={(e) => setSc({ ...sc, scale: Number(e.target.value) })}
          >
            {[3, 4, 5, 10].map((n) => (
              <option key={n} value={n}>
                1–{n}
              </option>
            ))}
          </select>
        </label>
        <div className="table-scroll">
          <table className="mini-table rule-table">
            <caption className="sr-only">Puanlama kriterleri</caption>
            <thead>
              <tr>
                <th>Kriter</th>
                <th>Açıklama (puanlayana yardım)</th>
                <th>Ağırlık</th>
                <th>Pay</th>
                <th>
                  <span className="sr-only">Sil</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sc.criteria.map((c, i) => (
                <tr key={c.id || i}>
                  <td>
                    <input
                      aria-label={"Kriter " + (i + 1) + " adı"}
                      value={c.name}
                      maxLength={60}
                      onChange={(e) => set(i, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={"Kriter " + (i + 1) + " açıklaması"}
                      value={c.description || ""}
                      maxLength={160}
                      onChange={(e) => set(i, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={"Kriter " + (i + 1) + " ağırlığı"}
                      type="number"
                      min={1}
                      max={100}
                      value={c.weight}
                      onChange={(e) =>
                        set(i, { weight: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="muted">
                    %{Math.round(((Number(c.weight) || 0) / wsum) * 100)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Kriter " + (i + 1) + " sil"}
                      disabled={sc.criteria.length <= 1}
                      onClick={() =>
                        setSc({
                          ...sc,
                          criteria: sc.criteria.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Örnek: her kriterde {Math.ceil(sc.scale * 0.8)}/{sc.scale} verilirse
          puan {scoreTotal(example, sc)}/100 olur.
        </p>
      </div>
      <div className="buttons">
        <button
          type="button"
          className="secondary"
          disabled={sc.criteria.length >= 6}
          onClick={() =>
            setSc({
              ...sc,
              criteria: [...sc.criteria, { id: "", name: "", weight: 1 }],
            })
          }
        >
          <Plus size={16} /> Kriter ekle
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !dirty}
          onClick={() =>
            command(
              { action: "defineScoring", scoring: sc },
              false,
              "Puanlama kriterleri kaydedildi.",
            )
          }
        >
          Kaydet
        </button>
        {dirty && (
          <span className="muted">Kaydedilmemiş değişiklikler var.</span>
        )}
      </div>
    </section>
  );
}

function TargetDaysSettings({
  state,
  busy,
  command,
}: {
  state: State;
  busy: boolean;
  command: Cmd;
}) {
  const saved = useMemo(
    () =>
      Object.fromEntries(
        TARGET_STAGES.map((st) => [
          st,
          Number((state.settings as any)?.targetDays?.[st]) ||
            DEFAULT_TARGET_DAYS[st],
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız hedef günler içerik olarak değişince
    [JSON.stringify((state.settings as any)?.targetDays)],
  );
  const [days, setDays] = useState<Record<string, number>>(saved);
  useEffect(() => setDays(saved), [saved]);
  const dirty = !same(days, saved);
  // Değişikliğin etkisi: kaç açık öneri gecikmiş sayılacak (şimdi ve kaydedince).
  const open = (state.proposals as Proposal[]).filter(
    (p) => !CLOSED.includes(p.status),
  );
  const lateWith = (m: Record<string, number>) =>
    open.filter((p) => m[p.status] && age(p.stageAt) > m[p.status]).length;
  const now = lateWith(saved),
    after = lateWith(days);
  return (
    <section className="panel def-panel" aria-labelledby="def-target">
      <div className="section-heading">
        <div>
          <h2 id="def-target">
            <Timer size={18} aria-hidden /> Aşama hedef süreleri
          </h2>
          <p className="muted">
            Gecikme, öneri bu süreden uzun aynı aşamada kalınca başlar; günlük
            gecikme e-postası ve panolar buna göre çalışır.
          </p>
        </div>
      </div>
      <div className="def-body target-grid">
        {TARGET_STAGES.map((st) => (
          <label key={st} className="field compact-field">
            <span>{st}</span>
            <input
              aria-label={st + " hedef gün"}
              type="number"
              min={1}
              max={365}
              value={days[st]}
              onChange={(e) =>
                setDays({
                  ...days,
                  [st]: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="buttons">
        <button
          type="button"
          className="primary"
          disabled={busy || !dirty}
          onClick={() =>
            command(
              { action: "defineTargetDays", targetDays: days },
              false,
              "Hedef süreler kaydedildi.",
            )
          }
        >
          Kaydet
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setDays({ ...DEFAULT_TARGET_DAYS })}
        >
          Varsayılana dön
        </button>
        {dirty && (
          <span className={after > now ? "warn-text" : "muted"} role="status">
            Bu değişiklikle gecikmiş açık öneri {now} → {after}
            {after > now
              ? " (artacak; ilgili kişilere ertesi sabah e-posta gider)"
              : ""}
            .
          </span>
        )}
      </div>
    </section>
  );
}

export default function DefinitionLists({
  state,
  busy,
  command,
}: {
  state: State;
  busy: boolean;
  command: Cmd;
}) {
  return (
    <>
      {(Object.keys(LIST_META) as ListKey[]).map((k) => (
        <ListSettings
          key={k}
          k={k}
          state={state}
          busy={busy}
          command={command}
        />
      ))}
      <ScoringSettings state={state} busy={busy} command={command} />
      <TargetDaysSettings state={state} busy={busy} command={command} />
    </>
  );
}
