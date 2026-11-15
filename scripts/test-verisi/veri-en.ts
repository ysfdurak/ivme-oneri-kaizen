// İngilizce canlı demonun örnek veri metinleri (IVME_DIL=en ile uret.ts kullanır).
// Yalnız veri: bölüm, departman, başlık, sorun, çözüm, yorum, aksiyon ve gerekçe metinleri.
// Aşama adları ve sistem maddeleri ("Mükerrer öneri", "Parasal") Türkçe kod olarak kalır; ekranda çevrilir.
export const VERI_EN: Record<string, string> = {
  // Müdürlükler ve departmanlar
  "Lojistik Müdürlüğü": "Logistics Management",
  "Üretim Müdürlüğü": "Production Management",
  "Satın Alma ve Tedarik Zinciri Müdürlüğü": "Purchasing and Supply Chain Management",
  "Bilgi Teknolojileri Müdürlüğü": "IT Management",
  "Teknik İşler Müdürlüğü": "Technical Services Management",
  "Süreç Geliştirme Müdürlüğü": "Process Improvement Management",
  "İnsan Kaynakları Müdürlüğü": "Human Resources Management",
  "Depo Operasyonları": "Warehouse Operations",
  "Taşıma ve Dağıtım": "Transport and Distribution",
  "Lojistik Planlama": "Logistics Planning",
  Montaj: "Assembly",
  "Kalite Kontrol": "Quality Control",
  "Bakım Onarım": "Maintenance and Repair",
  "Satın Alma": "Purchasing",
  "Tedarikçi Geliştirme": "Supplier Development",
  "Bilgi Teknolojileri": "Information Technology",
  "Teknik İşler": "Technical Services",
  "Süreç Geliştirme": "Process Improvement",
  "İnsan Kaynakları": "Human Resources",
  " Yönetimi": " Office",
  "Operasyon Direktörlüğü": "Operations Directorate",
  "Destek Hizmetleri Direktörlüğü": "Support Services Directorate",
  "Genel Müdürlük": "Head Office",
  // Bölümler (öneri alanları) ve destek birimleri
  "Mal Kabul": "Goods Receipt",
  Depolama: "Storage",
  Toplama: "Picking",
  Sevkiyat: "Shipping",
  Nakliye: "Transport",
  "Montaj Hattı": "Assembly Line",
  Bakım: "Maintenance",
  "Saha Operasyonu": "Field Operations",
  // Lokasyonlar
  "A blok raf 12-18": "Block A racks 12-18",
  "Hat 2": "Line 2",
  "Kalite giriş masası": "Quality intake desk",
  "Rampa 3": "Dock 3",
  "Sevkiyat sahası": "Shipping yard",
  "Şarj alanı": "Charging area",
  // Başlıklar
  "Randevu saatlerinin araç tipine göre ayrılması": "Separate appointment slots by vehicle type",
  "Irsaliye kontrolünün el terminaline taşınması": "Move delivery note checks to the handheld terminal",
  "Hasarlı koli fotoğrafının kabulde zorunlu olması": "Make a photo of damaged cartons mandatory at receipt",
  "Rampa önünde palet birikmesinin önlenmesi": "Prevent pallets piling up in front of the docks",
  "Raf adres etiketlerinin büyütülmesi": "Enlarge rack address labels",
  "Hızlı dönen ürünlerin bel hizasına alınması": "Move fast-moving items to waist height",
  "Boş lokasyonların günlük raporlanması": "Daily report of empty locations",
  "Yangın koridorlarının zemin işaretlemesi": "Floor marking for fire escape aisles",
  "Toplama rotasının dalga bazlı planlanması": "Plan picking routes by wave",
  "Sesli toplama pilotu": "Voice picking pilot",
  "Eksik toplama için anlık uyarı": "Instant alert for short picks",
  "Toplama arabalarına bölmeli kasa": "Divided crates on picking carts",
  "Sevkiyat etiketlerinde çift kontrol": "Double check on shipping labels",
  "Yükleme sırasının rota sırasına göre yapılması": "Load vehicles in delivery route order",
  "Streç tüketiminin standartlaştırılması": "Standardise stretch film use",
  "Araç doluluk oranının artırılması": "Raise vehicle fill rates",
  "Boş dönüşlerin planlanması": "Plan return trips to avoid running empty",
  "Sürücü teslim belgelerinin dijitalleşmesi": "Digital proof of delivery for drivers",
  "Yakıt tüketiminin rota bazında izlenmesi": "Track fuel consumption by route",
  "Vida sıkma torkunun hat başında doğrulanması": "Verify screw torque at the start of the line",
  "Hat dengesizliğinin istasyon yeniden dağılımıyla giderilmesi": "Fix line imbalance by redistributing stations",
  "Malzeme besleme sıklığının kanbanla yönetilmesi": "Manage line feeding frequency with kanban",
  "Operatör değişiminde standart iş kartı": "Standard work card for operator changeovers",
  "Giriş kalitede numune sayısının risk bazlı belirlenmesi": "Risk-based sample sizes in incoming inspection",
  "Hata kodlarının tek listede toplanması": "One shared list of defect codes",
  "Ölçüm cihazı kalibrasyon hatırlatması": "Calibration reminders for measuring devices",
  "Kompresör kaçaklarının haftalık taranması": "Weekly scan for compressed air leaks",
  "Otonom bakım kontrol listesi": "Autonomous maintenance checklist",
  "Yedek parça minimum stok takibi": "Minimum stock tracking for spare parts",
  "Forklift şarj alanında görsel yönlendirme": "Visual guidance in the forklift charging area",
  "Tedarikçi teslim performansının aylık paylaşılması": "Share supplier delivery performance monthly",
  "Ambalaj malzemesinde tek tedarikçi riskinin azaltılması": "Reduce single-supplier risk for packaging material",
  "Sipariş onay adımlarının sadeleştirilmesi": "Simplify purchase order approval steps",
  "Sevkiyat alanında yükleme öncesi palet etiketlerinin, sipariş numarası ve müşteri bilgisiyle el terminalinden çift kontrol edilerek yanlış araç yüklemesinin tamamen önlenmesi":
    "Completely prevent wrong-vehicle loading in the shipping area by double-checking pallet labels against the order number and customer details on the handheld terminal before loading",
  // Sorunlar ve çözümler
  "Vardiya başında aynı iş iki kez yapılıyor ve yaklaşık 20 dakika kayboluyor.":
    "At the start of each shift the same task is done twice and about 20 minutes are lost.",
  "Elle yapılan kontrol nedeniyle ayda ortalama 6-8 hata müşteriye ulaşıyor.":
    "Because checks are manual, 6-8 errors reach customers each month on average.",
  "Operatörler malzeme bulmak için hat dışına çıkıyor, hat duruyor.":
    "Operators leave the line to find materials and the line stops.",
  "Bilgi kâğıt üzerinde tutulduğu için geçmişe dönük analiz yapılamıyor.":
    "Information is kept on paper, so past data cannot be analysed.",
  "Ergonomik olmayan duruş nedeniyle şikâyetler artıyor.":
    "Complaints are rising because of awkward working postures.",
  "Basit bir görsel işaretleme ve standart iş kartı ile adımların netleştirilmesi.":
    "Clarify the steps with simple visual markings and a standard work card.",
  "El terminaline okutma adımı eklenerek kontrolün sistemden yapılması.":
    "Add a scanning step on the handheld terminal so the system does the check.",
  "Malzemenin kullanım noktasına yakın konumlandırılması ve kanban kartı.":
    "Place materials close to the point of use and add a kanban card.",
  "Excel yerine ortak ekranda takip ve haftalık gözden geçirme toplantısı.":
    "Track it on a shared screen instead of Excel, with a weekly review meeting.",
  // Beklenen fayda
  "Vardiya başına ~15 dk kazanç": "~15 min saved per shift",
  "Ayda 5-6 hata önlenir": "5-6 errors prevented per month",
  "Forklift trafiğinde güvenlik artar": "Safer forklift traffic",
  // Revizyon, ret, iptal, uygulanamama gerekçeleri
  "Fotoğraf ekleyin.": "Please add a photo.",
  "Hangi vardiyada olduğunu yazın.": "Please say which shift this happens on.",
  "Tahmini faydayı belirtin.": "Please state the expected benefit.",
  "Ön değerlendirmede uygun bulunmadı.": "Not found suitable in the pre-review.",
  "Operasyon değerlendirmesinde uygun bulunmadı.": "Not found suitable in the unit evaluation.",
  "Saha ziyareti yapıldı, öneri yerinde.": "We visited the floor; the proposal is spot on.",
  "Bu öneri için hangi vardiyada ölçüm yapıldı?": "Which shift was this measured on?",
  "Sabah vardiyasında, 3 gün boyunca ölçtük.": "On the morning shift, over 3 days.",
  "Proje kapsamı değişti.": "The project scope changed.",
  "Tedarikçi malzemeyi sağlayamadı": "The supplier could not provide the material",
  "Yatırım bütçesi gelecek yıla kaldı.": "The investment budget was moved to next year.",
  "Saha denemesinde beklenen sonuç alınamadı.": "The floor trial did not give the expected result.",
  "Hat yerleşimi değiştiği için öneri geçersiz kaldı.": "The line layout changed, so the proposal no longer applies.",
  "Hesaplama varsayımı eksik.": "A calculation assumption is missing.",
  // Aksiyonlar
  "Mevcut durumu ölç": "Measure the current state",
  "Pilot uygulama": "Pilot run",
  "Görsel işaretleme": "Visual marking",
  "Standart iş kartı hazırla": "Prepare a standard work card",
  "Ekip eğitimi": "Team training",
  "Sonuç ölçümü": "Measure the result",
  "Tedarikçi ile görüşme": "Meeting with the supplier",
  // Kazanç
  "Önce 20 dk": "Before: 20 min",
  "Sonra 8 dk": "After: 8 min",
  "Vardiya başına 12 dakika × 3 vardiya × 250 gün üzerinden hesaplandı.":
    "Calculated as 12 minutes per shift × 3 shifts × 250 days.",
  // Kampanyalar
  "İş güvenliği ayı": "Safety month",
  "Ramak kala ve ergonomi riskleri": "Near misses and ergonomic risks",
  "En yüksek puanlı 3 öneri ay sonu toplantısında ödüllendirilir":
    "The 3 highest-scoring proposals are rewarded at the month-end meeting",
  "Ambalaj israfı": "Packaging waste",
  // Ek dosya
  "saha-fotografi.png": "floor-photo.png",
};

/** Kişi adları: İngilizce demoda İngilizce adlar. */
export const FIRST_EN = [
  "James", "Emma", "Oliver", "Sophie", "Daniel", "Grace", "Thomas", "Chloe", "Samuel", "Hannah",
  "Jack", "Lucy", "Benjamin", "Amelia", "Ryan", "Megan", "George", "Ella", "Michael", "Isla",
  "Adam", "Laura", "Ethan", "Rachel", "Liam", "Zoe", "Nathan", "Holly", "Owen", "Jessica",
];
export const LAST_EN = [
  "Smith", "Jones", "Taylor", "Brown", "Wilson", "Evans", "Thomas", "Johnson", "Roberts", "Walker",
  "Wright", "Robinson", "Thompson", "White", "Hughes", "Edwards", "Green", "Hall", "Wood", "Harris",
];

/** İngilizce demoda düzenlenebilir listeler İngilizce tutulur; kilitli sistem maddeleri Türkçe kod olarak kalır. */
export const LISTS_EN = {
  categories: ["Productivity", "Quality", "Cost", "Occupational safety", "Ergonomics", "Environment"],
  rejectReasons: [
    "Mükerrer öneri",
    "Already being implemented",
    "Out of scope",
    "Cost higher than the benefit",
    "Technically not feasible",
    "Against safety rules / regulations",
    "Not enough information",
  ],
  notImplementedReasons: [
    "Budget / investment approval not obtained",
    "Technically not feasible",
    "Materials / supply not available",
    "Process or organisation changed",
    "Regulatory / safety obstacle",
    "Cost turned out higher than the benefit",
    "Other",
  ],
  gainTypes: ["Parasal", "Time", "Quality", "Occupational safety", "Ergonomics"],
};
export const SCORING_EN = {
  scale: 5,
  criteria: [
    { id: "etki", name: "Impact of the improvement", description: "How much it solves the problem, size of the savings", weight: 1 },
    { id: "kalicilik", name: "Sustainability of the change", description: "Has it become the standard; risk of going back", weight: 1 },
    { id: "yayginlik", name: "Transferability", description: "Can it be applied to other units or lines", weight: 1 },
  ],
};
export const REWARD_LABELS_EN: Record<string, string> = {
  "Yarım maaş ikramiye": "Half-salary bonus",
  "Başarı ödülü": "Achievement award",
  "Hediye çeki": "Gift voucher",
  "Teşekkür belgesi": "Certificate of thanks",
};

// Öneri sınıfları ve kazanç türleri (veri değeri olarak).
Object.assign(VERI_EN, {
  Verimlilik: "Productivity",
  Kalite: "Quality",
  Maliyet: "Cost",
  "İş güvenliği": "Occupational safety",
  Ergonomi: "Ergonomics",
  Çevre: "Environment",
  Zaman: "Time",
});
