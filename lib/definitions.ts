// Tanımlanabilir listeler, puanlama kriterleri ve aşama hedef süreleri.
// Firmaya göre değişen her şey burada: öneri sınıfları (alt sınıflarıyla), ret ve uygulanamama nedenleri,
// kazanç türleri, puanlama kriterleri, hedef süreler. Varsayılanlarla gelir; Tanımlar'dan değiştirilir.
//
// Kurallar:
//  - Kayıtlar maddenin adını taşır; bir madde yeniden adlandırılınca eski kayıtlar da yeni adla güncellenir.
//  - Kullanılmış madde silinemez, pasife alınır: yeni kayıtta seçilmez, eski kayıtta ve raporda görünür.
//  - Kilitli maddeler sistemin kendi kuralıdır ("Mükerrer öneri", "Parasal"): adı değişmez, silinmez.
import {
  CATEGORY_LIST,
  DEFAULT_TARGET_DAYS,
  NOT_IMPLEMENTED_REASONS,
  REJECT_REASONS,
  STAGE_TARGET_DAYS,
  type Proposal,
  type State,
} from "./model";

export type ListItem = {
  id: string;
  name: string;
  active: boolean;
  locked?: boolean;
  subs?: ListItem[];
};
export type ListKey =
  "categories" | "rejectReasons" | "notImplementedReasons" | "gainTypes";
export type Criterion = {
  id: string;
  name: string;
  description?: string;
  weight: number;
};
export type Scoring = { scale: number; criteria: Criterion[] };

export const LIST_META: Record<
  ListKey,
  { title: string; hint: string; subs?: boolean; max: number }
> = {
  categories: {
    title: "Öneri sınıfları",
    hint: "Önerinin iyileştirme alanı. İstenirse alt sınıf eklenir (ör. Verimlilik › Bekleme israfı); alt sınıf varsa formda seçilir.",
    subs: true,
    max: 30,
  },
  rejectReasons: {
    title: "Ret nedenleri",
    hint: "Ret kararında seçilir, raporlarda dağılımı görülür.",
    max: 30,
  },
  notImplementedReasons: {
    title: "Uygulanamama nedenleri",
    hint: "Aksiyon aşamasında hayata geçemeyen öneri kapatılırken seçilir.",
    max: 30,
  },
  gainTypes: {
    title: "Kazanç türleri",
    hint: 'Kazanç girişinde seçilir. "Parasal" tutar alan tek türdür; diğerleri parasal olmayan kazançtır.',
    max: 20,
  },
};

const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "madde";
const fromNames = (names: string[], locked: string[] = []): ListItem[] =>
  names.map((name) => ({
    id: slug(name),
    name,
    active: true,
    ...(locked.includes(name) ? { locked: true } : {}),
  }));

export const DEFAULT_LISTS: Record<ListKey, ListItem[]> = {
  categories: fromNames(CATEGORY_LIST),
  rejectReasons: fromNames(REJECT_REASONS, ["Mükerrer öneri"]),
  notImplementedReasons: fromNames(NOT_IMPLEMENTED_REASONS),
  gainTypes: fromNames(
    ["Parasal", "Zaman", "Kalite", "İş güvenliği", "Ergonomi"],
    ["Parasal"],
  ),
};
export const DEFAULT_SCORING: Scoring = {
  scale: 5,
  criteria: [
    {
      id: "etki",
      name: "İyileştirmenin etkisi",
      description: "Sorunu ne kadar çözüyor, kazanç büyüklüğü",
      weight: 1,
    },
    {
      id: "kalicilik",
      name: "Uygulamanın kalıcılığı",
      description: "Standarda girdi mi, geri dönüş riski",
      weight: 1,
    },
    {
      id: "yayginlik",
      name: "Yaygınlaştırılabilirlik",
      description: "Başka bölüm ya da hatlara uygulanabilir mi",
      weight: 1,
    },
  ],
};

/** Bir listenin güncel hâli (tanımlı değilse varsayılan). */
export function listOf(
  state: Pick<State, "settings"> | null | undefined,
  key: ListKey,
): ListItem[] {
  return (
    ((state?.settings as any)?.lists?.[key] as ListItem[]) || DEFAULT_LISTS[key]
  );
}
/** Yeni kayıtta seçilebilecek (aktif) adlar. */
export function activeNames(
  state: Pick<State, "settings"> | null | undefined,
  key: ListKey,
): string[] {
  return listOf(state, key)
    .filter((x) => x.active)
    .map((x) => x.name);
}
/** Bir sınıfın aktif alt sınıfları. */
export function activeSubs(
  state: Pick<State, "settings"> | null | undefined,
  category: string,
): string[] {
  const c = listOf(state, "categories").find((x) => x.name === category);
  return (c?.subs || []).filter((x) => x.active).map((x) => x.name);
}
export function scoringOf(
  state: Pick<State, "settings"> | null | undefined,
): Scoring {
  return ((state?.settings as any)?.scoring as Scoring) || DEFAULT_SCORING;
}
/** Puan: her kriter (değer / ölçek) × ağırlık, ağırlık toplamına bölünüp 100 üzerinden. */
export function scoreTotal(values: number[], scoring: Scoring) {
  const w = scoring.criteria.reduce((a, c) => a + c.weight, 0) || 1;
  return Math.round(
    (scoring.criteria.reduce(
      (a, c, i) => a + ((values[i] || 0) / scoring.scale) * c.weight,
      0,
    ) /
      w) *
      100,
  );
}

/** Bir maddenin kayıtlarda kullanılıp kullanılmadığı (silmeyi engeller). */
export function usageCount(
  proposals: Proposal[],
  key: ListKey,
  name: string,
  parent?: string,
) {
  return proposals.filter((p) => {
    if (key === "categories")
      return parent
        ? p.category === parent && p.subcategory === name
        : p.category === name;
    if (key === "rejectReasons") return p.rejectReason === name;
    if (key === "notImplementedReasons")
      return p.notImplemented?.reason === name;
    return (
      p.gain?.type === name ||
      (p.gain?.previous || []).some((g: any) => g.type === name)
    );
  }).length;
}

/** Kaydedilecek listeyi doğrular; yeniden adlandırmaları (eski ad → yeni ad) döner. Hatalı girişte Error fırlatır. */
export function validateList(
  key: ListKey,
  next: any[],
  prev: ListItem[],
  proposals: Proposal[],
) {
  const meta = LIST_META[key];
  if (!Array.isArray(next) || !next.length)
    throw new Error(meta.title + ": en az bir madde olmalı.");
  if (next.length > meta.max)
    throw new Error(meta.title + ": en fazla " + meta.max + " madde.");
  const renames: { from: string; to: string; parent?: string }[] = [];
  const clean = (
    items: any[],
    prevItems: ListItem[],
    parent?: string,
  ): ListItem[] => {
    const seen = new Set<string>();
    const out = items.map((x) => {
      const name = String(x?.name || "")
        .trim()
        .slice(0, 60);
      if (name.length < 2)
        throw new Error(meta.title + ": madde adı en az 2 karakter olmalı.");
      if (seen.has(name.toLocaleLowerCase("tr")))
        throw new Error(meta.title + ': "' + name + '" iki kez yazılmış.');
      seen.add(name.toLocaleLowerCase("tr"));
      const old = prevItems.find((p) => p.id === x.id);
      if (old?.locked) {
        if (old.name !== name || x.active === false)
          throw new Error(
            '"' +
              old.name +
              '" sistemin kendi maddesidir; adı değişmez, pasife alınmaz.',
          );
      }
      if (old && old.name !== name)
        renames.push({ from: old.name, to: name, parent });
      const item: ListItem = {
        id: old
          ? old.id
          : slug(name) + "-" + Math.random().toString(36).slice(2, 6),
        name,
        active: x.active !== false,
        ...(old?.locked ? { locked: true } : {}),
      };
      if (meta.subs && !parent)
        item.subs = clean(
          Array.isArray(x.subs) ? x.subs : [],
          old?.subs || [],
          name,
        );
      return item;
    });
    // Silinen maddeler: kullanılıyorsa engel.
    for (const old of prevItems) {
      if (out.some((o) => o.id === old.id)) continue;
      if (old.locked)
        throw new Error(
          '"' + old.name + '" sistemin kendi maddesidir; silinemez.',
        );
      const parentName = parent
        ? renames.find((r) => !r.parent && r.to === parent)?.from || parent
        : undefined;
      const used = usageCount(proposals, key, old.name, parentName);
      if (used)
        throw new Error(
          '"' +
            old.name +
            '" ' +
            used +
            " kayıtta kullanılıyor; silmek yerine pasife alın.",
        );
    }
    return out;
  };
  const items = clean(next, prev);
  return { items, renames };
}

/** Yeniden adlandırmayı eski kayıtlara uygular (kayıtlar maddenin adını taşır). */
export function applyRenames(
  proposals: Proposal[],
  key: ListKey,
  renames: { from: string; to: string; parent?: string }[],
) {
  let changed = 0;
  // Önce alt sınıflar (üst sınıfın eski adıyla eşleşir), sonra üst sınıflar.
  const subs = renames.filter((r) => r.parent);
  const tops = renames.filter((r) => !r.parent);
  for (const p of proposals) {
    for (const r of subs) {
      const parentOld = tops.find((t) => t.to === r.parent)?.from || r.parent;
      if (
        key === "categories" &&
        p.category === parentOld &&
        p.subcategory === r.from
      )
        ((p.subcategory = r.to), changed++);
    }
    for (const r of tops) {
      if (key === "categories" && p.category === r.from)
        ((p.category = r.to), changed++);
      if (key === "rejectReasons" && p.rejectReason === r.from)
        ((p.rejectReason = r.to), changed++);
      if (
        key === "notImplementedReasons" &&
        p.notImplemented?.reason === r.from
      )
        ((p.notImplemented.reason = r.to), changed++);
      if (key === "gainTypes") {
        if (p.gain?.type === r.from) ((p.gain.type = r.to), changed++);
        for (const g of p.gain?.previous || [])
          if (g.type === r.from) g.type = r.to;
      }
    }
  }
  return changed;
}

export function validateScoring(x: any): Scoring {
  const scale = Number(x?.scale);
  if (![3, 4, 5, 10].includes(scale))
    throw new Error("Puan ölçeği 3, 4, 5 ya da 10 olmalı.");
  const list: any[] = Array.isArray(x?.criteria) ? x.criteria : [];
  if (list.length < 1 || list.length > 6)
    throw new Error("1 ile 6 arasında puanlama kriteri olmalı.");
  const criteria = list.map((c, i) => {
    const name = String(c?.name || "")
      .trim()
      .slice(0, 60);
    if (name.length < 2) throw new Error("Kriter " + (i + 1) + ": ad yazın.");
    const weight = Number(c?.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100)
      throw new Error(name + ": ağırlık 1–100 arası tam sayı olmalı.");
    return {
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : slug(name),
      name,
      description:
        String(c?.description || "")
          .trim()
          .slice(0, 160) || undefined,
      weight,
    };
  });
  return { scale, criteria };
}

export const TARGET_STAGES = Object.keys(DEFAULT_TARGET_DAYS);
export function validateTargetDays(x: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const st of TARGET_STAGES) {
    const v = Number(x?.[st] ?? DEFAULT_TARGET_DAYS[st]);
    if (!Number.isInteger(v) || v < 1 || v > 365)
      throw new Error(st + ": hedef süre 1–365 gün arası tam sayı olmalı.");
    out[st] = v;
  }
  return out;
}

/** Kurumun hedef sürelerini uygular. Gecikme hesapları (overdueDays) bu tabloyu okur;
 * sunucuda her istekte durum yüklenince, tarayıcıda durum her geldiğinde çağrılır. */
export function applyTargetDays(
  state: Pick<State, "settings"> | null | undefined,
) {
  const custom = (state?.settings as any)?.targetDays || {};
  for (const st of TARGET_STAGES)
    STAGE_TARGET_DAYS[st] = Number(custom[st]) || DEFAULT_TARGET_DAYS[st];
}
