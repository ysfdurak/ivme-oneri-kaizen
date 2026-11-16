// Büyük ve çeşitli İvme test verisi (yalnızca yerel deneme için).
// Süreç komutlarıyla (applyCommand) gerçekçi geçmiş oluşturur: 49 kullanıcı, 6 müdürlük, 9 operasyon, 300 öneri,
// her durumda kayıt, yorumlar, retler, geciken aksiyonlar, aynı isimli kişiler ve işleri üzerinde kalmış pasif bir kullanıcı.
// Çalıştırma: bkz. scripts/test-verisi/README.md
import { applyCommand } from "../../lib/workflow";
import {
  STAGES,
  REJECT_REASONS,
  NOT_IMPLEMENTED_REASONS,
} from "../../lib/model";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_REWARD_SETTINGS } from "../../lib/rewards";
import { VERI_EN, FIRST_EN, LAST_EN, LISTS_EN, SCORING_EN, REWARD_LABELS_EN } from "./veri-en";
import { DEFAULT_LISTS } from "../../lib/definitions";
// IVME_DIL=en: İngilizce canlı demo verisi (lib/vitrin/en). Veri metinleri İngilizce, sistem kodları Türkçe kalır.
const EN = process.env.IVME_DIL === "en";
const L = (x: string) => (EN ? (VERI_EN[x] ?? x) : x);
let seed = 42;
const rnd = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const DIRS: Record<string, string[]> = {
  [L("Lojistik Müdürlüğü")]: [
    L("Depo Operasyonları"),
    L("Taşıma ve Dağıtım"),
    L("Lojistik Planlama"),
  ],
  [L("Üretim Müdürlüğü")]: [L("Montaj"), L("Kalite Kontrol"), L("Bakım Onarım")],
  [L("Satın Alma ve Tedarik Zinciri Müdürlüğü")]: [
    L("Satın Alma"),
    L("Tedarikçi Geliştirme"),
  ],
  [L("Bilgi Teknolojileri Müdürlüğü")]: [L("Bilgi Teknolojileri")],
  [L("Teknik İşler Müdürlüğü")]: [L("Teknik İşler")],
  [L("Süreç Geliştirme Müdürlüğü")]: [L("Süreç Geliştirme")],
  [L("İnsan Kaynakları Müdürlüğü")]: [L("İnsan Kaynakları")],
};
const firstTr = [
  "Ahmet",
  "Ayşe",
  "Mehmet",
  "Fatma",
  "Mustafa",
  "Zeynep",
  "Ali",
  "Elif",
  "Hüseyin",
  "Emine",
  "Hasan",
  "Merve",
  "İbrahim",
  "Büşra",
  "Osman",
  "Gülşen",
  "Kemal",
  "Şeyma",
  "Murat",
  "Özge",
  "Çağrı",
  "Ümran",
  "Ercan",
  "Tuğba",
  "Serkan",
  "Ebru",
  "Yasin",
  "Sibel",
  "Oğuz",
  "Derya",
];
const lastTr = [
  "Yılmaz",
  "Kaya",
  "Demir",
  "Şahin",
  "Çelik",
  "Yıldız",
  "Yıldırım",
  "Öztürk",
  "Aydın",
  "Özdemir",
  "Arslan",
  "Doğan",
  "Kılıç",
  "Aslan",
  "Çetin",
  "Kara",
  "Koç",
  "Kurt",
  "Özkan",
  "Şimşek",
];
const first = EN ? FIRST_EN : firstTr;
const last = EN ? LAST_EN : lastTr;
type U = any;
const users: U[] = [];
let n = 0;
const mk = (
  role: string,
  dir: string,
  dept: string,
  manager = "",
  id?: string,
) => {
  const name = pick(first) + " " + pick(last);
  const u = {
    id: id || "u" + ++n,
    username: id || "k" + n,
    name,
    department: dept,
    directorate: dir,
    role,
    manager,
    active: 1,
  };
  users.push(u);
  return u;
};
const admin = mk(
  "admin",
  L("Süreç Geliştirme Müdürlüğü"),
  L("Süreç Geliştirme"),
  "",
  "admin",
);
// Herkese açık demoda yönetici gerçek bir kişi adı taşımaz.
admin.name = EN ? "Alex Morgan" : process.env.IVME_CIKTI ? "Deniz Aktaş" : "Yusuf Durak";
const managers: Record<string, U> = {};
for (const dir of Object.keys(DIRS))
  managers[dir] = mk("manager", dir, DIRS[dir][0] + L(" Yönetimi"));
admin.manager = managers[L("Süreç Geliştirme Müdürlüğü")].id;
const OPS: Record<string, string> = {
  [L("Mal Kabul")]: L("Lojistik Müdürlüğü"),
  [L("Depolama")]: L("Lojistik Müdürlüğü"),
  [L("Toplama")]: L("Lojistik Müdürlüğü"),
  [L("Sevkiyat")]: L("Lojistik Müdürlüğü"),
  [L("Nakliye")]: L("Lojistik Müdürlüğü"),
  [L("Montaj Hattı")]: L("Üretim Müdürlüğü"),
  [L("Kalite Kontrol")]: L("Üretim Müdürlüğü"),
  [L("Bakım")]: L("Üretim Müdürlüğü"),
  [L("Satın Alma")]: L("Satın Alma ve Tedarik Zinciri Müdürlüğü"),
};
const byRole: Record<string, U[]> = {};
const add = (r: string, u: U) => ((byRole[r] ||= []).push(u), u);
// değerlendiriciler: her müdürlükte ön değerlendirici, operasyon sorumluları, kazanç ve puanlama
for (const dir of [
  L("Lojistik Müdürlüğü"),
  L("Üretim Müdürlüğü"),
  L("Satın Alma ve Tedarik Zinciri Müdürlüğü"),
]) {
  add(
    "pre:" + dir,
    mk("pre", dir, DIRS[dir][DIRS[dir].length - 1], managers[dir].id),
  );
  for (let i = 0; i < 3; i++)
    add(
      "operation:" + dir,
      mk("operation", dir, pick(DIRS[dir]), managers[dir].id),
    );
}
const gain = add(
  "gain",
  mk(
    "gain",
    L("Süreç Geliştirme Müdürlüğü"),
    L("Süreç Geliştirme"),
    managers[L("Süreç Geliştirme Müdürlüğü")].id,
  ),
);
const score = add(
  "score",
  mk(
    "score",
    L("Süreç Geliştirme Müdürlüğü"),
    L("Süreç Geliştirme"),
    managers[L("Süreç Geliştirme Müdürlüğü")].id,
  ),
);
mk(
  "support",
  L("Bilgi Teknolojileri Müdürlüğü"),
  L("Bilgi Teknolojileri"),
  managers[L("Bilgi Teknolojileri Müdürlüğü")].id,
  "it",
);
mk(
  "support",
  L("Teknik İşler Müdürlüğü"),
  L("Teknik İşler"),
  managers[L("Teknik İşler Müdürlüğü")].id,
  "teknik",
);
// Ödül sorumlusu (İK): puanlanan önerilerin ödül kararını verir.
mk(
  "reward",
  L("İnsan Kaynakları Müdürlüğü"),
  L("İnsan Kaynakları"),
  managers[L("İnsan Kaynakları Müdürlüğü")].id,
  "ik",
);
const employees: U[] = [];
for (let i = 0; i < 26; i++) {
  const dir = pick([
    L("Lojistik Müdürlüğü"),
    L("Lojistik Müdürlüğü"),
    L("Üretim Müdürlüğü"),
    L("Üretim Müdürlüğü"),
    L("Satın Alma ve Tedarik Zinciri Müdürlüğü"),
  ]);
  employees.push(mk("employee", dir, pick(DIRS[dir]), managers[dir].id));
}
employees[0].id = "calisan";
employees[0].username = "calisan";
// kullanıcı adları sabit: admin, calisan, on.lojistik, op.lojistik1, mudur.lojistik
byRole["pre:" + L("Lojistik Müdürlüğü")][0].username = "on.lojistik";
byRole["operation:" + L("Lojistik Müdürlüğü")][0].username = "op.lojistik";
managers[L("Lojistik Müdürlüğü")].username = "mudur.lojistik";
managers[L("Üretim Müdürlüğü")].username = "mudur.uretim";
// Direktör ve genel müdür: unvan birimi "directorate" alanında tutulur.
const director = mk(
  "director",
  L("Operasyon Direktörlüğü"),
  L("Operasyon Direktörlüğü"),
  "",
  "direktor",
);
const gmUser = mk("gm", L("Genel Müdürlük"), L("Genel Müdürlük"), "", "genelmudur");
managers[L("Lojistik Müdürlüğü")].manager = director.id;
managers[L("Üretim Müdürlüğü")].manager = director.id;
director.manager = gmUser.id;

const matrix = Object.entries(OPS).map(([operation, dir]) => ({
  operation,
  pre: byRole["pre:" + dir][0].id,
  operationOwner: pick(byRole["operation:" + dir]).id,
  gain: gain.id,
  score: score.id,
  directorate: dir,
}));
const s: any = {
  operations: Object.keys(OPS),
  matrix,
  audit: [],
  proposals: [],
  units: ["IT", L("Teknik İşler"), L("Saha Operasyonu"), L("Satın Alma")],
  settings: {
    disabledReports: [],
    // Ödül kuralları örnek değerlerle açık: puanlanan önerilerde İK'ya ödül kaydı düşer.
    rewards: {
      ...DEFAULT_REWARD_SETTINGS,
      enabled: true,
      rules: DEFAULT_REWARD_SETTINGS.rules.map((r) => ({ ...r, label: EN ? REWARD_LABELS_EN[r.label] || r.label : r.label })),
    },
    // İngilizce demoda listeler ve puan kriterleri İngilizce adlarla kaydedilir (kilitli maddeler Türkçe kod).
    ...(EN
      ? {
          lists: Object.fromEntries(
            Object.entries(LISTS_EN).map(([key, names]) => [
              key,
              names.map((name, i) => {
                const base = (DEFAULT_LISTS as any)[key][i];
                return { ...(base || {}), id: base?.id || "m" + i, name, active: true };
              }),
            ]),
          ),
          scoring: SCORING_EN,
        }
      : {}),
    locations: [
      L("A blok raf 12-18"),
      L("Hat 2"),
      L("Kalite giriş masası"),
      L("Rampa 3"),
      L("Sevkiyat sahası"),
      L("Şarj alanı"),
    ],
    // Hiyerarşi: Departman → Müdürlük → Direktörlük → Genel Müdürlük (üst iki seviye açık).
    org: {
      departments: Object.entries(DIRS).flatMap(([dir, depts]) =>
        [...depts, depts[0] + L(" Yönetimi")].map((name) => ({
          name,
          directorate: dir,
        })),
      ),
      directorates: Object.keys(DIRS).map((name) => ({
        name,
        division: [L("Lojistik Müdürlüğü"), L("Üretim Müdürlüğü")].includes(name)
          ? L("Operasyon Direktörlüğü")
          : L("Destek Hizmetleri Direktörlüğü"),
      })),
      divisions: [
        { name: L("Operasyon Direktörlüğü"), group: L("Genel Müdürlük") },
        { name: L("Destek Hizmetleri Direktörlüğü"), group: L("Genel Müdürlük") },
      ],
      groups: [L("Genel Müdürlük")],
      levels: { division: true, group: true },
    },
  },
};
const get = (id: string) => users.find((u) => u.id === id);
const call = (b: any, u: U) => applyCommand(s, b, u, users);
const TITLES: Record<string, string[]> = {
  [L("Mal Kabul")]: [
    L("Randevu saatlerinin araç tipine göre ayrılması"),
    L("Irsaliye kontrolünün el terminaline taşınması"),
    L("Hasarlı koli fotoğrafının kabulde zorunlu olması"),
    L("Rampa önünde palet birikmesinin önlenmesi"),
  ],
  [L("Depolama")]: [
    L("Raf adres etiketlerinin büyütülmesi"),
    L("Hızlı dönen ürünlerin bel hizasına alınması"),
    L("Boş lokasyonların günlük raporlanması"),
    L("Yangın koridorlarının zemin işaretlemesi"),
  ],
  [L("Toplama")]: [
    L("Toplama rotasının dalga bazlı planlanması"),
    L("Sesli toplama pilotu"),
    L("Eksik toplama için anlık uyarı"),
    L("Toplama arabalarına bölmeli kasa"),
  ],
  [L("Sevkiyat")]: [
    L("Sevkiyat etiketlerinde çift kontrol"),
    L("Yükleme sırasının rota sırasına göre yapılması"),
    L("Streç tüketiminin standartlaştırılması"),
    L("Araç doluluk oranının artırılması"),
  ],
  [L("Nakliye")]: [
    L("Boş dönüşlerin planlanması"),
    L("Sürücü teslim belgelerinin dijitalleşmesi"),
    L("Yakıt tüketiminin rota bazında izlenmesi"),
  ],
  [L("Montaj Hattı")]: [
    L("Vida sıkma torkunun hat başında doğrulanması"),
    L("Hat dengesizliğinin istasyon yeniden dağılımıyla giderilmesi"),
    L("Malzeme besleme sıklığının kanbanla yönetilmesi"),
    L("Operatör değişiminde standart iş kartı"),
  ],
  [L("Kalite Kontrol")]: [
    L("Giriş kalitede numune sayısının risk bazlı belirlenmesi"),
    L("Hata kodlarının tek listede toplanması"),
    L("Ölçüm cihazı kalibrasyon hatırlatması"),
  ],
  [L("Bakım")]: [
    L("Kompresör kaçaklarının haftalık taranması"),
    L("Otonom bakım kontrol listesi"),
    L("Yedek parça minimum stok takibi"),
    L("Forklift şarj alanında görsel yönlendirme"),
  ],
  [L("Satın Alma")]: [
    L("Tedarikçi teslim performansının aylık paylaşılması"),
    L("Ambalaj malzemesinde tek tedarikçi riskinin azaltılması"),
    L("Sipariş onay adımlarının sadeleştirilmesi"),
  ],
};
const PROBS = [
  L("Vardiya başında aynı iş iki kez yapılıyor ve yaklaşık 20 dakika kayboluyor."),
  L("Elle yapılan kontrol nedeniyle ayda ortalama 6-8 hata müşteriye ulaşıyor."),
  L("Operatörler malzeme bulmak için hat dışına çıkıyor, hat duruyor."),
  L("Bilgi kâğıt üzerinde tutulduğu için geçmişe dönük analiz yapılamıyor."),
  L("Ergonomik olmayan duruş nedeniyle şikâyetler artıyor."),
];
const SOLS = [
  L("Basit bir görsel işaretleme ve standart iş kartı ile adımların netleştirilmesi."),
  L("El terminaline okutma adımı eklenerek kontrolün sistemden yapılması."),
  L("Malzemenin kullanım noktasına yakın konumlandırılması ve kanban kartı."),
  L("Excel yerine ortak ekranda takip ve haftalık gözden geçirme toplantısı."),
];
// hedef durum dağılımı. IVME_OLCEK=0.4 gibi bir değerle daha küçük veri üretilir (canlı demo için).
const SCALE = Number(process.env.IVME_OLCEK || 1);
const fill = (n: number, v: string) =>
  Array(Math.max(1, Math.round(n * SCALE))).fill(v);
const targets = [
  ...fill(28, STAGES[0]),
  ...fill(30, STAGES[1]),
  ...fill(22, STAGES[2]),
  ...fill(55, STAGES[3]),
  ...fill(16, STAGES[4]),
  ...fill(12, STAGES[5]),
  ...fill(10, STAGES[6]),
  ...fill(70, STAGES[7]),
  ...fill(12, "Revizyon bekliyor"),
  ...fill(5, "Kazanç düzeltmesi bekliyor"),
  ...fill(32, "Reddedildi"),
  ...fill(8, "İptal edildi"),
];
const smallPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
targets.sort(() => rnd() - 0.5);
for (const target of targets) {
  const op = pick(Object.keys(OPS));
  const author =
    rnd() < 0.15 ? pick(Object.values(byRole).flat()) : pick(employees);
  const long = rnd() < 0.04;
  const id = call(
    {
      action: "create",
      title: long
        ? L("Sevkiyat alanında yükleme öncesi palet etiketlerinin, sipariş numarası ve müşteri bilgisiyle el terminalinden çift kontrol edilerek yanlış araç yüklemesinin tamamen önlenmesi")
        : pick(TITLES[op]),
      problem: pick(PROBS) + (long ? " " + PROBS.join(" ") : ""),
      solution: pick(SOLS),
      operation: op,
      category: pick([
        L("Verimlilik"),
        L("Kalite"),
        L("Maliyet"),
        L("İş güvenliği"),
        L("Ergonomi"),
        L("Çevre"),
      ]),
      attachments:
        rnd() < 0.2 ? [{ name: L("saha-fotografi.png"), data: smallPng }] : [],
      location:
        rnd() < 0.6
          ? pick([
              L("Rampa 3"),
              L("A blok raf 12-18"),
              L("Hat 2"),
              L("Kalite giriş masası"),
              L("Şarj alanı"),
              L("Sevkiyat sahası"),
            ])
          : "",
      expectedBenefit:
        rnd() < 0.5
          ? pick([
              L("Vardiya başına ~15 dk kazanç"),
              L("Ayda 5-6 hata önlenir"),
              L("Forklift trafiğinde güvenlik artar"),
            ])
          : "",
      coAuthors:
        rnd() < 0.15
          ? [pick(employees.filter((e) => e.id !== author.id)).id]
          : [],
    },
    author,
  )!;
  const p = s.proposals.find((x: any) => x.id === id);
  const as = (uid: string) => get(uid)!;
  try {
    if (target === STAGES[0]) continue;
    if (target === "Revizyon bekliyor") {
      call(
        {
          action: "revision",
          id,
          reason: pick([
            L("Fotoğraf ekleyin."),
            L("Hangi vardiyada olduğunu yazın."),
            L("Tahmini faydayı belirtin."),
          ]),
        },
        as(p.owner),
      );
      continue;
    }
    if (target === "Reddedildi" && rnd() < 0.5) {
      call(
        {
          action: "reject",
          id,
          reason: L("Ön değerlendirmede uygun bulunmadı."),
          reasonCode: pick(EN ? LISTS_EN.rejectReasons : REJECT_REASONS),
        },
        as(p.owner),
      );
      continue;
    }
    call(
      {
        action: "accept",
        id,
        note: rnd() < 0.3 ? L("Saha ziyareti yapıldı, öneri yerinde.") : undefined,
      },
      as(p.owner),
    );
    if (target === STAGES[1]) continue;
    if (target === "Reddedildi") {
      call(
        {
          action: "reject",
          id,
          reason: L("Operasyon değerlendirmesinde uygun bulunmadı."),
          reasonCode: rnd() < 0.15 ? undefined : pick(EN ? LISTS_EN.rejectReasons : REJECT_REASONS),
        },
        as(p.owner),
      );
      continue;
    }
    if (rnd() < 0.3)
      call(
        {
          action: "comment",
          id,
          text: L("Bu öneri için hangi vardiyada ölçüm yapıldı?"),
        },
        as(p.owner),
      );
    if (rnd() < 0.2)
      call(
        {
          action: "comment",
          id,
          text: L("Sabah vardiyasında, 3 gün boyunca ölçtük."),
        },
        as(p.author),
      );
    call({ action: "accept", id }, as(p.owner));
    if (target === STAGES[2]) {
      if (rnd() < 0.4)
        call(
          {
            action: "addAction",
            id,
            title: L("Mevcut durumu ölç"),
            owner: p.owner,
            due: "2026-11-20",
          },
          as(p.owner),
        );
      continue;
    }
    const nAct = int(1, 4);
    const actionOwners = [
      ...byRole["operation:" + OPS[op]],
      ...employees.filter((e) => e.directorate === OPS[op]),
    ];
    for (let i = 0; i < nAct; i++)
      call(
        {
          action: "addAction",
          id,
          title: pick([
            L("Pilot uygulama"),
            L("Görsel işaretleme"),
            L("Standart iş kartı hazırla"),
            L("Ekip eğitimi"),
            L("Sonuç ölçümü"),
            L("Tedarikçi ile görüşme"),
          ]),
          owner: pick(actionOwners).id,
          due:
            "2026-" +
            String(int(8, 12)).padStart(2, "0") +
            "-" +
            String(int(1, 28)).padStart(2, "0"),
        },
        as(p.owner),
      );
    call({ action: "start", id }, as(p.owner));
    if (target === "İptal edildi") {
      call({ action: "cancel", id, reason: L("Proje kapsamı değişti.") }, admin);
      continue;
    }
    if (target === STAGES[3]) {
      for (const a of p.actions)
        if (rnd() < 0.5)
          call(
            {
              action: "actionUpdate",
              id,
              itemId: a.id,
              status: pick(["Devam ediyor", "Tamamlandı"]),
            },
            as(p.owner),
          );
      if (rnd() < 0.35) {
        const unit = pick(["IT", L("Teknik İşler"), L("Satın Alma")]);
        call({ action: "supportFlag", id, unit, selected: true }, as(p.owner));
        const item: any = p.support.find(
          (x: any) => x.unit === unit && x.status === "Bekliyor",
        );
        if (item) {
          // Bekleme başlangıcı geçmişe çekilir; bir kısmına destek biriminin talep numarası yazılır.
          item.since = new Date(
            Date.now() - Math.floor(rnd() * 25 + 1) * 86400000,
          ).toISOString();
          if (rnd() < 0.6)
            call(
              {
                action: "supportTicket",
                id,
                itemId: item.id,
                ticket:
                  (unit === "IT"
                    ? "INC-"
                    : unit === L("Teknik İşler")
                      ? (EN ? "WO-2026-" : "İE-2026-")
                      : "SAT-") + Math.floor(rnd() * 90000 + 10000),
              },
              as(p.owner),
            );
        }
      }
      continue;
    }
    // Örnek: uygulama aşamasında bir kısmı bir nedenle hayata geçemez ("Uygulanamadı" ile kapanır, kazanca gitmez).
    if (rnd() < 0.08) {
      if (p.actions[0])
        call(
          {
            action: "actionUpdate",
            id,
            itemId: p.actions[0].id,
            status: "Yapılamadı",
            reason: L("Tedarikçi malzemeyi sağlayamadı"),
          },
          as(p.owner),
        );
      call(
        {
          action: "finish",
          id,
          outcome: "notImplemented",
          reasonCode: pick((EN ? LISTS_EN.notImplementedReasons : NOT_IMPLEMENTED_REASONS).slice(0, 6)),
          reason: pick([
            L("Yatırım bütçesi gelecek yıla kaldı."),
            L("Saha denemesinde beklenen sonuç alınamadı."),
            L("Hat yerleşimi değiştiği için öneri geçersiz kaldı."),
          ]),
        },
        as(p.owner),
      );
      continue;
    }
    for (const a of p.actions)
      call(
        { action: "actionUpdate", id, itemId: a.id, status: "Tamamlandı" },
        as(p.owner),
      );
    call({ action: "finish", id, outcome: "implemented" }, as(p.owner));
    if (target === STAGES[4]) continue;
    const money = rnd() < 0.7;
    call(
      {
        action: "gain",
        id,
        amount: money ? int(2, 120) * 1000 : 0,
        cost: int(0, 20) * 500,
        period: pick(["Tek seferlik", "Aylık", "Yıllık", "Yıllık"]),
        type: money
          ? "Parasal"
          : pick([L("Zaman"), L("Kalite"), L("İş güvenliği"), L("Ergonomi")]),
        before: L("Önce 20 dk"),
        after: L("Sonra 8 dk"),
        explanation:
          L("Vardiya başına 12 dakika × 3 vardiya × 250 gün üzerinden hesaplandı."),
      },
      as(p.owner),
    );
    if (target === STAGES[5]) continue;
    if (target === "Kazanç düzeltmesi bekliyor") {
      call(
        { action: "gainReturn", id, reason: L("Hesaplama varsayımı eksik.") },
        as(p.owner),
      );
      continue;
    }
    call({ action: "gainApprove", id }, as(p.owner));
    if (target === STAGES[6]) continue;
    call(
      { action: "score", id, values: [int(2, 5), int(2, 5), int(1, 5)] },
      as(p.owner),
    );
  } catch (e: any) {
    console.error("hata", target, id, e.message);
  }
}
// Zaman çizelgesi: her öneriye son 200 gün içinde gerçekçi tarihler ver.
const DAY = 86400000,
  now = Date.now();
const dur: Record<string, [number, number]> = {
  [STAGES[0]]: [0.2, 9],
  [STAGES[1]]: [0.5, 14],
  [STAGES[2]]: [1, 12],
  [STAGES[3]]: [3, 70],
  [STAGES[4]]: [0.5, 15],
  [STAGES[5]]: [0.3, 8],
  [STAGES[6]]: [0.3, 8],
  "Revizyon bekliyor": [1, 20],
  "Kazanç düzeltmesi bekliyor": [1, 10],
};
for (const p of s.proposals) {
  const log = p.stageLog || [];
  const spans = log.map((l: any) => {
    const [a, b] = dur[l.stage] || [1, 5];
    return (a + rnd() ** 2 * (b - a)) * DAY;
  });
  const closed = ["Tamamlandı", "Reddedildi", "İptal edildi"].includes(
    p.status,
  );
  const [a, b] = dur[p.status] || [0, 0];
  const current = closed
    ? int(1, 60) * DAY
    : (a + rnd() ** 1.6 * (b - a) * (rnd() < 0.1 ? 3 : 1)) * DAY;
  const total = spans.reduce((x: number, y: number) => x + y, 0) + current;
  let t = now - total - rnd() * DAY;
  p.created = new Date(t).toISOString();
  const times = [t];
  log.forEach((l: any, i: number) => {
    l.from = new Date(t).toISOString();
    t += spans[i];
    l.to = new Date(t).toISOString();
    times.push(t);
  });
  p.stageAt = new Date(t).toISOString();
  // geçmiş: en yeni başta; zamanları aralığa yay
  const h = p.history.slice().reverse();
  h.forEach(
    (x: any, i: number) =>
      (x.at = new Date(
        times[
          Math.min(
            times.length - 1,
            Math.round((i / Math.max(1, h.length - 1)) * (times.length - 1)),
          )
        ],
      ).toISOString()),
  );
  (p.comments || []).forEach(
    (c: any) => (c.at = new Date(Math.min(now, t + DAY)).toISOString()),
  );
  if (p.gain?.approvedAt) p.gain.approvedAt = p.stageAt;
}
// bir kullanıcı ayrıldı: açık işleri üzerinde kalmış (uç durum)
const leaver = byRole["operation:" + L("Üretim Müdürlüğü")][0];
leaver.active = 0;
s.proposals.sort((a: any, b: any) => b.created.localeCompare(a.created));
// Ödül örnekleri: bir kısmı İK tarafından onaylanmış, bir kısmı ödenmiş.
(s.rewards || []).forEach((r: any, i: number) => {
  if (i % 3 === 0) return;
  const ik = users.find((u: any) => u.id === "ik")!;
  call({ action: "rewardDecide", rewardId: r.id, decision: "approve" }, ik);
  if (i % 3 === 2)
    call(
      {
        action: "rewardPaid",
        rewardId: r.id,
        period: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 7),
      },
      ik,
    );
});
// Kampanya ve anonim öneri örnekleri: son 45 günde verilen iş güvenliği önerileri kampanyaya bağlanır,
// ortak önereni olmayan önerilerin bir kısmı anonimdir.
const t0 = Date.now();
const d = (days: number) =>
  new Date(t0 + days * 86400000).toISOString().slice(0, 10);
s.settings = {
  ...(s.settings || {}),
  // İngilizce demo şirketi dolar kullanır; Türkçe kurulumda varsayılan Türk lirası (alan yok = ₺).
  ...(EN ? { currency: "$" } : {}),
  campaigns: [
    {
      id: "k-isg-ayi",
      title: L("İş güvenliği ayı"),
      description: L("Ramak kala ve ergonomi riskleri"),
      start: d(-45),
      end: d(10),
      category: L("İş güvenliği"),
      reward: L("En yüksek puanlı 3 öneri ay sonu toplantısında ödüllendirilir"),
    },
    {
      id: "k-ambalaj",
      title: L("Ambalaj israfı"),
      start: d(15),
      end: d(45),
      category: L("Maliyet"),
    },
  ],
};
for (const p of s.proposals) {
  if (
    p.category === L("İş güvenliği") &&
    p.created >= new Date(t0 - 45 * 86400000).toISOString()
  )
    p.campaign = "k-isg-ayi";
  if (!(p.coAuthors || []).length && rnd() < 0.08) p.anonymous = true;
}
// IVME_CIKTI verilirse (ör. lib/vitrin) dosyalar oraya yazılır; canlı demo verisi böyle üretilir.
const out = process.env.IVME_CIKTI
  ? pathToFileURL(resolve(process.env.IVME_CIKTI) + "/")
  : new URL("./", import.meta.url);
writeFileSync(
  new URL("state.json", out),
  JSON.stringify({ ...s, _builtAt: new Date().toISOString() }),
);
writeFileSync(new URL("users.json", out), JSON.stringify(users));
const count = (f: (p: any) => boolean) => s.proposals.filter(f).length;
console.log(
  "öneri",
  s.proposals.length,
  "kullanıcı",
  users.length,
  "boyut KB",
  Math.round(JSON.stringify(s).length / 1024),
);
console.log(
  "durumlar",
  Object.entries(
    s.proposals.reduce(
      (m: any, p: any) => ((m[p.status] = (m[p.status] || 0) + 1), m),
      {},
    ),
  ),
);
console.log(
  "ayrılan kullanıcıdaki açık öneri",
  count(
    (p) =>
      p.owner === leaver.id &&
      !["Tamamlandı", "Reddedildi", "İptal edildi"].includes(p.status),
  ),
);
