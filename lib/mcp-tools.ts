// MCP araçları (yapay zekâ paketi). Saf fonksiyonlar: veritabanı ve ağdan bağımsız, test edilebilir.
//
// Kurallar:
//  - Araçlar web arayüzünün kullandığı çekirdeği kullanır: görme yetkisi canSee, anonimlik redactProposal,
//    gecikme overdueDays, destek beklemesi supportWaits, benzerlik findSimilarSafe. Kural kopyalanmaz.
//  - Model, kullanıcının web'de göremediği hiçbir kaydı göremez; anonim önerenin adı burada da gizlidir.
//  - Hepsi salt okumadır. Kabul, ret, devir gibi kararlar web'de kalır.
//  - Ekler (fotoğraf, PDF) modele gönderilmez; yalnız adları ve türleri.
import {
  ANON,
  CLOSED,
  STAGE_TARGET_DAYS,
  State,
  Proposal,
  age,
  canSee,
  overdueDays,
  redactProposal,
  supportWaits,
} from "./model";
import { findSimilarSafe } from "./similarity";

type Viewer = {
  id: string;
  role: string;
  directorate: string;
  department?: string;
  name?: string;
};
type U = {
  id: string;
  name: string;
  department: string;
  directorate: string;
  role: string;
  active?: number;
};

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: any;
};

const LIMIT = 50;

export const MCP_TOOLS: ToolDef[] = [
  {
    name: "bekleyen_islerim",
    title: "Bekleyen işlerim",
    description:
      "Kullanıcının üzerindeki açık öneriler ve aksiyonlar: aşama, kaç gündür beklediği, hedef süre, gecikme ve destek birimi beklemesi (talep no). Gecikenler önce gelir.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "oneri_detayi",
    title: "Öneri detayı",
    description:
      "Tek bir önerinin ayrıntısı: sorun, çözüm, aşama, sorumlu, aksiyonlar, destek beklemeleri, kazanç ve son hareketler. Yalnızca kullanıcının görme yetkisi olan öneriler.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Öneri numarası, ör. KZ-2026-0073" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "benzer_oneriler",
    title: "Benzer öneriler",
    description:
      "Kayıtlı bir öneriye (id) ya da yazılmakta olan bir metne benzeyen öneriler: numara, başlık, bölüm, durum, benzerlik puanı ve ortak kelimeler. Mükerrer kararını insan verir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Kayıtlı öneri numarası" },
        baslik: { type: "string" },
        sorun: { type: "string" },
        cozum: { type: "string" },
        bolum: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gecikenler",
    title: "Hedef süresini aşan öneriler",
    description:
      "Kullanıcının görebildiği öneriler arasında aşamasının hedef süresini aşanlar; sorumlu ve müdürlük kırılımıyla. Gecikme destek birimindeyse talep numarası da verilir.",
    inputSchema: {
      type: "object",
      properties: {
        en_az_gun: {
          type: "integer",
          minimum: 0,
          maximum: 365,
          description: "En az kaç gün gecikmiş olsun (varsayılan 0)",
        },
        mudurluk: { type: "string", description: "Yalnız bu müdürlük" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kazanc_ozeti",
    title: "Onaylı kazanç özeti",
    description:
      "Kullanıcının görebildiği önerilerde onaylanmış kazançların özeti: dönem (tek seferlik/aylık/yıllık), tür ve bölüm kırılımı. Tarih aralığı kazanç onay tarihine göredir.",
    inputSchema: {
      type: "object",
      properties: {
        baslangic: { type: "string", description: "YYYY-AA-GG" },
        bitis: { type: "string", description: "YYYY-AA-GG" },
        bolum: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

export class ToolError extends Error {}

export async function runTool(
  name: string,
  args: any,
  state: State,
  users: U[],
  viewer: Viewer,
) {
  const a = args && typeof args === "object" ? args : {};
  const ctx = { users, matrix: state.matrix, org: state.settings?.org };
  const visible = state.proposals
    .filter((p) => canSee(p, viewer as any, ctx))
    .map((p) => redactProposal(p, viewer.id));
  const name_ = (id?: string) =>
    id === ANON
      ? "Anonim çalışan"
      : users.find((u) => u.id === id)?.name || "—";
  const dirOf = (id?: string) =>
    users.find((u) => u.id === id)?.directorate || "—";
  const brief = (p: Proposal) => ({
    id: p.id,
    baslik: p.title,
    bolum: p.operation,
    durum: p.status,
    asamada_gun: age(p.stageAt),
    hedef_gun: STAGE_TARGET_DAYS[p.status] ?? null,
    gecikme_gun: overdueDays(p),
    sorumlu: name_(p.owner),
    destek_bekleyen: supportWaits(p).map((w) => ({
      birim: w.unit,
      talep_no: w.ticket || null,
      gun: w.days ?? null,
    })),
  });

  switch (name) {
    case "bekleyen_islerim": {
      const props = visible
        .filter((p) => p.owner === viewer.id && !CLOSED.includes(p.status))
        .map(brief);
      props.sort(
        (x, y) =>
          y.gecikme_gun - x.gecikme_gun || y.asamada_gun - x.asamada_gun,
      );
      const today = new Date().toISOString().slice(0, 10);
      const actions = visible.flatMap((p) =>
        CLOSED.includes(p.status)
          ? []
          : (p.actions || [])
              .filter(
                (x: any) =>
                  x.owner === viewer.id &&
                  !["Tamamlandı", "İptal edildi", "Yapılamadı"].includes(
                    x.status,
                  ),
              )
              .map((x: any) => ({
                oneri: p.id,
                oneri_baslik: p.title,
                aksiyon: x.title,
                hedef_tarih: x.due,
                kalan_gun: x.due
                  ? Math.round(
                      (Date.parse(x.due) - Date.parse(today)) / 86400000,
                    )
                  : null,
                durum: x.status,
              })),
      );
      actions.sort((x, y) => (x.kalan_gun ?? 999) - (y.kalan_gun ?? 999));
      return {
        oneriler: props.slice(0, LIMIT),
        aksiyonlar: actions.slice(0, LIMIT),
        ozet: {
          oneri: props.length,
          geciken_oneri: props.filter((p) => p.gecikme_gun > 0).length,
          aksiyon: actions.length,
        },
      };
    }
    case "oneri_detayi": {
      const id = String(a.id || "")
        .trim()
        .toUpperCase();
      const p = visible.find((x) => x.id === id);
      if (!p)
        throw new ToolError(
          id + " bulunamadı ya da bu öneriyi görme yetkin yok.",
        );
      const campaign = state.settings?.campaigns?.find(
        (c) => c.id === p.campaign,
      )?.title;
      return {
        ...brief(p),
        oneren:
          p.anonymous && p.author === ANON ? "Anonim çalışan" : name_(p.author),
        birlikte_onerenler: (p.coAuthors || []).map(name_),
        departman: p.department,
        mudurluk: p.directorate,
        kategori: p.category,
        lokasyon: p.location || null,
        kampanya: campaign || null,
        gonderim: p.created.slice(0, 10),
        sorun: p.problem,
        cozum: p.solution,
        beklenen_fayda: p.expectedBenefit || null,
        ret_nedeni: p.rejectReason || null,
        mukerrer_oldugu: p.duplicateOf || null,
        aksiyonlar: (p.actions || []).map((x: any) => ({
          is: x.title,
          sorumlu: name_(x.owner),
          hedef_tarih: x.due,
          durum: x.status,
        })),
        kazanc:
          p.gain && p.gain.valid !== false
            ? {
                tur: p.gain.type,
                tutar: p.gain.amount,
                donem: p.gain.period,
                onceki: p.gain.before,
                sonraki: p.gain.after,
                onayli: !!p.gain.approved,
              }
            : null,
        puan: p.score?.valid !== false ? (p.score?.total ?? null) : null,
        ekler: (p.attachments || []).map((x: any) => ({
          ad: x.name,
          tur:
            x.kind === "after"
              ? "sonra"
              : x.kind === "before"
                ? "önce"
                : "belge",
        })),
        son_hareketler: (p.history || []).slice(0, 10).map((h: any) => ({
          tarih: String(h.at).slice(0, 10),
          kisi: name_(h.actor),
          not: h.text,
        })),
        yorumlar: (p.comments || []).slice(-10).map((c) => ({
          tarih: c.at.slice(0, 10),
          kisi: name_(c.actor),
          metin: c.text,
        })),
      };
    }
    case "benzer_oneriler": {
      let target: any;
      if (a.id) {
        const id = String(a.id).trim().toUpperCase();
        target = visible.find((x) => x.id === id);
        if (!target)
          throw new ToolError(
            id + " bulunamadı ya da bu öneriyi görme yetkin yok.",
          );
      } else {
        target = {
          title: String(a.baslik || "").slice(0, 200),
          problem: String(a.sorun || "").slice(0, 3000),
          solution: String(a.cozum || "").slice(0, 3000),
          operation: String(a.bolum || ""),
        };
        if (!target.title && !target.problem)
          throw new ToolError(
            "Bir öneri numarası (id) ya da başlık/sorun metni verin.",
          );
      }
      // Web'deki benzer öneri listesiyle aynı: tüm kayıtlarda aranır, yalnız özet bilgi döner.
      const { hits, provider } = await findSimilarSafe(
        target,
        state.proposals,
        state.settings?.synonyms || [],
      );
      return {
        yontem: provider,
        sonuclar: hits.map((h) => ({
          id: h.proposal.id,
          baslik: h.proposal.title,
          bolum: h.proposal.operation,
          durum: h.proposal.status,
          puan: h.score,
          ortak_kelimeler: h.shared,
          acabilir: canSee(h.proposal, viewer as any, ctx),
        })),
      };
    }
    case "gecikenler": {
      const min = Math.max(0, Math.min(365, Number(a.en_az_gun) || 0));
      const dir = a.mudurluk ? String(a.mudurluk) : "";
      const late = visible
        .filter(
          (p) =>
            overdueDays(p) > min &&
            (!dir || dirOf(p.owner) === dir || p.directorate === dir),
        )
        .map((p) => ({ ...brief(p), sorumlu_mudurluk: dirOf(p.owner) }))
        .sort((x, y) => y.gecikme_gun - x.gecikme_gun);
      const count = (key: (x: any) => string) =>
        Object.entries(
          late.reduce(
            (m: any, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m),
            {},
          ),
        )
          .map(([ad, adet]) => ({ ad, adet }))
          .sort((x: any, y: any) => y.adet - x.adet);
      return {
        toplam: late.length,
        destek_biriminde_bekleyen: late.filter((x) => x.destek_bekleyen.length)
          .length,
        sorumluya_gore: count((x) => x.sorumlu),
        mudurluge_gore: count((x) => x.sorumlu_mudurluk),
        oneriler: late.slice(0, LIMIT),
      };
    }
    case "kazanc_ozeti": {
      const day = /^\d{4}-\d{2}-\d{2}$/;
      if (
        (a.baslangic && !day.test(a.baslangic)) ||
        (a.bitis && !day.test(a.bitis))
      )
        throw new ToolError("Tarihleri YYYY-AA-GG biçiminde verin.");
      const rows = visible.filter((p) => {
        const g: any = p.gain;
        if (
          !g ||
          !g.approved ||
          g.valid === false ||
          ["Reddedildi", "İptal edildi"].includes(p.status)
        )
          return false;
        const at = String(g.approvedAt || p.stageAt).slice(0, 10);
        return (
          (!a.baslangic || at >= a.baslangic) &&
          (!a.bitis || at <= a.bitis) &&
          (!a.bolum || p.operation === a.bolum)
        );
      });
      const sum = (key: (p: Proposal) => string) =>
        Object.entries(
          rows.reduce((m: any, p) => {
            const k = key(p);
            m[k] = m[k] || { oneri: 0, tutar_tl: 0 };
            m[k].oneri++;
            m[k].tutar_tl += Number(p.gain!.amount) || 0;
            return m;
          }, {}),
        ).map(([ad, v]: any) => ({ ad, ...v }));
      return {
        oneri_sayisi: rows.length,
        doneme_gore: sum((p) => p.gain!.period),
        ture_gore: sum((p) => p.gain!.type),
        bolume_gore: sum((p) => p.operation).sort(
          (x: any, y: any) => y.tutar_tl - x.tutar_tl,
        ),
        not: "Tutarlar dönemine göre ayrı toplanır (tek seferlik, aylık, yıllık); birbirine eklenmez. Parasal olmayan kazançların tutarı 0'dır.",
      };
    }
    default:
      throw new ToolError("Bilinmeyen araç: " + name);
  }
}
