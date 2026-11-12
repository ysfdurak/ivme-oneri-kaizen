// Toplu öneri aktarımı (eski sistemden Excel ile). Saf fonksiyonlar: doğrula → planla → uygula.
//
// Kararlar (12 Kasım 2026):
//  1. Kapanmış ve açık öneriler aktarılır; açık olan bulunduğu aşamada devam eder, sorumlusu atama tablosundan gelir.
//  2. İvme kendi numarasını verir (KZ-…); eski numara "legacyNo" alanında saklanır ve aramada bulunur.
//  3. Sistemde olmayan öneren, pasif kullanıcı olarak oluşturulur (ad ve departman satırdan).
//  4. Aktarımda e-posta gitmez, ödül kaydı oluşmaz.
//  5. Aktarılan kazanç onaylı sayılır; kayıt "imported" etiketi taşır, raporlarda dahil/hariç seçilebilir.
//  6. Puan 100 üzerinden tek sayı olarak alınır (kriter kırılımı yok).
import { STAGES, type Proposal, type State, type User } from "./model";
import { listOf } from "./definitions";

export const IMPORT_STATUSES = [
  ...STAGES,
  "Reddedildi",
  "Uygulanamadı",
  "İptal edildi",
];
export const IMPORT_MAX_ROWS = 2000;
/** D1 satır sınırı 2 MB; çalışma alanı tek satırda tutulduğu için pay bırakılır. */
export const STATE_MAX_BYTES = 1_900_000;

/** Excel başlığı → alan. Başlıklar büyük/küçük harf ve Türkçe karakterden bağımsız eşleşir (istemci çevirir). */
export const IMPORT_COLUMNS: {
  key: string;
  label: string;
  required?: boolean;
  hint: string;
}[] = [
  {
    key: "legacyNo",
    label: "Eski no",
    required: true,
    hint: "Eski sistemdeki öneri numarası; tekrar aktarımı engeller",
  },
  {
    key: "created",
    label: "Öneri tarihi",
    required: true,
    hint: "GG.AA.YYYY ya da YYYY-AA-GG",
  },
  { key: "title", label: "Başlık", required: true, hint: "En az 5 karakter" },
  { key: "problem", label: "Mevcut durum", required: true, hint: "Sorun" },
  { key: "solution", label: "Çözüm önerisi", required: true, hint: "" },
  {
    key: "author",
    label: "Öneren kullanıcı adı",
    required: true,
    hint: "Sistemde yoksa pasif kullanıcı oluşturulur",
  },
  {
    key: "authorName",
    label: "Öneren adı",
    hint: "Yeni (pasif) kullanıcı için zorunlu",
  },
  {
    key: "authorDepartment",
    label: "Öneren departmanı",
    hint: "Yeni (pasif) kullanıcı için zorunlu; Tanımlar'da olmalı",
  },
  {
    key: "coAuthors",
    label: "Birlikte önerenler",
    hint: "Kullanıcı adları, noktalı virgülle",
  },
  {
    key: "operation",
    label: "Bölüm",
    required: true,
    hint: "Tanımlar'daki bölümlerden",
  },
  { key: "category", label: "Öneri sınıfı", hint: "Boşsa ilk sınıf" },
  { key: "subcategory", label: "Alt sınıf", hint: "" },
  { key: "location", label: "Lokasyon", hint: "" },
  {
    key: "status",
    label: "Durum",
    required: true,
    hint: IMPORT_STATUSES.join(", "),
  },
  {
    key: "stageAt",
    label: "Durum tarihi",
    hint: "Kapanış ya da bulunduğu aşamaya giriş tarihi; boşsa öneri tarihi",
  },
  {
    key: "reason",
    label: "Neden",
    hint: "Reddedildi / Uygulanamadı için Tanımlar'daki nedenlerden",
  },
  {
    key: "reasonNote",
    label: "Açıklama",
    hint: "Ret ya da uygulanamama açıklaması",
  },
  { key: "gainType", label: "Kazanç türü", hint: "Parasal, Zaman…" },
  {
    key: "gainAmount",
    label: "Kazanç tutarı",
    hint: "₺; parasal olmayanlarda 0",
  },
  {
    key: "gainPeriod",
    label: "Kazanç dönemi",
    hint: "Tek seferlik, Aylık, Yıllık",
  },
  { key: "gainCost", label: "Uygulama maliyeti", hint: "₺" },
  { key: "gainBefore", label: "Önce", hint: "" },
  { key: "gainAfter", label: "Sonra", hint: "" },
  { key: "score", label: "Puan", hint: "0–100" },
  { key: "anonymous", label: "Anonim", hint: "Evet / Hayır" },
];

/** "12.03.2025", "2025-03-12", "12/03/2025" ya da ISO → ISO (öğlen, saat dilimi kaymasın). */
export function parseDate(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mm) [y, m, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
  else if ((mm = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)))
    [d, m, y] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 9));
  if (
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d ||
    y < 1990 ||
    y > 2100
  )
    return null;
  return dt.toISOString();
}
/** "12.500,50" / "12500.5" / "12 500" → 12500.5 */
export function parseNum(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "")
    .replace(/[₺\s]/g, "")
    .trim();
  if (!s) return null;
  // Türkçe yazım: nokta binlik, virgül ondalık ("48.000", "12.500,50"). "12.5" gibi tek ondalık nokta korunur.
  if (/,\d+$/.test(s) || /^-?\d{1,3}(\.\d{3})+$/.test(s))
    s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const yes = (v: any) =>
  ["evet", "e", "1", "true", "x"].includes(
    String(v ?? "")
      .trim()
      .toLocaleLowerCase("tr"),
  );
const norm = (v: any) => String(v ?? "").trim();

export type PlannedRow = {
  line: number;
  row: Record<string, any>;
  authorKey: string;
  coAuthorKeys: string[];
};
export type NewUser = {
  username: string;
  name: string;
  department: string;
  directorate: string;
};

export function planImport(
  rows: Record<string, any>[],
  state: State,
  users: User[],
) {
  const errors: string[] = [];
  const plan: PlannedRow[] = [];
  const newUsers = new Map<string, NewUser>();
  const byUsername = new Map(
    users.map((u) => [String(u.username || "").toLowerCase(), u]),
  );
  const known = new Set(state.proposals.map((p) => p.legacyNo).filter(Boolean));
  const seen = new Set<string>();
  const names = (k: any) => listOf(state, k).map((x) => x.name);
  const categories = listOf(state, "categories");
  const depts = state.settings?.org?.departments || [];
  if (rows.length > IMPORT_MAX_ROWS)
    errors.push(
      "Tek seferde en fazla " +
        IMPORT_MAX_ROWS +
        " satır aktarılır; dosyayı bölün.",
    );
  rows.slice(0, IMPORT_MAX_ROWS).forEach((r, i) => {
    const line = "Satır " + (i + 2) + ": ";
    const err = (t: string) => errors.push(line + t);
    const before = errors.length;
    const legacyNo = norm(r.legacyNo);
    if (!legacyNo) err("eski no boş");
    else if (known.has(legacyNo))
      err("eski no " + legacyNo + " daha önce aktarılmış");
    else if (seen.has(legacyNo))
      err("eski no " + legacyNo + " dosyada iki kez var");
    const created = parseDate(r.created);
    if (!created) err("öneri tarihi okunamadı (" + norm(r.created) + ")");
    else if (created > new Date().toISOString()) err("öneri tarihi gelecekte");
    if (norm(r.title).length < 5) err("başlık en az 5 karakter olmalı");
    if (norm(r.problem).length < 3) err("mevcut durum boş");
    if (norm(r.solution).length < 3) err("çözüm boş");
    if (!state.operations.includes(norm(r.operation)))
      err("bölüm Tanımlar'da yok (" + norm(r.operation) + ")");
    const status = norm(r.status);
    if (!IMPORT_STATUSES.includes(status))
      err("durum tanınmadı (" + status + ")");
    else if (
      STAGES.slice(0, 7).includes(status) &&
      !state.matrix.some((m) => m.operation === norm(r.operation))
    )
      err(
        "açık öneri için bölümün atama tablosu tanımlı olmalı (" +
          norm(r.operation) +
          ")",
      );
    const stageAt = r.stageAt ? parseDate(r.stageAt) : created;
    if (r.stageAt && !stageAt) err("durum tarihi okunamadı");
    if (created && stageAt && stageAt < created)
      err("durum tarihi öneri tarihinden önce");
    // Öneren: kullanıcı adıyla; yoksa ad + departmanla pasif kullanıcı açılacak.
    const authorKey = norm(r.author).toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(authorKey))
      err("öneren kullanıcı adı geçersiz (" + norm(r.author) + ")");
    else if (!byUsername.has(authorKey) && !newUsers.has(authorKey)) {
      const dept = depts.find(
        (d) =>
          d.name.toLocaleLowerCase("tr") ===
          norm(r.authorDepartment).toLocaleLowerCase("tr"),
      );
      if (!norm(r.authorName))
        err(
          authorKey + " sistemde yok; pasif kullanıcı için öneren adı gerekli",
        );
      else if (!dept)
        err(
          authorKey +
            " sistemde yok; öneren departmanı Tanımlar'da olmalı (" +
            norm(r.authorDepartment) +
            ")",
        );
      else
        newUsers.set(authorKey, {
          username: authorKey,
          name: norm(r.authorName).slice(0, 80),
          department: dept.name,
          directorate: dept.directorate,
        });
    }
    const coAuthorKeys = norm(r.coAuthors)
      .split(/[;,]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    for (const k of coAuthorKeys)
      if (!byUsername.has(k) && !newUsers.has(k))
        err("birlikte öneren " + k + " sistemde yok");
    if (coAuthorKeys.length > 5) err("en fazla 5 birlikte öneren");
    if (yes(r.anonymous) && coAuthorKeys.length)
      err("anonim öneride birlikte öneren olamaz");
    // Sınıf, lokasyon, nedenler (pasif maddeler de kabul: eski kayıtlar).
    const category = norm(r.category) || categories[0]?.name;
    const cat = categories.find((c) => c.name === category);
    if (!cat) err("öneri sınıfı Tanımlar'da yok (" + category + ")");
    if (
      norm(r.subcategory) &&
      !(cat?.subs || []).some((x) => x.name === norm(r.subcategory))
    )
      err("alt sınıf tanımlı değil");
    if (
      norm(r.location) &&
      !(state.settings?.locations || []).includes(norm(r.location))
    )
      err("lokasyon Tanımlar'da yok");
    if (
      status === "Reddedildi" &&
      norm(r.reason) &&
      !names("rejectReasons").includes(norm(r.reason))
    )
      err("ret nedeni Tanımlar'da yok (" + norm(r.reason) + ")");
    if (
      status === "Uygulanamadı" &&
      !names("notImplementedReasons").includes(norm(r.reason))
    )
      err(
        "uygulanamama nedeni Tanımlar'daki listeden olmalı (" +
          norm(r.reason) +
          ")",
      );
    // Kazanç: yalnız kazanç aşamasını geçmiş önerilerde; varsa tür ve dönem listeden.
    const hasGain = [r.gainType, r.gainAmount, r.gainCost].some(
      (x) => norm(x) !== "",
    );
    const gainStages = [STAGES[5], STAGES[6], STAGES[7]];
    if (hasGain) {
      if (!gainStages.includes(status))
        err(
          "kazanç yalnız Kazanç onayı, Puanlama ya da Tamamlandı durumunda girilir",
        );
      if (!names("gainTypes").includes(norm(r.gainType)))
        err("kazanç türü Tanımlar'da yok (" + norm(r.gainType) + ")");
      if (
        !["Tek seferlik", "Aylık", "Yıllık"].includes(
          norm(r.gainPeriod) || "Yıllık",
        )
      )
        err("kazanç dönemi Tek seferlik, Aylık ya da Yıllık olmalı");
      const amount = parseNum(r.gainAmount) ?? 0,
        cost = parseNum(r.gainCost) ?? 0;
      if (amount < 0 || cost < 0) err("kazanç ve maliyet negatif olamaz");
      if (norm(r.gainType) !== "Parasal" && amount > 0)
        err("parasal olmayan kazançta tutar 0 olmalı");
    } else if (gainStages.includes(status))
      err(status + " durumundaki öneride kazanç bilgisi gerekli");
    if (norm(r.score) !== "") {
      const sc = parseNum(r.score);
      if (sc === null || sc < 0 || sc > 100) err("puan 0–100 arası olmalı");
      if (status !== STAGES[7]) err("puan yalnız Tamamlandı durumunda girilir");
    }
    seen.add(legacyNo);
    if (errors.length === before)
      plan.push({ line: i + 2, row: r, authorKey, coAuthorKeys });
  });
  const byStatus: Record<string, number> = {};
  for (const p of plan)
    byStatus[norm(p.row.status)] = (byStatus[norm(p.row.status)] || 0) + 1;
  return {
    errors,
    plan,
    newUsers: [...newUsers.values()],
    summary: {
      rows: rows.length,
      ready: plan.length,
      byStatus,
      withGain: plan.filter((p) => norm(p.row.gainType)).length,
      newUsers: newUsers.size,
    },
  };
}

/** Planı çalışma alanına uygular. ownerFor: açık önerinin aşama sorumlusu (atama tablosu). E-posta ve ödül üretmez. */
export function applyImport(
  state: State,
  plan: PlannedRow[],
  idByUsername: Map<string, string>,
  usersById: Map<string, { department: string; directorate: string }>,
  actor: string,
  now: string,
  ownerFor: (p: Proposal, status: string) => string,
  batch = "",
) {
  let max = state.proposals.reduce(
    (n, p) => Math.max(n, Number(p.id.split("-").at(-1)) || 0),
    0,
  );
  const year = new Date(now).getFullYear();
  const created: Proposal[] = [];
  for (const { row: r, authorKey, coAuthorKeys } of plan) {
    const author = idByUsername.get(authorKey)!;
    const au = usersById.get(author);
    const status = norm(r.status);
    const createdAt = parseDate(r.created)!;
    const stageAt = (r.stageAt && parseDate(r.stageAt)) || createdAt;
    const closed = [
      "Tamamlandı",
      "Reddedildi",
      "Uygulanamadı",
      "İptal edildi",
    ].includes(status);
    const p: any = {
      id: "KZ-" + year + "-" + String(++max).padStart(4, "0"),
      legacyNo: norm(r.legacyNo),
      imported: { at: now, by: actor, ...(batch ? { batch } : {}) },
      title: norm(r.title).slice(0, 200),
      problem: norm(r.problem).slice(0, 6000),
      solution: norm(r.solution).slice(0, 6000),
      operation: norm(r.operation),
      category: norm(r.category) || listOf(state, "categories")[0]?.name,
      ...(norm(r.subcategory) ? { subcategory: norm(r.subcategory) } : {}),
      author,
      department: au?.department || "",
      directorate: au?.directorate || "",
      status,
      owner: "",
      created: createdAt,
      stageAt,
      due: "",
      actions: [],
      support: [],
      history: [],
      attachments: [],
      coAuthors: coAuthorKeys.map((k) => idByUsername.get(k)!).filter(Boolean),
      location: norm(r.location),
      expectedBenefit: "",
      _touched: true,
      ...(yes(r.anonymous) ? { anonymous: true } : {}),
    };
    if (!closed) p.owner = ownerFor(p, status);
    if (status === "Reddedildi") p.rejectReason = norm(r.reason) || undefined;
    if (status === "Uygulanamadı")
      p.notImplemented = {
        reason: norm(r.reason),
        note: norm(r.reasonNote),
        at: stageAt,
        by: actor,
      };
    if (norm(r.gainType)) {
      p.gain = {
        amount: parseNum(r.gainAmount) ?? 0,
        cost: parseNum(r.gainCost) ?? 0,
        period: norm(r.gainPeriod) || "Yıllık",
        type: norm(r.gainType),
        before: norm(r.gainBefore) || "—",
        after: norm(r.gainAfter) || "—",
        explanation: "Eski sistemden aktarıldı (eski no " + p.legacyNo + ").",
        approved: status !== STAGES[5],
        approvedAt: status !== STAGES[5] ? stageAt : undefined,
        valid: true,
        previous: [],
      };
    }
    if (status === STAGES[7] && norm(r.score) !== "")
      p.score = {
        total: Math.round(parseNum(r.score)!),
        valid: true,
        values: [],
        imported: true,
        at: stageAt,
      };
    // Kapanmış kayıtlarda aşama süresi raporlarını bozmamak için tek bir "aktarım" adımı tutulur.
    p.history = [
      {
        at: now,
        actor,
        text:
          "Eski sistemden toplu aktarımla alındı. Eski no: " +
          p.legacyNo +
          " · durum: " +
          status,
      },
      ...(status === "Reddedildi"
        ? [
            {
              at: stageAt,
              actor,
              text:
                "Aktarım ret gerekçesi: " +
                (norm(r.reason) || "—") +
                " · " +
                (norm(r.reasonNote) || "—"),
            },
          ]
        : []),
      ...(status === "Uygulanamadı"
        ? [
            {
              at: stageAt,
              actor,
              text:
                "Aktarım uygulanamama gerekçesi: " +
                norm(r.reason) +
                " · " +
                (norm(r.reasonNote) || "—"),
            },
          ]
        : []),
    ];
    created.push(p);
  }
  state.proposals.unshift(...created.reverse());
  return created.length;
}
