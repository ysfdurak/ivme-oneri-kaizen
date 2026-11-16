// Ödül mekanizması (saf fonksiyonlar).
//
// Akış: öneri puanlanıp "Tamamlandı" olunca kurallara göre otomatik bir ödül kaydı oluşur ve ödül sorumlusuna
// (İK) düşer. İK onaylar (gerekirse değeri gerekçeyle değiştirir) ya da reddeder; onaylanan ödül bordro
// döneminde ek ödeme olarak verilip "Ödendi" işaretlenir.
//
// Maaş bilgisi İvme'de TUTULMAZ: "0,5 brüt maaş" bir talimattır, tutarı İK kendi sisteminde hesaplar.
// Kurallar yukarıdan aşağı denenir; puanı ve (varsa) yıllık net kazanç şartını karşılayan ilk kural uygulanır.
import { intlLocale } from "./i18n";
import { Proposal, gainFigures, currency } from "./model";

export type RewardKind = "salary" | "amount" | "gift";
export type RewardRule = {
  id: string;
  /** En az puan (0–100). */
  minScore: number;
  /** En az ilk yıl net kazanç (₺); boşsa şart yok. */
  minNet?: number | null;
  kind: RewardKind;
  /** salary: maaş katı (ör. 0.5) · amount: ₺ · gift: kullanılmaz (etiket yeterli). */
  value: number;
  /** Görünen ad (ör. "Yarım maaş ikramiye", "Teşekkür belgesi"). */
  label: string;
};
export type RewardSettings = {
  enabled: boolean;
  /** equal: değer birlikte önerenler arasında eşit bölünür · each: her kişi tam değeri alır. */
  split: "equal" | "each";
  rules: RewardRule[];
};
export type RewardStatus =
  "Onay bekliyor" | "Onaylandı" | "Ödendi" | "Reddedildi" | "İptal edildi";
export type Reward = {
  id: string;
  proposalId: string;
  created: string;
  status: RewardStatus;
  ruleLabel: string;
  kind: RewardKind;
  /** Toplam değer (maaş katı ya da ₺; hediyede 0). */
  total: number;
  /** Kişi başı pay. */
  recipients: { userId: string; value: number }[];
  /** Karar dayanağı: puan ve ilk yıl net kazanç (₺). */
  basis: { score: number; net: number };
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
  payrollPeriod?: string;
  paidAt?: string;
  paidBy?: string;
};

export const REWARD_STATUSES: RewardStatus[] = [
  "Onay bekliyor",
  "Onaylandı",
  "Ödendi",
  "Reddedildi",
  "İptal edildi",
];
export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  enabled: false,
  split: "equal",
  rules: [
    {
      id: "r1",
      minScore: 85,
      minNet: 100000,
      kind: "salary",
      value: 0.5,
      label: "Yarım maaş ikramiye",
    },
    {
      id: "r2",
      minScore: 70,
      minNet: null,
      kind: "amount",
      value: 5000,
      label: "Başarı ödülü",
    },
    {
      id: "r3",
      minScore: 50,
      minNet: null,
      kind: "amount",
      value: 1500,
      label: "Hediye çeki",
    },
    {
      id: "r4",
      minScore: 0,
      minNet: null,
      kind: "gift",
      value: 0,
      label: "Teşekkür belgesi",
    },
  ],
};

const tr = (n: number, digits = 2) =>
  n.toLocaleString(intlLocale(), { maximumFractionDigits: digits });
/** Değeri okunur metne çevirir: "0,5 brüt maaş", "5.000 ₺", "Teşekkür belgesi". */
export function rewardText(kind: RewardKind, value: number, label = "") {
  if (kind === "salary") return tr(value) + " brüt maaş";
  if (kind === "amount") return tr(value) + " " + currency();
  return label || "Hediye / belge";
}

/** Kural listesini doğrular; hatada açıklayıcı mesajla Error fırlatır. */
export function validateRewardSettings(x: any): RewardSettings {
  const rules: any[] = Array.isArray(x?.rules) ? x.rules : [];
  if (rules.length > 10)
    throw new Error("En fazla 10 ödül kuralı tanımlanabilir.");
  const clean = rules.map((r, i) => {
    const line = "Kural " + (i + 1) + ": ";
    const minScore = Number(r.minScore);
    if (!Number.isInteger(minScore) || minScore < 0 || minScore > 100)
      throw new Error(line + "en az puan 0–100 arası tam sayı olmalı.");
    const minNet =
      r.minNet === "" || r.minNet === null || r.minNet === undefined
        ? null
        : Number(r.minNet);
    if (minNet !== null && (!Number.isFinite(minNet) || minNet < 0))
      throw new Error(line + "net kazanç şartı geçersiz.");
    if (!["salary", "amount", "gift"].includes(r.kind))
      throw new Error(line + "ödül türü seçin.");
    const value = Number(r.value) || 0;
    if (r.kind === "salary" && (value <= 0 || value > 12))
      throw new Error(line + "maaş katı 0 ile 12 arasında olmalı.");
    if (r.kind === "amount" && (value <= 0 || value > 10_000_000))
      throw new Error(line + "tutar geçersiz.");
    const label = String(r.label || "")
      .trim()
      .slice(0, 60);
    if (label.length < 2) throw new Error(line + "ödül adı yazın.");
    return {
      id:
        typeof r.id === "string" && /^[a-z0-9-]{1,40}$/.test(r.id)
          ? r.id
          : "r-" + crypto.randomUUID().slice(0, 8),
      minScore,
      minNet,
      kind: r.kind as RewardKind,
      value: r.kind === "gift" ? 0 : value,
      label,
    };
  });
  // Yüksek eşik önce denenir; aynı puanda net kazanç şartı olan önce.
  clean.sort(
    (a, b) => b.minScore - a.minScore || (b.minNet ?? -1) - (a.minNet ?? -1),
  );
  return {
    enabled: !!x?.enabled,
    split: x?.split === "each" ? "each" : "equal",
    rules: clean,
  };
}

/** Öneriye uyan ilk kural (yoksa null). */
export function pickRule(
  p: Pick<Proposal, "score" | "gain">,
  settings: RewardSettings,
) {
  const score = p.score?.valid !== false ? Number(p.score?.total) || 0 : 0;
  const net =
    p.gain?.approved && p.gain?.valid !== false ? gainFigures(p.gain).net : 0;
  const rule =
    settings.rules.find(
      (r) => score >= r.minScore && (r.minNet == null || net >= r.minNet),
    ) || null;
  return { rule, score, net };
}

/** Kişi başı pay: eşit bölmede iki ondalığa yuvarlanır, hediyede herkes aynı hediyeyi alır. */
export function shares(
  kind: RewardKind,
  total: number,
  people: string[],
  split: RewardSettings["split"],
) {
  const each =
    kind === "gift" || split === "each"
      ? total
      : Math.round((total / Math.max(1, people.length)) * 100) / 100;
  return people.map((userId) => ({ userId, value: each }));
}

/** Tamamlanan öneri için ödül kaydı üretir (kural yoksa null). */
export function buildReward(
  p: Proposal,
  settings: RewardSettings,
  now: string,
): Reward | null {
  if (!settings.enabled) return null;
  const { rule, score, net } = pickRule(p, settings);
  if (!rule) return null;
  const people = [...new Set([p.author, ...(p.coAuthors || [])])];
  return {
    id:
      "OD-" + p.id.replace(/^KZ-/, "") + "-" + crypto.randomUUID().slice(0, 4),
    proposalId: p.id,
    created: now,
    status: "Onay bekliyor",
    ruleLabel: rule.label,
    kind: rule.kind,
    total: rule.value,
    recipients: shares(rule.kind, rule.value, people, settings.split),
    basis: { score, net },
  };
}
