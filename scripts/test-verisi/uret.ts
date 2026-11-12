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
let seed = 42;
const rnd = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const DIRS: Record<string, string[]> = {
  "Lojistik Müdürlüğü": [
    "Depo Operasyonları",
    "Taşıma ve Dağıtım",
    "Lojistik Planlama",
  ],
  "Üretim Müdürlüğü": ["Montaj", "Kalite Kontrol", "Bakım Onarım"],
  "Satın Alma ve Tedarik Zinciri Müdürlüğü": [
    "Satın Alma",
    "Tedarikçi Geliştirme",
  ],
  "Bilgi Teknolojileri Müdürlüğü": ["Bilgi Teknolojileri"],
  "Teknik İşler Müdürlüğü": ["Teknik İşler"],
  "Süreç Geliştirme Müdürlüğü": ["Süreç Geliştirme"],
  "İnsan Kaynakları Müdürlüğü": ["İnsan Kaynakları"],
};
const first = [
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
const last = [
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
  "Süreç Geliştirme Müdürlüğü",
  "Süreç Geliştirme",
  "",
  "admin",
);
// Herkese açık demoda yönetici gerçek bir kişi adı taşımaz.
admin.name = process.env.IVME_CIKTI ? "Deniz Aktaş" : "Yusuf Durak";
const managers: Record<string, U> = {};
for (const dir of Object.keys(DIRS))
  managers[dir] = mk("manager", dir, DIRS[dir][0] + " Yönetimi");
admin.manager = managers["Süreç Geliştirme Müdürlüğü"].id;
const OPS: Record<string, string> = {
  "Mal Kabul": "Lojistik Müdürlüğü",
  Depolama: "Lojistik Müdürlüğü",
  Toplama: "Lojistik Müdürlüğü",
  Sevkiyat: "Lojistik Müdürlüğü",
  Nakliye: "Lojistik Müdürlüğü",
  "Montaj Hattı": "Üretim Müdürlüğü",
  "Kalite Kontrol": "Üretim Müdürlüğü",
  Bakım: "Üretim Müdürlüğü",
  "Satın Alma": "Satın Alma ve Tedarik Zinciri Müdürlüğü",
};
const byRole: Record<string, U[]> = {};
const add = (r: string, u: U) => ((byRole[r] ||= []).push(u), u);
// değerlendiriciler: her müdürlükte ön değerlendirici, operasyon sorumluları, kazanç ve puanlama
for (const dir of [
  "Lojistik Müdürlüğü",
  "Üretim Müdürlüğü",
  "Satın Alma ve Tedarik Zinciri Müdürlüğü",
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
    "Süreç Geliştirme Müdürlüğü",
    "Süreç Geliştirme",
    managers["Süreç Geliştirme Müdürlüğü"].id,
  ),
);
const score = add(
  "score",
  mk(
    "score",
    "Süreç Geliştirme Müdürlüğü",
    "Süreç Geliştirme",
    managers["Süreç Geliştirme Müdürlüğü"].id,
  ),
);
mk(
  "support",
  "Bilgi Teknolojileri Müdürlüğü",
  "Bilgi Teknolojileri",
  managers["Bilgi Teknolojileri Müdürlüğü"].id,
  "it",
);
mk(
  "support",
  "Teknik İşler Müdürlüğü",
  "Teknik İşler",
  managers["Teknik İşler Müdürlüğü"].id,
  "teknik",
);
// Ödül sorumlusu (İK): puanlanan önerilerin ödül kararını verir.
mk(
  "reward",
  "İnsan Kaynakları Müdürlüğü",
  "İnsan Kaynakları",
  managers["İnsan Kaynakları Müdürlüğü"].id,
  "ik",
);
const employees: U[] = [];
for (let i = 0; i < 26; i++) {
  const dir = pick([
    "Lojistik Müdürlüğü",
    "Lojistik Müdürlüğü",
    "Üretim Müdürlüğü",
    "Üretim Müdürlüğü",
    "Satın Alma ve Tedarik Zinciri Müdürlüğü",
  ]);
  employees.push(mk("employee", dir, pick(DIRS[dir]), managers[dir].id));
}
employees[0].id = "calisan";
employees[0].username = "calisan";
// kullanıcı adları sabit: admin, calisan, on.lojistik, op.lojistik1, mudur.lojistik
byRole["pre:Lojistik Müdürlüğü"][0].username = "on.lojistik";
byRole["operation:Lojistik Müdürlüğü"][0].username = "op.lojistik";
managers["Lojistik Müdürlüğü"].username = "mudur.lojistik";
managers["Üretim Müdürlüğü"].username = "mudur.uretim";
// Direktör ve genel müdür: unvan birimi "directorate" alanında tutulur.
const director = mk(
  "director",
  "Operasyon Direktörlüğü",
  "Operasyon Direktörlüğü",
  "",
  "direktor",
);
const gmUser = mk("gm", "Genel Müdürlük", "Genel Müdürlük", "", "genelmudur");
managers["Lojistik Müdürlüğü"].manager = director.id;
managers["Üretim Müdürlüğü"].manager = director.id;
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
  units: ["IT", "Teknik İşler", "Saha Operasyonu", "Satın Alma"],
  settings: {
    disabledReports: [],
    // Ödül kuralları örnek değerlerle açık: puanlanan önerilerde İK'ya ödül kaydı düşer.
    rewards: { ...DEFAULT_REWARD_SETTINGS, enabled: true },
    locations: [
      "A blok raf 12-18",
      "Hat 2",
      "Kalite giriş masası",
      "Rampa 3",
      "Sevkiyat sahası",
      "Şarj alanı",
    ],
    // Hiyerarşi: Departman → Müdürlük → Direktörlük → Genel Müdürlük (üst iki seviye açık).
    org: {
      departments: Object.entries(DIRS).flatMap(([dir, depts]) =>
        [...depts, depts[0] + " Yönetimi"].map((name) => ({
          name,
          directorate: dir,
        })),
      ),
      directorates: Object.keys(DIRS).map((name) => ({
        name,
        division: ["Lojistik Müdürlüğü", "Üretim Müdürlüğü"].includes(name)
          ? "Operasyon Direktörlüğü"
          : "Destek Hizmetleri Direktörlüğü",
      })),
      divisions: [
        { name: "Operasyon Direktörlüğü", group: "Genel Müdürlük" },
        { name: "Destek Hizmetleri Direktörlüğü", group: "Genel Müdürlük" },
      ],
      groups: ["Genel Müdürlük"],
      levels: { division: true, group: true },
    },
  },
};
const get = (id: string) => users.find((u) => u.id === id);
const call = (b: any, u: U) => applyCommand(s, b, u, users);
const TITLES: Record<string, string[]> = {
  "Mal Kabul": [
    "Randevu saatlerinin araç tipine göre ayrılması",
    "Irsaliye kontrolünün el terminaline taşınması",
    "Hasarlı koli fotoğrafının kabulde zorunlu olması",
    "Rampa önünde palet birikmesinin önlenmesi",
  ],
  Depolama: [
    "Raf adres etiketlerinin büyütülmesi",
    "Hızlı dönen ürünlerin bel hizasına alınması",
    "Boş lokasyonların günlük raporlanması",
    "Yangın koridorlarının zemin işaretlemesi",
  ],
  Toplama: [
    "Toplama rotasının dalga bazlı planlanması",
    "Sesli toplama pilotu",
    "Eksik toplama için anlık uyarı",
    "Toplama arabalarına bölmeli kasa",
  ],
  Sevkiyat: [
    "Sevkiyat etiketlerinde çift kontrol",
    "Yükleme sırasının rota sırasına göre yapılması",
    "Streç tüketiminin standartlaştırılması",
    "Araç doluluk oranının artırılması",
  ],
  Nakliye: [
    "Boş dönüşlerin planlanması",
    "Sürücü teslim belgelerinin dijitalleşmesi",
    "Yakıt tüketiminin rota bazında izlenmesi",
  ],
  "Montaj Hattı": [
    "Vida sıkma torkunun hat başında doğrulanması",
    "Hat dengesizliğinin istasyon yeniden dağılımıyla giderilmesi",
    "Malzeme besleme sıklığının kanbanla yönetilmesi",
    "Operatör değişiminde standart iş kartı",
  ],
  "Kalite Kontrol": [
    "Giriş kalitede numune sayısının risk bazlı belirlenmesi",
    "Hata kodlarının tek listede toplanması",
    "Ölçüm cihazı kalibrasyon hatırlatması",
  ],
  Bakım: [
    "Kompresör kaçaklarının haftalık taranması",
    "Otonom bakım kontrol listesi",
    "Yedek parça minimum stok takibi",
    "Forklift şarj alanında görsel yönlendirme",
  ],
  "Satın Alma": [
    "Tedarikçi teslim performansının aylık paylaşılması",
    "Ambalaj malzemesinde tek tedarikçi riskinin azaltılması",
    "Sipariş onay adımlarının sadeleştirilmesi",
  ],
};
const PROBS = [
  "Vardiya başında aynı iş iki kez yapılıyor ve yaklaşık 20 dakika kayboluyor.",
  "Elle yapılan kontrol nedeniyle ayda ortalama 6-8 hata müşteriye ulaşıyor.",
  "Operatörler malzeme bulmak için hat dışına çıkıyor, hat duruyor.",
  "Bilgi kâğıt üzerinde tutulduğu için geçmişe dönük analiz yapılamıyor.",
  "Ergonomik olmayan duruş nedeniyle şikâyetler artıyor.",
];
const SOLS = [
  "Basit bir görsel işaretleme ve standart iş kartı ile adımların netleştirilmesi.",
  "El terminaline okutma adımı eklenerek kontrolün sistemden yapılması.",
  "Malzemenin kullanım noktasına yakın konumlandırılması ve kanban kartı.",
  "Excel yerine ortak ekranda takip ve haftalık gözden geçirme toplantısı.",
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
        ? "Sevkiyat alanında yükleme öncesi palet etiketlerinin, sipariş numarası ve müşteri bilgisiyle el terminalinden çift kontrol edilerek yanlış araç yüklemesinin tamamen önlenmesi"
        : pick(TITLES[op]),
      problem: pick(PROBS) + (long ? " " + PROBS.join(" ") : ""),
      solution: pick(SOLS),
      operation: op,
      category: pick([
        "Verimlilik",
        "Kalite",
        "Maliyet",
        "İş güvenliği",
        "Ergonomi",
        "Çevre",
      ]),
      attachments:
        rnd() < 0.2 ? [{ name: "saha-fotografi.png", data: smallPng }] : [],
      location:
        rnd() < 0.6
          ? pick([
              "Rampa 3",
              "A blok raf 12-18",
              "Hat 2",
              "Kalite giriş masası",
              "Şarj alanı",
              "Sevkiyat sahası",
            ])
          : "",
      expectedBenefit:
        rnd() < 0.5
          ? pick([
              "Vardiya başına ~15 dk kazanç",
              "Ayda 5-6 hata önlenir",
              "Forklift trafiğinde güvenlik artar",
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
            "Fotoğraf ekleyin.",
            "Hangi vardiyada olduğunu yazın.",
            "Tahmini faydayı belirtin.",
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
          reason: "Ön değerlendirmede uygun bulunmadı.",
          reasonCode: pick(REJECT_REASONS),
        },
        as(p.owner),
      );
      continue;
    }
    call(
      {
        action: "accept",
        id,
        note: rnd() < 0.3 ? "Saha ziyareti yapıldı, öneri yerinde." : undefined,
      },
      as(p.owner),
    );
    if (target === STAGES[1]) continue;
    if (target === "Reddedildi") {
      call(
        {
          action: "reject",
          id,
          reason: "Operasyon değerlendirmesinde uygun bulunmadı.",
          reasonCode: rnd() < 0.15 ? undefined : pick(REJECT_REASONS),
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
          text: "Bu öneri için hangi vardiyada ölçüm yapıldı?",
        },
        as(p.owner),
      );
    if (rnd() < 0.2)
      call(
        {
          action: "comment",
          id,
          text: "Sabah vardiyasında, 3 gün boyunca ölçtük.",
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
            title: "Mevcut durumu ölç",
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
            "Pilot uygulama",
            "Görsel işaretleme",
            "Standart iş kartı hazırla",
            "Ekip eğitimi",
            "Sonuç ölçümü",
            "Tedarikçi ile görüşme",
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
      call({ action: "cancel", id, reason: "Proje kapsamı değişti." }, admin);
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
        const unit = pick(["IT", "Teknik İşler", "Satın Alma"]);
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
                    : unit === "Teknik İşler"
                      ? "İE-2026-"
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
            reason: "Tedarikçi malzemeyi sağlayamadı",
          },
          as(p.owner),
        );
      call(
        {
          action: "finish",
          id,
          outcome: "notImplemented",
          reasonCode: pick(NOT_IMPLEMENTED_REASONS.slice(0, 6)),
          reason: pick([
            "Yatırım bütçesi gelecek yıla kaldı.",
            "Saha denemesinde beklenen sonuç alınamadı.",
            "Hat yerleşimi değiştiği için öneri geçersiz kaldı.",
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
          : pick(["Zaman", "Kalite", "İş güvenliği", "Ergonomi"]),
        before: "Önce 20 dk",
        after: "Sonra 8 dk",
        explanation:
          "Vardiya başına 12 dakika × 3 vardiya × 250 gün üzerinden hesaplandı.",
      },
      as(p.owner),
    );
    if (target === STAGES[5]) continue;
    if (target === "Kazanç düzeltmesi bekliyor") {
      call(
        { action: "gainReturn", id, reason: "Hesaplama varsayımı eksik." },
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
const leaver = byRole["operation:Üretim Müdürlüğü"][0];
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
  campaigns: [
    {
      id: "k-isg-ayi",
      title: "İş güvenliği ayı",
      description: "Ramak kala ve ergonomi riskleri",
      start: d(-45),
      end: d(10),
      category: "İş güvenliği",
      reward: "En yüksek puanlı 3 öneri ay sonu toplantısında ödüllendirilir",
    },
    {
      id: "k-ambalaj",
      title: "Ambalaj israfı",
      start: d(15),
      end: d(45),
      category: "Maliyet",
    },
  ],
};
for (const p of s.proposals) {
  if (
    p.category === "İş güvenliği" &&
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
