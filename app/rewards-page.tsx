"use client";
import { intlLocale, translate } from "../lib/i18n";
// Ödüller (ödül sorumlusu / İK ve sistem yöneticisi): puanlamadan sonra otomatik oluşan ödül kayıtları.
// Onayla (değeri gerekçeyle değiştirerek), reddet ya da onaylananı bordro dönemiyle "ödendi" işaretle.
// Maaş bilgisi tutulmaz: "0,5 brüt maaş" talimattır, tutarı İK kendi sisteminde hesaplar.
import React, { useMemo, useState } from "react";
import { Download, Gift } from "lucide-react";
import type { Proposal, User } from "../lib/model";
import { gainFigures } from "../lib/model";
import { REWARD_STATUSES, Reward, rewardText } from "../lib/rewards";

type Props = {
  rewards: Reward[];
  proposals: Proposal[];
  users: User[];
  busy: boolean;
  command: (data: any, close?: boolean, success?: string) => Promise<any>;
  onOpen: (proposalId: string) => void;
};

const money = (n: number) =>
  n.toLocaleString(intlLocale(), { maximumFractionDigits: 0 }) + " ₺";
const thisMonth = () =>
  new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7);

function download(name: string, rows: (string | number)[][]) {
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

export default function RewardsPage({
  rewards,
  proposals,
  users,
  busy,
  command,
  onOpen,
}: Props) {
  const [tab, setTab] = useState<string>("Onay bekliyor");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{
    total: string;
    reason: string;
    period: string;
  }>({
    total: "",
    reason: "",
    period: thisMonth(),
  });
  const who = (id: string) => users.find((u) => u.id === id);
  const prop = (id: string) => proposals.find((p) => p.id === id);
  const list = useMemo(
    () =>
      rewards
        .filter((r) => r.status === tab)
        .sort((a, b) => b.created.localeCompare(a.created)),
    [rewards, tab],
  );
  const count = (st: string) => rewards.filter((r) => r.status === st).length;
  const start = (r: Reward) => {
    setOpen(r.id);
    setForm({ total: String(r.total), reason: "", period: thisMonth() });
  };
  const exportPayroll = () =>
    download("ivme-odul-bordro-" + thisMonth() + ".csv", [
      [
        "Ödül no",
        "Öneri no",
        "Öneri",
        "Ad soyad",
        "Kullanıcı adı",
        "Departman",
        "Ödül",
        "Kişi başı",
        "Durum",
        "Bordro dönemi",
      ],
      ...rewards
        .filter((r) => ["Onaylandı", "Ödendi"].includes(r.status))
        .flatMap((r) =>
          r.recipients.map((x) => [
            r.id,
            r.proposalId,
            prop(r.proposalId)?.title || "",
            who(x.userId)?.name || x.userId,
            who(x.userId)?.username || "",
            who(x.userId)?.department || "",
            r.ruleLabel,
            rewardText(r.kind, x.value, r.ruleLabel),
            r.status,
            r.payrollPeriod || "",
          ]),
        ),
    ]);

  return (
    <div className="rewards-page">
      <div className="page-heading">
        <div>
          <h1>
            Ödüller<span className="mint-dot">.</span>
          </h1>
          <p>
            Puanlanan önerilerin ödül kararı. Onaylanan ödüller bordro döneminde
            ek ödeme olarak verilir. Maaş bilgisi İvme'de tutulmaz; "brüt maaş"
            ödülünün tutarını bordro sistemi hesaplar.
          </p>
        </div>
        <button
          className="secondary"
          onClick={exportPayroll}
          disabled={!count("Onaylandı") && !count("Ödendi")}
        >
          <Download size={16} /> Bordro listesi (Excel)
        </button>
      </div>

      <div className="segmented" role="tablist" aria-label="Ödül durumu">
        {REWARD_STATUSES.map((st) => (
          <button
            key={st}
            role="tab"
            aria-selected={tab === st}
            className={tab === st ? "active" : ""}
            onClick={() => setTab(st)}
          >
            {st} <small>{count(st)}</small>
          </button>
        ))}
      </div>

      {!list.length ? (
        <div className="panel empty">
          <Gift size={28} aria-hidden />
          <p>Bu durumda ödül kaydı yok.</p>
        </div>
      ) : (
        <ul className="reward-list">
          {list.map((r) => {
            const p = prop(r.proposalId);
            const g =
              p?.gain && p.gain.valid !== false ? gainFigures(p.gain) : null;
            return (
              <li key={r.id} className="panel reward-card">
                <div className="reward-head">
                  <div>
                    <small>
                      {r.id} · {r.created.slice(0, 10)}
                    </small>
                    <h2>
                      <button
                        className="text-button"
                        onClick={() => onOpen(r.proposalId)}
                      >
                        {r.proposalId} · {p?.title || "Öneri"}
                      </button>
                    </h2>
                    <p className="muted">
                      {p?.operation} · Puan <b>{r.basis.score}</b>
                      {g && g.annual > 0 && (
                        <>
                          {" "}
                          · İlk yıl net kazanç <b>{money(r.basis.net)}</b>
                        </>
                      )}
                      {p?.gain?.type &&
                        p.gain.type !== "Parasal" &&
                        " · " + p.gain.type + " iyileştirmesi"}
                    </p>
                  </div>
                  <div className="reward-value">
                    <b>{r.ruleLabel}</b>
                    <span>{rewardText(r.kind, r.total, r.ruleLabel)}</span>
                  </div>
                </div>
                <table className="mini-table">
                  <caption className="sr-only">Ödül alacak kişiler</caption>
                  <thead>
                    <tr>
                      <th>Kişi</th>
                      <th>Departman</th>
                      <th>Kişi başı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.recipients.map((x) => (
                      <tr key={x.userId}>
                        <td>
                          {who(x.userId)?.name || x.userId}
                          {who(x.userId)?.active === 0 && " (pasif)"}
                          {p?.anonymous && " · anonim önerdi"}
                        </td>
                        <td>{who(x.userId)?.department || "—"}</td>
                        <td>{rewardText(r.kind, x.value, r.ruleLabel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.note && <p className="reward-note">Not: {r.note}</p>}
                {r.status === "Ödendi" && (
                  <p className="muted">
                    Bordro dönemi {r.payrollPeriod} ·{" "}
                    {who(r.paidBy || "")?.name}
                  </p>
                )}
                {r.decidedBy && r.status !== "Ödendi" && (
                  <p className="muted">
                    Karar: {who(r.decidedBy)?.name} ·{" "}
                    {r.decidedAt?.slice(0, 10)}
                  </p>
                )}

                {["Onay bekliyor", "Onaylandı"].includes(r.status) &&
                  (open === r.id ? (
                    <form
                      className="reward-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                      }}
                    >
                      {r.status === "Onay bekliyor" ? (
                        <>
                          {r.kind !== "gift" && (
                            <label className="field">
                              <span>
                                {r.kind === "salary"
                                  ? "Toplam maaş katı"
                                  : "Toplam tutar (₺)"}
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={r.kind === "salary" ? 0.05 : 100}
                                value={form.total}
                                onChange={(e) =>
                                  setForm({ ...form, total: e.target.value })
                                }
                              />
                            </label>
                          )}
                          <label className="field wide">
                            <span>
                              Gerekçe (değer değişirse ya da reddedilirse
                              zorunlu)
                            </span>
                            <input
                              value={form.reason}
                              maxLength={400}
                              onChange={(e) =>
                                setForm({ ...form, reason: e.target.value })
                              }
                            />
                          </label>
                          <div className="buttons">
                            <button
                              type="button"
                              className="primary"
                              disabled={busy}
                              onClick={async () => {
                                const ok = await command(
                                  {
                                    action: "rewardDecide",
                                    rewardId: r.id,
                                    decision: "approve",
                                    total:
                                      r.kind === "gift"
                                        ? undefined
                                        : Number(form.total),
                                    reason: form.reason,
                                  },
                                  false,
                                  "Ödül onaylandı.",
                                );
                                if (ok) setOpen(null);
                              }}
                            >
                              Onayla
                            </button>
                            <button
                              type="button"
                              className="secondary danger-text"
                              disabled={busy}
                              onClick={async () => {
                                const ok = await command(
                                  {
                                    action: "rewardDecide",
                                    rewardId: r.id,
                                    decision: "reject",
                                    reason: form.reason,
                                  },
                                  false,
                                  "Ödül verilmedi olarak kaydedildi.",
                                );
                                if (ok) setOpen(null);
                              }}
                            >
                              Reddet
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setOpen(null)}
                            >
                              Vazgeç
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="field">
                            <span>Bordro dönemi</span>
                            <input
                              type="month"
                              value={form.period}
                              onChange={(e) =>
                                setForm({ ...form, period: e.target.value })
                              }
                            />
                          </label>
                          <div className="buttons">
                            <button
                              type="button"
                              className="primary"
                              disabled={busy}
                              onClick={async () => {
                                const ok = await command(
                                  {
                                    action: "rewardPaid",
                                    rewardId: r.id,
                                    period: form.period,
                                  },
                                  false,
                                  "Ödendi olarak işaretlendi.",
                                );
                                if (ok) setOpen(null);
                              }}
                            >
                              Ödendi işaretle
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setOpen(null)}
                            >
                              Vazgeç
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  ) : (
                    <div className="buttons">
                      <button className="primary" onClick={() => start(r)}>
                        {r.status === "Onay bekliyor"
                          ? "Karar ver"
                          : "Ödendi işaretle"}
                      </button>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
