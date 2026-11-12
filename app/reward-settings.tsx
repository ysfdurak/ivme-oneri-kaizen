"use client";
// Ödül kuralları (yalnız sistem yöneticisi). Kurallar yukarıdan aşağı denenir: puanı ve net kazanç şartını
// karşılayan ilk kural uygulanır. Kayıt puanlamada otomatik oluşur ve ödül sorumlusuna (İK) düşer.
import React, { useEffect, useState } from "react";
import { Gift, Plus, Trash2 } from "lucide-react";
import type { State } from "../lib/model";
import {
  DEFAULT_REWARD_SETTINGS,
  RewardRule,
  RewardSettings as RS,
  rewardText,
} from "../lib/rewards";

export default function RewardSettings({
  state,
  users,
  busy,
  command,
}: {
  state: State;
  users: { role: string; active?: number }[];
  busy: boolean;
  command: (data: any, close?: boolean, success?: string) => Promise<any>;
}) {
  const saved = state.settings?.rewards || DEFAULT_REWARD_SETTINGS;
  const [rs, setRs] = useState<RS>(saved);
  useEffect(() => setRs(saved), [JSON.stringify(saved)]);
  const dirty = JSON.stringify(rs) !== JSON.stringify(saved);
  const set = (i: number, patch: Partial<RewardRule>) =>
    setRs({
      ...rs,
      rules: rs.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  const hasReviewer = users.some((u) => u.role === "reward" && u.active !== 0);

  return (
    <section className="panel def-panel" aria-labelledby="reward-title">
      <div className="section-heading">
        <div>
          <h2 id="reward-title">
            <Gift size={18} aria-hidden /> Ödül kuralları
          </h2>
          <p className="muted">
            Öneri puanlanınca uyan ilk kurala göre ödül kaydı oluşur ve "Ödül
            sorumlusu (İK)" rolündeki kişilere düşer; İK onaylar, değiştirir ya
            da reddeder. Maaş bilgisi tutulmaz: "0,5 brüt maaş" bir talimattır.
            Net kazanç = ilk yıl kazancı − uygulama maliyeti.
          </p>
        </div>
      </div>
      <div className="reward-settings">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={rs.enabled}
            onChange={(e) => setRs({ ...rs, enabled: e.target.checked })}
          />
          <span>Otomatik ödül açık</span>
        </label>
        <label className="field compact-field">
          <span>Birlikte önerenlerde</span>
          <select
            value={rs.split}
            onChange={(e) => setRs({ ...rs, split: e.target.value as any })}
          >
            <option value="equal">Değer kişiler arasında eşit bölünür</option>
            <option value="each">Her kişi değerin tamamını alır</option>
          </select>
        </label>
        <div className="table-scroll">
          <table className="mini-table rule-table">
            <caption className="sr-only">Ödül kuralları</caption>
            <thead>
              <tr>
                <th>En az puan</th>
                <th>En az net kazanç (₺)</th>
                <th>Ödül türü</th>
                <th>Değer</th>
                <th>Ödül adı</th>
                <th>Örnek</th>
                <th>
                  <span className="sr-only">Sil</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rs.rules.map((r, i) => (
                <tr key={r.id || i}>
                  <td>
                    <input
                      aria-label={"Kural " + (i + 1) + " en az puan"}
                      type="number"
                      min={0}
                      max={100}
                      value={r.minScore}
                      onChange={(e) =>
                        set(i, { minScore: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={"Kural " + (i + 1) + " en az net kazanç"}
                      type="number"
                      min={0}
                      placeholder="Şart yok"
                      value={r.minNet ?? ""}
                      onChange={(e) =>
                        set(i, {
                          minNet:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={"Kural " + (i + 1) + " ödül türü"}
                      value={r.kind}
                      onChange={(e) => set(i, { kind: e.target.value as any })}
                    >
                      <option value="salary">Maaş katı</option>
                      <option value="amount">Tutar (₺)</option>
                      <option value="gift">Hediye / belge</option>
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={"Kural " + (i + 1) + " değer"}
                      type="number"
                      min={0}
                      step={r.kind === "salary" ? 0.05 : 100}
                      disabled={r.kind === "gift"}
                      value={r.kind === "gift" ? "" : r.value}
                      onChange={(e) =>
                        set(i, { value: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={"Kural " + (i + 1) + " ödül adı"}
                      maxLength={60}
                      value={r.label}
                      onChange={(e) => set(i, { label: e.target.value })}
                    />
                  </td>
                  <td className="muted">
                    {rewardText(r.kind, r.value, r.label)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Kural " + (i + 1) + " sil"}
                      onClick={() =>
                        setRs({
                          ...rs,
                          rules: rs.rules.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasReviewer && (
          <p className="muted">
            Ödül sorumlusu (İK) rolünde kimse yok; kayıtları sistem yöneticisi
            görür.
          </p>
        )}
      </div>
      <div className="buttons">
        <button
          type="button"
          className="secondary"
          disabled={rs.rules.length >= 10}
          onClick={() =>
            setRs({
              ...rs,
              rules: [
                ...rs.rules,
                {
                  id: "",
                  minScore: 0,
                  minNet: null,
                  kind: "gift",
                  value: 0,
                  label: "Teşekkür belgesi",
                },
              ],
            })
          }
        >
          <Plus size={16} /> Kural ekle
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !dirty}
          onClick={() =>
            command(
              { action: "rewardSettings", settings: rs },
              false,
              "Ödül kuralları kaydedildi.",
            )
          }
        >
          Kaydet
        </button>
        {dirty && (
          <span className="muted">
            Kaydedilmemiş değişiklikler var. Kurallar kayıtta puana göre
            sıralanır.
          </span>
        )}
      </div>
    </section>
  );
}
