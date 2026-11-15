// E-posta bildirim kuralları (saf fonksiyonlar; veritabanı ve gönderimden bağımsız, test edilebilir).
// Süreç (workflow) her değişiklikte bir "olay" üretir; bu dosya olayları kurallara göre alıcılara ve
// e-posta içeriklerine çevirir. Gönderim lib/outbox.ts ve lib/mailer.ts içindedir.
import { translate as tr } from "./i18n";
import {
  CLOSED,
  Proposal,
  STAGE_TARGET_DAYS,
  age,
  overdueDays,
  supportWaits,
  supportWaitText,
} from "./model";

export type NotifyEvent = {
  type:
    | "created"
    | "stage"
    | "revision"
    | "rejected"
    | "completed"
    | "comment"
    | "transfer"
    | "action"
    | "reward"
    | "notImplemented";
  proposalId: string;
  actor: string;
  from?: string;
  to?: string;
  prevOwner?: string;
  actionId?: string;
  text?: string;
};

/** Kural tablosu: her olay kime gider. Yönetici Tanımlar'dan her kuralı kapatabilir. */
export const NOTIFY_RULES = [
  {
    key: "created",
    title: "Öneri gönderildi",
    to: "Öneren (alındı bilgisi) ve ön değerlendirici",
  },
  {
    key: "stage",
    title: "Kabul / aşama değişti",
    to: "Öneren, birlikte önerenler ve yeni sorumlu",
  },
  {
    key: "revision",
    title: "Revizyon istendi",
    to: "Öneren ve birlikte önerenler (gerekçeyle)",
  },
  {
    key: "rejected",
    title: "Öneri reddedildi",
    to: "Öneren ve birlikte önerenler (gerekçeyle)",
  },
  {
    key: "completed",
    title: "Öneri tamamlandı (puanlandı)",
    to: "Öneren ve birlikte önerenler",
  },
  {
    key: "comment",
    title: "Yorum yazıldı",
    to: "Öneriyle ilgili diğer kişiler",
  },
  { key: "transfer", title: "Devir / yönlendirme", to: "Eski ve yeni sorumlu" },
  { key: "action", title: "Aksiyon atandı", to: "Aksiyon sorumlusu" },
  {
    key: "notImplemented",
    title: "Öneri uygulanamadı",
    to: "Öneren ve birlikte önerenler (nedeniyle)",
  },
  {
    key: "reward",
    title: "Ödül kararı",
    to: "Ödül sorumlusu (yeni ödül); öneren ve birlikte önerenler (onay, ödeme, ret)",
  },
  {
    key: "overdue",
    title: "Hedef süre aşıldı (günlük tek e-posta)",
    to: "Sorumluya her sabah tek tablo: öneri no, başlık, aşama, bekleme ve gecikme günü, destek talep no; belirlenen gün kadar daha geçerse müdürüne de",
  },
  {
    key: "actionDue",
    title: "Aksiyon hedef tarihi yaklaştı / geçti",
    to: "Aksiyon sorumlusu (aynı günlük e-postada)",
  },
] as const;

export type Recipient = {
  id: string;
  name: string;
  email?: string;
  active?: number;
  manager?: string;
  notify?: string;
  role?: string;
};
export type Message = {
  userId: string;
  email: string;
  subject: string;
  html: string;
  text: string;
  eventKey: string;
  proposalId?: string;
};

const esc = (s: string) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Basit, e-posta istemcilerinde güvenle görünen HTML şablonu. */
export function renderEmail(
  title: string,
  lines: string[],
  link?: { url: string; label: string },
) {
  // E-postanın dili kurulumun dilidir (IVME_LANG → worker/index.ts). Türkçede tr() metni olduğu gibi bırakır.
  title = tr(title);
  lines = lines.map((l) => tr(l));
  if (link) link = { ...link, label: tr(link.label) };
  const html =
    `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#1f1d3a">` +
    `<p style="font-size:13px;color:#65557a;margin:0 0 8px">${esc(tr("İvme · Öneri ve Kaizen Merkezi"))}</p>` +
    `<h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2>` +
    lines
      .map(
        (l) =>
          `<p style="font-size:14px;line-height:1.5;margin:0 0 8px">${esc(l)}</p>`,
      )
      .join("") +
    (link
      ? `<p style="margin:16px 0"><a href="${esc(link.url)}" style="background:#5b45d6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">${esc(link.label)}</a></p>`
      : "") +
    `<p style="font-size:12px;color:#65557a;margin-top:20px">${esc(tr("Bildirim tercihini uygulamada adının yanındaki menüden değiştirebilirsin."))}</p></div>`;
  const text = [
    title,
    "",
    ...lines,
    link ? "\n" + link.label + ": " + link.url : "",
  ].join("\n");
  return { html, text };
}

/** Olayları, kurallara ve kişilerin tercihlerine göre e-postalara çevirir.
 * - Kapatılan kurallar atlanır; işlemi yapan kişiye kendi işlemi için e-posta gitmez.
 * - Pasif kişilere ve e-postası olmayanlara gönderilmez; tercihi "off" olanlar atlanır.
 * - Aynı kişiye aynı öneri için aynı işlemde tek e-posta gider. */
export function buildMessages(
  events: NotifyEvent[],
  proposals: Proposal[],
  users: Recipient[],
  opts: { disabled?: string[]; appUrl: string },
): Message[] {
  const out: Message[] = [];
  const seen = new Set<string>();
  const who = (id?: string) => users.find((u) => u.id === id);
  const name = (id?: string) => who(id)?.name || "—";
  // İşlemi yapan kişiye e-posta gitmez; tek istisna önerenin "önerin alındı" bilgisidir (self).
  const add = (
    userId: string | undefined,
    ev: NotifyEvent,
    p: Proposal,
    title: string,
    lines: string[],
    self = false,
  ) => {
    const u = who(userId);
    if (
      !u ||
      !u.email ||
      u.active === 0 ||
      u.notify === "off" ||
      (userId === ev.actor && !self)
    )
      return;
    const key = userId + "|" + p.id + "|" + ev.type;
    if (seen.has(key)) return;
    seen.add(key);
    const { html, text } = renderEmail(title, lines, {
      url: opts.appUrl + "/?oneri=" + encodeURIComponent(p.id),
      label: "Öneriyi aç",
    });
    out.push({
      userId: u.id,
      email: u.email,
      subject: "[İvme] " + p.id + " · " + tr(title),
      html,
      text,
      eventKey: ev.type,
      proposalId: p.id,
    });
  };
  for (const ev of events) {
    if (opts.disabled?.includes(ev.type)) continue;
    const p = proposals.find((x) => x.id === ev.proposalId);
    if (!p) continue;
    const authors = [p.author, ...(p.coAuthors || [])];
    const head = "“" + p.title + "” (" + p.operation + ")";
    switch (ev.type) {
      case "created":
        add(
          p.author,
          ev,
          p,
          "Önerin alındı",
          [
            head,
            "Numaran: " + p.id,
            "Ön değerlendirme için " + name(p.owner) + " kişisine iletildi.",
          ],
          true,
        );
        add(p.owner, ev, p, "Değerlendirmeni bekleyen yeni öneri", [
          head,
          "Öneren: " + (p.anonymous ? "Anonim (adı gizli)" : name(p.author)),
          "Hedef süre: " + (STAGE_TARGET_DAYS[p.status] || "—") + " gün.",
        ]);
        break;
      case "stage":
        for (const a of authors)
          add(a, ev, p, "Önerin bir sonraki aşamaya geçti", [
            head,
            "Yeni aşama: " + ev.to,
            "Sorumlu: " + name(p.owner),
          ]);
        if (!CLOSED.includes(p.status))
          add(p.owner, ev, p, "Sende bekleyen öneri: " + ev.to, [
            head,
            "Önceki aşama: " + (ev.from || "—"),
            "Hedef süre: " + (STAGE_TARGET_DAYS[p.status] || "—") + " gün.",
          ]);
        break;
      case "revision":
        for (const a of authors)
          add(a, ev, p, "Önerin için revizyon istendi", [
            head,
            "Açıklama: " + (ev.text || "—"),
            "Düzenleyip tekrar gönderebilirsin.",
          ]);
        break;
      case "rejected":
        for (const a of authors)
          add(a, ev, p, "Önerin sonuçlandı: uygun bulunmadı", [
            head,
            (p.rejectReason ? "Neden: " + p.rejectReason + ". " : "") +
              "Açıklama: " +
              (ev.text || "—"),
          ]);
        break;
      case "completed":
        for (const a of authors)
          add(
            a,
            ev,
            p,
            "Önerin hayata geçti",
            [
              head,
              p.score?.valid ? "Puan: " + p.score.total + " / 100" : "",
              "Katkın için teşekkürler.",
            ].filter(Boolean),
          );
        break;
      case "comment": {
        const involved = new Set([
          ...authors,
          p.owner,
          p.evaluator,
          ...(p.comments || []).map((c) => c.actor),
        ]);
        // Anonim öneride öneren yorum yazarsa adı yerine "Öneren" görünür (önerenin kendisine zaten gitmez).
        const writer =
          p.anonymous && ev.actor === p.author ? "Öneren" : name(ev.actor);
        for (const id of involved)
          add(id, ev, p, "Öneriye yeni yorum: " + writer, [
            head,
            "“" + (ev.text || "") + "”",
          ]);
        break;
      }
      case "transfer":
        add(ev.prevOwner, ev, p, "Öneri senden devredildi", [
          head,
          "Yeni sorumlu: " + name(p.owner),
          "Açıklama: " + (ev.text || "—"),
        ]);
        add(p.owner, ev, p, "Öneri sana devredildi", [
          head,
          "Önceki sorumlu: " + name(ev.prevOwner),
          "Aşama: " + p.status,
          "Açıklama: " + (ev.text || "—"),
        ]);
        break;
      case "notImplemented":
        for (const a of authors)
          add(a, ev, p, "Önerin uygulanamadı", [
            head,
            "Neden: " + (ev.text || "—"),
            "Katkın için teşekkürler; konu ileride yeniden değerlendirilebilir.",
          ]);
        break;
      case "reward": {
        // Ödül: değer bilgisi e-postaya yazılmaz (maaşla ilgili); kişi uygulamada görür.
        if (ev.text === "created")
          for (const r of users.filter((x) => x.role === "reward"))
            add(r.id, ev, p, "Ödül onayı bekliyor", [
              head,
              "Puanlama tamamlandı; ödül kuralına göre kayıt oluştu.",
              "Ödüller sayfasından onaylayabilir ya da değiştirebilirsin.",
            ]);
        else
          for (const a of authors)
            add(
              a,
              ev,
              p,
              ev.text === "paid"
                ? "Ödülün ödendi"
                : ev.text === "approved"
                  ? "Önerin ödül aldı"
                  : "Ödül değerlendirmen sonuçlandı",
              [
                head,
                ev.text === "paid"
                  ? "Ödül bordro ile ödendi."
                  : ev.text === "approved"
                    ? "Ödülün onaylandı; ayrıntısı önerinin sayfasında. Bordro döneminde ek ödeme olarak verilecek."
                    : "Bu öneri için ödül verilmedi; açıklama önerinin sayfasında.",
              ],
            );
        break;
      }
      case "action": {
        const a = p.actions.find((x) => x.id === ev.actionId);
        if (a)
          add(
            a.owner,
            ev,
            p,
            "Sana aksiyon atandı: " + a.title,
            [
              head,
              "Hedef tarih: " + a.due,
              a.description ? "Açıklama: " + a.description : "",
            ].filter(Boolean),
          );
        break;
      }
    }
  }
  return out;
}

/** Tablolu e-posta: başlık, kısa açıklama, bölümler (her biri başlık + tablo) ve bağlantı. */
export function renderTableEmail(
  title: string,
  intro: string,
  sections: { title: string; head: string[]; rows: string[][] }[],
  link: { url: string; label: string },
) {
  title = tr(title);
  intro = tr(intro);
  sections = sections.map((sec) => ({
    title: tr(sec.title),
    head: sec.head.map((h) => tr(h)),
    rows: sec.rows.map((r) => r.map((c) => tr(c))),
  }));
  link = { ...link, label: tr(link.label) };
  const cell =
    "padding:6px 8px;border-bottom:1px solid #e9eaf1;font-size:13px;text-align:left;vertical-align:top";
  const html =
    `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:720px;color:#1f1d3a">` +
    `<p style="font-size:13px;color:#65557a;margin:0 0 8px">${esc(tr("İvme · Öneri ve Kaizen Merkezi"))}</p>` +
    `<h2 style="font-size:18px;margin:0 0 8px">${esc(title)}</h2>` +
    `<p style="font-size:14px;margin:0 0 12px">${esc(intro)}</p>` +
    sections
      .map(
        (sec) =>
          `<h3 style="font-size:15px;margin:16px 0 6px">${esc(sec.title)} (${sec.rows.length})</h3>` +
          `<table style="border-collapse:collapse;width:100%"><thead><tr>` +
          sec.head
            .map(
              (h) =>
                `<th style="${cell};color:#65557a;font-weight:600">${esc(h)}</th>`,
            )
            .join("") +
          `</tr></thead><tbody>` +
          sec.rows
            .map(
              (r) =>
                `<tr>${r
                  .map((c) =>
                    // Öneri numarası doğrudan öneriyi açan bağlantıdır ve tek satırda kalır.
                    /^KZ-\d{4}-\d+$/.test(c)
                      ? `<td style="${cell};white-space:nowrap"><a href="${esc(link.url.replace(/\/$/, "") + "/?oneri=" + encodeURIComponent(c))}" style="color:#5b45d6">${esc(c)}</a></td>`
                      : `<td style="${cell}">${esc(c)}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("") +
          `</tbody></table>`,
      )
      .join("") +
    `<p style="margin:18px 0"><a href="${esc(link.url)}" style="background:#5b45d6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">${esc(link.label)}</a></p>` +
    `<p style="font-size:12px;color:#65557a;margin-top:20px">${esc(tr("Bu e-posta günde bir kez gelir. Bildirim tercihini uygulamada adının yanındaki menüden değiştirebilirsin."))}</p></div>`;
  const text = [
    title,
    intro,
    ...sections.flatMap((sec) => [
      "",
      sec.title + " (" + sec.rows.length + ")",
      sec.head.join(" | "),
      ...sec.rows.map((r) => r.join(" | ")),
    ]),
    "",
    link.label + ": " + link.url,
  ].join("\n");
  return { html, text };
}

/** Günlük gecikme özeti: her kişiye TEK e-posta.
 *  - Sorumlusu olduğu, hedef süresi geçmiş öneriler: öneri no, başlık, aşama, kaç gündür beklediği, kaç gün geciktiği, destek beklemesi.
 *  - Müdüre: ekibinde escalateAfterDays günden fazla gecikmiş öneriler (sorumlu adıyla; gecikme destek birimindeyse talep no).
 *  - Aksiyon sorumlusuna: hedef tarihi 2 gün içinde gelen ya da geçen aksiyonlar.
 * Gecikmesi en çok olan üstte. Kural kapalıysa (overdue / actionDue) ilgili bölüm çıkmaz. */
export function buildReminders(
  proposals: Proposal[],
  users: Recipient[],
  opts: {
    disabled?: string[];
    appUrl: string;
    escalateAfterDays?: number;
    today?: string;
  },
): Message[] {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const who = (id?: string) => users.find((u) => u.id === id);
  const waitText = (p: Proposal) =>
    supportWaits(p)
      .map(
        (w) =>
          w.unit +
          (w.ticket ? " · " + w.ticket : "") +
          (w.days !== undefined ? " · " + w.days + " g" : ""),
      )
      .join("; ") || "—";
  type Row = { sort: number; cells: string[] };
  const box = new Map<string, { own: Row[]; team: Row[]; actions: Row[] }>();
  const slot = (id?: string) => {
    const u = who(id);
    if (!u || !u.email || u.active === 0 || u.notify === "off") return null;
    if (!box.has(u.id)) box.set(u.id, { own: [], team: [], actions: [] });
    return box.get(u.id)!;
  };
  if (!opts.disabled?.includes("overdue"))
    for (const p of proposals) {
      const late = overdueDays(p);
      if (!late) continue;
      slot(p.owner)?.own.push({
        sort: late,
        cells: [
          p.id,
          p.title,
          p.status,
          String(age(p.stageAt)),
          String(late),
          waitText(p),
        ],
      });
      if (late >= (opts.escalateAfterDays ?? 5)) {
        const owner = who(p.owner);
        slot(owner?.manager)?.team.push({
          sort: late,
          cells: [
            p.id,
            p.title,
            p.status,
            owner?.name || "—",
            String(late),
            waitText(p),
          ],
        });
      }
    }
  if (!opts.disabled?.includes("actionDue"))
    for (const p of proposals.filter((x) => !CLOSED.includes(x.status)))
      for (const a of p.actions) {
        if (
          ["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(a.status) ||
          !a.due
        )
          continue;
        const days = Math.round(
          (Date.parse(a.due) - Date.parse(today)) / 86400000,
        );
        if (days > 2) continue;
        slot(a.owner)?.actions.push({
          sort: -days,
          cells: [
            p.id,
            a.title,
            a.due,
            days < 0
              ? -days + " gün geçti"
              : days === 0
                ? "Bugün"
                : days + " gün kaldı",
          ],
        });
      }
  const out: Message[] = [];
  for (const [userId, b] of box) {
    const u = who(userId)!;
    const by = (rows: Row[]) =>
      rows.sort((x, y) => y.sort - x.sort).map((r) => r.cells);
    const sections = [
      b.own.length && {
        title: "Hedef süresini aşan önerilerin",
        head: [
          "Öneri no",
          "Başlık",
          "Aşama",
          "Bekleme (gün)",
          "Gecikme (gün)",
          "Destek / talep no",
        ],
        rows: by(b.own),
      },
      b.team.length && {
        title: "Ekibinde gecikmesi uzayan öneriler",
        head: [
          "Öneri no",
          "Başlık",
          "Aşama",
          "Sorumlu",
          "Gecikme (gün)",
          "Destek / talep no",
        ],
        rows: by(b.team),
      },
      b.actions.length && {
        title: "Hedef tarihi yaklaşan ya da geçen aksiyonların",
        head: ["Öneri no", "Aksiyon", "Hedef tarih", "Durum"],
        rows: by(b.actions),
      },
    ].filter(Boolean) as { title: string; head: string[]; rows: string[][] }[];
    if (!sections.length) continue;
    const parts = [
      b.own.length && b.own.length + " geciken öneri",
      b.team.length && b.team.length + " ekip gecikmesi",
      b.actions.length && b.actions.length + " aksiyon",
    ].filter(Boolean);
    const subject = tr("Günlük gecikme özeti") + " · " + parts.map((x) => tr(String(x))).join(", ");
    const { html, text } = renderTableEmail(
      subject,
      "Merhaba " + u.name + ", bugün ilgilenmen gerekenler:",
      sections,
      {
        url: opts.appUrl + "/",
        label: "İşlerimi aç",
      },
    );
    out.push({
      userId,
      email: u.email!,
      subject: "[İvme] " + subject,
      html,
      text,
      eventKey: "daily",
    });
  }
  return out;
}

/** Aynı kişiye giden birden çok e-postayı tek özet e-postada birleştirir (günlük özet ve kalabalık işlemler). */
export function combine(
  messages: Message[],
  subject: string,
  appUrl: string,
): Message[] {
  const byUser = new Map<string, Message[]>();
  for (const m of messages)
    byUser.set(m.userId, [...(byUser.get(m.userId) || []), m]);
  const out: Message[] = [];
  for (const [userId, list] of byUser) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const { html, text } = renderEmail(
      tr(subject) + " (" + list.length + ")",
      list.map((m) => "• " + m.subject.replace(/^\[İvme\] /, "")),
      { url: appUrl + "/", label: "İvme'yi aç" },
    );
    out.push({
      userId,
      email: list[0].email,
      subject: "[İvme] " + tr(subject) + " (" + list.length + ")",
      html,
      text,
      eventKey: "digest",
    });
  }
  return out;
}
