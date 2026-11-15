import { intlLocale } from "./i18n";
export const STAGES = [
  "Ön değerlendirme",
  "Bölüm değerlendirmesi",
  "Aksiyon planlama",
  "Uygulamada",
  "Kazanç girişi",
  "Kazanç onayı",
  "Puanlama",
  "Tamamlandı",
];
/** Öneri iyileştirme alanları. */
export const CATEGORY_LIST = [
  "Verimlilik",
  "Kalite",
  "Maliyet",
  "İş güvenliği",
  "Ergonomi",
  "Çevre",
];
/** Aksiyon aşamasında bir nedenle hayata geçirilemeyen önerinin kapanış durumu (kazanç adımına gitmez). */
export const NOT_IMPLEMENTED = "Uygulanamadı";
export const CLOSED = [
  "Tamamlandı",
  "Reddedildi",
  "İptal edildi",
  NOT_IMPLEMENTED,
];
/** Sonuçsuz kapanan durumlar (kazanç ve ödül hesaplarına girmez). */
export const CLOSED_UNSUCCESSFUL = [
  "Reddedildi",
  "İptal edildi",
  NOT_IMPLEMENTED,
];
/** Uygulanamama nedenleri (raporlama için standart liste). */
export const NOT_IMPLEMENTED_REASONS = [
  "Bütçe / yatırım onayı alınamadı",
  "Teknik olarak uygulanamadı",
  "Malzeme / tedarik sağlanamadı",
  "Süreç ya da organizasyon değişti",
  "Mevzuat / iş güvenliği engeli",
  "Maliyeti faydasından yüksek çıktı",
  "Diğer",
];
export const ROLES: any = {
  admin: "Sistem yöneticisi",
  employee: "Çalışan",
  pre: "Ön değerlendirici",
  operation: "Bölüm sorumlusu",
  gain: "Kazanç sorumlusu",
  manager: "Müdür",
  director: "Direktör",
  gm: "Genel müdür",
  score: "Puanlama sorumlusu",
  support: "Destek sorumlusu",
  reward: "Ödül sorumlusu (İK)",
};
export type User = {
  id: string;
  username: string;
  name: string;
  department: string;
  directorate: string;
  role: string;
  manager: string;
  mustChange?: number;
  active?: number;
  /** Bildirim adresi; boşsa e-posta gönderilmez. Yalnız yönetici ve kişinin kendisi görür. */
  email?: string | null;
  /** instant: anında · digest: günlük özet · off: kapalı */
  notify?: string | null;
};
export type Proposal = {
  id: string;
  title: string;
  problem: string;
  solution: string;
  operation: string;
  category: string;
  author: string;
  department: string;
  directorate: string;
  status: string;
  owner: string;
  created: string;
  stageAt: string;
  due: string;
  evaluator?: string;
  revisionTarget?: string;
  lastActiveStage?: string;
  actions: any[];
  support: any[];
  gain?: any;
  score?: any;
  history: any[];
  attachments: any[];
  /** Soru/not yazışmaları. */
  comments?: { at: string; actor: string; text: string }[];
  /** Mükerrer bağlantıları: bu öneri hangisinin tekrarı / hangi öneriler bunun tekrarı. */
  duplicateOf?: string;
  duplicates?: string[];
  /** Standart ret nedeni (raporlama için). */
  rejectReason?: string;
  /** Tamamlanan aşamaların süreleri: aşama ortalama süresi raporu bundan hesaplanır. */
  stageLog?: { stage: string; from: string; to: string }[];
  /** Öneriyi birlikte verenler (kullanıcı id). */
  coAuthors?: string[];
  /** Lokasyon (Tanımlar'daki listeden) ve önerenin beklediği fayda. */
  location?: string;
  expectedBenefit?: string;
  /** Kaydın en son değiştiği çalışma alanı sürümü (eşzamanlı işlem kontrolü). */
  rev?: number;
  /** Anonim öneri: önerenin adı öneren dışındaki herkesten gizlenir (sunucu yanıtında silinir). */
  anonymous?: boolean;
  /** Katıldığı öneri kampanyası (Tanımlar'daki kampanya kimliği). */
  campaign?: string;
  /** Öneri alt sınıfı (sınıfın alt sınıfı tanımlıysa). */
  subcategory?: string;
  /** Uygulanamadı kapanışının nedeni (NOT_IMPLEMENTED_REASONS) ve açıklaması. */
  notImplemented?: { reason: string; note: string; at: string; by: string };
  /** Eski sistemden toplu aktarımla gelen kayıt: eski numara ve aktarım bilgisi. */
  legacyNo?: string;
  imported?: { at: string; by: string; batch?: string };
};
export type State = {
  proposals: Proposal[];
  matrix: any[];
  units: string[];
  operations: string[];
  audit: any[];
  /** Kurum geneli ayarlar. disabledReports: durum panosunda pasife çekilen raporlar. */
  settings?: {
    disabledReports?: string[];
    orgName?: string;
    /** Öneri lokasyonları (Tanımlar sayfasından yönetilir). */
    locations?: string[];
    /** Benzer öneri aramasında kullanılan eş anlamlı grupları (ör. ["palet", "yük"]). */
    synonyms?: string[][];
    /** E-posta bildirim kuralları: kapatılan olaylar ve gecikme hatırlatmasının müdüre gitme günü. */
    notify?: { disabled?: string[]; escalateAfterDays?: number };
    /** Tanınma ekranı açık mı (varsayılan açık). */
    recognition?: boolean;
    /** Yapay zekâ paketi ayarları (yalnız IVME_EDITION=ai kurulumunda anlamlı). mcp: MCP erişimi açık mı (varsayılan kapalı). */
    ai?: { mcp?: boolean };
    /** Tanımlanabilir listeler, puanlama ve hedef süreler (lib/definitions.ts). */
    lists?: Partial<
      Record<
        import("./definitions").ListKey,
        import("./definitions").ListItem[]
      >
    >;
    scoring?: import("./definitions").Scoring;
    targetDays?: Record<string, number>;
    /** Ödül kuralları (lib/rewards.ts). */
    rewards?: import("./rewards").RewardSettings;
    /** Dönemsel öneri kampanyaları (ör. "Mart: iş güvenliği ayı"). */
    campaigns?: Campaign[];
    /** Organizasyon: departman → müdürlük → (direktörlük) → (genel müdürlük). Üst iki seviye isteğe bağlı açılır. */
    org?: OrgDefinitions;
  };
  /** Devir kayıtları: geri alma için her devrin önceki/sonraki değerleri saklanır. */
  transfers?: Transfer[];
  /** Ödül kayıtları (puanlama sonrası otomatik; İK onaylar ve ödendi işaretler). */
  rewards?: import("./rewards").Reward[];
  /** Toplu öneri aktarımları: geri alma (paket halinde silme) için. */
  importBatches?: ImportBatch[];
};
export type ImportBatch = {
  id: string;
  at: string;
  by: string;
  count: number;
  /** Aktarımla açılan pasif kullanıcılar (geri alınınca, başka kayıtta geçmiyorsa silinir). */
  newUsers: string[];
  undone?: { at: string; by: string; removed: number };
};
export const fmt = (v: number) =>
  new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 }).format(v || 0);
export const money = (v: number) => "₺" + fmt(v);
export const date = (v: string) =>
  v ? new Date(v).toLocaleDateString(intlLocale()) : "—";
export const waiting = (p: Proposal) =>
  CLOSED.includes(p.status)
    ? []
    : Array.from(
        new Set(
          p.support
            .filter(
              (x) =>
                x.blocking &&
                ["Bekliyor", "Devam ediyor", "Atama bekliyor"].includes(
                  x.status,
                ),
            )
            .map((x) => x.unit),
        ),
      );
export const age = (v: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(v).getTime()) / 86400000));

/** Standart ret nedenleri: serbest metin gerekçeye ek olarak seçilir ve raporlanır. */
export const REJECT_REASONS = [
  "Mükerrer öneri",
  "Zaten uygulanıyor",
  "Kapsam dışı",
  "Maliyeti faydasından yüksek",
  "Teknik olarak uygulanamaz",
  "İş güvenliği / mevzuata aykırı",
  "Yeterli bilgi yok",
  "Diğer",
];

/** Aşama hedef süreleri (gün). Pilot varsayılanları; şirket kurallarıyla güncellenecek. */
/** Varsayılan aşama hedef süreleri (gün); kurum Tanımlar'dan değiştirir (lib/definitions.ts applyTargetDays). */
export const DEFAULT_TARGET_DAYS: Record<string, number> = {
  "Ön değerlendirme": 3,
  "Bölüm değerlendirmesi": 5,
  "Aksiyon planlama": 5,
  Uygulamada: 30,
  "Kazanç girişi": 7,
  "Kazanç onayı": 3,
  Puanlama: 3,
  "Revizyon bekliyor": 7,
  "Kazanç düzeltmesi bekliyor": 5,
};
/** Geçerli hedef süreler: varsayılanların kopyası, kurum ayarıyla güncellenir. */
export const STAGE_TARGET_DAYS: Record<string, number> = {
  ...DEFAULT_TARGET_DAYS,
};
/** Açık bir kayıt bulunduğu aşamanın hedef süresini aştıysa kaç gün geciktiğini döner (yoksa 0). */
export const overdueDays = (p: Proposal) => {
  if (CLOSED.includes(p.status)) return 0;
  const target = STAGE_TARGET_DAYS[p.status];
  return target ? Math.max(0, age(p.stageAt) - target) : 0;
};

/** Öneriyi bekleten açık destek işleri (IT, Teknik İşler…): birim, talep no ve kaç gündür beklediği. */
export const supportWaits = (p: Proposal) =>
  CLOSED.includes(p.status)
    ? []
    : (p.support || [])
        .filter(
          (a: any) =>
            a.blocking && !["Tamamlandı", "İptal edildi"].includes(a.status),
        )
        .map((a: any) => ({
          id: a.id as string,
          unit: a.unit as string,
          ticket: (a.ticket || "") as string,
          days: a.since ? age(a.since) : undefined,
        }));
/** "IT bekleniyor · Talep INC-1 · 6 gün" biçiminde kısa metin. */
export const supportWaitText = (w: {
  unit: string;
  ticket: string;
  days?: number;
}) =>
  w.unit +
  " bekleniyor" +
  (w.ticket ? " · Talep " + w.ticket : " · talep no yok") +
  (w.days !== undefined ? " · " + w.days + " gün" : "");

/** Görünürlük hesabı için kullanıcı, bölüm → müdürlük ve organizasyon hiyerarşisi bilgisi. */
export type VisibilityContext = {
  users: { id: string; directorate: string }[];
  matrix: any[];
  org?: OrgDefinitions;
};
const dirOf = (ctx: VisibilityContext | undefined, userId?: string) =>
  userId ? ctx?.users.find((x) => x.id === userId)?.directorate : undefined;
/** Bölümün (operasyonun) bağlı olduğu müdürlük: matriste tanımlıysa o, yoksa bölüm sorumlusunun müdürlüğü. */
export const operationDirectorate = (
  ctx: VisibilityContext | undefined,
  operation: string,
) => {
  const row = ctx?.matrix.find((r: any) => r.operation === operation);
  return row?.directorate || dirOf(ctx, row?.operationOwner);
};
export const MANAGER_ROLES = ["manager", "director", "gm"];
/** Yöneticinin kapsadığı müdürlükler: müdür → kendi müdürlüğü; direktör → direktörlüğüne bağlı müdürlükler;
 * genel müdür → genel müdürlüğe bağlı direktörlüklerin müdürlükleri. Direktör ve genel müdürde unvan birimi
 * kullanıcının "directorate" alanında tutulur. */
export const scopeDirectorates = (
  u: { role: string; directorate: string },
  org?: OrgDefinitions,
): string[] => {
  if (u.role === "manager") return [u.directorate];
  if (!org) return [];
  if (u.role === "director")
    return org.levels.division
      ? org.directorates
          .filter((d) => d.division === u.directorate)
          .map((d) => d.name)
      : [];
  if (u.role === "gm") {
    if (!org.levels.group || !org.levels.division) return [];
    const divisions = org.divisions
      .filter((d) => d.group === u.directorate)
      .map((d) => d.name);
    return org.directorates
      .filter((d) => divisions.includes(d.division))
      .map((d) => d.name);
  }
  return [];
};
/** Yönetici bir öneriyi şu durumlardan biri kendi kapsamındaysa yönetir:
 * önerenin müdürlüğü, bölümün müdürlüğü, önerinin şu an beklediği kişinin veya değerlendiricinin müdürlüğü. */
export const managesProposal = (
  p: Proposal,
  u: { id: string; role: string; directorate: string },
  ctx?: VisibilityContext,
) => {
  if (!MANAGER_ROLES.includes(u.role)) return false;
  const scope = scopeDirectorates(u, ctx?.org);
  return [
    p.directorate,
    operationDirectorate(ctx, p.operation),
    dirOf(ctx, p.owner),
    dirOf(ctx, p.evaluator),
  ].some((d) => !!d && scope.includes(d));
};

/** Kullanıcının bir öneriyi görüp göremeyeceği. Sunucu (state, ek, yorum) aynı kuralı kullanır.
 * Değerlendiriciler, süreçte işlem yaptıkları kayıtları sonraki aşamalarda da görmeye devam eder. */
export const canSee = (
  p: Proposal,
  u: { id: string; role: string; directorate: string },
  ctx?: VisibilityContext,
) =>
  u.role === "admin" ||
  managesProposal(p, u, ctx) ||
  p.author === u.id ||
  (p.coAuthors || []).includes(u.id) ||
  p.owner === u.id ||
  p.evaluator === u.id ||
  p.actions.some((a: any) => a.owner === u.id) ||
  p.support.some((a: any) => a.owner === u.id) ||
  p.history.some((h: any) => h.actor === u.id) ||
  // Ödül sorumlusu (İK) ödül kararı için tamamlanan önerileri görür.
  (u.role === "reward" && p.status === "Tamamlandı");

export type OrgDefinitions = {
  departments: { name: string; directorate: string }[];
  directorates: { name: string; division: string }[];
  divisions: { name: string; group: string }[];
  groups: string[];
  levels: { division: boolean; group: boolean };
};
export type TransferChange = {
  type: "owner" | "action" | "matrix";
  proposalId?: string;
  actionId?: string;
  operation?: string;
  key?: string;
  prev: string;
  next: string;
  /** Bölüm değiştiren yönlendirmede önceki/sonraki bölüm (geri almada bölüm de döner). */
  prevOperation?: string;
  nextOperation?: string;
};
export type Transfer = {
  id: string;
  at: string;
  actor: string;
  kind: "user" | "proposal" | "bulk" | "matrix";
  from?: string;
  to: string;
  reason: string;
  changes: TransferChange[];
  /** Toplu devirde aynı işlemle yapılan devirler aynı batch değerini taşır. */
  batch?: string;
  undone?: { at: string; actor: string; reverted: number; skipped: number };
};

/** Anonim önerilerde istemciye giden kayıtta önerenin yerine geçen değer. */
export const ANON = "anonim";
/** Anonim öneriyi öneren dışındaki bir görüntüleyici için gizler: önerenin kimliği geçen her alan ANON olur.
 * Yetki kontrolleri sunucuda gerçek kayıt üzerinde yapılır; bu yalnızca dışarı giden kopyayı değiştirir. */
export function redactProposal<T extends Proposal>(p: T, viewerId: string): T {
  if (!p.anonymous || p.author === viewerId) return p;
  const a = p.author;
  const r = (id: any) => (id === a ? ANON : id);
  return {
    ...p,
    author: ANON,
    owner: r(p.owner),
    history: (p.history || []).map((h: any) => ({ ...h, actor: r(h.actor) })),
    comments: p.comments?.map((c) => ({ ...c, actor: r(c.actor) })),
    actions: (p.actions || []).map((x: any) => ({ ...x, owner: r(x.owner) })),
    support: (p.support || []).map((x: any) => ({ ...x, owner: r(x.owner) })),
  };
}

export type Campaign = {
  id: string;
  title: string;
  description?: string;
  /** YYYY-AA-GG, iki uç dahil. */
  start: string;
  end: string;
  /** Odak alanı (isteğe bağlı): iyileştirme alanı ve/veya bölüm. */
  category?: string;
  operation?: string;
  /** Ödül / tanınma açıklaması (ör. "En yüksek puanlı 3 öneriye hediye çeki"). */
  reward?: string;
};
/** Bugün (Türkiye saati) açık olan kampanyalar. */
export const activeCampaigns = (
  campaigns: Campaign[] = [],
  today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10),
) => campaigns.filter((c) => c.start <= today && today <= c.end);

/** Kazanç rakamları: ilk yıl brüt kazanç (aylık × 12, yıllık, tek seferlik olduğu gibi), uygulama maliyeti,
 * ilk yıl net kazanç (brüt − maliyet) ve maliyetin kaç ayda geri döndüğü (tekrarlayan kazançlarda). */
export function gainFigures(
  g?: { amount?: number; cost?: number; period?: string } | null,
) {
  const amount = Number(g?.amount) || 0,
    cost = Number(g?.cost) || 0;
  const annual = g?.period === "Aylık" ? amount * 12 : amount;
  const monthly =
    g?.period === "Aylık" ? amount : g?.period === "Yıllık" ? amount / 12 : 0;
  return {
    annual,
    cost,
    net: annual - cost,
    paybackMonths:
      cost > 0 && monthly > 0 ? Math.ceil((cost / monthly) * 10) / 10 : null,
  };
}
