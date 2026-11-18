// Rapor oluşturucu (saf fonksiyonlar): filtre + gruplama + ölçüler → tablo.
// Kullanıcı kendi raporunu kurar: ör. "2026 yılında tamamlanan iyileştirmelerin aylık net kazancı",
// "bölümlere göre onaylı kazanç", "müdürlüklere göre katılım". Hesap yalnız kullanıcının görebildiği önerilerle yapılır.
import { ANON, Proposal, User, gainFigures } from "./model";
import { getLocale } from "./i18n";

export type DateBasis = "created" | "completed" | "gainApproved";
export type GroupBy =
  | "none"
  | "month"
  | "quarter"
  | "year"
  | "operation"
  | "directorate"
  | "department"
  | "category"
  | "location"
  | "campaign"
  | "author"
  | "status"
  | "notImplementedReason";
export type MeasureId =
  | "count"
  | "open"
  | "implemented"
  | "completed"
  | "rejected"
  | "notImplemented"
  | "authors"
  | "gross"
  | "cost"
  | "net"
  | "avgScore"
  | "avgDays"
  | "nonMonetary";
export type StatusFilter =
  "all" | "open" | "implemented" | "completed" | "rejected" | "notImplemented";

export type ReportConfig = {
  name?: string;
  dateBasis: DateBasis;
  /** "" = tüm yıllar */
  year: string;
  /** "" = tüm aylar, "1".."12" */
  month: string;
  status: StatusFilter;
  operation: string;
  directorate: string;
  department: string;
  category: string;
  location: string;
  campaign: string;
  /** Eski sistemden aktarılan öneriler: "" dahil, "exclude" hariç, "only" yalnız aktarılanlar. */
  imported?: "" | "exclude" | "only";
  groupBy: GroupBy;
  measures: MeasureId[];
  /** Sıralama ölçüsü; zaman gruplarında (ay/çeyrek/yıl) her zaman tarih sırası kullanılır. */
  sortBy: MeasureId | "label";
  /** 0 = hepsi */
  limit: number;
};

export const DATE_BASES: { id: DateBasis; label: string }[] = [
  { id: "created", label: "Öneri tarihi" },
  { id: "completed", label: "Tamamlanma tarihi" },
  { id: "gainApproved", label: "Kazanç onay tarihi" },
];
export const GROUPS: { id: GroupBy; label: string }[] = [
  { id: "month", label: "Ay" },
  { id: "quarter", label: "Çeyrek" },
  { id: "year", label: "Yıl" },
  { id: "operation", label: "Bölüm" },
  { id: "directorate", label: "Önerenin müdürlüğü" },
  { id: "department", label: "Önerenin departmanı" },
  { id: "category", label: "İyileştirme alanı" },
  { id: "location", label: "Lokasyon" },
  { id: "campaign", label: "Kampanya" },
  { id: "author", label: "Öneren kişi" },
  { id: "status", label: "Durum" },
  { id: "notImplementedReason", label: "Uygulanamama nedeni" },
  { id: "none", label: "Gruplama yok (toplam)" },
];
export const MEASURES: {
  id: MeasureId;
  label: string;
  money?: boolean;
  hint?: string;
}[] = [
  { id: "count", label: "Öneri" },
  { id: "open", label: "Açık" },
  { id: "implemented", label: "Uygulamaya alınan" },
  { id: "completed", label: "Tamamlanan" },
  { id: "rejected", label: "Reddedilen" },
  {
    id: "notImplemented",
    label: "Uygulanamayan",
    hint: "Aksiyon aşamasında bir nedenle hayata geçemeyen",
  },
  {
    id: "authors",
    label: "Öneren kişi",
    hint: "Farklı kişi sayısı (birlikte önerenler dahil, anonimler hariç)",
  },
  {
    id: "gross",
    label: "İlk yıl kazanç ₺",
    money: true,
    hint: "Onaylı parasal kazanç: aylık × 12, yıllık, tek seferlik",
  },
  { id: "cost", label: "Uygulama maliyeti ₺", money: true },
  {
    id: "net",
    label: "İlk yıl net kazanç ₺",
    money: true,
    hint: "Kazanç − maliyet",
  },
  { id: "avgScore", label: "Ortalama puan" },
  {
    id: "avgDays",
    label: "Ort. sonuçlanma (gün)",
    hint: "Öneriden tamamlanmaya geçen gün",
  },
  {
    id: "nonMonetary",
    label: "Parasal olmayan kazanç",
    hint: "Zaman, kalite, iş güvenliği, ergonomi kazancı onaylanan öneri",
  },
];
const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Kısa ay adları arayüz diline göre (rapor satırları "Eyl 2026" / "Sep 2026"). */
export const monthNames = () => (getLocale() === "en" ? MONTHS_EN : MONTHS_TR);
/** Geriye dönük uyumluluk: Türkçe kısa ay adları. */
export const MONTHS = MONTHS_TR;
const IMPLEMENTED = [
  "Uygulamada",
  "Kazanç girişi",
  "Kazanç düzeltmesi bekliyor",
  "Kazanç onayı",
  "Puanlama",
  "Tamamlandı",
];
const CLOSED_BAD = ["Reddedildi", "İptal edildi", "Uygulanamadı"];

export const DEFAULT_CONFIG: ReportConfig = {
  dateBasis: "created",
  year: "",
  month: "",
  status: "all",
  operation: "",
  directorate: "",
  department: "",
  category: "",
  location: "",
  campaign: "",
  groupBy: "month",
  measures: ["count", "completed", "net"],
  sortBy: "count",
  limit: 0,
};

/** Hazır raporlar: tek tıkla açılır, sonra istenildiği gibi değiştirilir. */
export function presets(
  year: string,
): { id: string; title: string; config: ReportConfig }[] {
  return [
    {
      id: "monthly-gain",
      title: "Tamamlanan iyileştirmeler · aylık tutar",
      config: {
        ...DEFAULT_CONFIG,
        dateBasis: "completed",
        status: "completed",
        year,
        groupBy: "month",
        measures: ["completed", "gross", "cost", "net", "avgScore"],
        sortBy: "net",
      },
    },
    {
      id: "operation-gain",
      title: "Bölümlere göre onaylı kazanç",
      config: {
        ...DEFAULT_CONFIG,
        dateBasis: "gainApproved",
        year,
        groupBy: "operation",
        measures: ["count", "gross", "cost", "net"],
        sortBy: "net",
      },
    },
    {
      id: "directorate-participation",
      title: "Müdürlüklere göre katılım",
      config: {
        ...DEFAULT_CONFIG,
        year,
        groupBy: "directorate",
        measures: ["count", "authors", "implemented", "completed", "rejected"],
        sortBy: "count",
      },
    },
    {
      id: "category",
      title: "İyileştirme alanına göre sonuç",
      config: {
        ...DEFAULT_CONFIG,
        year,
        groupBy: "category",
        measures: ["count", "completed", "net", "nonMonetary", "avgDays"],
        sortBy: "count",
      },
    },
  ];
}

/** Seçilen tarih türüne göre önerinin tarihi (yoksa null: o öneri bu raporda yer almaz). */
export function dateOf(p: Proposal, basis: DateBasis): string | null {
  if (basis === "created") return p.created || null;
  if (basis === "completed")
    return p.status === "Tamamlandı" ? p.stageAt || null : null;
  const g: any = p.gain;
  return g?.approved && g.valid !== false ? g.approvedAt || null : null;
}

const approvedGain = (p: Proposal) => {
  const g: any = p.gain;
  return g && g.approved && g.valid !== false && !CLOSED_BAD.includes(p.status)
    ? g
    : null;
};

function matches(p: Proposal, c: ReportConfig) {
  const d = dateOf(p, c.dateBasis);
  if (!d) return false;
  if (c.year && d.slice(0, 4) !== c.year) return false;
  if (c.month && Number(d.slice(5, 7)) !== Number(c.month)) return false;
  if (
    c.status === "open" &&
    (p.status === "Tamamlandı" || CLOSED_BAD.includes(p.status))
  )
    return false;
  if (c.status === "implemented" && !IMPLEMENTED.includes(p.status))
    return false;
  if (c.status === "completed" && p.status !== "Tamamlandı") return false;
  if (c.status === "rejected" && p.status !== "Reddedildi") return false;
  if (c.status === "notImplemented" && p.status !== "Uygulanamadı")
    return false;
  if (c.status === "all" && p.status === "İptal edildi") return false;
  if (c.operation && p.operation !== c.operation) return false;
  if (c.directorate && p.directorate !== c.directorate) return false;
  if (c.department && p.department !== c.department) return false;
  if (c.category && p.category !== c.category) return false;
  if (c.location && (p.location || "") !== c.location) return false;
  if (c.campaign && (p.campaign || "") !== c.campaign) return false;
  if (c.imported === "exclude" && (p as any).legacyNo) return false;
  if (c.imported === "only" && !(p as any).legacyNo) return false;
  return true;
}

function groupKey(
  p: Proposal,
  c: ReportConfig,
  users: User[],
  campaigns: { id: string; title: string }[],
): { key: string; label: string } {
  const d = dateOf(p, c.dateBasis) || "";
  switch (c.groupBy) {
    case "none":
      return { key: "all", label: "Toplam" };
    case "month":
      return {
        key: d.slice(0, 7),
        label: monthNames()[Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4),
      };
    case "quarter": {
      const q = Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1;
      return {
        key: d.slice(0, 4) + "-Q" + q,
        label: d.slice(0, 4) + " · " + q + ". çeyrek",
      };
    }
    case "year":
      return { key: d.slice(0, 4), label: d.slice(0, 4) };
    case "author": {
      if (p.author === ANON || p.anonymous)
        return { key: ANON, label: "Anonim öneriler" };
      return {
        key: p.author,
        label: users.find((u) => u.id === p.author)?.name || "—",
      };
    }
    case "campaign": {
      const t = campaigns.find((x) => x.id === p.campaign)?.title;
      return {
        key: p.campaign || "",
        label: t || (p.campaign ? "Silinmiş kampanya" : "Kampanya dışı"),
      };
    }
    case "location":
      return { key: p.location || "", label: p.location || "Lokasyon yok" };
    case "notImplementedReason":
      return p.notImplemented
        ? { key: p.notImplemented.reason, label: p.notImplemented.reason }
        : {
            key: "",
            label:
              p.status === "Uygulanamadı"
                ? "Neden girilmemiş"
                : "Uygulanamadı değil",
          };
    default: {
      const v = String((p as any)[c.groupBy] || "");
      return { key: v, label: v || "—" };
    }
  }
}

function measure(id: MeasureId, ps: Proposal[]): number {
  switch (id) {
    case "count":
      return ps.length;
    case "open":
      return ps.filter(
        (p) => p.status !== "Tamamlandı" && !CLOSED_BAD.includes(p.status),
      ).length;
    case "implemented":
      return ps.filter((p) => IMPLEMENTED.includes(p.status)).length;
    case "completed":
      return ps.filter((p) => p.status === "Tamamlandı").length;
    case "rejected":
      return ps.filter((p) => p.status === "Reddedildi").length;
    case "notImplemented":
      return ps.filter((p) => p.status === "Uygulanamadı").length;
    case "authors":
      return new Set(
        ps
          .filter((p) => !p.anonymous)
          .flatMap((p) => [p.author, ...(p.coAuthors || [])]),
      ).size;
    case "gross":
    case "cost":
    case "net": {
      const f = ps
        .map(approvedGain)
        .filter(Boolean)
        .map((g) => gainFigures(g));
      const key = id === "gross" ? "annual" : id;
      return Math.round(f.reduce((a, x: any) => a + x[key], 0));
    }
    case "avgScore": {
      const s = ps.filter(
        (p) =>
          p.score &&
          p.score.valid !== false &&
          typeof p.score.total === "number",
      );
      return s.length
        ? Math.round(
            (s.reduce((a, p) => a + p.score.total, 0) / s.length) * 10,
          ) / 10
        : 0;
    }
    case "avgDays": {
      const s = ps.filter(
        (p) => p.status === "Tamamlandı" && p.stageAt && p.created,
      );
      return s.length
        ? Math.round(
            (s.reduce(
              (a, p) =>
                a + (Date.parse(p.stageAt) - Date.parse(p.created)) / 86400000,
              0,
            ) /
              s.length) *
              10,
          ) / 10
        : 0;
    }
    case "nonMonetary":
      return ps.filter((p) => {
        const g = approvedGain(p);
        return g && g.type !== "Parasal";
      }).length;
  }
}

export type ReportResult = {
  columns: { id: MeasureId; label: string; money?: boolean }[];
  rows: { key: string; label: string; values: Record<string, number> }[];
  total: Record<string, number>;
  /** Rapora giren öneri sayısı. */
  matched: number;
};

export function runReport(
  proposals: Proposal[],
  c: ReportConfig,
  users: User[],
  campaigns: { id: string; title: string }[] = [],
): ReportResult {
  const measures = (c.measures.length ? c.measures : ["count"]) as MeasureId[];
  const ps = proposals.filter((p) => matches(p, c));
  const groups = new Map<string, { label: string; items: Proposal[] }>();
  for (const p of ps) {
    const g = groupKey(p, c, users, campaigns);
    if (!groups.has(g.key)) groups.set(g.key, { label: g.label, items: [] });
    groups.get(g.key)!.items.push(p);
  }
  let rows = [...groups.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    values: Object.fromEntries(
      measures.map((m) => [m, measure(m, g.items)]),
    ) as Record<string, number>,
  }));
  const timeGroup = ["month", "quarter", "year"].includes(c.groupBy);
  if (timeGroup) rows.sort((a, b) => a.key.localeCompare(b.key));
  else if (c.sortBy === "label")
    rows.sort((a, b) => a.label.localeCompare(b.label, "tr"));
  else {
    const by = measures.includes(c.sortBy as MeasureId)
      ? (c.sortBy as MeasureId)
      : measures[0];
    rows.sort(
      (a, b) =>
        (b.values[by] || 0) - (a.values[by] || 0) ||
        a.label.localeCompare(b.label, "tr"),
    );
  }
  if (c.limit > 0 && !timeGroup) rows = rows.slice(0, c.limit);
  return {
    columns: measures.map((m) => {
      const d = MEASURES.find((x) => x.id === m)!;
      return { id: m, label: d.label, money: d.money };
    }),
    rows,
    total: Object.fromEntries(measures.map((m) => [m, measure(m, ps)])),
    matched: ps.length,
  };
}

/** Rapor ayarının okunur özeti (ör. "2026 · Kas · Tamamlanan · Bölüm: Mal Kabul"). */
export function describe(c: ReportConfig) {
  return [
    DATE_BASES.find((d) => d.id === c.dateBasis)!.label +
      ": " +
      (c.year || "tüm yıllar") +
      (c.month ? " " + monthNames()[Number(c.month) - 1] : ""),
    c.status !== "all" &&
      {
        open: "açık",
        implemented: "uygulamaya alınan",
        completed: "tamamlanan",
        rejected: "reddedilen",
        notImplemented: "uygulanamayan",
      }[c.status],
    c.operation && "Bölüm: " + c.operation,
    c.directorate && "Müdürlük: " + c.directorate,
    c.department && "Departman: " + c.department,
    c.category && "Alan: " + c.category,
    c.location && "Lokasyon: " + c.location,
    c.campaign && "Kampanya",
    c.imported === "exclude" && "Aktarılanlar hariç",
    c.imported === "only" && "Yalnız aktarılanlar",
  ]
    .filter(Boolean)
    .join(" · ");
}
