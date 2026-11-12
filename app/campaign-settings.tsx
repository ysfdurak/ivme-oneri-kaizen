"use client";
// Öneri kampanyaları (yalnız yönetici): belirli bir dönemde belirli bir konuya öneri toplamak için.
// Açık kampanya öneri formunda görünür; sonuçları Tanınma ekranında izlenir.
import React, { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Campaign, State } from "../lib/model";
import { activeNames } from "../lib/definitions";

const today = () =>
  new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const plus = (days: number) =>
  new Date(Date.now() + 3 * 3600_000 + days * 86400000)
    .toISOString()
    .slice(0, 10);
const statusOf = (c: Campaign) =>
  c.end < today() ? "Bitti" : c.start > today() ? "Planlandı" : "Açık";

export default function CampaignSettings({
  state,
  busy,
  command,
}: {
  state: State;
  busy: boolean;
  command: (data: any, close?: boolean, success?: string) => Promise<any>;
}) {
  const saved = state.settings?.campaigns || [];
  const [list, setList] = useState<Campaign[]>(saved);
  useEffect(() => setList(saved), [JSON.stringify(saved)]);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const set = (i: number, patch: Partial<Campaign>) =>
    setList(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const count = (id: string) =>
    state.proposals.filter((p) => p.campaign === id).length;

  return (
    <section className="panel def-panel" aria-labelledby="camp-title">
      <div className="section-heading">
        <div>
          <h2 id="camp-title">
            <Megaphone size={18} aria-hidden /> Öneri kampanyaları
          </h2>
          <p className="muted">
            Ör. "Kasım: iş güvenliği ayı". Açık kampanya öneri formunda görünür,
            sonuçları Tanınma ekranında izlenir. Öneri bağlanmış kampanya
            silinemez; bitiş tarihini değiştirin.
          </p>
        </div>
      </div>
      <div className="campaign-list">
        {list.map((c, i) => {
          const n = c.id ? count(c.id) : 0;
          return (
            <fieldset key={c.id || "yeni-" + i} className="campaign-row">
              <legend>
                {c.title || "Yeni kampanya"} ·{" "}
                <span className={"camp-status s-" + statusOf(c)}>
                  {statusOf(c)}
                </span>
                {n > 0 && " · " + n + " öneri"}
              </legend>
              <label className="field">
                <span>Ad *</span>
                <input
                  value={c.title}
                  maxLength={80}
                  onChange={(e) => set(i, { title: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Başlangıç *</span>
                <input
                  type="date"
                  value={c.start}
                  onChange={(e) => set(i, { start: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Bitiş *</span>
                <input
                  type="date"
                  value={c.end}
                  onChange={(e) => set(i, { end: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Odak alanı</span>
                <select
                  value={c.category || ""}
                  onChange={(e) =>
                    set(i, { category: e.target.value || undefined })
                  }
                >
                  <option value="">Hepsi</option>
                  {activeNames(state, "categories").map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Bölüm</span>
                <select
                  value={c.operation || ""}
                  onChange={(e) =>
                    set(i, { operation: e.target.value || undefined })
                  }
                >
                  <option value="">Hepsi</option>
                  {state.operations.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field wide">
                <span>Açıklama</span>
                <input
                  value={c.description || ""}
                  maxLength={500}
                  onChange={(e) => set(i, { description: e.target.value })}
                />
              </label>
              <label className="field wide">
                <span>Ödül / tanınma</span>
                <input
                  value={c.reward || ""}
                  maxLength={200}
                  placeholder="Ör. En yüksek puanlı 3 öneri ay sonu toplantısında ödüllendirilir"
                  onChange={(e) => set(i, { reward: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="text-button danger-text"
                disabled={n > 0}
                title={n > 0 ? "Öneri bağlı; silinemez" : undefined}
                onClick={() => setList(list.filter((_, j) => j !== i))}
              >
                <Trash2 size={15} /> Kaldır
              </button>
            </fieldset>
          );
        })}
      </div>
      <div className="buttons">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setList([
              ...list,
              { id: "", title: "", start: today(), end: plus(30) },
            ])
          }
        >
          <Plus size={16} /> Kampanya ekle
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || !dirty}
          onClick={() =>
            command(
              { action: "defineCampaigns", campaigns: list },
              false,
              "Kampanyalar kaydedildi.",
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
