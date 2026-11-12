import { STAGES, State } from "./model";
export const DEMO_USERS = [
  {
    id: "admin",
    username: "admin",
    name: "Yusuf Durak",
    department: "Süreç Geliştirme",
    role: "admin",
    manager: "mudur",
  },
  {
    id: "calisan",
    username: "calisan",
    name: "Elif Yılmaz",
    department: "Depo Operasyonları",
    role: "employee",
    manager: "mudur",
  },
  {
    id: "on",
    username: "on.degerlendirme",
    name: "Zeynep Kaya",
    department: "Süreç Geliştirme",
    role: "pre",
    manager: "mudur",
  },
  {
    id: "operasyon",
    username: "operasyon",
    name: "Emre Demir",
    department: "Depo Operasyonları",
    role: "operation",
    manager: "mudur",
  },
  {
    id: "kazanc",
    username: "kazanc",
    name: "Deniz Aydın",
    department: "Süreç Geliştirme",
    role: "gain",
    manager: "mudur",
  },
  {
    id: "mudur",
    username: "mudur",
    name: "Selin Arslan",
    department: "Lojistik Yönetimi",
    role: "manager",
    manager: "",
  },
  {
    id: "puan",
    username: "puanlama",
    name: "Mert Aksoy",
    department: "Süreç Geliştirme",
    role: "score",
    manager: "mudur",
  },
  {
    id: "it",
    username: "it",
    name: "Can Öztürk",
    department: "Bilgi Teknolojileri",
    role: "support",
    manager: "mudur",
  },
  {
    id: "teknik",
    username: "teknik",
    name: "Ece Koç",
    department: "Teknik İşler",
    role: "support",
    manager: "mudur",
  },
];
export function initialState(): State {
  const operations = ["Mal Kabul", "Depolama", "Toplama", "Sevkiyat", "Nakliye"];
  const titles = [
    "Mal kabul randevularında dijital sıra yönetimi",
    "Toplama rotalarının ürün hızına göre düzenlenmesi",
    "Sevkiyat etiketlerinde çift kontrol",
    "Streç tüketiminin standartlaştırılması",
    "Forklift şarj alanında görsel yönlendirme",
    "İade ürünlerinde barkodla ayrıştırma",
    "Araç doluluk oranının artırılması",
    "Raf adreslerinin okunabilirliğinin artırılması",
    "Paketleme masasında ergonomik düzenleme",
    "Hasarlı paletler için ayrılmış alan",
    "Yükleme rampalarında sensörlü uyarı",
    "Boş kasa dönüşlerinin planlanması",
  ];
  const statuses = [
    STAGES[0],
    STAGES[1],
    STAGES[3],
    STAGES[4],
    STAGES[5],
    STAGES[6],
    STAGES[7],
    STAGES[2],
    STAGES[3],
    "Reddedildi",
    STAGES[3],
    "İptal edildi",
  ];
  return {
    settings: { disabledReports: [] },
    operations,
    units: ["IT", "Teknik İşler", "Saha Operasyonu"],
    matrix: operations.map((operation) => ({
      operation,
      pre: "on",
      operationOwner: "operasyon",
      gain: "kazanc",
      score: "puan",
    })),
    audit: [],
    proposals: titles.map((title, i) => {
      const status = statuses[i],
        n = STAGES.indexOf(status),
        created = new Date(Date.now() - (20 - i) * 86400000).toISOString(),
        stageAt = new Date(Date.now() - ((i % 6) + 1) * 86400000).toISOString();
      return {
        id: "KZ-2026-" + String(i + 1).padStart(4, "0"),
        title,
        problem: [
          "Manuel takip nedeniyle araçlar bekliyor ve öncelik sırası karışıyor.",
          "Yüksek hareketli ürünlerin farklı koridorlarda bulunması gereksiz yürüyüşe neden oluyor.",
          "Elle yapılan kontrol, yanlış etiketlerin yüklemeye ulaşmasına neden olabiliyor.",
        ][i % 3],
        solution: [
          "Süreç adımlarının ortak ekranda izlenmesi ve sorumluların netleştirilmesi.",
          "Ölçüm yapılarak yerleşimin ve iş sırasının yeniden düzenlenmesi.",
          "Barkod doğrulama ve görsel kontrol adımlarının standartlaştırılması.",
        ][i % 3],
        operation: operations[i % 5],
        category: ["Verimlilik", "Kalite", "Maliyet", "İş güvenliği"][i % 4],
        author: i % 3 === 0 ? "admin" : "calisan",
        department: i % 3 === 0 ? "Süreç Geliştirme" : "Depo Operasyonları",
        directorate: "Lojistik Müdürlüğü",
        status,
        owner:
          n === 0
            ? "on"
            : n === 1 || n === 2 || n === 3
              ? "operasyon"
              : n === 4
                ? "kazanc"
                : n === 5
                  ? "mudur"
                  : n === 6
                    ? "puan"
                    : "",
        evaluator: n >= 2 ? "operasyon" : undefined,
        lastActiveStage:
          status === "Reddedildi" ? STAGES[1] : status === "İptal edildi" ? STAGES[3] : undefined,
        created,
        stageAt,
        due: new Date(Date.now() + ((i % 4) - 1) * 86400000).toISOString().slice(0, 10),
        actions:
          n >= 3
            ? [
                {
                  id: "a" + i,
                  title: "Pilot uygulamayı tamamla ve sonucu ölç",
                  owner: "operasyon",
                  due: "2026-11-02",
                  status: n >= 4 ? "Tamamlandı" : "Devam ediyor",
                },
              ]
            : [],
        support: [2, 8, 10].includes(i)
          ? [
              {
                id: "s" + i,
                unit: i === 8 ? "Operasyon" : i === 10 ? "Teknik İşler" : "IT",
                owner: i === 8 ? "operasyon" : i === 10 ? "teknik" : "it",
                title:
                  i === 10
                    ? "Rampa sensörü montajı"
                    : i === 8
                      ? "Pilot alanın hazırlanması"
                      : "Barkod doğrulama geliştirmesi",
                status: "Bekliyor",
                blocking: true,
                due: "2026-11-05",
              },
            ]
          : [],
        gain:
          n >= 5
            ? {
                amount: i === 6 ? 144000 : 36000,
                cost: 6000,
                period: "Yıllık",
                type: "Parasal",
                before: "120 dakika",
                after: "80 dakika",
                explanation:
                  "Pilot ölçüm: işlem başına 40 dakika iyileşme. Yıllık hacim ve işçilik maliyeti üzerinden hesaplandı.",
                approved: n >= 6,
                valid: true,
              }
            : undefined,
        score: n === 7 ? { values: [4, 4, 5], total: 87, valid: true } : undefined,
        attachments: [],
        history: [
          { at: created, actor: i % 3 === 0 ? "admin" : "calisan", text: "Öneri oluşturuldu." },
          { at: stageAt, actor: "on", text: "Demo kaydı: " + status },
        ],
      };
    }),
  };
}
