// Tanınma ekranı hesapları (saf fonksiyon; sunucu ve testler kullanır).
// İlke: kişiler arasında sıralama yok. Herkese açık olan yalnızca tamamlanmış iyileştirmeler ve
// bölüm/departman düzeyindeki katılım; kişisel sayılar ve rozetler yalnızca kişinin kendisine gösterilir.
import { Proposal, State } from "./model";

export const RECOGNITION_WINDOWS = [30, 90, 365];
/** Katılım oranı bu sayının altındaki departmanlarda gösterilmez (oran tek kişiyi ele verebilir). */
export const MIN_DEPARTMENT_SIZE = 3;

type U = {
  id: string;
  name: string;
  department: string;
  role: string;
  active?: number;
};

export const BADGES = [
  { key: "first", label: "İlk adım", desc: "İlk önerini verdin." },
  { key: "five", label: "Düzenli katkı", desc: "5 öneri verdin." },
  { key: "ten", label: "Kaizen gönüllüsü", desc: "10 öneri verdin." },
  {
    key: "implemented",
    label: "Hayata geçti",
    desc: "Bir önerin uygulamaya alındı.",
  },
  { key: "completed", label: "Sonuca ulaştı", desc: "Bir önerin tamamlandı." },
  {
    key: "gain",
    label: "Ölçülen fayda",
    desc: "Bir önerinin kazancı onaylandı.",
  },
  {
    key: "team",
    label: "Birlikte daha iyi",
    desc: "Ortak bir öneride yer aldın.",
  },
  {
    key: "high",
    label: "Örnek iyileştirme",
    desc: "Bir önerin 80 ve üzeri puan aldı.",
  },
] as const;

const DAY = 86400000;
const IMPLEMENTED = [
  "Uygulamada",
  "Kazanç girişi",
  "Kazanç düzeltmesi bekliyor",
  "Kazanç onayı",
  "Puanlama",
  "Tamamlandı",
];
const people = (p: Proposal) => [p.author, ...(p.coAuthors || [])];

export function buildRecognition(
  state: State,
  users: U[],
  me: string,
  today = new Date(),
  windowDays = 90,
) {
  const days = RECOGNITION_WINDOWS.includes(windowDays) ? windowDays : 90;
  const from = new Date(today.getTime() - days * DAY).toISOString();
  const name = (id: string) => users.find((x) => x.id === id)?.name || "—";
  const live = state.proposals.filter((p) => p.status !== "İptal edildi");
  const inWindow = live.filter((p) => p.created >= from);
  const completed = live
    .filter(
      (p) => p.status === "Tamamlandı" && (p.stageAt || p.created) >= from,
    )
    .sort(
      (a, b) =>
        (b.score?.total || 0) - (a.score?.total || 0) ||
        (b.gain?.approved ? 1 : 0) - (a.gain?.approved ? 1 : 0) ||
        (b.stageAt || "").localeCompare(a.stageAt || ""),
    );

  // Departman katılımı: dönemde öneri veren (ya da ortak yazar olan) aktif kişi / departmandaki aktif kişi.
  const staff = users.filter(
    (x) => x.active !== 0 && !["admin", "director", "gm"].includes(x.role),
  );
  const contributors = new Set(inWindow.flatMap(people));
  const depts = new Map<
    string,
    { people: number; contributors: number; completed: number }
  >();
  for (const x of staff) {
    const d = depts.get(x.department) || {
      people: 0,
      contributors: 0,
      completed: 0,
    };
    d.people++;
    if (contributors.has(x.id)) d.contributors++;
    depts.set(x.department, d);
  }
  for (const p of completed) {
    const d = depts.get(p.department);
    if (d) d.completed++;
  }
  const departments = [...depts.entries()]
    .filter(([, d]) => d.people >= MIN_DEPARTMENT_SIZE)
    .map(([name, d]) => ({
      name,
      ...d,
      rate: Math.round((d.contributors / d.people) * 100),
    }))
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        b.completed - a.completed ||
        a.name.localeCompare(b.name, "tr"),
    );

  // Kişinin kendi özeti: tüm zamanlar (rozetler kalıcıdır).
  const mine = live.filter((p) => people(p).includes(me));
  const authored = mine.filter((p) => p.author === me);
  const earned = new Set<string>();
  if (authored.length >= 1) earned.add("first");
  if (authored.length >= 5) earned.add("five");
  if (authored.length >= 10) earned.add("ten");
  if (mine.some((p) => IMPLEMENTED.includes(p.status)))
    earned.add("implemented");
  if (mine.some((p) => p.status === "Tamamlandı")) earned.add("completed");
  if (mine.some((p) => p.gain?.approved && p.gain?.valid !== false))
    earned.add("gain");
  if (mine.some((p) => (p.coAuthors || []).length > 0)) earned.add("team");
  if (mine.some((p) => (p.score?.total || 0) >= 80 && p.score?.valid !== false))
    earned.add("high");

  const staffSet = new Set(staff.map((x) => x.id));
  const participants = [...contributors].filter((x) => staffSet.has(x)).length;
  return {
    windowDays: days,
    totals: {
      submitted: inWindow.length,
      completed: completed.length,
      participants,
      participation: staff.length
        ? Math.round((participants / staff.length) * 100)
        : 0,
    },
    highlights: completed.slice(0, 6).map((p) => ({
      id: p.id,
      title: p.title,
      operation: p.operation,
      department: p.department,
      authors:
        p.anonymous && !people(p).includes(me)
          ? ["Anonim çalışan"]
          : people(p).map(name),
      score: p.score?.valid !== false ? p.score?.total : undefined,
      gainType: p.gain?.approved ? p.gain.type : undefined,
      completedAt: p.stageAt,
      benefit: p.gain?.approved ? p.gain.after : undefined,
    })),
    departments,
    campaigns: (state.settings?.campaigns || [])
      .filter((c) => c.end >= from.slice(0, 10))
      .sort((a, b) => b.start.localeCompare(a.start))
      .map((c) => {
        const ps = live.filter((p) => p.campaign === c.id);
        const t = new Date(today.getTime() + 3 * 3600_000)
          .toISOString()
          .slice(0, 10);
        return {
          id: c.id,
          title: c.title,
          start: c.start,
          end: c.end,
          reward: c.reward,
          status: c.end < t ? "Bitti" : c.start > t ? "Planlandı" : "Açık",
          submitted: ps.length,
          participants: new Set(ps.flatMap(people)).size,
          completed: ps.filter((p) => p.status === "Tamamlandı").length,
          mine: ps.filter((p) => people(p).includes(me)).length,
        };
      }),
    me: {
      submitted: authored.length,
      coAuthored: mine.length - authored.length,
      implemented: mine.filter((p) => IMPLEMENTED.includes(p.status)).length,
      completed: mine.filter((p) => p.status === "Tamamlandı").length,
      open: mine.filter(
        (p) => !["Tamamlandı", "Reddedildi", "Uygulanamadı"].includes(p.status),
      ).length,
      badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.key) })),
    },
  };
}
export type Recognition = ReturnType<typeof buildRecognition>;
