"use client";
import { intlLocale, translate } from "../lib/i18n";
import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  GitBranch,
  Users,
  ChartNoAxesCombined,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  X,
  Clock,
  LogOut,
  Menu,
  ArrowLeft,
  Send,
  ShieldCheck,
  Monitor,
  Smartphone,
  Paperclip,
  Download,
  RotateCcw,
  UserRound,
  Building2,
  Activity,
  AlertCircle,
  CheckCircle2,
  Ban,
  Settings2,
  FileText,
  TrendingUp,
  LoaderCircle,
  MessageSquare,
  Bell,
  Upload,
  QrCode,
  Award,
  Megaphone,
  Gift,
  Trash2,
} from "lucide-react";
import {
  STAGES,
  CLOSED,
  ROLES,
  REJECT_REASONS,
  MANAGER_ROLES,
  STAGE_TARGET_DAYS,
  overdueDays,
  Proposal,
  State,
  User,
  fmt,
  money,
  date,
  waiting,
  supportWaits,
  NOT_IMPLEMENTED,
  NOT_IMPLEMENTED_REASONS,
  gainFigures,
  CATEGORY_LIST,
  activeCampaigns,
  ANON,
  supportWaitText,
  age,
} from "../lib/model";
import DashboardPage from "./dashboard-page";
import LanguageSwitch from "./language-switch";
import PersonPicker from "./person-picker";
import DefinitionsPage from "./definitions-page";
import SimilarPanel from "./similar-panel";
import UserImport from "./user-import";
import RecognitionPage from "./recognition-page";
import BeforeAfter from "./before-after";
import McpAccess from "./mcp-access";
import {
  activeNames,
  activeSubs,
  applyTargetDays,
  listOf,
  scoreTotal,
  scoringOf,
} from "../lib/definitions";
import RewardsPage from "./rewards-page";
import ReportBuilder from "./report-builder";
import { DemoGuide } from "./demo-guide";
import { pickRule, rewardText } from "../lib/rewards";
import { REPORTS } from "../lib/dashboard";
const NAV = [
  ["overview", "Çalışma merkezim", LayoutDashboard],
  ["list", "Öneriler", Lightbulb],
  ["tasks", "İşlerim", ListChecks],
  ["dashboard", "Durum panosu", Activity],
  ["recognition", "Tanınma", Award],
  ["rewards", "Ödüller", Gift],
  ["reports", "Raporlar", ChartNoAxesCombined],
  ["matrix", "Atama matrisi", GitBranch],
  ["users", "Kullanıcılar", Users],
  ["definitions", "Tanımlar", Settings2],
] as const;
const initialForm = {
  title: "",
  problem: "",
  solution: "",
  operation: "",
  category: "",
  attachments: [] as any[],
  location: "",
  expectedBenefit: "",
  coAuthors: [] as string[],
  anonymous: false,
  campaign: "",
  subcategory: "",
};
const CATEGORIES = CATEGORY_LIST;
const draftKey = (userId: string) => "ivme-taslak-" + userId;
// Sunucu tarafındaki sınır: base64 olarak 700.000 karakter ≈ 500 KB dosya.
const MAX_ATTACHMENT = 500_000;
const MAX_DATA_URL = 680_000;
function readAsDataUrl(f: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
/** Fotoğrafı uzun kenarı en fazla 1600 px olacak şekilde küçültür, JPEG'e çevirir ve
 * 500 KB altına inene kadar kaliteyi/boyutu kademeli düşürür. */
async function shrinkImage(f: File) {
  const bitmap = await createImageBitmap(f, {
    imageOrientation: "from-image",
  } as any);
  let longest = 1600;
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(
        1,
        longest / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // Saydam PNG'ler siyah görünmesin.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const data = canvas.toDataURL("image/jpeg", quality);
        if (data.length <= MAX_DATA_URL) return data;
      }
      longest = Math.round(longest * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Fotoğraf küçültülemedi.");
}
/** Destek beklemesi satırı: birim, kaç gündür beklendiği ve dış sistemdeki talep numarası. */
function TicketRow({
  wait,
  disabled,
  onSave,
}: {
  wait: { id: string; unit: string; ticket: string; days?: number };
  disabled: boolean;
  onSave: (ticket: string) => void;
}) {
  const [value, setValue] = useState(wait.ticket);
  useEffect(() => setValue(wait.ticket), [wait.ticket]);
  const id = "ticket-" + wait.id;
  return (
    <form
      className="ticket-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() !== wait.ticket) onSave(value.trim());
      }}
    >
      <label htmlFor={id}>
        <b>{wait.unit}</b>
        <small>
          {wait.days !== undefined
            ? wait.days + " gündür bekleniyor"
            : "Bekleniyor"}
        </small>
      </label>
      <input
        id={id}
        placeholder="Talep no (ör. INC-10293)"
        maxLength={40}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="secondary"
        disabled={disabled || value.trim() === wait.ticket}
      >
        Kaydet
      </button>
    </form>
  );
}
/** Detaydan eklenen tek dosyayı hazırlar: fotoğraf küçültülür, PDF 500 KB sınırına bakılır. */
async function prepareFile(f: File) {
  const isImage =
    /^image\/(png|jpeg|webp|heic|heif)$/.test(f.type) ||
    /\.(heic|heif)$/i.test(f.name);
  if (!isImage && f.type !== "application/pdf")
    throw Error("Yalnızca fotoğraf veya PDF eklenebilir.");
  if (!isImage && f.size > MAX_ATTACHMENT)
    throw Error("PDF dosyası en fazla 500 KB olabilir.");
  if (isImage && f.size > 25_000_000)
    throw Error("Fotoğraf çok büyük (25 MB üstü).");
  return isImage ? shrinkImage(f) : readAsDataUrl(f);
}
/** Kaydın sıradaki adımı. Sıra kullanıcıdaysa emir kipinde ("Öneriyi değerlendir"),
 * başkasındaysa durum bildiren ifadeyle ("Bölüm değerlendirmesi bekleniyor") gösterilir. */
function nextStep(p: Proposal, id: string) {
  if (
    p.owner !== id &&
    p.support.some(
      (a) =>
        a.owner === id &&
        !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
    )
  )
    return { title: "Destek işini güncelle", tab: "support", mine: true };
  if (
    p.owner !== id &&
    p.actions.some(
      (a) =>
        a.owner === id &&
        !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
    )
  )
    return { title: "Aksiyonunu güncelle", tab: "actions", mine: true };
  const steps: Record<string, [string, string, string]> = {
    "Ön değerlendirme": [
      "Ön değerlendirme yap",
      "Ön değerlendirme bekleniyor",
      "summary",
    ],
    "Bölüm değerlendirmesi": [
      "Öneriyi değerlendir",
      "Bölüm değerlendirmesi bekleniyor",
      "summary",
    ],
    "Aksiyon planlama": [
      "Aksiyon planını oluştur",
      "Aksiyon planı bekleniyor",
      "actions",
    ],
    Uygulamada: ["Aksiyonları tamamla", "Uygulama sürüyor", "actions"],
    "Kazanç girişi": [
      "Kazanç bilgisini gir",
      "Kazanç girişi bekleniyor",
      "gain",
    ],
    "Kazanç düzeltmesi bekliyor": [
      "Kazanç bilgisini düzelt",
      "Kazanç düzeltmesi bekleniyor",
      "gain",
    ],
    "Kazanç onayı": [
      "Kazancı incele ve onayla",
      "Kazanç onayı bekleniyor",
      "gain",
    ],
    Puanlama: ["Puanla ve tamamla", "Puanlama bekleniyor", "gain"],
    "Revizyon bekliyor": [
      "Önerini düzenle",
      "Öneri sahibinin düzeltmesi bekleniyor",
      "summary",
    ],
  };
  const st = steps[p.status];
  if (!st) return { title: "Sonucu incele", tab: "summary", mine: false };
  const mine = p.owner === id;
  return { title: mine ? st[0] : st[1], tab: st[2], mine };
}
/** Önerinin süreçte kaçıncı adımda olduğunu ve çalışana gösterilecek açıklamayı verir. */
function progressOf(p: Proposal) {
  const i = STAGES.indexOf(p.status);
  if (p.status === "Revizyon bekliyor")
    return {
      step: 1,
      tone: "warn",
      label: "Değerlendirici düzenleme istedi · sıra sende",
    };
  if (p.status === "Kazanç düzeltmesi bekliyor")
    return { step: 5, tone: "", label: "Kazanç bilgisi düzeltiliyor" };
  if (p.status === "Reddedildi")
    return {
      step: STAGES.length,
      tone: "red",
      label: "Sonuçlandı · reddedildi",
    };
  if (p.status === "İptal edildi")
    return {
      step: STAGES.length,
      tone: "red",
      label: "Sonuçlandı · iptal edildi",
    };
  if (p.status === NOT_IMPLEMENTED)
    return {
      step: STAGES.length,
      tone: "warn",
      label: "Sonuçlandı · uygulanamadı",
    };
  if (p.status === "Tamamlandı")
    return { step: STAGES.length, tone: "green", label: "Hayata geçti" };
  return {
    step: i + 1,
    tone: "",
    label: "Adım " + (i + 1) + "/" + (STAGES.length - 1),
  };
}
/** "X gündür bu aşamada" metni; hedef süre aşıldıysa gecikmeyi vurgular. */
function StageAge({
  p,
  suffix = "gündür bu aşamada",
}: {
  p: Proposal;
  suffix?: string;
}) {
  if (CLOSED.includes(p.status)) return <>Süreç kapalı</>;
  const late = overdueDays(p);
  return (
    <span className={late ? "overdue" : ""}>
      {age(p.stageAt)} {suffix}
      {late > 0 && <b> · {late} gün gecikti</b>}
    </span>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "badge " +
        (status === "Tamamlandı"
          ? "green"
          : status === "Reddedildi" || status === "İptal edildi"
            ? "red"
            : status === NOT_IMPLEMENTED
              ? "slate"
              : status.includes("Kazanç")
                ? "amber"
                : status === "Uygulamada"
                  ? "blue"
                  : "neutral")
      }
    >
      <i />
      {status}
    </span>
  );
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={"avatar " + (small ? "small" : "")}>
      {name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [demo, setDemo] = useState(false),
    [showcase, setShowcase] = useState<
      { username: string; label: string; hint: string }[] | null
    >(null),
    [edition, setEdition] = useState("surec"),
    [altDemo, setAltDemo] = useState<{ url: string; lang: string; label: string } | null>(null),
    [state, setState] = useState<State | null>(null),
    [users, setUsers] = useState<User[]>([]),
    [version, setVersion] = useState(0),
    [page, setPage] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const [formStep, setFormStep] = useState(1),
    [queueScope, setQueueScope] = useState("team");
  const [login, setLogin] = useState({ username: "admin", password: "" }),
    [pw, setPw] = useState({ oldPassword: "", password: "", confirm: "" });
  const [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [unitFilter, setUnitFilter] = useState(""),
    [opFilter, setOpFilter] = useState(""),
    [deptFilter, setDeptFilter] = useState(""),
    [dirFilter, setDirFilter] = useState(""),
    [authorFilter, setAuthorFilter] = useState(""),
    [ownerFilter, setOwnerFilter] = useState(""),
    [catFilter, setCatFilter] = useState(""),
    [locFilter, setLocFilter] = useState(""),
    [sortBy, setSortBy] = useState<{ key: string; dir: 1 | -1 }>({
      key: "created",
      dir: -1,
    }),
    [pageNo, setPageNo] = useState(1),
    [pageSize, setPageSize] = useState(25),
    [fromFilter, setFromFilter] = useState(""),
    [toFilter, setToFilter] = useState(""),
    [listTab, setListTab] = useState("all"),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null),
    [detailTab, setDetailTab] = useState("summary"),
    [form, setForm] = useState(initialForm),
    [modal, setModal] = useState<any>(null),
    [draft, setDraft] = useState<any>({}),
    [commentText, setCommentText] = useState("");
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) {
          setModal(null);
          setError("");
        } else if (detail) setDetail(null);
        else setMobile(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [modal, detail]);
  // Erişilebilirlik: pencere veya detay açılınca klavye odağı içine taşınır.
  useEffect(() => {
    setPageNo(1);
  }, [
    search,
    statusFilter,
    unitFilter,
    opFilter,
    deptFilter,
    dirFilter,
    authorFilter,
    ownerFilter,
    catFilter,
    locFilter,
    fromFilter,
    toFilter,
    listTab,
    pageSize,
  ]);
  useEffect(() => {
    if (!modal && !detail) return;
    const t = setTimeout(() => {
      const root = document.querySelector(modal ? ".modal" : ".drawer");
      const target = root?.querySelector<HTMLElement>(
        modal
          ? "textarea, input, select, button:not(.icon-button)"
          : ".icon-button",
      );
      target?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [modal?.type, detail]);
  useEffect(() => {
    if (page === "new") window.scrollTo({ top: 0, behavior: "instant" });
  }, [formStep, page]);
  // Pasif kullanıcılar adın yanında işaretlenir; aynı adı taşıyan kişiler departmanla ayırt edilir.
  const who = (id: string) => {
    if (id === ANON) return "Anonim çalışan";
    const u = users.find((u) => u.id === id);
    return u ? u.name + (u.active === 0 ? " (pasif)" : "") : "—";
  };
  const personLabel = (u: User) =>
    u.name +
    (users.filter((x) => x.name === u.name).length > 1
      ? " · " + u.department
      : "") +
    (u.active === 0 ? " (pasif)" : "");
  const sortedUsers = users
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const inactiveIds = users.filter((u) => u.active === 0).map((u) => u.id);
  const orgName = state?.settings?.orgName || "Lojistik";
  const org = state?.settings?.org || {
    departments: [],
    directorates: [],
    divisions: [],
    groups: [],
    levels: { division: false, group: false },
  };
  /** Kullanıcının üzerindeki açık iş sayısı: sorumlu olduğu açık öneriler, açık aksiyonları ve matris görevleri. */
  const workload = (id: string) => {
    const open = (state?.proposals || []).filter(
      (p) => !CLOSED.includes(p.status),
    );
    return {
      proposals: open.filter((p) => p.owner === id).length,
      actions: open
        .flatMap((p) => p.actions)
        .filter(
          (a) =>
            a.owner === id &&
            !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
        ).length,
      matrix: (state?.matrix || []).filter((r) =>
        ["pre", "operationOwner", "gain", "score"].some((k) => r[k] === id),
      ).length,
    };
  };
  const strandedUsers = users
    .filter((u) => u.active === 0)
    .map((u) => ({ u, w: workload(u.id) }))
    .filter(({ w }) => w.proposals + w.actions + w.matrix > 0);
  const [userSearch, setUserSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const admin = user?.role === "admin",
    manager = MANAGER_ROLES.includes(user?.role || ""),
    canManage = admin || manager;
  // Aktarılanlar süzgecinde yönetici kapalı kayıtları da seçebilir (silmek için).
  const selectableOf = (p: Proposal) =>
    !CLOSED.includes(p.status) || (admin && statusFilter === "__imported");
  const alert = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 7000);
  };
  // Elimizdeki sürüm sunucuya gönderilir; değişiklik yoksa kayıtlar yeniden indirilmez.
  const versionRef = React.useRef(0);
  async function refresh(force = false) {
    const known = force ? 0 : versionRef.current;
    const r = await fetch("/api/state" + (known ? "?v=" + known : ""), {
        cache: "no-store",
      }),
      b: any = await r.json();
    if (!r.ok) throw Error(b.error);
    setUsers(b.users);
    if (b.unchanged) return;
    // Kurumun hedef süreleri gecikme hesaplarına uygulanır (Tanımlar > Hedef süreler).
    applyTargetDays(b.state);
    setState(b.state);
    setVersion(b.version);
    versionRef.current = b.version;
  }
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((b: any) => {
        setUser(b.user);
        setDemo(b.demo !== false);
        setShowcase(Array.isArray(b.showcase) ? b.showcase : null);
        setEdition(b.edition === "ai" ? "ai" : "surec");
        setAltDemo(b.altDemo && typeof b.altDemo.url === "string" ? b.altDemo : null);
        if (!b.demo) setLogin((l) => ({ ...l, username: "" }));
        if (b.error) setError(b.error);
      })
      .catch(() => setError("Bağlantı kurulamadı. Sayfayı yenileyin."))
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    versionRef.current = 0;
    if (user && !user.mustChange)
      refresh(true).catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!user || user.mustChange) return;
    const fn = () => refresh().catch(() => {});
    const id = setInterval(fn, 30000);
    window.addEventListener("focus", fn);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", fn);
    };
  }, [user]);
  // Bağlantı ile gelme: e-postadaki "/?oneri=KZ-…" ya da QR'daki "/?yeni=1&bolum=…&lokasyon=…".
  // Giriş ekranından geçilse de kaybolmasın diye oturum deposunda tutulur, adres çubuğundan silinir.
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has("oneri") || q.has("yeni")) {
        sessionStorage.setItem(
          "ivme-link",
          JSON.stringify({
            oneri: q.get("oneri") || "",
            yeni: q.has("yeni"),
            bolum: q.get("bolum") || "",
            lokasyon: q.get("lokasyon") || "",
          }),
        );
        history.replaceState(null, "", location.pathname);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!state || !user || user.mustChange) return;
    let link: any = null;
    try {
      link = JSON.parse(sessionStorage.getItem("ivme-link") || "null");
      sessionStorage.removeItem("ivme-link");
    } catch {}
    if (!link) return;
    if (link.oneri) {
      const p = state.proposals.find((x) => x.id === link.oneri);
      if (p) openWork(p);
      else alert(link.oneri + " bulunamadı ya da bu öneriyi görme yetkin yok.");
    } else if (link.yeni) {
      const operation = state.operations.includes(link.bolum) ? link.bolum : "";
      const loc = (state.settings?.locations || []).includes(link.lokasyon)
        ? link.lokasyon
        : "";
      setForm((f) => ({
        ...f,
        operation: operation || f.operation,
        location: loc || f.location,
      }));
      navigate("new");
    }
  }, [state, user?.id, user?.mustChange]);
  // Yarım kalan öneri taslağı cihazda kullanıcıya özel saklanır; gönderilince silinir.
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (!user || user.mustChange) return;
    try {
      const raw = localStorage.getItem(draftKey(user.id));
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && (saved.title || saved.problem || saved.solution)) {
        setForm({ ...initialForm, ...saved });
        setDraftRestored(true);
      } else setForm(initialForm);
    } catch {}
  }, [user?.id, user?.mustChange]);
  useEffect(() => {
    if (!user || user.mustChange) return;
    const key = draftKey(user.id);
    const empty = !form.title && !form.problem && !form.solution;
    try {
      if (empty) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(form));
    } catch {
      try {
        localStorage.setItem(key, JSON.stringify({ ...form, attachments: [] }));
      } catch {}
    }
  }, [form, user?.id]);
  function clearDraft() {
    try {
      if (user) localStorage.removeItem(draftKey(user.id));
    } catch {}
    setDraftRestored(false);
  }
  const hasDraft = !!(form.title || form.problem || form.solution);
  async function auth(action: string) {
    setBusy(true);
    setError("");
    try {
      if (action === "password" && pw.password !== pw.confirm)
        throw Error("Yeni şifreler eşleşmiyor.");
      const r = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "password"
              ? { action, ...pw }
              : action === "logout"
                ? { action }
                : action.startsWith("showcase:")
                  ? { action: "showcase", username: action.slice(9) }
                  : login,
          ),
        }),
        b: any = await r.json();
      if (!r.ok) throw Error(b.error);
      setUser(b.user || null);
      setState(null);
      if (action === "logout") {
        setLogin({ username: demo ? "admin" : "", password: "" });
        setPw({ oldPassword: "", password: "", confirm: "" });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function command(
    data: any,
    close = true,
    success?: string | ((b: any) => string),
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, version }),
        }),
        b: any = await r.json();
      if (!r.ok) {
        if (r.status === 409) await refresh(true);
        throw Error(b.error);
      }
      await refresh();
      if (close) setModal(null);
      alert(
        typeof success === "function"
          ? success(b)
          : success || "İşlem kaydedildi.",
      );
      return b;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function open(type: string, data: any = {}) {
    setError("");
    setDraft(data);
    setModal({ type });
  }
  function navigate(p: string) {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (p === "new") setFormStep(1);
    setPage(p);
    setMobile(false);
    setSearch("");
    setStatusFilter("");
    setUnitFilter("");
    setOpFilter("");
    setDeptFilter("");
    setDirFilter("");
    setAuthorFilter("");
    setOwnerFilter("");
    setCatFilter("");
    setLocFilter("");
    setPageNo(1);
    // İşlerim: en uzun bekleyen önce; diğer listeler: en yeni önce.
    setSortBy(
      p === "tasks" ? { key: "wait", dir: -1 } : { key: "created", dir: -1 },
    );
    setFromFilter("");
    setToFilter("");
    setSelected([]);
    setListTab("all");
    setError("");
  }
  const proposals = state?.proposals || [],
    p = proposals.find((x) => x.id === detail),
    active = proposals.filter((p) => !CLOSED.includes(p.status)),
    myTasks = active.filter(
      (p) =>
        p.owner === user?.id ||
        p.actions.some(
          (a) =>
            a.owner === user?.id &&
            !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
        ) ||
        p.support.some(
          (a) =>
            a.owner === user?.id &&
            !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status),
        ),
    );
  const filtered = proposals.filter(
    (p) =>
      (page !== "tasks" || myTasks.some((x) => x.id === p.id)) &&
      (listTab !== "mine" ||
        p.author === user?.id ||
        (p.coAuthors || []).includes(user?.id || "")) &&
      (listTab !== "reviewed" ||
        (p.author !== user?.id &&
          (p.evaluator === user?.id ||
            p.history.some((h) => h.actor === user?.id)))) &&
      (!search ||
        // Arama: başlık, numara, öneren, sorumlu, operasyon, alan ve yer.
        [
          p.title,
          p.id,
          (p as any).legacyNo || "",
          who(p.author),
          who(p.owner),
          p.operation,
          p.category,
          p.location || "",
        ]
          .join(" ")
          .toLocaleLowerCase("tr")
          .includes(search.toLocaleLowerCase("tr"))) &&
      (!statusFilter ||
        (statusFilter === "__late"
          ? overdueDays(p) > 0
          : statusFilter === "__imported"
            ? !!p.legacyNo
            : p.status === statusFilter)) &&
      (!unitFilter || waiting(p).includes(unitFilter)) &&
      (!opFilter || p.operation === opFilter) &&
      (!deptFilter || p.department === deptFilter) &&
      (!dirFilter || p.directorate === dirFilter) &&
      (!authorFilter || p.author === authorFilter) &&
      (!ownerFilter ||
        (p.owner === ownerFilter && !CLOSED.includes(p.status))) &&
      (!catFilter || p.category === catFilter) &&
      (!locFilter || (p.location || "") === locFilter) &&
      (!fromFilter || p.created.slice(0, 10) >= fromFilter) &&
      (!toFilter || p.created.slice(0, 10) <= toFilter),
  );
  // Liste sıralaması ve sayfalama (Raporlar sayfası "filtered" listesini sırasız kullanmaya devam eder).
  const stageRank = (st: string) => {
    const i = STAGES.indexOf(st);
    return i >= 0
      ? i
      : st === "Revizyon bekliyor"
        ? 0.5
        : st === "Kazanç düzeltmesi bekliyor"
          ? 4.5
          : 9;
  };
  const sortValue = (p: Proposal): string | number =>
    ({
      created: p.created,
      id: Number(p.id.split("-").at(-1)) || 0,
      title: p.title.toLocaleLowerCase("tr"),
      author: who(p.author).toLocaleLowerCase("tr"),
      status: stageRank(p.status),
      owner: CLOSED.includes(p.status)
        ? "\uffff"
        : who(p.owner).toLocaleLowerCase("tr"),
      wait: CLOSED.includes(p.status) ? -1 : Date.now() - Date.parse(p.stageAt),
    })[sortBy.key] ?? p.created;
  const sorted = filtered.slice().sort((a, b) => {
    const x = sortValue(a),
      y = sortValue(b);
    return (
      (x < y ? -1 : x > y ? 1 : 0) * sortBy.dir ||
      b.created.localeCompare(a.created)
    );
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(pageNo, pageCount);
  const paged = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeFilterCount = [
    statusFilter,
    unitFilter,
    opFilter,
    deptFilter,
    dirFilter,
    authorFilter,
    ownerFilter,
    catFilter,
    locFilter,
    fromFilter,
    toFilter,
  ].filter(Boolean).length;
  const isEmployee = user?.role === "employee";
  const mine = proposals
    .filter(
      (p) =>
        p.author === user?.id || (p.coAuthors || []).includes(user?.id || ""),
    )
    .sort(
      (a, b) =>
        Number(b.status === "Revizyon bekliyor") -
          Number(a.status === "Revizyon bekliyor") ||
        b.created.localeCompare(a.created),
    );
  const gainProposals = proposals.filter(
      (p) =>
        !["Reddedildi", "İptal edildi"].includes(p.status) &&
        p.gain?.valid &&
        p.gain?.approved,
    ),
    annual = gainProposals
      .filter((p) => p.gain.period === "Yıllık")
      .reduce((a, p) => a + p.gain.amount, 0);
  function openWork(item: Proposal) {
    setCommentText("");
    setDetail(item.id);
    setDetailTab(nextStep(item, user?.id || "").tab);
    setError("");
  }
  function selectDetail(id: string) {
    setCommentText("");
    setDetail(id);
    setDetailTab("summary");
    setError("");
  }
  function showList(status = "", unit = "") {
    navigate("list");
    setStatusFilter(status);
    setUnitFilter(unit);
  }
  function download() {
    const rows = [
      [
        "Öneri no",
        "Başlık",
        "Öneren",
        "Departman",
        "Müdürlük",
        "Bölüm",
        "Durum",
        "Sorumlu",
        "Beklenen birimler",
        "Destek talep no",
        "Kampanya",
        "Anonim",
        "Kazanç",
        "Dönem",
        "Onay",
        "Puan",
        "Ret nedeni",
        "Aşamada geçen gün",
        "Gecikme (gün)",
      ],
      ...filtered.map((p) => [
        p.id,
        p.title,
        who(p.author),
        p.department,
        p.directorate,
        p.operation,
        p.status,
        who(p.owner),
        waiting(p).join(", "),
        supportWaits(p)
          .filter((w) => w.ticket)
          .map((w) => w.unit + ": " + w.ticket)
          .join(", "),
        state?.settings?.campaigns?.find((c) => c.id === p.campaign)?.title ||
          "",
        p.anonymous ? "Evet" : "",
        p.gain?.valid ? p.gain.amount : "",
        p.gain?.period || "",
        p.gain?.approved ? "Onaylı" : "",
        p.score?.valid ? p.score.total : "",
        p.rejectReason || "",
        CLOSED.includes(p.status) ? "" : age(p.stageAt),
        overdueDays(p) || "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (x) =>
                '"' +
                translate(String(x ?? ""))
                  .replace(/"/g, '""')
                  .replace(/^[=+@-]/, "'") +
                '"',
            )
            .join(";"),
        )
        .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = "ivme-oneriler.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function attachments(files: FileList | null) {
    if (!files) return;
    setError("");
    const items: { name: string; data: string }[] = [];
    for (const f of Array.from(files)) {
      const isImage = ["image/png", "image/jpeg", "image/webp"].includes(
        f.type,
      );
      if (!isImage && f.type !== "application/pdf") {
        setError("Yalnızca fotoğraf (PNG, JPG, WebP) veya PDF eklenebilir.");
        return;
      }
      if (!isImage && f.size > MAX_ATTACHMENT) {
        setError(
          "PDF dosyası en fazla 500 KB olabilir. Daha küçük bir PDF seç veya sayfanın fotoğrafını ekle.",
        );
        return;
      }
      if (isImage && f.size > 25_000_000) {
        setError(
          "Fotoğraf çok büyük (25 MB üstü). Telefon kamerasıyla yeniden çekmeyi dene.",
        );
        return;
      }
      try {
        // Telefon fotoğrafları birkaç MB olduğu için tarayıcıda küçültülür ve 500 KB altına indirilir.
        const data = isImage ? await shrinkImage(f) : await readAsDataUrl(f);
        const name = isImage
          ? f.name.replace(/\.(png|jpe?g|webp)$/i, "") + ".jpg"
          : f.name;
        items.push({ name, data });
      } catch {
        setError("Dosya okunamadı. Başka bir dosya dene.");
        return;
      }
    }
    setForm((form) => ({
      ...form,
      attachments: [...form.attachments, ...items].slice(0, 3),
    }));
  }
  // Kişi seçimleri yazdıkça süzülen listeyle yapılır (ad · departman · rol).
  const userSelect = (
    value: string,
    onChange: (v: string) => void,
    optional = false,
  ) => (
    <PersonPicker
      users={sortedUsers}
      value={value || ""}
      onChange={onChange}
      required={!optional}
    />
  );
  if (boot)
    return (
      // Sunucu bu ekranı Türkçe çizer; tarayıcı seçili dile çevirir (lib/i18n.ts). Fark beklenen bir durumdur.
      <div className="loading" suppressHydrationWarning>
        <LoaderCircle className="spin" />
        İvme açılıyor…
      </div>
    );
  if (!user)
    return (
      <main className="login-wrap">
        <LanguageSwitch className="login-lang" />
        <section className="login-story">
          <div className="brand">
            <span className="brand-mark">
              <ChartNoAxesCombined />
            </span>
            ivme<span className="brand-dot">.</span>
          </div>
          <span className="eyebrow">ÖNERİ VE KAİZEN MERKEZİ</span>
          <h1>
            Küçük bir fikir.
            <br />
            <em>Büyük bir değişim.</em>
          </h1>
          <p>
            Sahayı en iyi sen tanıyorsun. İyileştirmeyi başlat,
            <br />
            fikrinin yarattığı etkiyi birlikte büyütelim.
          </p>
          <div className="story-flow">
            Fikir <ArrowRight size={16} /> Aksiyon <ArrowRight size={16} />{" "}
            Kazanım
          </div>
          <div className="story-note">
            <ShieldCheck size={18} /> Öneriden sonuca tek akış · Telefondan ve
            masaüstünden
          </div>
        </section>
        <section className="login-form">
          <h1 className="sr-only">İvme · Öneri ve Kaizen Merkezi girişi</h1>
          <div className="mobile-brand">ivme.</div>
          {showcase && (
            <div className="showcase-login">
              <span className="eyebrow">CANLI DEMO</span>
              <h2>Bir rol seç, hemen dene</h2>
              <p>
                Örnek bir şirketin 120 önerisiyle çalışan gerçek uygulama. Şifre
                gerekmez; veriler her gece sıfırlanır, e-posta gönderilmez.
              </p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <ul className="showcase-roles">
                {showcase.map((r) => (
                  <li key={r.username}>
                    <button
                      disabled={busy}
                      onClick={() => auth("showcase:" + r.username)}
                    >
                      <b>{r.label}</b>
                      <small>{r.hint}</small>
                      <ArrowRight size={17} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <small className="login-foot">
                Bu demo bir portföy çalışmasıdır · ysfdurak.com
              </small>
              {altDemo && (
                <small className="login-foot alt-demo">
                  <a href={altDemo.url} lang={altDemo.lang}>
                    {altDemo.label}
                  </a>
                </small>
              )}
            </div>
          )}
          {!showcase && (
            <>
              <span className="eyebrow">BİRLİKTE DAHA İYİYE</span>
              <h2>Hoş geldin</h2>
              <p>Önerilerini ve çalışmalarını takip etmek için giriş yap.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  auth("login");
                }}
              >
                <Field label="Kullanıcı adı">
                  <input
                    autoComplete="username"
                    value={login.username}
                    onChange={(e) =>
                      setLogin({ ...login, username: e.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Şifre">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={login.password}
                    onChange={(e) =>
                      setLogin({ ...login, password: e.target.value })
                    }
                    required
                    placeholder="Şifreni gir"
                  />
                </Field>
                {error && <div className="error">{error}</div>}
                <button className="primary full" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <>
                      Giriş yap <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              {demo && (
                <div className="demo-box">
                  <b>Çalışan demo</b>
                  <p>
                    Başlangıç şifresi: <code>Kaizen123!</code>
                    <br />
                    İlk girişte değiştirmen istenir.
                  </p>
                  <label>
                    Denemek istediğin rol
                    <select
                      value={login.username}
                      onChange={(e) =>
                        setLogin({ ...login, username: e.target.value })
                      }
                    >
                      {[
                        ["admin", "Yönetici · tüm akış"],
                        ["calisan", "Öneri veren"],
                        ["on.degerlendirme", "Ön değerlendirme"],
                        ["operasyon", "Bölüm sorumlusu"],
                        ["kazanc", "Kazanç girişi"],
                        ["mudur", "Müdür onayı"],
                        ["puanlama", "Puanlama"],
                        ["it", "IT desteği"],
                        ["teknik", "Teknik İşler"],
                      ].map(([v, t]) => (
                        <option key={v} value={v}>
                          {t} ({v})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <small className="login-foot">
                <Smartphone size={15} /> Telefonda öner · <Monitor size={15} />{" "}
                Masaüstünde yönet
              </small>
            </>
          )}
        </section>
      </main>
    );
  if (user.mustChange)
    return (
      <div className="password-page">
        <div className="password-card">
          <span className="brand-mark">
            <ShieldCheck />
          </span>
          <h2>Şifreni kişiselleştir</h2>
          <p>
            Merhaba {user.name}. İlk girişini tamamlamak için başlangıç şifreni
            değiştir.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              auth("password");
            }}
          >
            <Field label="Mevcut şifre">
              <input
                type="password"
                autoComplete="current-password"
                value={pw.oldPassword}
                onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })}
                required
              />
            </Field>
            <Field
              label="Yeni şifre"
              hint="En az 10 karakter; başlangıç şifresinden farklı olmalı."
            >
              <input
                type="password"
                minLength={10}
                autoComplete="new-password"
                value={pw.password}
                onChange={(e) => setPw({ ...pw, password: e.target.value })}
                required
              />
            </Field>
            <Field label="Yeni şifre tekrar">
              <input
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                required
              />
            </Field>
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              Şifremi değiştir ve devam et <ArrowRight size={17} />
            </button>
          </form>
          <button className="text-button" onClick={() => auth("logout")}>
            Girişe dön
          </button>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside
        className={"sidebar " + (mobile ? "mobile-open" : "")}
        aria-label="Ana menü"
        inert={!!detail || !!modal}
      >
        <div className="brand">
          <span className="brand-mark">
            <ChartNoAxesCombined />
          </span>
          ivme<span className="brand-dot">.</span>
          <button
            className="icon-button close-nav"
            onClick={() => setMobile(false)}
            aria-label="Menüyü kapat"
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={17} />
          </span>
          <div>
            <b>{orgName}</b>
            <small>Öneri & Kaizen Merkezi</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-caption">MENÜ</span>
        <nav>
          {NAV.filter(
            ([id]) =>
              (admin || !["matrix", "users", "definitions"].includes(id)) &&
              (canManage || id !== "dashboard") &&
              (id !== "recognition" ||
                state?.settings?.recognition !== false) &&
              (id !== "rewards" ||
                ((admin || user.role === "reward") &&
                  (!!state?.settings?.rewards?.enabled ||
                    (state?.rewards || []).length > 0))),
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === "tasks" && myTasks.length > 0 && (
                <span className="nav-count">{myTasks.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button className="sidebar-new" onClick={() => navigate("new")}>
          <Plus size={19} /> Yeni öneri oluştur
        </button>
        <div className="sidebar-bottom">
          <div className="pilot-label">
            <i />{" "}
            {showcase
              ? "Canlı demo · her gece sıfırlanır"
              : demo
                ? orgName + " pilot sürümü"
                : orgName}
          </div>
          <div className="profile">
            <Avatar name={user.name} />
            <div>
              <b>{user.name}</b>
              <small>{ROLES[user.role]}</small>
            </div>
            <button
              aria-label="Bildirim tercihim"
              title="Bildirim tercihim"
              className="icon-button"
              onClick={() =>
                open("prefs", { notify: user.notify || "instant" })
              }
            >
              <Bell size={17} />
            </button>
            <button
              aria-label="Çıkış yap"
              title="Çıkış yap"
              className="icon-button"
              onClick={() => auth("logout")}
            >
              <LogOut size={17} />
            </button>
          </div>
          <LanguageSwitch className="side-lang" />
        </div>
      </aside>
      {mobile && (
        <div className="nav-backdrop" onClick={() => setMobile(false)} />
      )}
      <main className="main" inert={!!detail || !!modal}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menüyü aç"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            {orgName} <ChevronRight size={14} />
            <span>
              {page === "new"
                ? "Yeni öneri"
                : NAV.find((x) => x[0] === page)?.[1]}
            </span>
          </div>
          <div className="topbar-right">
            <span className="sync">
              <i /> Güncel
            </span>
            <span className="header-date">
              {new Date().toLocaleDateString(intlLocale(), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <Avatar name={user.name} small />
          </div>
        </header>
        {!state ? (
          <div className="loading">
            {error ? (
              <>
                <p>{error}</p>
                <button
                  onClick={() => refresh().catch((e) => setError(e.message))}
                >
                  Tekrar dene
                </button>
              </>
            ) : (
              <>
                <LoaderCircle className="spin" />
                Veriler yükleniyor…
              </>
            )}
          </div>
        ) : (
          <div
            className={
              "content " + (page === "overview" ? "overview-content" : "")
            }
          >
            {error && !modal && page !== "new" && (
              <div className="error global-error" role="alert">
                <AlertCircle size={18} />
                {error}
                <button
                  aria-label="Hata mesajını kapat"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "overview" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="welcome-label">
                      <span className="live-dot" /> Çalışma merkezim
                    </div>
                    <h1>
                      Merhaba, {user.name.split(" ")[0]}{" "}
                      <span className="wave">✦</span>
                    </h1>
                    <p>Önerilerini ilerlet, ekibinle birlikte iyileştir.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      setFormStep(1);
                      navigate("new");
                    }}
                  >
                    <Plus size={20} /> Öneri ver
                  </button>
                </div>
                {showcase && (
                  <DemoGuide role={user.role} onNavigate={navigate} />
                )}
                {admin && strandedUsers.length > 0 && (
                  <button
                    className="draft-resume stranded-alert"
                    onClick={() => navigate("users")}
                  >
                    <span className="metric-icon pale-orange">
                      <AlertCircle size={20} />
                    </span>
                    <div>
                      <b>
                        {strandedUsers.reduce(
                          (a, x) => a + x.w.proposals + x.w.actions,
                          0,
                        )}{" "}
                        açık iş pasif kullanıcıların üzerinde bekliyor
                      </b>
                      <small>
                        {strandedUsers.map((x) => x.u.name).join(", ")} ·
                        Kullanıcılar sayfasından devredebilirsin
                      </small>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                )}
                {hasDraft && (
                  <button
                    className="draft-resume"
                    onClick={() => navigate("new")}
                  >
                    <span className="metric-icon pale-orange">
                      <FileText size={20} />
                    </span>
                    <div>
                      <b>Yarım kalan önerin var</b>
                      <small>
                        {form.title || "Başlıksız taslak"} · Kaldığın yerden
                        devam et
                      </small>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                )}
                {isEmployee && (
                  <section className="panel my-proposals">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">ÖNERİLERİM</span>
                        <h2>Önerilerin nerede?</h2>
                      </div>
                      {mine.length > 0 && (
                        <button
                          className="text-button"
                          onClick={() => {
                            navigate("list");
                            setListTab("mine");
                          }}
                        >
                          Tümünü gör <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                    {mine.length === 0 ? (
                      <div className="empty">
                        <span className="empty-circle">
                          <Lightbulb size={28} />
                        </span>
                        <h3>Henüz önerin yok</h3>
                        <p>
                          Sahada gördüğün bir sorunu 3 kısa adımda öneriye
                          dönüştürebilirsin.
                        </p>
                      </div>
                    ) : (
                      <ul className="my-list">
                        {mine.slice(0, 5).map((item) => {
                          const prog = progressOf(item);
                          return (
                            <li
                              key={item.id}
                              className={
                                item.status === "Revizyon bekliyor"
                                  ? "needs-me"
                                  : ""
                              }
                            >
                              <div className="queue-meta">
                                <span>{item.id}</span>
                                <span>{item.operation}</span>
                              </div>
                              <button
                                className="queue-title"
                                onClick={() => openWork(item)}
                              >
                                {item.title}
                              </button>
                              <div
                                className={"mini-progress " + prog.tone}
                                role="progressbar"
                                aria-label={item.title + " ilerlemesi"}
                                aria-valuemin={0}
                                aria-valuemax={STAGES.length}
                                aria-valuenow={prog.step}
                                aria-valuetext={prog.label}
                              >
                                <i
                                  style={{
                                    width:
                                      (prog.step / STAGES.length) * 100 + "%",
                                  }}
                                />
                              </div>
                              <div className="my-status">
                                <Badge status={item.status} />
                                <span>{prog.label}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                )}
                <div className="kpi-grid">
                  <button className="kpi" onClick={() => showList()}>
                    <span className="metric-icon pale">
                      <Lightbulb size={20} />
                    </span>
                    <div>
                      <span>{isEmployee ? "Önerilerim" : "Toplam öneri"}</span>
                      <strong>
                        {isEmployee ? mine.length : proposals.length}
                      </strong>
                    </div>
                    <footer>
                      {isEmployee
                        ? "Verdiğin tüm öneriler"
                        : "Yetkin kapsamındaki kayıtlar"}{" "}
                      <ArrowUpRight size={16} />
                    </footer>
                  </button>
                  <button className="kpi" onClick={() => navigate("tasks")}>
                    <span className="metric-icon pale-orange">
                      <Clock size={20} />
                    </span>
                    <div>
                      <span>Beni bekliyor</span>
                      <strong>{myTasks.length}</strong>
                    </div>
                    <footer>
                      İşlem yapman gereken öneriler <ArrowUpRight size={16} />
                    </footer>
                  </button>
                  <button
                    className="kpi"
                    onClick={() => showList("Tamamlandı")}
                  >
                    <span className="metric-icon pale-blue">
                      <CheckCheck size={20} />
                    </span>
                    <div>
                      <span>Tamamlanan</span>
                      <strong>
                        {
                          (isEmployee ? mine : proposals).filter(
                            (p) => p.status === "Tamamlandı",
                          ).length
                        }
                      </strong>
                    </div>
                    <footer>
                      Hayata geçen iyileştirmeler <ArrowUpRight size={16} />
                    </footer>
                  </button>
                  <button
                    className="kpi featured"
                    onClick={() => navigate("reports")}
                  >
                    <span className="metric-icon">
                      <TrendingUp size={20} />
                    </span>
                    <div>
                      <span>Yıllık onaylı kazanç</span>
                      <strong>{money(annual)}</strong>
                    </div>
                    <footer>
                      Brüt tutar · yıllık dönem <ArrowUpRight size={16} />
                    </footer>
                  </button>
                </div>
                <div
                  className={
                    "work-dashboard " + (isEmployee ? "employee-dashboard" : "")
                  }
                >
                  <section className="panel queue-panel">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">SIRADAKİ ADIM</span>
                        <h2>İlerlemeyi bekleyen işler</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          navigate(queueScope === "mine" ? "tasks" : "list")
                        }
                      >
                        Tümünü gör <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="queue-controls">
                      <div className="segmented">
                        <button
                          className={
                            !canManage || queueScope === "mine" ? "active" : ""
                          }
                          onClick={() => setQueueScope("mine")}
                        >
                          Benim işlerim <span>{myTasks.length}</span>
                        </button>
                        {canManage && (
                          <button
                            className={queueScope === "team" ? "active" : ""}
                            onClick={() => setQueueScope("team")}
                          >
                            Ekibin işleri <span>{active.length}</span>
                          </button>
                        )}
                      </div>
                      <span className="sort-hint">
                        <Clock size={14} /> En uzun bekleyen önce
                      </span>
                    </div>
                    <div className="work-queue">
                      {(canManage && queueScope === "team" ? active : myTasks)
                        .slice()
                        .sort((a, b) => a.stageAt.localeCompare(b.stageAt))
                        .slice(0, 4)
                        .map((item) => {
                          const step = nextStep(item, user.id);
                          return (
                            <article className="queue-item" key={item.id}>
                              <div
                                className={
                                  "queue-symbol " +
                                  (item.status.includes("Kazanç")
                                    ? "amber"
                                    : item.status === "Uygulamada"
                                      ? "blue"
                                      : "violet")
                                }
                              >
                                {item.status.includes("Kazanç") ? (
                                  <TrendingUp size={21} />
                                ) : item.status === "Uygulamada" ? (
                                  <ListChecks size={21} />
                                ) : (
                                  <FileText size={21} />
                                )}
                              </div>
                              <div className="queue-content">
                                <div className="queue-meta">
                                  <span>{item.id}</span>
                                  <span>{item.operation}</span>
                                </div>
                                <button
                                  className="queue-title"
                                  onClick={() => openWork(item)}
                                >
                                  {item.title}
                                </button>
                                <div className="queue-step">
                                  <span className="step-caption">
                                    {step.title}
                                  </span>
                                  <span className="quiet-dot">·</span>
                                  <span>{who(item.owner)}</span>
                                </div>
                              </div>
                              <div className="queue-side">
                                <span
                                  className={
                                    "age-label " +
                                    (overdueDays(item) ? "long-wait" : "")
                                  }
                                >
                                  <StageAge p={item} suffix="gündür bekliyor" />
                                </span>
                                <button
                                  className="queue-cta"
                                  onClick={() => openWork(item)}
                                >
                                  İncele <ArrowRight size={15} />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      {(canManage && queueScope === "team" ? active : myTasks)
                        .length === 0 && (
                        <div className="empty">
                          <span className="empty-circle">
                            <CheckCheck size={28} />
                          </span>
                          <h3>Bekleyen işin yok</h3>
                          <p>
                            Yeni bir öneri verebilir veya önerilerinin durumunu
                            takip edebilirsin.
                          </p>
                          <button
                            className="secondary"
                            onClick={() => {
                              navigate("list");
                              setListTab("mine");
                            }}
                          >
                            Önerilerime git <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                  <aside
                    className="dashboard-aside"
                    aria-label="Destek ve öneri kısayolları"
                  >
                    {!isEmployee && (
                      <section className="panel waiting-panel">
                        <div className="section-heading">
                          <div>
                            <span className="section-kicker">
                              BAĞIMLILIKLAR
                            </span>
                            <h2>Hangi birimi bekliyoruz?</h2>
                          </div>
                        </div>
                        {state.units.map((unit, i) => {
                          const count = active.filter((p) =>
                            waiting(p).includes(unit),
                          ).length;
                          return (
                            <button
                              className="waiting-row"
                              key={unit}
                              onClick={() => showList("", unit)}
                            >
                              <span className={"unit-icon unit-" + i}>
                                {unit === "IT" ? (
                                  <Monitor size={20} />
                                ) : unit === "Teknik İşler" ? (
                                  <Settings2 size={20} />
                                ) : (
                                  <Building2 size={20} />
                                )}
                              </span>
                              <div>
                                <b>{unit}</b>
                                <small>
                                  {count
                                    ? count +
                                      " öneri bu birimin desteğini bekliyor"
                                    : "Bekleyen öneri yok"}
                                </small>
                              </div>
                              <strong>{count}</strong>
                              <ChevronRight size={16} />
                            </button>
                          );
                        })}
                        <div className="waiting-total">
                          <span className="live-dot amber" />
                          <b>
                            {active.filter((p) => waiting(p).length).length}{" "}
                            farklı öneri
                          </b>
                          <span>destek bekliyor</span>
                        </div>
                        <p className="waiting-note">
                          Bir öneri birden fazla birimi bekleyebilir.
                        </p>
                      </section>
                    )}
                    <button
                      className="idea-prompt"
                      onClick={() => {
                        setFormStep(1);
                        navigate("new");
                      }}
                    >
                      <span className="idea-orbit">
                        <Lightbulb size={25} />
                      </span>
                      <div>
                        <h3>Bir şey daha iyi olabilir mi?</h3>
                        <p>Gördüğün bir sorunu öneriye dönüştür.</p>
                      </div>
                      <ArrowUpRight size={22} />
                    </button>
                  </aside>
                </div>
                {!isEmployee && (
                  <section className="panel pipeline-panel">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">SÜREÇ GÖRÜNÜMÜ</span>
                        <h2>Öneriler hangi aşamada?</h2>
                      </div>
                      <span className="subtle-tag">
                        {active.length} açık öneri
                      </span>
                    </div>
                    <div className="pipeline-grid">
                      {[
                        ...STAGES.slice(0, 7),
                        "Revizyon bekliyor",
                        "Kazanç düzeltmesi bekliyor",
                      ].map((st, i) => {
                        const count = active.filter(
                          (p) => p.status === st,
                        ).length;
                        return (
                          <button key={st} onClick={() => showList(st)}>
                            <span className={"pipeline-dot tone-" + i} />
                            <span>{st}</span>
                            <b>{count}</b>
                            <ChevronRight size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
                <div className="bottom-note">
                  <ShieldCheck size={15} /> Yetkin kapsamındaki kayıtlar
                  gösterilir. Örnek kayıtlar demo verisidir.
                </div>
              </>
            )}
            {(page === "list" || page === "tasks") && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">FİKİRDEN SONUCA</span>
                    <h1>
                      {page === "tasks" ? "İşlerim" : "Öneriler"}
                      <span className="mint-dot">.</span>
                    </h1>
                    <p>
                      {page === "tasks"
                        ? "Senden işlem bekleyen öneriler, aksiyonlar ve destek işleri. En uzun bekleyen en üstte."
                        : "Görebildiğin tüm öneriler: aşama, sorumlu ve bekleyen birimlerle."}
                    </p>
                  </div>
                  <div className="buttons">
                    <button className="secondary" onClick={download}>
                      <Download size={17} /> Dışa aktar
                    </button>
                    <button className="primary" onClick={() => navigate("new")}>
                      <Plus size={18} /> Yeni öneri
                    </button>
                  </div>
                </div>
                <div
                  className="list-counts"
                  role="group"
                  aria-label="Duruma göre hızlı filtre"
                >
                  {(() => {
                    // Sayaçlar sayfanın kendi kayıtlarından hesaplanır: İşlerim'de yalnızca senden bekleyen işler.
                    const base = page === "tasks" ? myTasks : proposals;
                    const chips: [string, string][] =
                      page === "tasks"
                        ? [
                            ["", "Tüm işlerim"],
                            ...[
                              ...STAGES.slice(0, 7),
                              "Revizyon bekliyor",
                              "Kazanç düzeltmesi bekliyor",
                            ]
                              .filter((st) => base.some((p) => p.status === st))
                              .map((st) => [st, st] as [string, string]),
                            ["__late", "Geciken"],
                          ]
                        : [
                            ["", "Tüm öneriler"],
                            ["Ön değerlendirme", "Ön değerlendirme"],
                            ["Bölüm değerlendirmesi", "Bölüm değerlendirmesi"],
                            ["Uygulamada", "Uygulamada"],
                            ["Kazanç onayı", "Kazanç onayı"],
                            ["Tamamlandı", "Tamamlandı"],
                            ["Reddedildi", "Reddedildi"],
                            [NOT_IMPLEMENTED, NOT_IMPLEMENTED],
                            ["__late", "Geciken"],
                          ];
                    return chips.map(([v, l]) => (
                      <button
                        key={l}
                        aria-pressed={statusFilter === v}
                        className={statusFilter === v ? "selected" : ""}
                        onClick={() => setStatusFilter(v)}
                      >
                        {l}
                        <strong>
                          {
                            base.filter((p) =>
                              v === "__late"
                                ? overdueDays(p) > 0
                                : !v || p.status === v,
                            ).length
                          }
                        </strong>
                      </button>
                    ));
                  })()}
                </div>
                {ownerFilter && (
                  <div className="info-strip filter-chip">
                    Sorumlusu <b>{who(ownerFilter)}</b> olan açık öneriler
                    <button
                      aria-label="Sorumlu filtresini kaldır"
                      onClick={() => setOwnerFilter("")}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                <section className="panel list-panel">
                  <div className="list-toolbar">
                    {page === "tasks" ? (
                      <h2 className="list-title">Senden bekleyenler</h2>
                    ) : (
                      <div
                        className="tabs"
                        role="tablist"
                        aria-label="Öneri kapsamı"
                      >
                        <button
                          role="tab"
                          aria-selected={listTab === "all"}
                          className={listTab === "all" ? "active" : ""}
                          onClick={() => setListTab("all")}
                        >
                          Tümü
                        </button>
                        <button
                          role="tab"
                          aria-selected={listTab === "mine"}
                          className={listTab === "mine" ? "active" : ""}
                          onClick={() => setListTab("mine")}
                        >
                          Önerilerim
                        </button>
                        {!isEmployee && (
                          <button
                            role="tab"
                            aria-selected={listTab === "reviewed"}
                            className={listTab === "reviewed" ? "active" : ""}
                            onClick={() => setListTab("reviewed")}
                          >
                            İşlem yaptıklarım
                          </button>
                        )}
                      </div>
                    )}
                    <div className="buttons">
                      <div className="search">
                        <Search size={17} />
                        <input
                          aria-label="Öneri ara"
                          placeholder="Öneri, numara veya kişi ara…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <label className="sort-select">
                        <span className="sr-only">Sırala</span>
                        <select
                          value={sortBy.key + ":" + sortBy.dir}
                          onChange={(e) => {
                            const [key, dir] = e.target.value.split(":");
                            setSortBy({ key, dir: Number(dir) as 1 | -1 });
                          }}
                        >
                          <option value="created:-1">En yeni önce</option>
                          <option value="created:1">En eski önce</option>
                          <option value="wait:-1">En uzun bekleyen önce</option>
                          <option value="status:1">Aşamaya göre</option>
                          <option value="owner:1">Sorumluya göre (A–Z)</option>
                          <option value="author:1">Önerene göre (A–Z)</option>
                          <option value="id:1">Numaraya göre</option>
                          <option value="title:1">Başlığa göre (A–Z)</option>
                        </select>
                      </label>
                      <button
                        className={"secondary " + (filters ? "pressed" : "")}
                        onClick={() => setFilters(!filters)}
                      >
                        <SlidersHorizontal size={17} /> Filtreler
                        {activeFilterCount > 0 && (
                          <span className="filter-count">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  {filters && (
                    <div className="filters">
                      <Field label="Durum">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="">Tüm durumlar</option>
                          <option value="__late">Hedef süreyi aşanlar</option>
                          {state.proposals.some((p) => p.legacyNo) && (
                            <option value="__imported">
                              Eski sistemden aktarılanlar
                            </option>
                          )}
                          {[
                            ...STAGES,
                            "Revizyon bekliyor",
                            "Kazanç düzeltmesi bekliyor",
                            "Reddedildi",
                            NOT_IMPLEMENTED,
                            "İptal edildi",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Beklenen birim">
                        <select
                          value={unitFilter}
                          onChange={(e) => setUnitFilter(e.target.value)}
                        >
                          <option value="">Tüm birimler</option>
                          {state.units.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Bölüm">
                        <select
                          value={opFilter}
                          onChange={(e) => setOpFilter(e.target.value)}
                        >
                          <option value="">Tüm bölümler</option>
                          {state.operations.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      {(state.settings?.locations || []).length > 0 && (
                        <Field label="Lokasyon">
                          <select
                            value={locFilter}
                            onChange={(e) => setLocFilter(e.target.value)}
                          >
                            <option value="">Tüm lokasyonlar</option>
                            {state.settings!.locations!.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="İyileştirme alanı">
                        <select
                          value={catFilter}
                          onChange={(e) => setCatFilter(e.target.value)}
                        >
                          <option value="">Tüm alanlar</option>
                          {listOf(state, "categories").map((x) => (
                            <option key={x.id}>{x.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Önerenin departmanı">
                        <select
                          value={deptFilter}
                          onChange={(e) => setDeptFilter(e.target.value)}
                        >
                          <option value="">Tüm departmanlar</option>
                          {[...new Set(proposals.map((p) => p.department))]
                            .sort((a, b) => a.localeCompare(b, "tr"))
                            .map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Önerenin müdürlüğü">
                        <select
                          value={dirFilter}
                          onChange={(e) => setDirFilter(e.target.value)}
                        >
                          <option value="">Tüm müdürlükler</option>
                          {[...new Set(proposals.map((p) => p.directorate))]
                            .sort((a, b) => a.localeCompare(b, "tr"))
                            .map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Öneren">
                        <select
                          value={authorFilter}
                          onChange={(e) => setAuthorFilter(e.target.value)}
                        >
                          <option value="">Tüm kişiler</option>
                          {sortedUsers
                            .filter((x) =>
                              proposals.some((p) => p.author === x.id),
                            )
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {personLabel(x)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Sorumlu (açık işler)">
                        <select
                          value={ownerFilter}
                          onChange={(e) => setOwnerFilter(e.target.value)}
                        >
                          <option value="">Tüm sorumlular</option>
                          {sortedUsers
                            .filter((x) =>
                              proposals.some(
                                (p) =>
                                  p.owner === x.id &&
                                  !CLOSED.includes(p.status),
                              ),
                            )
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {personLabel(x)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Gönderim başlangıcı">
                        <input
                          type="date"
                          value={fromFilter}
                          onChange={(e) => setFromFilter(e.target.value)}
                        />
                      </Field>
                      <Field label="Gönderim bitişi">
                        <input
                          type="date"
                          value={toFilter}
                          onChange={(e) => setToFilter(e.target.value)}
                        />
                      </Field>
                      <button
                        className="text-button"
                        onClick={() => {
                          setStatusFilter("");
                          setUnitFilter("");
                          setOpFilter("");
                          setDeptFilter("");
                          setDirFilter("");
                          setAuthorFilter("");
                          setOwnerFilter("");
                          setCatFilter("");
                          setLocFilter("");
                          setFromFilter("");
                          setToFilter("");
                        }}
                      >
                        Filtreleri temizle
                      </button>
                    </div>
                  )}
                  {(statusFilter || unitFilter) && (
                    <div className="applied-filters">
                      {statusFilter && (
                        <span>
                          {statusFilter === "__late"
                            ? "Hedef süreyi aşanlar"
                            : statusFilter === "__imported"
                              ? "Eski sistemden aktarılanlar"
                              : statusFilter}
                          <button
                            aria-label="Durum süzgecini kaldır"
                            onClick={() => setStatusFilter("")}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      )}
                      {unitFilter && (
                        <span>
                          {unitFilter} bekliyor
                          <button onClick={() => setUnitFilter("")}>
                            <X size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  {selected.length > 0 && canManage && (
                    <div className="selection-bar">
                      <b>{selected.length} öneri seçildi</b>
                      {selected.every((id) => {
                        const p = state.proposals.find((x) => x.id === id);
                        return p && !CLOSED.includes(p.status);
                      }) && (
                        <button
                          onClick={() =>
                            open("bulkTransfer", { owner: "", reason: "" })
                          }
                        >
                          Seçili işleri devret <ArrowRight size={16} />
                        </button>
                      )}
                      {admin && statusFilter === "__imported" && (
                        <button
                          className="danger-text"
                          onClick={() =>
                            open("deleteImported", {
                              items: state.proposals.filter((p) =>
                                selected.includes(p.id),
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} /> Seçilenleri sil
                        </button>
                      )}
                      <button onClick={() => setSelected([])}>Vazgeç</button>
                    </div>
                  )}
                  {renderTable(paged, true)}
                  <div className="table-footer pager">
                    <span>
                      {sorted.length
                        ? (currentPage - 1) * pageSize +
                          1 +
                          "–" +
                          Math.min(currentPage * pageSize, sorted.length) +
                          " / " +
                          sorted.length +
                          " öneri"
                        : "0 öneri"}
                    </span>
                    <div className="pager-controls">
                      <label>
                        <span className="sr-only">Sayfa başına kayıt</span>
                        <select
                          aria-label="Sayfa başına kayıt"
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                          {[25, 50, 100].map((n) => (
                            <option key={n} value={n}>
                              {n} / sayfa
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary"
                        disabled={currentPage <= 1}
                        onClick={() => {
                          setPageNo(currentPage - 1);
                          window.scrollTo({ top: 0, behavior: "instant" });
                        }}
                      >
                        <ArrowLeft size={15} /> Önceki
                      </button>
                      <span aria-live="polite">
                        Sayfa {currentPage} / {pageCount}
                      </span>
                      <button
                        className="secondary"
                        disabled={currentPage >= pageCount}
                        onClick={() => {
                          setPageNo(currentPage + 1);
                          window.scrollTo({ top: 0, behavior: "instant" });
                        }}
                      >
                        Sonraki <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
            {page === "new" && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="welcome-label">YENİ ÖNERİ</div>
                    <h1>İyileştirme seninle başlar.</h1>
                    <p>Üç kısa adımda fikrini paylaş.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => navigate("overview")}
                  >
                    <X size={17} /> Kapat
                  </button>
                </div>
                <div className="new-grid">
                  <form
                    className="panel proposal-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (formStep < 3) {
                        setFormStep(formStep + 1);
                        return;
                      }
                      const pre = who(
                        state.matrix.find((r) => r.operation === form.operation)
                          ?.pre || "",
                      );
                      const result = await command(
                        { action: "create", ...form },
                        true,
                        (b) =>
                          b.id +
                          " numaralı önerin gönderildi. Ön değerlendirme için " +
                          pre +
                          " kişisine iletildi.",
                      );
                      if (result) {
                        clearDraft();
                        setForm(initialForm);
                        setFormStep(1);
                        navigate("list");
                        if (result.id) selectDetail(result.id);
                      }
                    }}
                  >
                    <div className="wizard-steps">
                      {["Sorunu anlat", "Çözümünü paylaş", "Kontrol et"].map(
                        (label, i) => (
                          <button
                            type="button"
                            key={label}
                            disabled={i + 1 > formStep}
                            className={
                              formStep === i + 1
                                ? "current"
                                : formStep > i + 1
                                  ? "completed"
                                  : ""
                            }
                            onClick={() => setFormStep(i + 1)}
                          >
                            <span>
                              {formStep > i + 1 ? <Check size={16} /> : i + 1}
                            </span>
                            <b>{label}</b>
                          </button>
                        ),
                      )}
                    </div>
                    <div className="wizard-body">
                      {draftRestored && hasDraft && formStep === 1 && (
                        <div className="draft-note" role="status">
                          <FileText size={17} />
                          <span>Yarım kalan önerin geri yüklendi.</span>
                          <button
                            type="button"
                            onClick={() => {
                              clearDraft();
                              setForm(initialForm);
                            }}
                          >
                            Temizle ve baştan başla
                          </button>
                        </div>
                      )}
                      {formStep === 1 && (
                        <>
                          <div className="wizard-intro">
                            <span className="form-icon">
                              <Search size={25} />
                            </span>
                            <h2>Neyi iyileştirebiliriz?</h2>
                            <p>
                              Gördüğün sorunu, hiç bilmeyen birine anlatır gibi
                              yaz.
                            </p>
                          </div>
                          {activeCampaigns(state?.settings?.campaigns).length >
                            0 && (
                            <div className="campaign-box">
                              <Megaphone size={20} aria-hidden />
                              <div>
                                {activeCampaigns(
                                  state?.settings?.campaigns,
                                ).map((c) => (
                                  <p key={c.id}>
                                    <b>{c.title}</b> ·{" "}
                                    {c.end.split("-").reverse().join(".")}{" "}
                                    tarihine kadar
                                    {c.description && <> · {c.description}</>}
                                    {c.reward && <> · Ödül: {c.reward}</>}
                                  </p>
                                ))}
                                <Field label="Kampanyaya katıl">
                                  <select
                                    value={form.campaign || ""}
                                    onChange={(e) => {
                                      const c = activeCampaigns(
                                        state?.settings?.campaigns,
                                      ).find((x) => x.id === e.target.value);
                                      setForm({
                                        ...form,
                                        campaign: e.target.value,
                                        category: c?.category || form.category,
                                        operation:
                                          c?.operation || form.operation,
                                      });
                                    }}
                                  >
                                    <option value="">Kampanya dışı</option>
                                    {activeCampaigns(
                                      state?.settings?.campaigns,
                                    ).map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.title}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                              </div>
                            </div>
                          )}
                          <Field label="Önerine bir başlık ver *">
                            <input
                              required
                              minLength={5}
                              maxLength={200}
                              placeholder="Örn. Sevkiyatta yanlış etiketlerin önlenmesi"
                              value={form.title}
                              onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                              }
                            />
                          </Field>
                          <div className="two-col">
                            <Field label="Öneri hangi bölüme? *">
                              <select
                                required
                                value={form.operation}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    operation: e.target.value,
                                  })
                                }
                              >
                                <option value="" disabled>
                                  Bölüm seç
                                </option>
                                {state.operations.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="İyileştirme alanı *">
                              <select
                                required
                                value={form.category}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    category: e.target.value,
                                    subcategory: "",
                                  })
                                }
                              >
                                <option value="" disabled>
                                  Alan seç
                                </option>
                                {activeNames(state, "categories").map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            {activeSubs(state, form.category).length > 0 && (
                              <Field label="Alt sınıf">
                                <select
                                  value={form.subcategory || ""}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      subcategory: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Seçilmedi</option>
                                  {activeSubs(state, form.category).map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </Field>
                            )}
                          </div>
                          {(state.settings?.locations || []).length > 0 && (
                            <Field
                              label="Lokasyon"
                              hint={
                                admin
                                  ? "İsteğe bağlı. Liste Tanımlar sayfasından yönetilir."
                                  : "İsteğe bağlı. Sorunun yaşandığı yer."
                              }
                            >
                              <select
                                value={form.location}
                                onChange={(e) =>
                                  setForm({ ...form, location: e.target.value })
                                }
                              >
                                <option value="">Belirtilmedi</option>
                                {state.settings!.locations!.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                          )}
                          <Field
                            label="Şu anda ne oluyor? *"
                            hint="Sorun nerede yaşanıyor? Zaman, maliyet veya kalite üzerindeki etkisi ne?"
                          >
                            <textarea
                              required
                              minLength={10}
                              maxLength={6000}
                              rows={5}
                              placeholder="Örn. Etiketler elle kontrol edildiği için bazı yanlışlıklar yükleme sırasında fark ediliyor…"
                              value={form.problem}
                              onChange={(e) =>
                                setForm({ ...form, problem: e.target.value })
                              }
                            />
                          </Field>
                        </>
                      )}
                      {formStep === 2 && (
                        <>
                          <div className="wizard-intro">
                            <span className="form-icon">
                              <Lightbulb size={25} />
                            </span>
                            <h2>Sence nasıl daha iyi olur?</h2>
                            <p>
                              Değiştirmek istediğin adımı ve beklediğin faydayı
                              anlat.
                            </p>
                          </div>
                          <Field label="Çözüm önerin *">
                            <textarea
                              required
                              minLength={5}
                              maxLength={6000}
                              rows={6}
                              placeholder="Örn. Yüklemeden önce barkod okutularak etiket ile siparişin eşleşmesi kontrol edilsin…"
                              value={form.solution}
                              onChange={(e) =>
                                setForm({ ...form, solution: e.target.value })
                              }
                            />
                          </Field>
                          <Field
                            label="Ne kazanırız?"
                            hint="Zaman, maliyet, kalite veya güvenlik açısından beklediğin fayda. Tahmin yeterli, isteğe bağlı."
                          >
                            <textarea
                              rows={2}
                              maxLength={1000}
                              placeholder="Örn. Vardiya başına yaklaşık 15 dakika kazanç, yanlış yükleme hatasının bitmesi"
                              value={form.expectedBenefit}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  expectedBenefit: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <label className="toggle-row anon-toggle">
                            <input
                              type="checkbox"
                              checked={!!form.anonymous}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  anonymous: e.target.checked,
                                  coAuthors: e.target.checked
                                    ? []
                                    : form.coAuthors,
                                })
                              }
                            />
                            <span>
                              <b>Adımı gizle (anonim öneri)</b>
                              <small>
                                Değerlendiriciler ve yöneticiler adını görmez;
                                departmanın raporlarda görünür. Sen önerini
                                takip edersin, bildirim sana gelir. Revizyon
                                istenirse yine sen düzenlersin. Ödül hak edersen
                                adın yalnızca ödeme için ödül sorumlusuna (İK)
                                görünür.
                              </small>
                            </span>
                          </label>
                          {!form.anonymous && (
                            <div className="field">
                              <span>Öneriyi birlikte verdiğin kişiler</span>
                              <PersonPicker
                                users={sortedUsers}
                                value={form.coAuthors}
                                multiple
                                max={5}
                                exclude={[user.id]}
                                label="Birlikte öneren"
                                placeholder="Ad yazmaya başla…"
                                onChange={(v: string[]) =>
                                  setForm({ ...form, coAuthors: v })
                                }
                              />
                              <small>
                                En fazla 5 kişi. Onlar da öneriyi ve durumunu
                                görür.
                              </small>
                            </div>
                          )}
                          <div className="upload">
                            <span className="upload-icon">
                              <Paperclip size={23} />
                            </span>
                            <div>
                              <b>Mevcut durumun fotoğrafı veya belge</b>
                              <small>
                                İsteğe bağlı · Fotoğraf veya PDF · En fazla 3
                                dosya
                                <br />
                                Fotoğraflar "önce" görseli olur; uygulama
                                sonrası "sonra" fotoğrafı detaydan eklenir · PDF
                                en fazla 500 KB
                              </small>
                            </div>
                            <label className="secondary">
                              {form.attachments.length >= 3
                                ? "Sınıra ulaşıldı"
                                : "Fotoğraf çek / dosya seç"}
                              <input
                                type="file"
                                multiple
                                disabled={form.attachments.length >= 3}
                                accept="image/png,image/jpeg,image/webp,application/pdf"
                                onChange={async (e) => {
                                  await attachments(e.target.files);
                                  e.target.value = "";
                                }}
                                hidden
                              />
                            </label>
                          </div>
                          {form.attachments.map((a, i) => (
                            <div className="attachment" key={i}>
                              <FileText size={17} />
                              {a.name}
                              <button
                                type="button"
                                aria-label={a.name + " dosyasını kaldır"}
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    attachments: form.attachments.filter(
                                      (_, j) => i !== j,
                                    ),
                                  })
                                }
                              >
                                <X size={17} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                      {formStep === 3 && (
                        <>
                          <div className="wizard-intro">
                            <span className="form-icon">
                              <CheckCheck size={25} />
                            </span>
                            <h2>Göndermeye hazır mı?</h2>
                            <p>
                              Önerin aşağıdaki bilgilerle ön değerlendirmeye
                              gidecek.
                            </p>
                          </div>
                          <div className="review-card">
                            <div className="review-tags">
                              <span>{form.operation}</span>
                              <span>
                                {form.category}
                                {form.subcategory
                                  ? " › " + form.subcategory
                                  : ""}
                              </span>
                            </div>
                            <h3>{form.title}</h3>
                            <h4>Mevcut durum</h4>
                            <p>{form.problem}</p>
                            <h4>Çözüm önerisi</h4>
                            <p>{form.solution}</p>
                            {form.expectedBenefit && (
                              <>
                                <h4>Beklenen fayda</h4>
                                <p>{form.expectedBenefit}</p>
                              </>
                            )}
                            {(form.location ||
                              form.coAuthors.length > 0 ||
                              form.anonymous) && (
                              <p className="review-extra">
                                {[
                                  form.anonymous &&
                                    "Anonim: adın değerlendiricilerden gizlenecek",
                                  form.location && "Lokasyon: " + form.location,
                                  form.coAuthors.length > 0 &&
                                    "Birlikte: " +
                                      form.coAuthors.map(who).join(", "),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {form.attachments.length > 0 && (
                              <div className="review-attachment">
                                <Paperclip size={16} />
                                {form.attachments.length} dosya eklendi
                              </div>
                            )}
                          </div>
                          <div className="routing-preview">
                            <Avatar
                              name={who(
                                state.matrix.find(
                                  (r) => r.operation === form.operation,
                                )?.pre || "",
                              )}
                              small
                            />
                            <div>
                              <small>
                                Ön değerlendirme için gönderilecek kişi
                              </small>
                              <b>
                                {who(
                                  state.matrix.find(
                                    (r) => r.operation === form.operation,
                                  )?.pre || "",
                                )}
                              </b>
                            </div>
                            <ArrowRight size={18} />
                          </div>
                          <SimilarPanel
                            compact
                            draft={{
                              title: form.title,
                              problem: form.problem,
                              solution: form.solution,
                              operation: form.operation,
                              category: form.category,
                            }}
                          />
                        </>
                      )}
                    </div>
                    {error && !modal && (
                      <div className="error form-error" role="alert">
                        <AlertCircle size={18} />
                        {error}
                      </div>
                    )}
                    <div className="form-footer">
                      <div>
                        {formStep > 1 ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setFormStep(formStep - 1)}
                          >
                            <ArrowLeft size={17} /> Geri
                          </button>
                        ) : (
                          <span className="required-note">* Zorunlu alan</span>
                        )}
                      </div>
                      <button disabled={busy} className="primary">
                        {busy ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : formStep < 3 ? (
                          <>
                            Devam et <ArrowRight size={18} />
                          </>
                        ) : (
                          <>
                            Öneriyi gönder <Send size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                  <aside
                    className="new-aside"
                    aria-label="Öneri yazma ipuçları"
                  >
                    <div className="new-help">
                      <span className="section-kicker">İYİ BİR ÖNERİ İÇİN</span>
                      <h3>
                        {formStep === 1
                          ? "Somut bir sorunla başla."
                          : formStep === 2
                            ? "Küçük bir değişiklik yeterli."
                            : "Fikrinin yolculuğu başlıyor."}
                      </h3>
                      <p>
                        {formStep === 1
                          ? "“İşler yavaş” yerine hangi adımda, ne kadar zaman kaybedildiğini anlatmak değerlendirmeyi kolaylaştırır."
                          : formStep === 2
                            ? "Çözümünün teknik ayrıntılarını bilmen gerekmiyor. Neyi değiştirmek istediğini netleştirmen yeterli."
                            : "Gönderdikten sonra önerinin kimde olduğunu ve hangi aşamada bulunduğunu Önerilerim ekranından görebilirsin."}
                      </p>
                      <div className="help-example">
                        <Lightbulb size={21} />
                        <span>
                          {formStep === 1
                            ? "Tekrarlanan bir hata, gereksiz bir yürüyüş veya zor bir kontrol adımı."
                            : formStep === 2
                              ? "Bir fotoğraf, mevcut durumu açıklamayı kolaylaştırabilir."
                              : "Her karar ve yönlendirme önerinin geçmişinde görünür."}
                        </span>
                      </div>
                    </div>
                    <div className="identity-note">
                      <Avatar name={user.name} />
                      <div>
                        <b>{user.name}</b>
                        <small>{user.department}</small>
                      </div>
                      <ShieldCheck size={18} />
                    </div>
                  </aside>
                </div>
              </>
            )}
            {page === "matrix" && admin && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">DOĞRU İŞ, DOĞRU KİŞİ</span>
                    <h1>
                      Atama matrisi<span className="mint-dot">.</span>
                    </h1>
                    <p>
                      Aşamaların sorumlularını belirle. Değişiklikte mevcut
                      işleri aynı adımda devret.
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => open("operation", { operation: "" })}
                  >
                    <Plus size={18} /> Bölüm ekle
                  </button>
                </div>
                <div className="info-strip">
                  <ShieldCheck size={20} />
                  <div>
                    <b>Kazanç onayı otomatik yönlenir.</b>
                    <span>
                      Bölüm değerlendirmesini kabul eden kişinin tanımlı
                      müdürüne atanır.
                    </span>
                  </div>
                </div>
                <section className="panel">
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Tablo"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Bölüm</th>
                          <th>Bağlı müdürlük</th>
                          <th>Ön değerlendirme</th>
                          <th>Bölüm sorumlusu</th>
                          <th>Kazanç girişi</th>
                          <th>Puanlama</th>
                          <th>
                            <span className="sr-only">İşlem</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.matrix.map((r) => (
                          <tr key={r.operation}>
                            <td>
                              <b>{r.operation}</b>
                            </td>
                            <td>
                              {r.directorate || (
                                <span className="muted">
                                  {users.find((u) => u.id === r.operationOwner)
                                    ?.directorate || "—"}{" "}
                                  (otomatik)
                                </span>
                              )}
                            </td>
                            {["pre", "operationOwner", "gain", "score"].map(
                              (k) => (
                                <td
                                  key={k}
                                  className={
                                    inactiveIds.includes(r[k]) ? "overdue" : ""
                                  }
                                >
                                  {who(r[k])}
                                  {inactiveIds.includes(r[k]) && (
                                    <small className="cell-sub">
                                      Pasif · yeni işler müdürüne gider
                                    </small>
                                  )}
                                </td>
                              ),
                            )}
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  open("matrix", { ...r, transfer: true })
                                }
                              >
                                Düzenle <ArrowUpRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel audit-panel">
                  <h2>Yönetim işlem geçmişi</h2>
                  {state.audit.length ? (
                    state.audit.slice(0, 10).map((a, i) => (
                      <div className="audit-row" key={i}>
                        <GitBranch size={16} />
                        <span>
                          {a.text}
                          <small>
                            {who(a.actor)} · {date(a.at)}
                          </small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Henüz bir değişiklik yapılmadı.</p>
                  )}
                </section>
              </>
            )}
            {page === "users" && admin && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">EKİP VE YETKİLER</span>
                    <h1>
                      Kullanıcı yönetimi<span className="mint-dot">.</span>
                    </h1>
                    <p>
                      Organizasyon, kullanıcı rolleri ve yönetici ilişkileri.
                    </p>
                  </div>
                  <div className="heading-actions">
                    <button
                      className="primary"
                      onClick={() =>
                        open("user", {
                          username: "",
                          name: "",
                          department: "",
                          directorate: "",
                          role: "employee",
                          manager: "",
                          active: true,
                        })
                      }
                    >
                      <Plus size={18} /> Kullanıcı ekle
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setImportOpen(true)}
                    >
                      <Upload size={17} /> Excel'den yükle
                    </button>
                  </div>
                </div>
                {importOpen && (
                  <UserImport
                    onClose={() => setImportOpen(false)}
                    onDone={() => refresh()}
                    alert={alert}
                  />
                )}
                <div className="info-strip">
                  <ShieldCheck size={20} />
                  <div>
                    <b>İlk girişte şifre değişikliği zorunludur.</b>
                    <span>
                      Yeni hesapların başlangıç şifresi: Kaizen123! · Her
                      kullanıcı kendi şifresini belirler.
                    </span>
                  </div>
                </div>
                {strandedUsers.length > 0 && (
                  <div className="warning stranded">
                    <AlertCircle size={18} />
                    <span>
                      <b>
                        {strandedUsers.length} pasif kullanıcının üzerinde açık
                        iş var.
                      </b>{" "}
                      Bu işler kimse tarafından ilerletilemez; “İşleri devret”
                      ile aktif bir kişiye aktarın.
                    </span>
                  </div>
                )}
                <div className="users-toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Kullanıcı ara"
                      placeholder="Ad, kullanıcı adı, departman veya rol ara…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <span className="muted">{users.length} kullanıcı</span>
                </div>
                <section className="panel">
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Tablo"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Kullanıcı</th>
                          <th>Departman / müdürlük</th>
                          <th>Rol</th>
                          <th>Yöneticisi</th>
                          <th>Açık iş</th>
                          <th>Hesap</th>
                          <th>
                            <span className="sr-only">İşlem</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedUsers
                          .filter(
                            (u) =>
                              !userSearch ||
                              (
                                u.name +
                                " " +
                                u.username +
                                " " +
                                u.department +
                                " " +
                                u.directorate +
                                " " +
                                ROLES[u.role]
                              )
                                .toLocaleLowerCase("tr")
                                .includes(userSearch.toLocaleLowerCase("tr")),
                          )
                          .map((u) => {
                            const w = workload(u.id);
                            const total = w.proposals + w.actions + w.matrix;
                            return (
                              <tr
                                key={u.id}
                                className={
                                  !u.active && total ? "row-warning" : ""
                                }
                              >
                                <td>
                                  <div className="person">
                                    <Avatar name={u.name} small />
                                    <span>
                                      <b>{u.name}</b>
                                      <small>{u.username}</small>
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {u.department}
                                  <small>{u.directorate}</small>
                                </td>
                                <td>{ROLES[u.role]}</td>
                                <td>{who(u.manager)}</td>
                                <td>
                                  {total ? (
                                    <>
                                      <b className={!u.active ? "overdue" : ""}>
                                        {w.proposals} öneri
                                      </b>
                                      <small className="cell-sub">
                                        {w.actions} aksiyon
                                        {w.matrix
                                          ? " · " + w.matrix + " matris görevi"
                                          : ""}
                                      </small>
                                    </>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={
                                      "subtle-tag " + (!u.active ? "red" : "")
                                    }
                                  >
                                    {u.active
                                      ? u.mustChange
                                        ? "İlk giriş bekliyor"
                                        : "Aktif"
                                      : "Pasif"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      open("user", {
                                        ...u,
                                        userId: u.id,
                                        active: !!u.active,
                                      })
                                    }
                                  >
                                    Düzenle
                                  </button>
                                  {total > 0 && (
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        open("reassign", {
                                          from: u.id,
                                          to: "",
                                          reason: "",
                                        })
                                      }
                                    >
                                      İşleri devret
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section
                  className="panel transfer-panel"
                  aria-labelledby="transfer-title"
                >
                  <div className="section-heading">
                    <div>
                      <h2 id="transfer-title">Devir geçmişi</h2>
                      <p>
                        Kullanıcı devirleri, tekli/toplu devirler,
                        yönlendirmeler ve matris değişikliğiyle yapılan
                        devirler. Geri alındığında, devirden sonra başkası
                        tarafından değiştirilmiş kayıtlar korunur.
                      </p>
                    </div>
                  </div>
                  {(() => {
                    // Toplu devirler (aynı batch) tek satırda gösterilir.
                    const groups: { key: string; items: any[] }[] = [];
                    for (const t of state.transfers || []) {
                      const key = t.batch || t.id;
                      const g = groups.find((x) => x.key === key);
                      if (g) g.items.push(t);
                      else groups.push({ key, items: [t] });
                    }
                    if (!groups.length)
                      return <p className="muted">Henüz devir yapılmadı.</p>;
                    const kinds: Record<string, string> = {
                      user: "Kullanıcı devri",
                      proposal: "Öneri devri / yönlendirme",
                      bulk: "Toplu devir",
                      matrix: "Matris değişikliği",
                    };
                    return (
                      <div
                        className="table-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label="Devir geçmişi tablosu"
                      >
                        <table className="mini-table">
                          <thead>
                            <tr>
                              <th>Tarih</th>
                              <th>Tür</th>
                              <th>Kimden → kime</th>
                              <th>Kapsam</th>
                              <th>Gerekçe</th>
                              <th>Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups.slice(0, 30).map(({ key, items }) => {
                              const t = items[0];
                              const changes = items.flatMap((x) => x.changes);
                              const count = (type: string) =>
                                changes.filter((c: any) => c.type === type)
                                  .length;
                              const undone = items.every((x) => x.undone);
                              return (
                                <tr key={key}>
                                  <td>
                                    {new Date(t.at).toLocaleString(intlLocale())}
                                  </td>
                                  <td>
                                    {kinds[t.kind] || t.kind}
                                    <small className="cell-sub">
                                      Yapan: {who(t.actor)}
                                    </small>
                                  </td>
                                  <td>
                                    {t.kind === "bulk"
                                      ? [
                                          ...new Set(
                                            items.map((x) => who(x.from)),
                                          ),
                                        ].join(", ") +
                                        " → " +
                                        who(t.to)
                                      : t.kind === "matrix"
                                        ? "Yeni matris sorumluları"
                                        : who(t.from) + " → " + who(t.to)}
                                  </td>
                                  <td>
                                    {[
                                      count("owner") &&
                                        count("owner") + " öneri",
                                      count("action") &&
                                        count("action") + " aksiyon",
                                      count("matrix") &&
                                        count("matrix") + " matris görevi",
                                    ]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </td>
                                  <td>{t.reason}</td>
                                  <td>
                                    {undone ? (
                                      <span className="subtle-tag">
                                        Geri alındı
                                        {items.reduce(
                                          (a, x) =>
                                            a + (x.undone?.skipped || 0),
                                          0,
                                        ) > 0 &&
                                          " · " +
                                            items.reduce(
                                              (a, x) =>
                                                a + (x.undone?.skipped || 0),
                                              0,
                                            ) +
                                            " atlandı"}
                                      </span>
                                    ) : (
                                      <button
                                        className="text-button"
                                        onClick={() =>
                                          open(
                                            "undoTransfer",
                                            t.batch
                                              ? { batch: t.batch }
                                              : { transferId: t.id },
                                          )
                                        }
                                      >
                                        Geri al
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </section>
              </>
            )}
            {page === "definitions" && admin && (
              <DefinitionsPage
                state={state}
                users={users}
                busy={busy}
                who={who}
                command={command}
                openModal={open}
                orgName={orgName}
                alert={alert}
                edition={edition}
                refresh={refresh}
              />
            )}
            {page === "rewards" && (admin || user.role === "reward") && (
              <RewardsPage
                rewards={state.rewards || []}
                proposals={state.proposals}
                users={users}
                busy={busy}
                command={command}
                onOpen={selectDetail}
              />
            )}
            {page === "recognition" && (
              <RecognitionPage onOpen={selectDetail} admin={admin} />
            )}
            {page === "dashboard" && canManage && (
              <DashboardPage
                proposals={proposals}
                users={users}
                operations={state.operations}
                disabled={state.settings?.disabledReports || []}
                org={state.settings?.org}
                admin={admin}
                viewer={user}
                onOpenProposal={selectDetail}
                onOpenOwner={(id) => {
                  navigate("list");
                  setOwnerFilter(id);
                }}
                onManage={() =>
                  open("reports", {
                    disabledReports: state.settings?.disabledReports || [],
                  })
                }
              />
            )}
            {page === "reports" && (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">ÖLÇÜLEBİLİR İYİLEŞTİRME</span>
                    <h1>
                      Etki ve kazançlar<span className="mint-dot">.</span>
                    </h1>
                    <p>
                      Öneren, departman ve müdürlük bazında katılımı ve sonucu
                      izle.
                    </p>
                  </div>
                  <button className="secondary" onClick={download}>
                    <Download size={17} /> Kayıtları dışa aktar
                  </button>
                </div>
                <ReportBuilder
                  proposals={proposals}
                  users={users}
                  operations={state.operations}
                  locations={state.settings?.locations || []}
                  campaigns={(state.settings?.campaigns || []).map((x) => ({
                    id: x.id,
                    title: x.title,
                  }))}
                  categories={listOf(state, "categories").map((x) => x.name)}
                  userId={user.id}
                />
                <h2 className="section-title">Hazır tablolar</h2>
                <div className="report-controls panel">
                  <Field label="Departman">
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                    >
                      <option value="">Tüm departmanlar</option>
                      {[...new Set(proposals.map((p) => p.department))].map(
                        (x) => (
                          <option key={x}>{x}</option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Müdürlük">
                    <select
                      value={dirFilter}
                      onChange={(e) => setDirFilter(e.target.value)}
                    >
                      <option value="">Tüm müdürlükler</option>
                      {[...new Set(proposals.map((p) => p.directorate))].map(
                        (x) => (
                          <option key={x}>{x}</option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Öneren">
                    <select
                      value={authorFilter}
                      onChange={(e) => setAuthorFilter(e.target.value)}
                    >
                      <option value="">Tüm kişiler</option>
                      {users.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Gönderim başlangıcı">
                    <input
                      type="date"
                      value={fromFilter}
                      onChange={(e) => setFromFilter(e.target.value)}
                    />
                  </Field>
                  <Field label="Gönderim bitişi">
                    <input
                      type="date"
                      value={toFilter}
                      onChange={(e) => setToFilter(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="kpi-grid reports-kpi">
                  {["Tek seferlik", "Aylık", "Yıllık"].map((period) => (
                    <div className="kpi" key={period}>
                      <div>
                        <span>{period} onaylı kazanç</span>
                        <TrendingUp size={18} />
                      </div>
                      <strong>
                        {money(
                          filtered
                            .filter(
                              (p) =>
                                p.gain?.valid &&
                                p.gain?.approved &&
                                !["Reddedildi", "İptal edildi"].includes(
                                  p.status,
                                ) &&
                                p.gain.period === period,
                            )
                            .reduce((a, p) => a + p.gain.amount, 0),
                        )}
                      </strong>
                      <footer>
                        Brüt parasal kazanç · dönemler ayrı tutulur
                      </footer>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Katılım ve sonuç tablosu</h2>
                      <p>
                        Kazanç yalnızca geçerli ve müdür onaylı kayıtlardan
                        hesaplanır. Ort. puan: 100 üzerinden, parantez içinde
                        puanlanan öneri sayısı.
                      </p>
                    </div>
                    <select
                      aria-label="Gruplama"
                      className="compact-select"
                      value={draft.group || "department"}
                      onChange={(e) =>
                        setDraft({ ...draft, group: e.target.value })
                      }
                    >
                      <option value="department">Departman bazında</option>
                      <option value="directorate">Müdürlük bazında</option>
                      <option value="author">Öneren bazında</option>
                    </select>
                  </div>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Tablo"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {
                              (
                                {
                                  department: "Departman",
                                  directorate: "Müdürlük",
                                  author: "Öneren",
                                } as any
                              )[draft.group || "department"]
                            }
                          </th>
                          <th>Öneri</th>
                          {draft.group !== "author" && <th>Öneren kişi</th>}
                          <th>Açık</th>
                          <th>Tamamlanan</th>
                          <th>Ret</th>
                          <th>İptal</th>
                          <th>Tek seferlik ₺</th>
                          <th>Aylık ₺</th>
                          <th>Yıllık ₺</th>
                          <th>Maliyet ₺</th>
                          <th>İlk yıl net ₺</th>
                          <th>Ort. puan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...new Set(
                            filtered.map(
                              (p: any) => p[draft.group || "department"],
                            ),
                          ),
                        ]
                          .sort(
                            (a, b) =>
                              filtered.filter(
                                (p: any) =>
                                  p[draft.group || "department"] === b,
                              ).length -
                              filtered.filter(
                                (p: any) =>
                                  p[draft.group || "department"] === a,
                              ).length,
                          )
                          .map((group) => {
                            const rows = filtered.filter(
                              (p: any) =>
                                p[draft.group || "department"] === group,
                            );
                            return (
                              <tr key={group}>
                                <td>
                                  <b>
                                    {draft.group === "author"
                                      ? who(group)
                                      : group}
                                  </b>
                                </td>
                                <td>{rows.length}</td>
                                {draft.group !== "author" && (
                                  <td>
                                    {new Set(rows.map((p) => p.author)).size}
                                  </td>
                                )}
                                <td>
                                  {
                                    rows.filter(
                                      (p) => !CLOSED.includes(p.status),
                                    ).length
                                  }
                                </td>
                                <td>
                                  {
                                    rows.filter(
                                      (p) => p.status === "Tamamlandı",
                                    ).length
                                  }
                                </td>
                                <td>
                                  {
                                    rows.filter(
                                      (p) => p.status === "Reddedildi",
                                    ).length
                                  }
                                </td>
                                <td>
                                  {
                                    rows.filter(
                                      (p) => p.status === "İptal edildi",
                                    ).length
                                  }
                                </td>
                                {["Tek seferlik", "Aylık", "Yıllık"].map(
                                  (period) => (
                                    <td key={period}>
                                      {fmt(
                                        rows
                                          .filter(
                                            (p) =>
                                              p.gain?.approved &&
                                              p.gain?.valid &&
                                              ![
                                                "Reddedildi",
                                                "İptal edildi",
                                              ].includes(p.status) &&
                                              p.gain.period === period,
                                          )
                                          .reduce(
                                            (a, p) => a + p.gain.amount,
                                            0,
                                          ),
                                      )}
                                    </td>
                                  ),
                                )}
                                {(() => {
                                  const approved = rows.filter(
                                    (p) =>
                                      p.gain?.approved &&
                                      p.gain?.valid &&
                                      !["Reddedildi", "İptal edildi"].includes(
                                        p.status,
                                      ),
                                  );
                                  const f = approved.map((p) =>
                                    gainFigures(p.gain),
                                  );
                                  return (
                                    <>
                                      <td>
                                        {fmt(f.reduce((a, x) => a + x.cost, 0))}
                                      </td>
                                      <td>
                                        {fmt(f.reduce((a, x) => a + x.net, 0))}
                                      </td>
                                    </>
                                  );
                                })()}
                                <td>
                                  {(() => {
                                    // Puan 100 üzerindendir; toplanmaz, geçerli puanların ortalaması alınır.
                                    const scored = rows.filter(
                                      (p) => p.score?.valid,
                                    );
                                    return scored.length
                                      ? Math.round(
                                          scored.reduce(
                                            (a, p) => a + p.score.total,
                                            0,
                                          ) / scored.length,
                                        ) +
                                          " (" +
                                          scored.length +
                                          ")"
                                      : "—";
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
                <div className="dashboard-grid report-bottom">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Durumlara göre dağılım</h2>
                        <p>Filtre kapsamındaki önerilerin dağılımı</p>
                      </div>
                    </div>
                    {[
                      ...STAGES,
                      "Revizyon bekliyor",
                      "Kazanç düzeltmesi bekliyor",
                      "Reddedildi",
                      NOT_IMPLEMENTED,
                      "İptal edildi",
                    ].map((st) => (
                      <div className="status-report" key={st}>
                        <span>{st}</span>
                        <div className="bar">
                          <i
                            style={{
                              width:
                                (filtered.filter((p) => p.status === st)
                                  .length /
                                  Math.max(filtered.length, 1)) *
                                  100 +
                                "%",
                            }}
                          />
                        </div>
                        <b>{filtered.filter((p) => p.status === st).length}</b>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Aşama süreleri</h2>
                        <p>
                          Tamamlanan aşamaların ortalama süresi ve hedefi aşan
                          açık kayıtlar
                        </p>
                      </div>
                    </div>
                    <div
                      className="table-scroll"
                      tabIndex={0}
                      aria-label="Aşama süreleri tablosu"
                    >
                      <table className="mini-table">
                        <thead>
                          <tr>
                            <th>Aşama</th>
                            <th>Hedef</th>
                            <th>Ort. süre</th>
                            <th>Açık</th>
                            <th>Geciken</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...STAGES.slice(0, 7), "Revizyon bekliyor"].map(
                            (st) => {
                              const spans = filtered.flatMap((p) =>
                                (p.stageLog || []).filter(
                                  (l) => l.stage === st,
                                ),
                              );
                              const avg = spans.length
                                ? spans.reduce(
                                    (a, l) =>
                                      a +
                                      (Date.parse(l.to) - Date.parse(l.from)),
                                    0,
                                  ) /
                                  spans.length /
                                  86400000
                                : null;
                              const open = filtered.filter(
                                (p) => p.status === st,
                              );
                              const late = open.filter(
                                (p) => overdueDays(p) > 0,
                              ).length;
                              return (
                                <tr key={st}>
                                  <td>{st}</td>
                                  <td>{STAGE_TARGET_DAYS[st]} gün</td>
                                  <td
                                    className={
                                      avg !== null &&
                                      avg > STAGE_TARGET_DAYS[st]
                                        ? "overdue"
                                        : ""
                                    }
                                  >
                                    {avg === null
                                      ? "—"
                                      : avg.toLocaleString(intlLocale(), {
                                          maximumFractionDigits: 1,
                                        }) + " gün"}
                                  </td>
                                  <td>{open.length}</td>
                                  <td className={late ? "overdue" : ""}>
                                    {late}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="waiting-note">
                      Ortalama süre, bu sürümden sonra aşama değiştiren
                      kayıtlardan hesaplanır. Hedef süreler pilot varsayımıdır;
                      şirket kurallarıyla güncellenecek.
                    </p>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Ret nedenleri</h2>
                        <p>
                          Reddedilen önerilerin standart nedenlere göre dağılımı
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const rejected = filtered.filter(
                        (p) => p.status === "Reddedildi",
                      );
                      if (!rejected.length)
                        return (
                          <p className="muted">
                            Filtre kapsamında reddedilen öneri yok.
                          </p>
                        );
                      return [
                        ...listOf(state, "rejectReasons").map((x) => x.name),
                        "Neden seçilmemiş",
                      ].map((r) => {
                        const n = rejected.filter(
                          (p) => (p.rejectReason || "Neden seçilmemiş") === r,
                        ).length;
                        if (!n) return null;
                        return (
                          <div className="status-report" key={r}>
                            <span>{r}</span>
                            <div className="bar">
                              <i
                                style={{
                                  width: (n / rejected.length) * 100 + "%",
                                }}
                              />
                            </div>
                            <b>{n}</b>
                          </div>
                        );
                      });
                    })()}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Bekleme analizi</h2>
                        <p>İlerlemeyi engelleyen destek işleri</p>
                      </div>
                    </div>
                    {state.units.map((unit) => (
                      <div className="waiting-row" key={unit}>
                        <span className="unit-icon">
                          <Building2 size={17} />
                        </span>
                        <div>
                          <b>{unit}</b>
                          <small>
                            {
                              filtered.filter((p) => waiting(p).includes(unit))
                                .length
                            }{" "}
                            öneri bu birimi bekliyor
                            {(() => {
                              const w = filtered.flatMap((p) =>
                                supportWaits(p).filter((x) => x.unit === unit),
                              );
                              const days = w
                                .filter((x) => x.days !== undefined)
                                .map((x) => x.days!);
                              const noTicket = w.filter(
                                (x) => !x.ticket,
                              ).length;
                              return (
                                <>
                                  {days.length > 0 &&
                                    " · ort. " +
                                      Math.round(
                                        days.reduce((a, c) => a + c, 0) /
                                          days.length,
                                      ) +
                                      " gün"}
                                  {noTicket > 0 &&
                                    " · " + noTicket + " talep no girilmemiş"}
                                </>
                              );
                            })()}
                          </small>
                        </div>
                        <strong>
                          {
                            filtered
                              .filter((p) => !CLOSED.includes(p.status))
                              .flatMap((p) =>
                                p.support.filter(
                                  (a) =>
                                    a.unit === unit &&
                                    a.blocking &&
                                    ![
                                      "Tamamlandı",
                                      "İptal edildi",
                                      "Yapılamadı",
                                    ].includes(a.status),
                                ),
                              ).length
                          }
                        </strong>
                        <small>iş</small>
                      </div>
                    ))}
                    <p className="waiting-note">
                      Bir öneri birden fazla birimi bekleyebilir. Kazançlar
                      hesaplama dönemleriyle raporlanır; parasal olmayan
                      faydalar öneri detayındadır.
                    </p>
                  </section>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <nav
        inert={!!detail || !!modal}
        className="mobile-bottom-nav"
        aria-label="Mobil menü"
      >
        <button
          className={page === "overview" ? "active" : ""}
          onClick={() => navigate("overview")}
        >
          <LayoutDashboard size={21} />
          <span>Ana sayfa</span>
        </button>
        <button
          className={page === "tasks" ? "active" : ""}
          onClick={() => navigate("tasks")}
        >
          <ListChecks size={21} />
          <span>İşlerim</span>
          {myTasks.length > 0 && <i>{myTasks.length}</i>}
        </button>
        <button className="mobile-create" onClick={() => navigate("new")}>
          <span>
            <Plus size={23} />
          </span>
          <b>Öneri ver</b>
        </button>
        <button
          className={page === "list" ? "active" : ""}
          onClick={() => navigate("list")}
        >
          <Lightbulb size={21} />
          <span>Öneriler</span>
        </button>
      </nav>
      {p && (
        <div className="drawer-backdrop" onClick={() => setDetail(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer-header">
              <span className="eyebrow">{p.id}</span>
              <button
                className="icon-button"
                aria-label="Detayı kapat"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
            </header>
            <div className="drawer-title">
              <Badge status={p.status} />
              <h2 id="drawer-title">{p.title}</h2>
              <div className="detail-person">
                <Avatar name={who(p.author)} small />
                <span>
                  {who(p.author)} · {p.department}
                </span>
              </div>
            </div>
            {!CLOSED.includes(p.status) && (
              <div className="next-action-banner">
                <span className="next-action-icon">
                  <ArrowRight size={21} />
                </span>
                <div>
                  <small>SIRADAKİ ADIM</small>
                  <b>{nextStep(p, user.id).title}</b>
                </div>
                <span className="next-action-owner">
                  {p.owner === user.id ? "Senden bekleniyor" : who(p.owner)}
                </span>
              </div>
            )}
            <div className="detail-owner">
              <span>
                <UserRound size={17} /> Sorumlu <b>{who(p.owner)}</b>
              </span>
              <span>
                <Clock size={16} /> <StageAge p={p} />
                {!CLOSED.includes(p.status) && STAGE_TARGET_DAYS[p.status] && (
                  <small className="target-note">
                    Hedef: {STAGE_TARGET_DAYS[p.status]} gün
                  </small>
                )}
              </span>
            </div>
            <div className="detail-tabs">
              {[
                ["summary", "Özet"],
                ["actions", "Aksiyonlar"],
                ["support", "Destek"],
                ["gain", "Kazanç"],
                ["history", "Geçmiş"],
              ].map(([id, l]) => (
                <button
                  className={detailTab === id ? "active" : ""}
                  key={id}
                  onClick={() => setDetailTab(id)}
                >
                  {l}
                  {id === "support" && waiting(p).length > 0 && (
                    <small>{waiting(p).length}</small>
                  )}
                </button>
              ))}
            </div>
            <div
              className="drawer-body"
              tabIndex={0}
              aria-label="Öneri ayrıntıları"
            >
              {error && !modal && <div className="error">{error}</div>}
              {detailTab === "summary" && (
                <>
                  <div className="detail-meta">
                    <div>
                      <small>Bölüm</small>
                      <b>{p.operation}</b>
                    </div>
                    <div>
                      <small>İyileştirme alanı</small>
                      <b>
                        {p.category}
                        {p.subcategory ? " › " + p.subcategory : ""}
                      </b>
                    </div>
                    <div>
                      <small>Gönderim tarihi</small>
                      <b>{date(p.created)}</b>
                    </div>
                    <div>
                      <small>Önerenin müdürlüğü</small>
                      <b>{p.directorate}</b>
                    </div>
                    {p.location && (
                      <div>
                        <small>Lokasyon</small>
                        <b>{p.location}</b>
                      </div>
                    )}
                    {(state?.rewards || [])
                      .filter(
                        (r) =>
                          r.proposalId === p.id && r.status !== "İptal edildi",
                      )
                      .map((r) => {
                        const mine = r.recipients.find(
                          (x) => x.userId === user.id,
                        );
                        return (
                          <div key={r.id}>
                            <small>Ödül</small>
                            <b>
                              {r.ruleLabel} · {r.status}
                              {mine &&
                                r.status !== "Reddedildi" &&
                                " · payın " +
                                  rewardText(r.kind, mine.value, r.ruleLabel)}
                              {!mine &&
                                " · " +
                                  rewardText(r.kind, r.total, r.ruleLabel)}
                              {r.status === "Reddedildi" &&
                                r.note &&
                                " · " + r.note}
                            </b>
                          </div>
                        );
                      })}
                    {p.campaign && (
                      <div>
                        <small>Kampanya</small>
                        <b>
                          {state?.settings?.campaigns?.find(
                            (c) => c.id === p.campaign,
                          )?.title || "Silinmiş kampanya"}
                        </b>
                      </div>
                    )}
                    {(p as any).legacyNo && (
                      <div>
                        <small>Aktarım</small>
                        <b>
                          Eski sistemden aktarıldı · eski no{" "}
                          {(p as any).legacyNo}
                        </b>
                        {admin && (
                          <button
                            className="text-button danger-text"
                            onClick={() =>
                              open("deleteImported", { items: [p] })
                            }
                          >
                            <Trash2 size={14} /> Aktarılan kaydı sil
                          </button>
                        )}
                      </div>
                    )}
                    {p.anonymous && (
                      <div>
                        <small>Gizlilik</small>
                        <b>
                          {p.author === user.id
                            ? "Anonim gönderdin; adın başkalarına görünmez"
                            : "Anonim öneri"}
                        </b>
                      </div>
                    )}
                    {(p.coAuthors || []).length > 0 && (
                      <div>
                        <small>Birlikte öneren</small>
                        <b>{p.coAuthors!.map(who).join(", ")}</b>
                      </div>
                    )}
                  </div>
                  <div className="text-section">
                    <h3>Mevcut durum / problem</h3>
                    <p>{p.problem}</p>
                  </div>
                  <div className="text-section solution">
                    <h3>
                      <Lightbulb size={17} /> Çözüm önerisi
                    </h3>
                    <p>{p.solution}</p>
                  </div>
                  {p.expectedBenefit && (
                    <div className="text-section">
                      <h3>Önerenin beklediği fayda</h3>
                      <p>{p.expectedBenefit}</p>
                    </div>
                  )}
                  {(p.duplicateOf || (p.duplicates || []).length > 0) && (
                    <div className="info-strip duplicate-links">
                      {p.duplicateOf && (
                        <span>
                          Bu öneri{" "}
                          <button
                            className="link-button"
                            onClick={() => selectDetail(p.duplicateOf!)}
                          >
                            {p.duplicateOf}
                          </button>{" "}
                          ile mükerrer olarak işaretlendi.
                        </span>
                      )}
                      {(p.duplicates || []).length > 0 && (
                        <span>
                          Bu öneriye bağlanan mükerrer öneriler:{" "}
                          {p.duplicates!.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                  {[STAGES[0], STAGES[1]].includes(p.status) &&
                    (p.author !== user.id || admin) && (
                      <SimilarPanel
                        id={p.id}
                        onOpen={(id) => selectDetail(id)}
                        onDuplicate={
                          p.owner === user.id || admin || manager
                            ? (x) =>
                                open("duplicate", {
                                  of: x.id,
                                  ofTitle: x.title,
                                  reason: "",
                                })
                            : undefined
                        }
                      />
                    )}
                  <BeforeAfter
                    id={p.id}
                    attachments={p.attachments}
                    canAddAfter={
                      (STAGES.indexOf(p.status) >= 3 ||
                        p.status === "Kazanç düzeltmesi bekliyor") &&
                      (p.author === user.id ||
                        (p.coAuthors || []).includes(user.id) ||
                        p.owner === user.id ||
                        admin ||
                        p.actions.some((a) => a.owner === user.id))
                    }
                    prepare={prepareFile}
                    onAdd={(attachment) =>
                      command(
                        { action: "addAttachment", id: p.id, attachment },
                        false,
                        "Sonra görseli eklendi.",
                      )
                    }
                  />
                  <div className="text-section">
                    <h3>İlerleme</h3>
                    <div className="progress-steps">
                      {STAGES.map((s, i) => (
                        <div
                          key={s}
                          className={
                            (STAGES.indexOf(p.status) >= i ? "done" : "") +
                            (p.status === s ? " current" : "")
                          }
                        >
                          <span>
                            {STAGES.indexOf(p.status) > i ? (
                              <Check size={12} />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <small>{s}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                  {supportWaits(p).length > 0 && (
                    <div className="warning">
                      <Clock size={18} />
                      <span>
                        İlerlemek için beklenen birimler:{" "}
                        {supportWaits(p).map((w, i) => (
                          <React.Fragment key={w.id}>
                            {i > 0 && "; "}
                            <b>{w.unit}</b>
                            {w.ticket ? " · Talep " + w.ticket : ""}
                            {w.days !== undefined
                              ? " · " + w.days + " gündür"
                              : ""}
                          </React.Fragment>
                        ))}
                      </span>
                    </div>
                  )}
                  {(() => {
                    // Revizyon/ret açıklaması öneri sahibine görünür şekilde öne çıkarılır.
                    const key =
                      p.status === "Revizyon bekliyor"
                        ? "Revizyon istendi: "
                        : p.status === "Reddedildi"
                          ? " ret gerekçesi: "
                          : p.status === NOT_IMPLEMENTED
                            ? " uygulanamama gerekçesi: "
                            : "";
                    const h = key
                      ? p.history.find((x) => x.text.includes(key))
                      : null;
                    if (!h) return null;
                    return (
                      <div
                        className={
                          "decision-note " +
                          (p.status === "Reddedildi" ? "red" : "amber")
                        }
                        role="note"
                      >
                        <AlertCircle size={18} />
                        <div>
                          <b>
                            {p.status === "Reddedildi"
                              ? "Ret açıklaması"
                              : p.status === NOT_IMPLEMENTED
                                ? "Uygulanamadı"
                                : "Revizyon isteği"}
                          </b>
                          <p>
                            {h.text.slice(h.text.indexOf(key) + key.length)}
                          </p>
                          <small>
                            {who(h.actor)} ·{" "}
                            {new Date(h.at).toLocaleDateString(intlLocale())}
                          </small>
                        </div>
                      </div>
                    );
                  })()}
                  {p.status === "Revizyon bekliyor" &&
                    (p.author === user.id || admin) && (
                      <button
                        className="primary"
                        onClick={() =>
                          open("resubmit", {
                            problem: p.problem,
                            solution: p.solution,
                          })
                        }
                      >
                        Düzenle ve tekrar gönder <Send size={16} />
                      </button>
                    )}
                  <section
                    className="comments"
                    aria-labelledby="comments-title"
                  >
                    <h4 id="comments-title">
                      <MessageSquare size={16} /> Sorular ve notlar
                      {(p.comments?.length || 0) > 0 && (
                        <small>{p.comments!.length}</small>
                      )}
                    </h4>
                    {(p.comments || []).length === 0 && (
                      <p className="muted">
                        Öneriyle ilgili soru sormak veya bilgi eklemek için yaz.
                        Öneren kişi ve sorumlular görür.
                      </p>
                    )}
                    <ul>
                      {(p.comments || []).map((c, i) => (
                        <li
                          key={i}
                          className={c.actor === user.id ? "own" : ""}
                        >
                          <Avatar name={who(c.actor)} small />
                          <div>
                            <small>
                              <b>{who(c.actor)}</b> ·{" "}
                              {new Date(c.at).toLocaleString(intlLocale())}
                            </small>
                            <p>{c.text}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <form
                      className="comment-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const ok = await command(
                          { action: "comment", id: p.id, text: commentText },
                          false,
                          "Mesajın eklendi.",
                        );
                        if (ok) setCommentText("");
                      }}
                    >
                      <label className="sr-only" htmlFor="comment-input">
                        Soru veya not yaz
                      </label>
                      <textarea
                        id="comment-input"
                        rows={2}
                        required
                        minLength={2}
                        maxLength={2000}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Soru sor veya not ekle…"
                      />
                      <button
                        className="secondary"
                        disabled={busy || commentText.trim().length < 2}
                      >
                        <Send size={15} /> Gönder
                      </button>
                    </form>
                  </section>
                </>
              )}
              {detailTab === "actions" && (
                <>
                  {p.status === STAGES[3] &&
                    (p.actions.some(
                      (a) => !["Tamamlandı", "Yapılamadı"].includes(a.status),
                    ) ||
                      p.support.some(
                        (a) =>
                          a.blocking &&
                          ![
                            "Tamamlandı",
                            "İptal edildi",
                            "Yapılamadı",
                          ].includes(a.status),
                      )) && (
                      <div className="completion-guide">
                        <Clock size={19} />
                        <div>
                          <b>Uygulamayı tamamlamak için</b>
                          {p.actions.some(
                            (a) =>
                              !["Tamamlandı", "Yapılamadı"].includes(a.status),
                          ) && (
                            <p>
                              {
                                p.actions.filter(
                                  (a) =>
                                    !["Tamamlandı", "Yapılamadı"].includes(
                                      a.status,
                                    ),
                                ).length
                              }{" "}
                              aksiyonun sonuçlanması gerekiyor (yapıldı ya da
                              yapılamadı).
                            </p>
                          )}
                          {waiting(p).length > 0 && (
                            <p>
                              {waiting(p).join(", ")} desteği bekleniyor.{" "}
                              <button
                                className="text-button"
                                onClick={() => setDetailTab("support")}
                              >
                                Destek birimlerini aç <ArrowRight size={13} />
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  <div className="section-heading">
                    <div>
                      <h3>Aksiyon planı</h3>
                      <p>
                        {
                          p.actions.filter((a) =>
                            ["Tamamlandı", "Yapılamadı"].includes(a.status),
                          ).length
                        }{" "}
                        / {p.actions.length} iş sonuçlandı
                      </p>
                    </div>
                    {(admin || p.owner === user.id) &&
                      [STAGES[2], STAGES[3]].includes(p.status) && (
                        <button
                          className="secondary"
                          onClick={() =>
                            open("addAction", {
                              title: "",
                              owner: p.owner,
                              due: "",
                            })
                          }
                        >
                          <Plus size={16} /> Aksiyon
                        </button>
                      )}
                  </div>
                  {p.actions.length ? (
                    p.actions.map((a) => (
                      <div className="task-card" key={a.id}>
                        <span
                          className={
                            "task-check " +
                            (a.status === "Tamamlandı" ? "done" : "")
                          }
                        >
                          <Check size={17} />
                        </span>
                        <div>
                          <b>{a.title}</b>
                          {a.description && (
                            <p className="task-note">{a.description}</p>
                          )}
                          {a.evidence && (
                            <p className="task-note evidence">
                              <CheckCircle2 size={13} /> Sonuç: {a.evidence}
                            </p>
                          )}
                          <small>
                            {who(a.owner)} · Hedef: {date(a.due)}{" "}
                            {!["Tamamlandı", "Yapılamadı"].includes(a.status) &&
                              a.due < new Date().toISOString().slice(0, 10) && (
                                <em>Gecikti</em>
                              )}
                          </small>
                        </div>
                        {!CLOSED.includes(p.status) &&
                        (admin ||
                          p.owner === user.id ||
                          a.owner === user.id) ? (
                          <select
                            aria-label="Aksiyon durumu"
                            disabled={busy}
                            value={a.status}
                            onChange={(e) =>
                              e.target.value === "__close"
                                ? open("actionDone", {
                                    itemId: a.id,
                                    title: a.title,
                                    status: "",
                                    evidence: "",
                                    reason: "",
                                  })
                                : command({
                                    action: "actionUpdate",
                                    id: p.id,
                                    itemId: a.id,
                                    status: e.target.value,
                                  })
                            }
                          >
                            {[
                              "Başlamadı",
                              "Devam ediyor",
                              ...(["Tamamlandı", "Yapılamadı"].includes(
                                a.status,
                              )
                                ? [a.status]
                                : []),
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                            <option value="__close">
                              Sonuçlandır (yapıldı / yapılamadı)…
                            </option>
                          </select>
                        ) : (
                          <span>{a.status}</span>
                        )}
                        {!CLOSED.includes(p.status) &&
                          (admin || manager || p.owner === user.id) && (
                            <button
                              className="icon-button"
                              aria-label="Aksiyonu düzenle veya devret"
                              onClick={() =>
                                open("editWork", {
                                  ...a,
                                  itemId: a.id,
                                  kind: "action",
                                  reason: "",
                                })
                              }
                            >
                              <Settings2 size={15} />
                            </button>
                          )}
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      <ListChecks />
                      <h3>Henüz aksiyon eklenmedi</h3>
                      <p>
                        {(admin || p.owner === user.id) &&
                        p.status === STAGES[2]
                          ? "Uygulamayı başlatmak için önce “Aksiyon” ile yapılacak işleri, sorumlusunu ve hedef tarihini ekle."
                          : "Aksiyon planı, bölüm değerlendirmesi kabul edildikten sonra oluşturulur."}
                      </p>
                    </div>
                  )}
                </>
              )}
              {detailTab === "support" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h3>Beklenen destek birimleri</h3>
                      <p>
                        Yalnızca ilgili birimleri işaretle. Bekleme bittiğinde
                        işareti kaldır.
                      </p>
                    </div>
                  </div>
                  <div className="support-flags">
                    {state?.units.map((unit) => {
                      const checked = waiting(p).includes(unit);
                      return (
                        <label
                          key={unit}
                          className={
                            "support-flag " + (checked ? "is-selected" : "")
                          }
                        >
                          <input
                            type="checkbox"
                            aria-label={unit + " bekleniyor"}
                            checked={checked}
                            disabled={
                              busy ||
                              CLOSED.includes(p.status) ||
                              !(admin || p.owner === user.id)
                            }
                            onChange={(e) =>
                              command({
                                action: "supportFlag",
                                id: p.id,
                                unit,
                                selected: e.target.checked,
                              })
                            }
                          />
                          <span className="unit-icon">
                            {unit === "IT" ? (
                              <Monitor size={21} />
                            ) : unit === "Teknik İşler" ? (
                              <Settings2 size={21} />
                            ) : (
                              <Building2 size={21} />
                            )}
                          </span>
                          <b>{unit}</b>
                          <span className="support-flag-state">
                            {checked ? "Bekleniyor" : "Bekleme yok"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {supportWaits(p).length > 0 && (
                    <div className="ticket-list">
                      {supportWaits(p).map((w) => (
                        <TicketRow
                          key={w.id}
                          wait={w}
                          disabled={busy || !(admin || p.owner === user.id)}
                          onSave={(ticket) =>
                            command(
                              {
                                action: "supportTicket",
                                id: p.id,
                                itemId: w.id,
                                ticket,
                              },
                              false,
                              ticket
                                ? w.unit + " talep numarası kaydedildi."
                                : "Talep numarası silindi.",
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                  <p className="support-selection-note">
                    Seçimler otomatik kaydedilir ve bekleme raporlarına yansır.
                    Destek biriminin kendi sistemindeki talep / iş emri
                    numarasını yazarsan takip oradan yapılır; gecikme
                    e-postaları bu numarayla gider.
                  </p>
                  {CLOSED.includes(p.status) && (
                    <p className="support-selection-note">
                      Kapalı önerilerde destek seçimi değiştirilemez.
                    </p>
                  )}
                </>
              )}
              {detailTab === "gain" && (
                <>
                  {p.gain ? (
                    <>
                      <div className="gain-hero">
                        <span>
                          {p.gain.type} kazanım · {p.gain.period}
                        </span>
                        <strong>
                          {p.gain.type === "Parasal"
                            ? money(p.gain.amount)
                            : p.gain.type + " iyileştirmesi"}
                        </strong>
                        <span className="subtle-tag">
                          {!p.gain.valid
                            ? "Geçmiş kayıt · geçerli değil"
                            : p.gain.approved
                              ? "Müdür onaylı"
                              : "Müdür onayı bekliyor"}
                        </span>
                      </div>
                      <div className="detail-meta">
                        <div>
                          <small>Önce</small>
                          <b>{p.gain.before}</b>
                        </div>
                        <div>
                          <small>Sonra</small>
                          <b>{p.gain.after}</b>
                        </div>
                        <div>
                          <small>Uygulama maliyeti</small>
                          <b>{money(p.gain.cost)}</b>
                        </div>
                        {p.gain.type === "Parasal" && (
                          <>
                            <div>
                              <small>İlk yıl net kazanç</small>
                              <b>{money(gainFigures(p.gain).net)}</b>
                            </div>
                            <div>
                              <small>Maliyetin geri dönüşü</small>
                              <b>
                                {gainFigures(p.gain).paybackMonths !== null
                                  ? gainFigures(
                                      p.gain,
                                    ).paybackMonths!.toLocaleString(intlLocale()) +
                                    " ay"
                                  : p.gain.cost > 0
                                    ? "—"
                                    : "Maliyet yok"}
                              </b>
                            </div>
                          </>
                        )}
                        <div>
                          <small>Kazanç onaylayıcısı</small>
                          <b>
                            {p.gain.approver
                              ? who(p.gain.approver)
                              : who(
                                  users.find((u) => u.id === p.evaluator)
                                    ?.manager || "",
                                )}
                          </b>
                        </div>
                      </div>
                      <div className="text-section">
                        <h3>Hesaplama ve ölçüm dayanağı</h3>
                        <p>{p.gain.explanation}</p>
                      </div>
                      {p.gain.previous?.length > 0 && (
                        <details>
                          <summary>
                            Önceki kazanç kayıtları ({p.gain.previous.length})
                          </summary>
                          {p.gain.previous.map((g: any, i: number) => (
                            <p key={i}>
                              {money(g.amount)} · {g.period} · {g.explanation}
                            </p>
                          ))}
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="empty">
                      <TrendingUp />
                      <h3>Kazanç henüz girilmedi</h3>
                      <p>
                        Uygulama tamamlandığında ölçüm ve hesaplamalar
                        kaydedilir.
                      </p>
                    </div>
                  )}
                  {p.score && (
                    <div className="score-card">
                      <div>
                        <h3>Kaizen puanı</h3>
                        <p>
                          {p.score.imported
                            ? "Eski sistemden aktarılan puan · kriter kırılımı yok"
                            : p.score.valid
                              ? "Geçerli puanlama"
                              : "Geçmiş puanlama · geçerli değil"}
                        </p>
                      </div>
                      <strong>
                        {p.score.total}
                        <small>/100</small>
                      </strong>
                    </div>
                  )}
                  {p.score?.criteria?.length > 0 && (
                    <ul className="score-breakdown" aria-label="Puan kırılımı">
                      {p.score.criteria.map((c: any) => (
                        <li key={c.name}>
                          <span>{c.name}</span>
                          <b>
                            {c.value}/{p.score.scale}
                          </b>
                          {p.score.criteria.some(
                            (x: any) => x.weight !== c.weight,
                          ) && <small>ağırlık {c.weight}</small>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {detailTab === "history" && (
                <div className="timeline">
                  {[...p.history]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((h, i) => (
                      <div key={i}>
                        <span className="timeline-dot" />
                        <div>
                          <small>
                            {new Date(h.at).toLocaleString(intlLocale())} ·{" "}
                            {who(h.actor)}
                          </small>
                          <p>{h.text}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div
              className="drawer-footer"
              role="group"
              aria-label="Öneri işlemleri"
            >
              <div className="buttons">
                {(admin || p.owner === user.id) &&
                  [STAGES[0], STAGES[1]].includes(p.status) && (
                    <>
                      <button
                        disabled={busy}
                        className="primary"
                        onClick={() => open("accept", { note: "" })}
                      >
                        <Check size={16} /> Kabul et
                      </button>
                      <button
                        className="danger-outline"
                        onClick={() =>
                          open("reject", { reason: "", reasonCode: "" })
                        }
                      >
                        Reddet
                      </button>
                      <button
                        className="secondary"
                        onClick={() => open("revision", { reason: "" })}
                      >
                        Revizyon iste
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          open("forward", {
                            operation: p.operation,
                            reason: "",
                          })
                        }
                      >
                        Yönlendir
                      </button>
                    </>
                  )}
                {(admin || p.owner === user.id) && p.status === STAGES[2] && (
                  <button
                    className="primary"
                    disabled={busy || !p.actions.length}
                    title={
                      p.actions.length
                        ? undefined
                        : "Önce en az bir aksiyon ekleyin."
                    }
                    onClick={() =>
                      command(
                        { action: "start", id: p.id },
                        true,
                        "Uygulama başladı.",
                      )
                    }
                  >
                    Uygulamayı başlat <ArrowRight size={16} />
                  </button>
                )}
                {(admin || p.owner === user.id) && p.status === STAGES[3] && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      open("finish", {
                        outcome: "",
                        reasonCode: "",
                        reason: "",
                      })
                    }
                  >
                    Uygulamayı sonuçlandır <Check size={16} />
                  </button>
                )}
                {(admin || p.owner === user.id) && p.status === STAGES[2] && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      open("finish", {
                        outcome: "notImplemented",
                        reasonCode: "",
                        reason: "",
                      })
                    }
                  >
                    Uygulanamadı olarak kapat
                  </button>
                )}
                {(admin || p.owner === user.id) &&
                  [STAGES[4], "Kazanç düzeltmesi bekliyor"].includes(
                    p.status,
                  ) && (
                    <button
                      className="primary"
                      onClick={() =>
                        open(
                          "gain",
                          p.gain || {
                            amount: 0,
                            cost: 0,
                            period: "Yıllık",
                            type: "Parasal",
                            before: "",
                            after: "",
                            explanation: "",
                          },
                        )
                      }
                    >
                      Kazanç gir <TrendingUp size={16} />
                    </button>
                  )}
                {(admin || p.owner === user.id) && p.status === STAGES[5] && (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        command({ action: "gainApprove", id: p.id })
                      }
                    >
                      Kazancı onayla <Check size={16} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => open("gainReturn", { reason: "" })}
                    >
                      Düzeltmeye gönder
                    </button>
                  </>
                )}
                {(admin || p.owner === user.id) && p.status === STAGES[6] && (
                  <button
                    className="primary"
                    onClick={() =>
                      open("score", {
                        values: scoringOf(state).criteria.map(() =>
                          Math.ceil(scoringOf(state).scale / 2),
                        ),
                      })
                    }
                  >
                    Puanla ve tamamla <CheckCheck size={17} />
                  </button>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  className="process-launcher"
                  onClick={() => open("process")}
                >
                  <Settings2 size={16} /> Süreç işlemleri{" "}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="modal"
          >
            <div className="modal-heading">
              <h2 id="modal-title">
                {
                  {
                    process: "Süreç işlemleri",
                    accept: "Öneriyi kabul et",
                    reports: "Durum panosu raporları",
                    org: "Kurum / birim adı",
                    reassign: "Kullanıcının işlerini devret",
                    actionDone: "Aksiyonu sonuçlandır",
                    finish: "Uygulama sonucu",
                    undoTransfer: "Devri geri al",
                    deleteImported: draft.batch
                      ? "Aktarımı geri al"
                      : "Aktarılan kayıtları sil",
                    duplicate: "Mükerrer olarak işaretle",
                    prefs: "Bildirim tercihim",
                    reject: "Öneriyi reddet",
                    revision: "Revizyon iste",
                    forward: "Öneriyi yönlendir",
                    transfer: "İşi devret",
                    bulkTransfer: "Seçili işleri devret",
                    rollback: "Önceki aşamaya geri al",
                    cancel: "Öneriyi iptal et",
                    editWork: "İşi düzenle / devret",
                    addAction: "Aksiyon ekle",
                    support: "Destek işi aç",
                    gain: "Kazanç bilgileri",
                    gainReturn: "Kazancı düzeltmeye gönder",
                    score: "Kaizen puanlaması",
                    matrix: "Atama matrisini düzenle",
                    unit: "Destek birimi ekle",
                    operation: "Bölüm ekle",
                    user: draft.userId
                      ? "Kullanıcıyı düzenle"
                      : "Kullanıcı ekle",
                    resubmit: "Öneriyi revize et",
                  }[modal.type as string]
                }
              </h2>
              <button
                className="icon-button"
                aria-label="Pencereyi kapat"
                onClick={() => {
                  setModal(null);
                  setError("");
                }}
              >
                <X />
              </button>
            </div>
            <form onSubmit={submitModal}>
              <div className="modal-body">
                {modal.type === "deleteImported" && (
                  <div className="delete-imported">
                    <p>
                      <b>{draft.items.length} aktarılan öneri</b> kalıcı olarak
                      silinecek. Bu işlem geri alınamaz; gerekirse aynı dosya
                      yeniden aktarılabilir.
                    </p>
                    <p className="muted">
                      Eski no:{" "}
                      {draft.items
                        .slice(0, 12)
                        .map((p: any) => p.legacyNo)
                        .join(", ")}
                      {draft.items.length > 12 &&
                        ` … ve ${draft.items.length - 12} kayıt daha`}
                    </p>
                    {draft.items.some(
                      (p: any) =>
                        p.history.some((h: any) => h.at > p.imported.at) ||
                        (p.comments || []).length,
                    ) && (
                      <p className="warn-text" role="note">
                        Dikkat:{" "}
                        {
                          draft.items.filter(
                            (p: any) =>
                              p.history.some(
                                (h: any) => h.at > p.imported.at,
                              ) || (p.comments || []).length,
                          ).length
                        }{" "}
                        kayıtta aktarımdan sonra işlem yapılmış (aşama, aksiyon,
                        yorum). Bunlar da silinir.
                      </p>
                    )}
                    {draft.batch && (
                      <p className="muted">
                        Bu aktarımla açılan pasif kullanıcılar, başka bir
                        kayıtta geçmiyorsa silinir.
                      </p>
                    )}
                  </div>
                )}
                {[
                  "reject",
                  "revision",
                  "forward",
                  "transfer",
                  "bulkTransfer",
                  "rollback",
                  "cancel",
                  "gainReturn",
                ].includes(modal.type) && (
                  <>
                    {modal.type === "rollback" && (
                      <>
                        <div className="warning">
                          <RotateCcw size={20} />
                          <span>
                            Sonraki aşamaların onayları yeniden alınır. Geçmiş
                            kayıtlar silinmez.
                          </span>
                        </div>
                        <Field label="Hedef aşama">
                          <select
                            value={draft.target}
                            onChange={(e) =>
                              setDraft({ ...draft, target: e.target.value })
                            }
                          >
                            {STAGES.slice(
                              0,
                              p
                                ? STAGES.indexOf(p.status) > -1
                                  ? STAGES.indexOf(p.status)
                                  : STAGES.indexOf(
                                      p.status === "Revizyon bekliyor"
                                        ? p.revisionTarget || STAGES[0]
                                        : p.status ===
                                            "Kazanç düzeltmesi bekliyor"
                                          ? STAGES[4]
                                          : p.lastActiveStage || STAGES[0],
                                    ) + 1
                                : 0,
                            ).map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                    {modal.type === "cancel" && (
                      <div className="warning">
                        <Ban size={18} />
                        <span>
                          Açık işler sonlandırılır. Kazanç ve puan güncel
                          toplamların dışında kalır.
                        </span>
                      </div>
                    )}
                    {modal.type === "forward" && (
                      <>
                        <div
                          className="segmented forward-mode"
                          role="radiogroup"
                          aria-label="Yönlendirme türü"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={!draft.byPerson}
                            className={!draft.byPerson ? "active" : ""}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                byPerson: false,
                                toUser: "",
                              })
                            }
                          >
                            Başka bölüme
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={!!draft.byPerson}
                            className={draft.byPerson ? "active" : ""}
                            onClick={() =>
                              setDraft({ ...draft, byPerson: true })
                            }
                          >
                            Başka kişiye
                          </button>
                        </div>
                        {draft.byPerson ? (
                          <>
                            <Field label="Değerlendirecek kişi *">
                              {userSelect(draft.toUser, (v) =>
                                setDraft({ ...draft, toUser: v }),
                              )}
                            </Field>
                            <div className="info-strip">
                              Bölüm ({p?.operation}) aynı kalır; değerlendirme
                              seçtiğin kişiye geçer. Yönlendirme geri
                              alınabilir.
                            </div>
                          </>
                        ) : (
                          <>
                            <Field label="Yeni bölüm">
                              <select
                                value={draft.operation}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    operation: e.target.value,
                                  })
                                }
                              >
                                {state?.operations.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            <div className="info-strip">
                              Yeni sorumlu:{" "}
                              {who(
                                state?.matrix.find(
                                  (r) => r.operation === draft.operation,
                                )?.[
                                  p?.status === STAGES[0]
                                    ? "pre"
                                    : "operationOwner"
                                ] || "",
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {["transfer", "bulkTransfer"].includes(modal.type) && (
                      <Field label="Yeni sorumlu">
                        {userSelect(draft.owner, (v) =>
                          setDraft({ ...draft, owner: v }),
                        )}
                      </Field>
                    )}
                    {modal.type === "reject" && (
                      <Field label="Ret nedeni *">
                        <select
                          required
                          value={draft.reasonCode || ""}
                          onChange={(e) =>
                            setDraft({ ...draft, reasonCode: e.target.value })
                          }
                        >
                          <option value="" disabled>
                            Neden seç
                          </option>
                          {activeNames(state, "rejectReasons").map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field
                      label={
                        modal.type === "reject"
                          ? "Öneri sahibine açıklama *"
                          : "Gerekçe *"
                      }
                      hint={
                        modal.type === "reject"
                          ? "Öneren kişi bu açıklamayı görür. Neden uygun bulunmadığını kısaca açıkla."
                          : modal.type === "revision"
                            ? "Öneren kişi neyi düzeltmesi gerektiğini buradan görür."
                            : undefined
                      }
                    >
                      <textarea
                        rows={3}
                        required
                        minLength={3}
                        value={draft.reason}
                        onChange={(e) =>
                          setDraft({ ...draft, reason: e.target.value })
                        }
                        placeholder="İşlem gerekçesini yazın…"
                      />
                    </Field>
                  </>
                )}
                {modal.type === "reassign" && (
                  <>
                    {(() => {
                      const w = workload(draft.from);
                      return (
                        <div className="info-strip">
                          <b>{who(draft.from)}</b> üzerindeki {w.proposals} açık
                          öneri, {w.actions} açık aksiyon ve {w.matrix} matris
                          görevi seçeceğin kişiye aktarılır. Her kayda devir
                          notu düşülür.
                        </div>
                      );
                    })()}
                    <Field label="Devralacak kişi *">
                      {userSelect(draft.to, (v) =>
                        setDraft({ ...draft, to: v }),
                      )}
                    </Field>
                    <Field label="Gerekçe *">
                      <textarea
                        rows={2}
                        required
                        minLength={3}
                        value={draft.reason}
                        onChange={(e) =>
                          setDraft({ ...draft, reason: e.target.value })
                        }
                        placeholder="Örn. Görev değişikliği, işten ayrılma"
                      />
                    </Field>
                  </>
                )}
                {modal.type === "org" && (
                  <Field
                    label="Ad"
                    hint="Örn. Lojistik, Üretim, Genel Müdürlük"
                  >
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      value={draft.orgName || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, orgName: e.target.value })
                      }
                    />
                  </Field>
                )}
                {modal.type === "reports" && (
                  <fieldset className="report-toggles">
                    <legend>Kullanıcılara gösterilecek raporlar</legend>
                    {REPORTS.map((r) => {
                      const active = !(draft.disabledReports || []).includes(
                        r.id,
                      );
                      return (
                        <label key={r.id} className="toggle-row">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                disabledReports: e.target.checked
                                  ? (draft.disabledReports || []).filter(
                                      (x: string) => x !== r.id,
                                    )
                                  : [...(draft.disabledReports || []), r.id],
                              })
                            }
                          />
                          <span>
                            <b>{r.title}</b>
                            <small>{r.hint}</small>
                          </span>
                          <em className={active ? "on" : "off"}>
                            {active ? "Aktif" : "Pasif"}
                          </em>
                        </label>
                      );
                    })}
                    <p className="muted">
                      Pasif raporlar tüm kullanıcılar için panodan kalkar;
                      veriler silinmez.
                    </p>
                  </fieldset>
                )}
                {modal.type === "accept" && p && (
                  <>
                    <div className="info-strip">
                      Öneri{" "}
                      <b>{p.status === STAGES[0] ? STAGES[1] : STAGES[2]}</b>{" "}
                      aşamasına geçecek
                      {p.status === STAGES[0] && (
                        <>
                          {" "}
                          · Sorumlu:{" "}
                          <b>
                            {who(
                              state?.matrix.find(
                                (r) => r.operation === p.operation,
                              )?.operationOwner || "",
                            )}
                          </b>
                        </>
                      )}
                      .
                    </div>
                    <Field
                      label="Not (isteğe bağlı)"
                      hint="Bir sonraki sorumluya iletmek istediğin bilgi."
                    >
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={draft.note || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, note: e.target.value })
                        }
                        placeholder="Örn. Benzer bir uygulama Toplama'da denendi, sonuçlarına bakılabilir."
                      />
                    </Field>
                  </>
                )}
                {["addAction", "editWork"].includes(modal.type) && (
                  <>
                    <Field label="Yapılacak iş *">
                      <input
                        required
                        value={draft.title}
                        onChange={(e) =>
                          setDraft({ ...draft, title: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Sorumlu *">
                      {userSelect(draft.owner, (v) =>
                        setDraft({ ...draft, owner: v }),
                      )}
                    </Field>
                    <Field label="Hedef tarih *">
                      <input
                        required
                        type="date"
                        value={draft.due}
                        onChange={(e) =>
                          setDraft({ ...draft, due: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label="Açıklama"
                      hint="Ne yapılacak, nasıl ölçülecek? İsteğe bağlı."
                    >
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={draft.description || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, description: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                {modal.type === "prefs" && (
                  <fieldset className="choice-list">
                    <legend>Bana e-postayı ne zaman gönderelim?</legend>
                    {[
                      [
                        "instant",
                        "Anında",
                        "Bir şey değiştiğinde hemen. Kısa sürede çok olay olursa tek e-postada toplanır.",
                      ],
                      [
                        "digest",
                        "Günlük özet",
                        "Gün içindekiler sabah tek e-postada gelir.",
                      ],
                      [
                        "off",
                        "Kapalı",
                        "E-posta gelmez; değişiklikleri uygulamadan takip edersin.",
                      ],
                    ].map(([v, t, d]) => (
                      <label key={v} className="choice">
                        <input
                          type="radio"
                          name="notify"
                          value={v}
                          checked={draft.notify === v}
                          onChange={() => setDraft({ ...draft, notify: v })}
                        />
                        <span>
                          <b>{t}</b>
                          <small>{d}</small>
                        </span>
                      </label>
                    ))}
                    <p className="muted">
                      {user.email
                        ? "Adres: " + user.email
                        : "Kayıtlı e-posta adresin yok; adresini sistem yöneticisi ekler."}
                    </p>
                  </fieldset>
                )}
                {modal.type === "prefs" && edition === "ai" && <McpAccess />}
                {modal.type === "duplicate" && (
                  <>
                    <div className="info-strip">
                      Bu öneri <b>{draft.of}</b> · {draft.ofTitle} ile aynı konu
                      olarak işaretlenecek ve “Mükerrer öneri” nedeniyle
                      sonuçlanacak. İki kayıt birbirine bağlanır; öneren kişi
                      açıklamanı görür.
                    </div>
                    <Field label="Öneri sahibine açıklama *">
                      <textarea
                        rows={3}
                        required
                        minLength={3}
                        value={draft.reason}
                        onChange={(e) =>
                          setDraft({ ...draft, reason: e.target.value })
                        }
                        placeholder="Örn. Aynı konu KZ-2026-0073 ile değerlendiriliyor; ilerlemeyi oradan takip edebilirsin."
                      />
                    </Field>
                  </>
                )}
                {modal.type === "undoTransfer" && (
                  <div className="info-strip">
                    Devirle değişen kayıtlar önceki sorumlularına döner.
                    Devirden sonra başka biri tarafından değiştirilmiş kayıtlar
                    atlanır ve olduğu gibi kalır. Her kayda “Devir geri alındı”
                    notu düşülür.
                  </div>
                )}
                {modal.type === "actionDone" && (
                  <>
                    <fieldset className="choice-list">
                      <legend>
                        <b>{draft.title}</b> · aksiyon yapıldı mı? *
                      </legend>
                      {[
                        ["Tamamlandı", "Yapıldı", "Aksiyon uygulandı."],
                        [
                          "Yapılamadı",
                          "Yapılamadı",
                          "Bir nedenle uygulanamadı; nedeni yazılır.",
                        ],
                      ].map(([v, t, d]) => (
                        <label key={v} className="choice">
                          <input
                            type="radio"
                            name="action-outcome"
                            required
                            value={v}
                            checked={draft.status === v}
                            onChange={() => setDraft({ ...draft, status: v })}
                          />
                          <span>
                            <b>{t}</b>
                            <small>{d}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {draft.status === "Yapılamadı" && (
                      <Field label="Neden yapılamadı? *">
                        <textarea
                          rows={2}
                          required
                          minLength={3}
                          maxLength={1000}
                          value={draft.reason || ""}
                          onChange={(e) =>
                            setDraft({ ...draft, reason: e.target.value })
                          }
                          placeholder="Örn. Bütçe onayı çıkmadı; yeni yıl bütçesine aktarıldı."
                        />
                      </Field>
                    )}
                    {draft.status !== "Yapılamadı" && (
                      <Field
                        label="Sonuç / kanıt"
                        hint="Ne yapıldı, sonuç ne oldu? Fotoğraf yerine kısa not; isteğe bağlı ama kazanç değerlendirmesini kolaylaştırır."
                      >
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={draft.evidence || ""}
                          onChange={(e) =>
                            setDraft({ ...draft, evidence: e.target.value })
                          }
                          placeholder="Örn. Zemin işaretlemesi yapıldı, 1 haftalık ölçümde bekleme 20 dk'dan 8 dk'ya indi."
                        />
                      </Field>
                    )}
                  </>
                )}
                {modal.type === "finish" && (
                  <>
                    <fieldset className="choice-list">
                      <legend>Öneri uygulandı mı? *</legend>
                      {[
                        [
                          "implemented",
                          "Uygulandı",
                          "Kazanç girişine geçer. Tüm aksiyonlar yapıldı ya da yapılamadı olarak sonuçlanmış, en az biri yapılmış olmalı.",
                        ],
                        [
                          "notImplemented",
                          "Uygulanamadı",
                          'Kazanç adımına gitmez; nedeniyle "Uygulanamadı" olarak kapanır. Öneren bilgilendirilir.',
                        ],
                      ].map(([v, t, d]) => (
                        <label key={v} className="choice">
                          <input
                            type="radio"
                            name="finish-outcome"
                            required
                            value={v}
                            checked={draft.outcome === v}
                            onChange={() => setDraft({ ...draft, outcome: v })}
                          />
                          <span>
                            <b>{t}</b>
                            <small>{d}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {draft.outcome === "notImplemented" && (
                      <>
                        <Field label="Uygulanamama nedeni *">
                          <select
                            required
                            value={draft.reasonCode}
                            onChange={(e) =>
                              setDraft({ ...draft, reasonCode: e.target.value })
                            }
                          >
                            <option value="">Seç…</option>
                            {activeNames(state, "notImplementedReasons").map(
                              (x) => (
                                <option key={x}>{x}</option>
                              ),
                            )}
                          </select>
                        </Field>
                        <Field label="Açıklama (öneren görür) *">
                          <textarea
                            rows={3}
                            required
                            minLength={3}
                            maxLength={1000}
                            value={draft.reason}
                            onChange={(e) =>
                              setDraft({ ...draft, reason: e.target.value })
                            }
                            placeholder="Örn. Yatırım bütçesi 2027'ye kaldı; konu yeniden değerlendirilecek."
                          />
                        </Field>
                      </>
                    )}
                  </>
                )}
                {modal.type === "editWork" && (
                  <Field label="Değişiklik gerekçesi *">
                    <textarea
                      required
                      minLength={3}
                      rows={2}
                      value={draft.reason}
                      onChange={(e) =>
                        setDraft({ ...draft, reason: e.target.value })
                      }
                    />
                  </Field>
                )}
                {modal.type === "gain" && (
                  <>
                    <div className="two-col">
                      <Field label="Kazanç türü">
                        <select
                          value={draft.type}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              type: e.target.value,
                              amount:
                                e.target.value === "Parasal" ? draft.amount : 0,
                            })
                          }
                        >
                          {[
                            ...activeNames(state, "gainTypes"),
                            // Düzeltilen kazancın türü pasife alınmışsa yine görünsün.
                            ...(draft.type &&
                            !activeNames(state, "gainTypes").includes(
                              draft.type,
                            )
                              ? [draft.type]
                              : []),
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Hesaplama dönemi">
                        <select
                          value={draft.period}
                          onChange={(e) =>
                            setDraft({ ...draft, period: e.target.value })
                          }
                        >
                          {["Tek seferlik", "Aylık", "Yıllık"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="two-col">
                      <Field label="Kazanç tutarı (₺)">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={draft.type !== "Parasal"}
                          value={draft.amount}
                          required
                          onChange={(e) =>
                            setDraft({ ...draft, amount: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Uygulama maliyeti (₺)"
                        hint={
                          "Malzeme, işçilik, dış hizmet; yoksa 0." +
                          (draft.type === "Parasal" && Number(draft.amount) > 0
                            ? " İlk yıl net: " +
                              money(
                                gainFigures({
                                  amount: Number(draft.amount),
                                  cost: Number(draft.cost),
                                  period: draft.period,
                                }).net,
                              )
                            : "")
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.cost}
                          required
                          onChange={(e) =>
                            setDraft({ ...draft, cost: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Önceki değer *">
                        <input
                          value={draft.before}
                          required
                          onChange={(e) =>
                            setDraft({ ...draft, before: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Sonraki değer *">
                        <input
                          value={draft.after}
                          required
                          onChange={(e) =>
                            setDraft({ ...draft, after: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Hesaplama / ölçüm açıklaması *">
                      <textarea
                        required
                        minLength={10}
                        rows={4}
                        value={draft.explanation}
                        onChange={(e) =>
                          setDraft({ ...draft, explanation: e.target.value })
                        }
                      />
                    </Field>
                    <div className="info-strip">
                      Müdür onayı:{" "}
                      {who(
                        users.find((x) => x.id === p?.evaluator)?.manager || "",
                      )}{" "}
                      · Onaydan sonra puanlamaya geçer.
                    </div>
                  </>
                )}
                {modal.type === "score" && (
                  <>
                    <div className="info-strip">
                      {scoringOf(state).criteria.length} kriter, 1–
                      {scoringOf(state).scale} arası; ağırlıklı toplam 100
                      üzerinden. Kriterler Tanımlar'dan değiştirilir; verilen
                      puan o anki kriterlerle saklanır.
                    </div>
                    {scoringOf(state).criteria.map((c, i) => (
                      <Field
                        label={
                          c.name +
                          (scoringOf(state).criteria.some(
                            (x) => x.weight !== c.weight,
                          )
                            ? " · ağırlık " + c.weight
                            : "")
                        }
                        hint={c.description}
                        key={c.id}
                      >
                        <div
                          className="score-options"
                          role="group"
                          aria-label={c.name}
                        >
                          {Array.from(
                            { length: scoringOf(state).scale },
                            (_, k) => k + 1,
                          ).map((n) => (
                            <button
                              type="button"
                              key={n}
                              aria-pressed={draft.values[i] === n}
                              className={
                                draft.values[i] === n ? "selected" : ""
                              }
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  values: draft.values.map(
                                    (v: number, j: number) => (j === i ? n : v),
                                  ),
                                })
                              }
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </Field>
                    ))}
                    <div className="score-card">
                      <span>Toplam puan</span>
                      <strong>
                        {scoreTotal(draft.values, scoringOf(state))}
                        <small>/100</small>
                      </strong>
                    </div>
                    {(() => {
                      // Ödül önizlemesi: puan kaydedilince uygulanacak kural (İK yine onaylar).
                      const rs = state?.settings?.rewards;
                      const target = state?.proposals.find(
                        (x) => x.id === detail,
                      );
                      if (!rs?.enabled || !target) return null;
                      const total = scoreTotal(draft.values, scoringOf(state));
                      const { rule } = pickRule(
                        {
                          score: { total, valid: true },
                          gain: target.gain,
                        } as any,
                        rs,
                      );
                      return (
                        <p className="muted reward-preview">
                          {rule
                            ? "Bu puanla ödül önerisi: " +
                              rule.label +
                              " (" +
                              rewardText(rule.kind, rule.value, rule.label) +
                              "). Ödül sorumlusu (İK) onaylar."
                            : "Bu puanla ödül kuralı uygulanmaz."}
                        </p>
                      );
                    })()}
                  </>
                )}
                {modal.type === "matrix" && (
                  <>
                    <p className="muted">{draft.operation}</p>
                    <Field
                      label="Bağlı müdürlük"
                      hint="Bu müdürlüğün müdürü, bu bölümle ilgili tüm önerileri görür. Boş bırakılırsa bölüm sorumlusunun müdürlüğü kullanılır."
                    >
                      <select
                        value={draft.directorate || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, directorate: e.target.value })
                        }
                      >
                        <option value="">
                          Otomatik (bölüm sorumlusunun müdürlüğü)
                        </option>
                        {[...new Set(users.map((u) => u.directorate))]
                          .sort((a, b) => a.localeCompare(b, "tr"))
                          .map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                      </select>
                    </Field>
                    {[
                      ["pre", "Ön değerlendirme"],
                      [
                        "operationOwner",
                        "Bölüm sorumlusu (değerlendirme ve uygulama)",
                      ],
                      ["gain", "Kazanç girişi"],
                      ["score", "Puanlama"],
                    ].map(([key, label]) => (
                      <Field key={key} label={label}>
                        {userSelect(draft[key], (v) =>
                          setDraft({ ...draft, [key]: v }),
                        )}
                      </Field>
                    ))}
                    {(() => {
                      const r = state?.matrix.find(
                        (r) => r.operation === draft.operation,
                      );
                      const keys: any = {
                        [STAGES[0]]: "pre",
                        [STAGES[1]]: "operationOwner",
                        [STAGES[2]]: "operationOwner",
                        [STAGES[3]]: "operationOwner",
                        [STAGES[4]]: "gain",
                        ["Kazanç düzeltmesi bekliyor"]: "gain",
                        [STAGES[6]]: "score",
                      };
                      const affected = proposals.filter(
                        (p) =>
                          p.operation === draft.operation &&
                          keys[p.status] &&
                          r?.[keys[p.status]] !== draft[keys[p.status]],
                      );
                      return affected.length > 0 ? (
                        <div className="transfer-question">
                          <h3>{affected.length} açık iş etkilenecek</h3>
                          <p>
                            Mevcut işler de yeni sorumlulara devredilsin mi?
                          </p>
                          <label>
                            <input
                              type="radio"
                              name="transfer"
                              checked={draft.transfer === true}
                              onChange={() =>
                                setDraft({ ...draft, transfer: true })
                              }
                            />{" "}
                            Evet, mevcut işleri de devret
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="transfer"
                              checked={draft.transfer === false}
                              onChange={() =>
                                setDraft({ ...draft, transfer: false })
                              }
                            />{" "}
                            Hayır, yalnızca yeni atamalarda uygula
                          </label>
                          <details>
                            <summary>Etkilenen işleri gör</summary>
                            {affected.map((p) => (
                              <div key={p.id}>
                                {p.id} · {p.title} ·{" "}
                                {who(draft[keys[p.status]])}
                              </div>
                            ))}
                          </details>
                        </div>
                      ) : (
                        <p className="muted">
                          Mevcut açık işleri etkileyen bir değişiklik yok.
                        </p>
                      );
                    })()}
                  </>
                )}
                {["unit", "operation"].includes(modal.type) && (
                  <Field
                    label={modal.type === "unit" ? "Birim adı" : "Bölüm adı"}
                  >
                    <input
                      required
                      minLength={2}
                      value={draft[modal.type]}
                      onChange={(e) =>
                        setDraft({ ...draft, [modal.type]: e.target.value })
                      }
                    />
                  </Field>
                )}
                {modal.type === "user" && (
                  <>
                    <div className="two-col">
                      <Field label="Ad soyad *">
                        <input
                          required
                          value={draft.name}
                          onChange={(e) =>
                            setDraft({ ...draft, name: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Kullanıcı adı *">
                        <input
                          required
                          pattern="[a-z0-9._-]{3,40}"
                          value={draft.username}
                          onChange={(e) =>
                            setDraft({ ...draft, username: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field
                      label="E-posta"
                      hint="Bildirimler bu adrese gider. Boş bırakılırsa e-posta gönderilmez."
                    >
                      <input
                        type="email"
                        autoComplete="off"
                        value={draft.email || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Rol">
                      <select
                        value={draft.role}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            role: e.target.value,
                            // Rol türü değişince birim seçimi sıfırlanır (departman ↔ direktörlük/genel müdürlük).
                            ...(["director", "gm"].includes(e.target.value) !==
                            ["director", "gm"].includes(draft.role)
                              ? { department: "", directorate: "" }
                              : {}),
                          })
                        }
                      >
                        {Object.entries(ROLES)
                          .filter(
                            ([v]) =>
                              (v !== "director" ||
                                org.levels.division ||
                                draft.role === v) &&
                              (v !== "gm" ||
                                org.levels.group ||
                                draft.role === v),
                          )
                          .map(([v, t]) => (
                            <option key={v} value={v}>
                              {String(t)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {draft.role === "director" || draft.role === "gm" ? (
                      <Field
                        label={
                          draft.role === "director"
                            ? "Direktörlük *"
                            : "Genel müdürlük *"
                        }
                      >
                        <select
                          required
                          value={draft.directorate || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              directorate: e.target.value,
                              department: e.target.value,
                            })
                          }
                        >
                          <option value="">Seç…</option>
                          {(draft.role === "director"
                            ? org.divisions.map((d) => d.name)
                            : org.groups
                          ).map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field
                        label="Departman *"
                        hint={
                          draft.department
                            ? "Müdürlük: " +
                              (org.departments.find(
                                (d) => d.name === draft.department,
                              )?.directorate || "—")
                            : "Liste Tanımlar sayfasından yönetilir."
                        }
                      >
                        <select
                          required
                          value={draft.department || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              department: e.target.value,
                              directorate:
                                org.departments.find(
                                  (d) => d.name === e.target.value,
                                )?.directorate || "",
                            })
                          }
                        >
                          <option value="">Seç…</option>
                          {org.departments
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                            .map((d) => (
                              <option key={d.name} value={d.name}>
                                {d.name} · {d.directorate}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                    <div className="field">
                      <span>Yöneticisi</span>
                      <PersonPicker
                        users={sortedUsers}
                        value={draft.manager || ""}
                        exclude={draft.userId ? [draft.userId] : []}
                        label="Yönetici"
                        onChange={(v: string) =>
                          setDraft({ ...draft, manager: v })
                        }
                      />
                      <small>
                        Kazanç onayı ve pasif sorumlunun işlerinin
                        yönlendirilmesi için kullanılır.
                      </small>
                    </div>
                    <label className="checkbox-line">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) =>
                          setDraft({ ...draft, active: e.target.checked })
                        }
                      />{" "}
                      Hesap aktif
                    </label>
                    {draft.userId &&
                      !draft.active &&
                      (() => {
                        const w = workload(draft.userId);
                        return w.proposals + w.actions + w.matrix > 0 ? (
                          <div className="info-strip">
                            Bu kişinin üzerinde {w.proposals} açık öneri,{" "}
                            {w.actions} aksiyon ve {w.matrix} matris görevi var.
                            Pasife alınabilir; bu işler kişide kalır ve bölümüne
                            gelen yeni işler müdürüne yönlenir. İstediğinde
                            Kullanıcılar sayfasından “İşleri devret” ile
                            aktarabilirsin.
                          </div>
                        ) : null;
                      })()}
                  </>
                )}
                {modal.type === "resubmit" && (
                  <>
                    <Field label="Mevcut durum">
                      <textarea
                        required
                        minLength={10}
                        value={draft.problem}
                        rows={4}
                        onChange={(e) =>
                          setDraft({ ...draft, problem: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Çözüm önerisi">
                      <textarea
                        required
                        minLength={5}
                        value={draft.solution}
                        rows={4}
                        onChange={(e) =>
                          setDraft({ ...draft, solution: e.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                {modal.type === "process" && p && (
                  <>
                    <p className="process-context">
                      {p.id} · {p.title}
                    </p>
                    <div className="process-options">
                      {!CLOSED.includes(p.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            open("transfer", { owner: p.owner, reason: "" })
                          }
                        >
                          <span className="process-option-icon">
                            <Users size={21} />
                          </span>
                          <span>
                            <b>İşi devret</b>
                            <small>Mevcut işi başka bir sorumluya aktar.</small>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                      )}
                      {p.status !== STAGES[0] && (
                        <button
                          type="button"
                          onClick={() =>
                            open("rollback", { target: STAGES[0], reason: "" })
                          }
                        >
                          <span className="process-option-icon">
                            <RotateCcw size={21} />
                          </span>
                          <span>
                            <b>Aşamaya geri al</b>
                            <small>
                              Geçmiş bir aşamayı seçerek yeniden başlat.
                            </small>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                      )}
                      {!["Reddedildi", "İptal edildi"].includes(p.status) && (
                        <button
                          type="button"
                          className="process-option-danger"
                          onClick={() => open("cancel", { reason: "" })}
                        >
                          <span className="process-option-icon">
                            <Ban size={21} />
                          </span>
                          <span>
                            <b>Öneriyi iptal et</b>
                            <small>Gerekçe yazarak süreci sonlandır.</small>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </div>
                  </>
                )}
                {error && <div className="error">{error}</div>}
              </div>
              <footer className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setModal(null);
                    setError("");
                  }}
                >
                  {modal.type === "process" ? "Kapat" : "Vazgeç"}
                </button>
                {modal.type !== "process" && (
                  <button
                    disabled={busy}
                    className={
                      ["cancel", "reject", "deleteImported"].includes(
                        modal.type,
                      )
                        ? "danger"
                        : "primary"
                    }
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Check size={17} />
                    )}{" "}
                    {(
                      {
                        matrix: "Kaydet ve uygula",
                        score: "Puanla ve tamamla",
                        accept: "Kabul et",
                        reports: "Kaydet",
                        reassign: "Devret",
                        actionDone: "Kaydet",
                        finish: "Sonucu kaydet",
                        undoTransfer: "Geri al",
                        deleteImported: "Kalıcı olarak sil",
                        duplicate: "Mükerrer olarak işaretle",
                        prefs: "Kaydet",
                        reject: "Reddet",
                        revision: "Revizyon iste",
                        forward: "Yönlendir",
                        transfer: "Devret",
                        bulkTransfer: "Devret",
                        rollback: "Geri al",
                        cancel: "İptal et",
                        gainReturn: "Düzeltmeye gönder",
                        addAction: "Aksiyonu ekle",
                        resubmit: "Tekrar gönder",
                      } as Record<string, string>
                    )[modal.type] || "Kaydet"}
                  </button>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
  /** Tıklanınca o sütuna göre sıralayan başlık; aynı sütuna tekrar tıklamak yönü çevirir. */
  function sortHeader(key: string, label: string) {
    const active = sortBy.key === key;
    return (
      <th
        aria-sort={
          active ? (sortBy.dir === 1 ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          className={"sort-button " + (active ? "active" : "")}
          onClick={() =>
            setSortBy({
              key,
              dir: active ? (-sortBy.dir as 1 | -1) : key === "wait" ? -1 : 1,
            })
          }
        >
          {label}
          <span aria-hidden="true">
            {active ? (sortBy.dir === 1 ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  }
  function renderTable(items: Proposal[], selectable: boolean) {
    return (
      <>
        <div className="mobile-proposals">
          {items.map((item) => (
            <article className="mobile-proposal-card" key={item.id}>
              <div className="mobile-card-top">
                {selectable && canManage && selectableOf(item) && (
                  <input
                    type="checkbox"
                    aria-label={item.id + " seç"}
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, item.id]
                          : selected.filter((x) => x !== item.id),
                      )
                    }
                  />
                )}
                <span>{item.id}</span>
                <Badge status={item.status} />
              </div>
              <button
                className="mobile-card-title"
                onClick={() => selectDetail(item.id)}
              >
                {item.title}
              </button>
              <div className="mobile-card-meta">
                <span>{item.operation}</span>
                <span>·</span>
                <span>{who(item.author)}</span>
              </div>
              {waiting(item).length > 0 && (
                <div className="mobile-card-wait">
                  <Clock size={14} />
                  {waiting(item).join(", ")} bekleniyor
                </div>
              )}
              <button
                className="mobile-card-action"
                onClick={() => openWork(item)}
              >
                <div>
                  <small>
                    {CLOSED.includes(item.status)
                      ? "Süreç kapalı"
                      : who(item.owner) + " · " + age(item.stageAt) + " gün"}
                    {overdueDays(item) > 0 && (
                      <b className="overdue">
                        {" "}
                        · {overdueDays(item)} gün gecikti
                      </b>
                    )}
                  </small>
                  <b>{nextStep(item, user?.id || "").title}</b>
                </div>
                <ArrowRight size={18} />
              </button>
            </article>
          ))}
          {!items.length && (
            <div className="empty">
              <Search />
              <h3>Öneri bulunamadı</h3>
              <p>
                Filtrelerini değiştirebilir veya yeni bir öneri verebilirsin.
              </p>
            </div>
          )}
        </div>
        <div className="table-scroll desktop-proposals">
          <table className="proposals-table">
            <thead>
              <tr>
                {selectable && canManage && (
                  <th className="check-cell">
                    <input
                      type="checkbox"
                      aria-label="Tüm açık işleri seç"
                      checked={
                        items.some(selectableOf) &&
                        items
                          .filter(selectableOf)
                          .every((p) => selected.includes(p.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? items.filter(selectableOf).map((p) => p.id)
                            : [],
                        )
                      }
                    />
                  </th>
                )}
                {sortHeader("title", "Öneri")}
                {sortHeader("author", "Öneren / departman")}
                {sortHeader("status", "Durum")}
                {sortHeader("owner", "Sorumlu")}
                <th>Bekleyen birim</th>
                <th>
                  <span className="sr-only">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => selectDetail(p.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") selectDetail(p.id);
                  }}
                >
                  {selectable && canManage && (
                    <td
                      className="check-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        aria-label={p.id + " seç"}
                        type="checkbox"
                        disabled={!selectableOf(p)}
                        checked={selected.includes(p.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, p.id]
                              : selected.filter((x) => x !== p.id),
                          )
                        }
                      />
                    </td>
                  )}
                  <td>
                    <small className="proposal-id">
                      {p.id} <span>· {p.operation}</span>
                    </small>
                    <b className="proposal-title">{p.title}</b>
                  </td>
                  <td>
                    <span>{who(p.author)}</span>
                    <small>{p.department}</small>
                  </td>
                  <td>
                    <Badge status={p.status} />
                    {!CLOSED.includes(p.status) && (
                      <small className="stage-age">
                        <StageAge p={p} />
                      </small>
                    )}
                  </td>
                  <td>
                    {p.owner ? (
                      <div className="person">
                        <Avatar small name={who(p.owner)} />
                        <span>{who(p.owner)}</span>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {waiting(p).length ? (
                      <div className="waiting-tags">
                        {supportWaits(p).map((w) => (
                          <span key={w.id} title={supportWaitText(w)}>
                            {w.unit}
                            {w.ticket ? " · " + w.ticket : ""}
                            {w.days !== undefined ? " · " + w.days + " g" : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <ChevronRight size={17} className="muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty">
              <Search />
              <h3>Bu görünümde öneri yok</h3>
              <p>Filtreleri değiştirebilir veya yeni öneri oluşturabilirsin.</p>
            </div>
          )}
        </div>
      </>
    );
  }
  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (modal.type === "process") return;
    if (modal.type === "prefs") {
      const r = await command(
        { action: "myPrefs", notify: draft.notify },
        true,
        "Bildirim tercihin kaydedildi.",
      );
      if (r && user) setUser({ ...user, notify: draft.notify });
      return;
    }
    if (modal.type === "deleteImported") {
      const r = await command(
        draft.batch
          ? { action: "deleteImported", batch: draft.batch }
          : {
              action: "deleteImported",
              ids: draft.items.map((p: any) => p.id),
            },
        true,
        (b: any) =>
          (b.id?.removed || 0) +
          " aktarılan öneri silindi" +
          (draft.batch ? "; aktarım geri alındı." : "."),
      );
      if (r) {
        setSelected([]);
        if (draft.items.some((p: any) => p.id === detail)) setDetail(null);
      }
      return;
    }
    if (modal.type === "bulkTransfer") {
      setBusy(true);
      let currentVersion = version;
      // Aynı toplu devirdeki kayıtlar tek seferde geri alınabilsin diye ortak bir kimlik taşır.
      const batch = crypto.randomUUID();
      let done = 0;
      try {
        for (const id of selected) {
          const r = await fetch("/api/command", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "transfer",
                id,
                ...draft,
                batch,
                version: currentVersion,
              }),
            }),
            b: any = await r.json();
          if (!r.ok) throw Error(b.error);
          currentVersion = b.version ?? currentVersion + 1;
          done++;
        }
        await refresh();
        setSelected([]);
        setModal(null);
        alert(
          done +
            " iş devredildi. Kullanıcılar sayfasındaki Devir geçmişi'nden geri alabilirsin.",
        );
      } catch (err: any) {
        await refresh();
        setError(done + " iş devredildi. " + err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const messages: Record<string, string> = {
      accept: "Öneri kabul edildi ve bir sonraki aşamaya geçti.",
      reports: "Pano rapor ayarları kaydedildi.",
      org: "Kurum adı güncellendi.",
      reassign: "İşler devredildi.",
      actionDone: "Aksiyon sonucu kaydedildi.",
      finish: "Uygulama sonucu kaydedildi.",
      undoTransfer: "Devir geri alındı.",
      duplicate:
        "Öneri mükerrer olarak işaretlendi ve önceki öneriye bağlandı.",
      prefs: "Bildirim tercihin kaydedildi.",
      reject: "Öneri reddedildi. Öneren kişi gerekçeni görebilir.",
      revision: "Revizyon istendi. Öneri sahibine iletildi.",
      forward: "Öneri yönlendirildi.",
      resubmit: "Önerin güncellendi ve tekrar değerlendirmeye gönderildi.",
    };
    const settingsAction: Record<string, string> = {
      actionDone: "actionUpdate",
      reports: "reportSettings",
      org: "orgSettings",
      reassign: "reassignUser",
      undoTransfer: "undoTransfer",
      prefs: "myPrefs",
    };
    const action = settingsAction[modal.type] || modal.type;
    const result = await command(
      {
        ...draft,
        action,
        id:
          settingsAction[modal.type] && modal.type !== "actionDone"
            ? undefined
            : detail,
      },
      true,
      modal.type === "undoTransfer"
        ? (b: any) =>
            "Devir geri alındı: " +
            (b.id?.reverted ?? 0) +
            " kayıt eski sorumluya döndü" +
            (b.id?.skipped
              ? ", " + b.id.skipped + " kayıt sonradan değiştiği için atlandı."
              : ".")
        : modal.type === "reassign"
          ? (b: any) =>
              "Devredildi: " +
              (b.id?.proposals ?? 0) +
              " öneri, " +
              (b.id?.actions ?? 0) +
              " aksiyon, " +
              (b.id?.matrixSlots ?? 0) +
              " matris görevi. Devir geçmişinden geri alabilirsin."
          : messages[modal.type],
    );
    if (result && modal.type === "operation")
      alert(
        "Bölüm eklendi. Varsayılan atamalar yöneticiye yapıldı; matrisi düzenleyebilirsin.",
      );
  }
}
