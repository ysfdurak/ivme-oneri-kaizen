// Durum panosu hesaplamaları. Saf fonksiyonlardır: aynı veriyle her zaman aynı sonucu verir,
// arayüzden bağımsız test edilir ve ileride MCP aracı olarak da aynen kullanılabilir.
import {
  CLOSED,
  STAGES,
  OrgDefinitions,
  Proposal,
  User,
  age,
  overdueDays,
} from "./model";

/** Panodaki raporlar. Yönetici bunları tek tek pasife çekebilir. */
export const REPORTS = [
  {
    id: "status",
    title: "Öneri durumları",
    hint: "Açık önerilerin aşamalara dağılımı",
  },
  {
    id: "owners",
    title: "Üzerinde en çok öneri bekleyenler",
    hint: "Sorumlusu olduğu açık öneri sayısı",
  },
  {
    id: "directorates",
    title: "En çok öneri bekleyen müdürlükler",
    hint: "Önerinin şu an beklediği kişinin birimine göre",
  },
  {
    id: "deptWait",
    title: "Ortalama bekleme süresi en uzun departmanlar",
    hint: "Açık önerilerin bulunduğu aşamada geçen gün ortalaması",
  },
  {
    id: "dirWait",
    title: "Ortalama bekleme süresi en uzun müdürlükler",
    hint: "Açık önerilerin bulunduğu aşamada geçen gün ortalaması",
  },
  {
    id: "locations",
    title: "Lokasyonlara göre açık öneriler",
    hint: "Lokasyon bazında bekleyen öneri ve gecikme",
  },
  {
    id: "longest",
    title: "En uzun süredir bekleyen 10 öneri",
    hint: "Bulunduğu aşamada en uzun bekleyenler",
  },
  {
    id: "actions",
    title: "Aksiyon durumları",
    hint: "Açık önerilerdeki aksiyonların durumu ve gecikenler",
  },
  {
    id: "participation",
    title: "Öneri katılımı",
    hint: "Kapsamdaki aktif çalışanların seçili dönemde verdiği öneri sayısı; anonim öneriler kişiye yazılmaz",
  },
] as const;
export type ReportId = (typeof REPORTS)[number]["id"];
export const REPORT_IDS = REPORTS.map((r) => r.id) as string[];

export type GroupRow = {
  key: string;
  label: string;
  sub?: string;
  inactive?: boolean;
  /** Ortalama, güvenilir sayılamayacak kadar az kayda dayanıyorsa true. */
  lowSample?: boolean;
  count: number;
  avgDays: number;
  maxDays: number;
  overdue: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
export const openOf = (ps: Proposal[]) =>
  ps.filter((p) => !CLOSED.includes(p.status));

/** Açık önerileri bir anahtara göre gruplar; sayı, ortalama/en uzun bekleme ve gecikme sayısını döner. */
export function groupOpen(
  ps: Proposal[],
  keyOf: (
    p: Proposal,
  ) => { key: string; label: string; sub?: string; inactive?: boolean } | null,
): GroupRow[] {
  const map = new Map<string, GroupRow & { total: number }>();
  for (const p of openOf(ps)) {
    const k = keyOf(p);
    if (!k) continue;
    const days = age(p.stageAt);
    const row = map.get(k.key) || {
      ...k,
      count: 0,
      avgDays: 0,
      maxDays: 0,
      overdue: 0,
      total: 0,
    };
    row.count++;
    row.total += days;
    row.maxDays = Math.max(row.maxDays, days);
    if (overdueDays(p) > 0) row.overdue++;
    map.set(k.key, row);
  }
  return [...map.values()].map(({ total, ...r }) => ({
    ...r,
    avgDays: round1(total / r.count),
  }));
}

/** Önerinin şu an kimde beklediğine göre sorumlu kullanıcısı (revizyonda öneri sahibi). */
const ownerUser = (p: Proposal, users: User[]) =>
  users.find((u) => u.id === p.owner);

export function byOwner(ps: Proposal[], users: User[]) {
  return groupOpen(ps, (p) => {
    const u = ownerUser(p, users);
    if (!p.owner) return null;
    return {
      key: p.owner,
      label:
        p.owner === "anonim"
          ? "Öneren (anonim, revizyonda)"
          : (u?.name || "Tanımsız kullanıcı") +
            (u?.active === 0 ? " (pasif)" : ""),
      sub:
        (u?.department || "") +
        // Aynı adlı kişiler departmanla ayrılır; aynı departmandaysa (yalnız yöneticiye gelen) kullanıcı adı eklenir.
        (u &&
        u.username &&
        users.filter((x) => x.name === u.name && x.department === u.department)
          .length > 1
          ? " · " + u.username
          : ""),
      inactive: u?.active === 0,
    };
  }).sort((a, b) => b.count - a.count || b.avgDays - a.avgDays);
}

/** field: sorumlunun "department" veya "directorate" bilgisi. */
export function byOwnerUnit(
  ps: Proposal[],
  users: User[],
  field: "department" | "directorate",
) {
  return groupOpen(ps, (p) => {
    const v = ownerUser(p, users)?.[field];
    return p.owner ? { key: v || "—", label: v || "Tanımsız" } : null;
  });
}
/** Hiyerarşi seviyesi: müdürlük, direktörlük veya genel müdürlük (Tanımlar'da açıksa). */
export type OrgLevel = "directorate" | "division" | "group";
/** Bir müdürlüğün seçilen seviyedeki üst birimi. */
export function unitAt(
  directorate: string,
  level: OrgLevel,
  org?: OrgDefinitions,
) {
  if (level === "directorate" || !org) return directorate;
  const division =
    org.directorates.find((d) => d.name === directorate)?.division || "";
  if (level === "division") return division;
  return org.divisions.find((d) => d.name === division)?.group || "";
}
/** Sorumlunun müdürlüğüne göre gruplar; seviye seçilirse direktörlük veya genel müdürlüğe toplanır. */
export function byOwnerLevel(
  ps: Proposal[],
  users: User[],
  level: OrgLevel,
  org?: OrgDefinitions,
) {
  return groupOpen(ps, (p) => {
    const d = ownerUser(p, users)?.directorate;
    if (!p.owner) return null;
    const v = d ? unitAt(d, level, org) : "";
    return { key: v || "—", label: v || "Tanımsız" };
  });
}
/** Açık önerileri lokasyona göre gruplar (lokasyonu olmayanlar "Belirtilmemiş"). */
export function byLocation(ps: Proposal[]) {
  return groupOpen(ps, (p) => ({
    key: p.location || "—",
    label: p.location || "Belirtilmemiş",
  })).sort(
    (a, b) =>
      Number(a.key === "—") - Number(b.key === "—") || b.count - a.count,
  );
}
export const mostPending = (rows: GroupRow[]) =>
  rows.slice().sort((a, b) => b.count - a.count || b.avgDays - a.avgDays);
/** Ortalama bekleme sıralaması. En az MIN_SAMPLE kaydı olan gruplar önce gelir;
 * daha az kayıtlı gruplar sona alınır ve "az kayıt" diye işaretlenir (1 önerilik ortalama yanıltıcıdır). */
export const MIN_SAMPLE = 3;
export const longestAvg = (rows: GroupRow[]) =>
  rows
    .map((r) => ({ ...r, lowSample: r.count < MIN_SAMPLE }))
    .sort(
      (a, b) =>
        Number(a.lowSample) - Number(b.lowSample) ||
        b.avgDays - a.avgDays ||
        b.count - a.count,
    );

export function longestWaiting(ps: Proposal[], n = 10) {
  return openOf(ps)
    .slice()
    .sort((a, b) => a.stageAt.localeCompare(b.stageAt))
    .slice(0, n);
}

export function statusSummary(ps: Proposal[]) {
  const open = openOf(ps);
  const stages = [
    ...STAGES.slice(0, 7),
    "Revizyon bekliyor",
    "Kazanç düzeltmesi bekliyor",
  ];
  return stages.map((st) => {
    const items = open.filter((p) => p.status === st);
    return {
      key: st,
      label: st,
      count: items.length,
      avgDays: items.length
        ? round1(items.reduce((a, p) => a + age(p.stageAt), 0) / items.length)
        : 0,
      maxDays: items.reduce((a, p) => Math.max(a, age(p.stageAt)), 0),
      overdue: items.filter((p) => overdueDays(p) > 0).length,
    } as GroupRow;
  });
}

export const ACTION_STATUSES = [
  "Başlamadı",
  "Devam ediyor",
  "Tamamlandı",
  "İptal edildi",
];
/** Aksiyonun hedef tarihi geçmiş ve tamamlanmamışsa kaç gün geciktiği. */
export function actionLateDays(
  a: any,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    !a.due ||
    ["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status) ||
    a.due >= today
  )
    return 0;
  return Math.round((Date.parse(today) - Date.parse(a.due)) / 86400000);
}
export function actionSummary(ps: Proposal[], users: User[]) {
  const items = openOf(ps).flatMap((p) =>
    p.actions.map((a) => ({ ...a, proposal: p })),
  );
  const byStatus = ACTION_STATUSES.map((st) => ({
    status: st,
    count: items.filter((a) => a.status === st).length,
  }));
  const late = items
    .filter((a) => actionLateDays(a) > 0)
    .sort((a, b) => actionLateDays(b) - actionLateDays(a));
  const ownerMap = new Map<
    string,
    { key: string; label: string; sub: string; open: number; late: number }
  >();
  for (const a of items.filter(
    (a) => !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
  )) {
    const u = users.find((x) => x.id === a.owner);
    const r = ownerMap.get(a.owner) || {
      key: a.owner,
      label: (u?.name || "Tanımsız") + (u?.active === 0 ? " (pasif)" : ""),
      sub: u?.department || "",
      open: 0,
      late: 0,
    };
    r.open++;
    if (actionLateDays(a) > 0) r.late++;
    ownerMap.set(a.owner, r);
  }
  return {
    total: items.length,
    byStatus,
    late,
    byOwner: [...ownerMap.values()].sort(
      (a, b) => b.late - a.late || b.open - a.open,
    ),
  };
}

/** Uygulamaya alınmış sayılan aşamalar (katılım ve tanınma raporlarında). */
const IMPLEMENTED_STATUSES = [
  "Uygulamada",
  "Kazanç girişi",
  "Kazanç düzeltmesi bekliyor",
  "Kazanç onayı",
  "Puanlama",
  "Tamamlandı",
];
/** Katılım: kişi başına öneri sayısı (öneren ya da birlikte öneren), dağılım ve en çok öneri verenler.
 * people = raporun kapsadığı aktif çalışanlar. Anonim öneriler kimseye yazılmaz, ayrıca sayılır
 * (yoksa "1 önerisi var ama hiçbiri görünmüyor" çıkarımıyla anonimlik bozulurdu).
 * İptal edilen öneriler sayılmaz. from: ISO tarih, bu tarihten sonra verilen öneriler. */
export function participation(
  ps: Proposal[],
  people: User[],
  from = "",
  threshold = 5,
  topN = 10,
) {
  // Eşik (ör. 5 ya da 7 ve üzeri) ve listelenecek kişi sayısı (ör. 10, 15, 20) ekrandan seçilir.
  const t = Math.max(2, Math.min(100, Math.round(threshold) || 5));
  const n = Math.max(1, Math.min(200, Math.round(topN) || 10));
  const groups = [
    { key: "none", label: "Hiç öneri vermedi", min: 0, max: 0 },
    { key: "one", label: "1 öneri", min: 1, max: 1 },
    ...(t > 2
      ? [
          {
            key: "some",
            label: t === 3 ? "2 öneri" : "2–" + (t - 1) + " öneri",
            min: 2,
            max: t - 1,
          },
        ]
      : []),
    { key: "many", label: t + " ve üzeri öneri", min: t, max: Infinity },
  ];
  const inPeriod = ps.filter(
    (p) => p.status !== "İptal edildi" && (!from || p.created >= from),
  );
  const named = inPeriod.filter((p) => !p.anonymous);
  const stats = new Map(
    people.map((u) => [
      u.id,
      { user: u, count: 0, implemented: 0, completed: 0 },
    ]),
  );
  for (const p of named)
    for (const id of new Set([p.author, ...(p.coAuthors || [])])) {
      const r = stats.get(id);
      if (!r) continue;
      r.count++;
      if (IMPLEMENTED_STATUSES.includes(p.status)) r.implemented++;
      if (p.status === "Tamamlandı") r.completed++;
    }
  const rows = [...stats.values()];
  const buckets = groups.map((b) => {
    const n = rows.filter((r) => r.count >= b.min && r.count <= b.max).length;
    return {
      key: b.key,
      label: b.label,
      count: n,
      share: rows.length ? Math.round((n / rows.length) * 100) : 0,
    };
  });
  const top = rows
    .filter((r) => r.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.implemented - a.implemented ||
        a.user.name.localeCompare(b.user.name, "tr"),
    )
    .slice(0, n);
  return {
    threshold: t,
    atOrAbove: rows.filter((r) => r.count >= t).length,
    people: rows.length,
    contributors: rows.filter((r) => r.count > 0).length,
    anonymous: inPeriod.filter((p) => p.anonymous).length,
    buckets,
    top,
  };
}
