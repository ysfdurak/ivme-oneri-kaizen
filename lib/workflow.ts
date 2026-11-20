import { applyImport } from "./proposal-import";
import {
  STAGES,
  CLOSED,
  REJECT_REASONS,
  State,
  User,
  Proposal,
  Transfer,
  TransferChange,
  canSee,
  managesProposal,
  Campaign,
  CATEGORY_LIST,
  activeCampaigns,
  NOT_IMPLEMENTED,
  NOT_IMPLEMENTED_REASONS,
  CURRENCIES,
  ANON_LABEL,
} from "./model";
import { REPORT_IDS, REPORTS } from "./dashboard";
import {
  LIST_META,
  activeNames,
  activeSubs,
  applyRenames,
  applyTargetDays,
  listOf,
  scoreTotal,
  scoringOf,
  validateList,
  validateScoring,
  validateTargetDays,
  type ListKey,
} from "./definitions";
import { NOTIFY_RULES, type NotifyEvent } from "./notify";
import {
  DEFAULT_REWARD_SETTINGS,
  buildReward,
  rewardText,
  shares,
  validateRewardSettings,
} from "./rewards";
const NOTIFY_KEYS: string[] = NOTIFY_RULES.map((r) => r.key);
export function applyCommand(s: State, b: any, u: User, us: User[]) {
  const now = new Date().toISOString();
  const assert = (v: any, m: string) => {
    if (!v) throw new Error(m);
  };
  const validUser = (id: string) =>
    us.some((x) => x.id === id && x.active !== 0);
  const reason = () =>
    assert(
      typeof b.reason === "string" && b.reason.trim().length >= 3,
      "En az 3 karakterlik gerekçe yazın.",
    );
  const audit = (text: string) =>
    s.audit.unshift({ at: now, actor: u.id, text });
  // Anonim öneride geçmiş metnine önerenin adı yazılmaz (devir, yönlendirme gibi ad içeren kayıtlar).
  const anonText = (p: Proposal, text: string) => {
    const n = p.anonymous ? us.find((x) => x.id === p.author)?.name : "";
    return n ? text.split(n).join(ANON_LABEL) : text;
  };
  const log = (p: Proposal, text: string) => {
    p.history.unshift({ at: now, actor: u.id, text: anonText(p, text) });
    (p as any)._touched = true; // Komut yolu bu işaretle kaydın sürümünü (rev) günceller.
  };
  const nameOf = (id?: string) =>
    id ? us.find((x) => x.id === id)?.name || id : "—";
  /** Devri geri alınabilir şekilde kaydeder. */
  /** E-posta bildirimleri için olay kaydı. Komut yolu (route) olayları alır, kurallara göre e-postaya çevirir. */
  const emit = (e: Omit<NotifyEvent, "actor">) => {
    ((s as any)._events ||= []).push({ ...e, actor: u.id });
  };
  const recordTransfer = (t: Omit<Transfer, "id" | "at" | "actor">) => {
    for (const c of t.changes)
      if (c.type === "owner" && c.proposalId)
        emit({
          type: "transfer",
          proposalId: c.proposalId,
          prevOwner: c.prev,
          text: t.reason,
        });
      else if (c.type === "action" && c.proposalId)
        emit({
          type: "action",
          proposalId: c.proposalId,
          actionId: c.actionId,
        });
    if (!t.changes.length) return;
    s.transfers = [
      { id: crypto.randomUUID(), at: now, actor: u.id, ...t },
      ...(s.transfers || []),
    ].slice(0, 500);
  };
  const rule = (op: string) => {
    const r = s.matrix.find((x) => x.operation === op);
    assert(r, "Bölüm için atama matrisi eksik.");
    return r;
  };
  const ownerFor = (p: Proposal, status: string) => {
    const r = rule(p.operation);
    const active = (key: string) => r[key];
    const id =
      status === STAGES[0]
        ? active("pre")
        : status === STAGES[1] || status === STAGES[2] || status === STAGES[3]
          ? active("operationOwner")
          : status === STAGES[4] || status === "Kazanç düzeltmesi bekliyor"
            ? active("gain")
            : status === STAGES[5]
              ? us.find((x) => x.id === p.evaluator)?.manager
              : status === STAGES[6]
                ? active("score")
                : "";
    // Sorumlu pasife alınmışsa iş durmasın: önce onun müdürüne, o da yoksa sistem yöneticisine gider.
    // (Yedek zorunlu değildir; kalıcı çözüm için matriste yeni sorumlu seçilir veya "İşleri devret" kullanılır.)
    if (!CLOSED.includes(status) && id && !validUser(id)) {
      const mgr = us.find((x) => x.id === id)?.manager;
      const fallback =
        mgr && validUser(mgr)
          ? mgr
          : us.find((x) => x.role === "admin" && x.active !== 0)?.id;
      if (fallback) {
        p.history.unshift({
          at: now,
          actor: u.id,
          text: (p.anonymous && id === p.author ? ANON_LABEL : nameOf(id)) +
            " pasif olduğu için iş " +
            nameOf(fallback) +
            " kişisine yönlendirildi.",
        });
        return fallback;
      }
    }
    if (!CLOSED.includes(status))
      assert(
        validUser(id),
        "İlgili aşamanın sorumlusu veya değerlendiricinin müdürü tanımlı değil.",
      );
    return id || "";
  };
  const setStage = (p: Proposal, status: string) => {
    const old = p.status;
    if (CLOSED.includes(status)) p.lastActiveStage = old;
    p.stageLog = [
      ...(p.stageLog || []),
      { stage: old, from: p.stageAt, to: now },
    ];
    p.owner = ownerFor(p, status);
    p.status = status;
    p.stageAt = now;
    // Ret ve iptal bildirimleri kendi işlemlerinde (gerekçeyle) üretilir.
    if (status === "Tamamlandı") emit({ type: "completed", proposalId: p.id });
    else if (!["Reddedildi", "İptal edildi", NOT_IMPLEMENTED].includes(status))
      emit({ type: "stage", proposalId: p.id, from: old, to: status });
    log(
      p,
      old +
        " → " +
        status +
        (p.owner
          ? " · " + (us.find((x) => x.id === p.owner)?.name || p.owner)
          : ""),
    );
  };
  // Öneri geri alınır ya da iptal edilirse ödenmemiş ödülleri de iptal edilir.
  const cancelRewards = (p: Proposal, why: string) => {
    for (const r of s.rewards || [])
      if (
        r.proposalId === p.id &&
        ["Onay bekliyor", "Onaylandı"].includes(r.status)
      ) {
        r.status = "İptal edildi";
        r.note = why;
        r.decidedAt = now;
        log(p, "Ödül kaydı iptal edildi: " + why);
      }
  };
  if (b.action === "create") {
    assert(b.title?.trim().length >= 5, "Başlık en az 5 karakter olmalı.");
    assert(
      b.problem?.trim().length >= 10,
      "Mevcut durumu en az 10 karakterle açıklayın.",
    );
    assert(b.solution?.trim().length >= 5, "Çözüm önerisini açıklayın.");
    assert(s.operations.includes(b.operation), "Bölüm seçin.");
    assert(
      !b.category || activeNames(s, "categories").includes(b.category),
      "Öneri sınıfını listeden seçin.",
    );
    assert(
      !b.subcategory ||
        activeSubs(s, b.category || activeNames(s, "categories")[0]).includes(
          b.subcategory,
        ),
      "Alt sınıfı listeden seçin.",
    );
    const attachments = b.attachments || [];
    assert(
      attachments.length <= 3 &&
        attachments.every(
          (a: any) =>
            a.name &&
            /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/.test(
              a.data,
            ) &&
            a.data.length < 700000,
        ),
      "En fazla 3 adet, her biri 500 KB altında PNG/JPG/WebP/PDF eklenebilir.",
    );
    const coAuthors: string[] = Array.isArray(b.coAuthors)
      ? Array.from(new Set(b.coAuthors as string[]))
      : [];
    assert(
      coAuthors.length <= 5 &&
        coAuthors.every((id) => validUser(id) && id !== u.id),
      "Ortak öneri sahipleri aktif kullanıcılardan seçilmeli (en fazla 5).",
    );
    const locations = s.settings?.locations || [];
    assert(
      !b.location || locations.includes(b.location),
      "Lokasyonu listeden seçin.",
    );
    const anonymous = !!b.anonymous;
    const campaign = String(b.campaign || "");
    assert(
      !campaign ||
        activeCampaigns(s.settings?.campaigns).some((c) => c.id === campaign),
      "Seçilen kampanya şu an açık değil.",
    );
    assert(
      !anonymous || !coAuthors.length,
      "Anonim öneride ortak öneren eklenemez.",
    );
    const p: Proposal = {
      id:
        "KZ-" +
        new Date().getFullYear() +
        "-" +
        String(
          s.proposals.reduce(
            (n, p) => Math.max(n, Number(p.id.split("-").at(-1)) || 0),
            0,
          ) + 1,
        ).padStart(4, "0"),
      title: b.title.trim().slice(0, 200),
      problem: b.problem.slice(0, 6000),
      solution: b.solution.slice(0, 6000),
      operation: b.operation,
      category: b.category || activeNames(s, "categories")[0],
      ...(b.subcategory ? { subcategory: String(b.subcategory) } : {}),
      author: u.id,
      department: u.department,
      directorate: u.directorate,
      status: STAGES[0],
      owner: "",
      created: now,
      stageAt: now,
      due: "",
      actions: [],
      support: [],
      history: [],
      // Öneriyle gelen fotoğraflar "önce" görselidir; uygulama sonrası "sonra" fotoğrafı ayrıca eklenir.
      attachments: attachments.map((a: any) => ({
        name: String(a.name).slice(0, 120),
        data: a.data,
        kind: /^data:image\//.test(a.data) ? "before" : "",
        at: now,
        by: u.id,
      })),
      coAuthors,
      location: b.location || "",
      ...(anonymous ? { anonymous: true } : {}),
      ...(campaign ? { campaign } : {}),
      expectedBenefit: String(b.expectedBenefit || "")
        .trim()
        .slice(0, 1000),
    };
    p.owner = ownerFor(p, p.status);
    log(p, "Öneri gönderildi.");
    s.proposals.unshift(p);
    emit({ type: "created", proposalId: p.id });
    return p.id;
  }
  if (b.action === "importProposals") {
    // Toplu aktarım: plan sunucuda planImport ile doğrulanmış olarak gelir. E-posta (olay) ve ödül üretilmez.
    assert(
      u.role === "admin",
      "Toplu aktarım yalnız sistem yöneticisine açıktır.",
    );
    const idByUsername = new Map(
      us.map((x) => [String(x.username || "").toLowerCase(), x.id]),
    );
    const byId = new Map(
      us.map((x) => [
        x.id,
        { department: x.department, directorate: x.directorate },
      ]),
    );
    // Paket kimliği: tarih-saat + kısa rastgele ek (aynı saniyedeki iki aktarım çakışmasın).
    const batch =
      "AKT-" +
      now.replace(/\D/g, "").slice(0, 14) +
      "-" +
      Math.random().toString(36).slice(2, 6);
    const n = applyImport(
      s,
      b.plan,
      idByUsername,
      byId,
      u.id,
      now,
      (p, status) => {
        // Değerlendirme sonrası aşamalarda "değerlendiren" bölüm sorumlusu sayılır (Kazanç onayı müdürü bundan bulunur).
        if (STAGES.indexOf(status) >= 2)
          p.evaluator = rule(p.operation).operationOwner;
        return ownerFor(p, status);
      },
      batch,
    );
    s.importBatches = [
      {
        id: batch,
        at: now,
        by: u.id,
        count: n,
        newUsers: Array.isArray(b.newUserIds) ? b.newUserIds : [],
      },
      ...(s.importBatches || []),
    ].slice(0, 50);
    audit(n + " öneri eski sistemden toplu aktarımla alındı (" + batch + ").");
    return n;
  }
  if (b.action === "deleteImported") {
    // Aktarılan önerileri siler: bir aktarım paketinin tamamı (geri al) ya da seçili kayıtlar.
    // Yalnız eski sistemden gelen kayıtlar silinebilir; İvme'de açılan öneriler bu yolla silinmez.
    assert(
      u.role === "admin",
      "Aktarılan kayıtları yalnız sistem yöneticisi silebilir.",
    );
    const batch = b.batch
      ? (s.importBatches || []).find((x) => x.id === b.batch)
      : null;
    if (b.batch)
      assert(
        batch && !batch.undone,
        "Aktarım bulunamadı ya da zaten geri alındı.",
      );
    const ids: string[] = batch
      ? s.proposals
          .filter((p) => p.imported?.batch === batch.id)
          .map((p) => p.id)
      : Array.isArray(b.ids)
        ? Array.from(new Set(b.ids.map(String)))
        : [];
    assert(ids.length > 0, "Silinecek aktarılan kayıt yok.");
    const targets = ids.map((id) => s.proposals.find((p) => p.id === id));
    assert(
      targets.every((p) => p && p.legacyNo),
      "Yalnız eski sistemden aktarılan öneriler silinebilir.",
    );
    const paid = (s.rewards || []).filter(
      (r: any) => ids.includes(r.proposalId) && r.status === "Ödendi",
    );
    assert(
      !paid.length,
      "Ödülü ödenmiş kayıt silinemez: " +
        paid.map((r: any) => r.proposalId).join(", "),
    );
    const gone = new Set(ids);
    s.proposals = s.proposals.filter((p) => !gone.has(p.id));
    s.rewards = (s.rewards || []).filter((r: any) => !gone.has(r.proposalId));
    for (const p of s.proposals) {
      if (p.duplicateOf && gone.has(p.duplicateOf)) delete p.duplicateOf;
      if (p.duplicates?.some((x) => gone.has(x)))
        p.duplicates = p.duplicates.filter((x) => !gone.has(x));
    }
    // Paket kayıtlarını güncelle; geri alınan paketin pasif kullanıcıları silinmeye adaydır.
    const candidates: string[] = [];
    for (const x of s.importBatches || []) {
      const left = s.proposals.filter((p) => p.imported?.batch === x.id).length;
      if (!x.undone && left === 0) {
        x.undone = { at: now, by: u.id, removed: x.count };
        candidates.push(...x.newUsers);
      }
    }
    audit(
      ids.length +
        " aktarılan öneri silindi" +
        (batch ? " (aktarım geri alındı: " + batch.id + ")" : "") +
        ": " +
        targets
          .map((p) => p!.legacyNo)
          .slice(0, 20)
          .join(", "),
    );
    return { removed: ids.length, userCandidates: candidates };
  }
  if (b.action === "matrix") {
    assert(u.role === "admin", "Matris düzenleme yetkiniz yok.");
    const r = rule(b.operation);
    for (const key of ["pre", "operationOwner", "gain", "score"]) {
      assert(validUser(b[key]), "Her aşama için aktif kullanıcı seçin.");
    }
    assert(
      !b.directorate || us.some((x) => x.directorate === b.directorate),
      "Geçerli bir müdürlük seçin.",
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
    const affected = s.proposals.filter(
      (p) =>
        p.operation === b.operation &&
        keys[p.status] &&
        r[keys[p.status]] !== b[keys[p.status]],
    );
    Object.assign(r, {
      pre: b.pre,
      operationOwner: b.operationOwner,
      gain: b.gain,
      score: b.score,
      directorate: b.directorate || r.directorate || "",
    });
    if (b.transfer) {
      const changes: TransferChange[] = [];
      for (const p of affected) {
        const prev = p.owner;
        p.owner = ownerFor(p, p.status);
        if (prev !== p.owner)
          changes.push({
            type: "owner",
            proposalId: p.id,
            prev,
            next: p.owner,
          });
        log(
          p,
          "Matris değişikliğiyle devir: " +
            nameOf(prev) +
            " → " +
            nameOf(p.owner),
        );
      }
      recordTransfer({
        kind: "matrix",
        to: "",
        reason: b.operation + " atama matrisi değişikliği",
        changes,
      });
    }
    audit(
      b.operation +
        " atama matrisi güncellendi. " +
        (b.transfer
          ? affected.length + " açık iş devredildi."
          : "Açık işler korundu."),
    );
    return;
  }
  if (b.action === "unit") {
    assert(u.role === "admin", "Yetkiniz yok.");
    const unit = String(b.unit || "").trim();
    assert(
      unit.length >= 2 && !s.units.includes(unit),
      "Benzersiz bir birim adı yazın.",
    );
    s.units.push(unit.slice(0, 60));
    audit("Destek birimi eklendi: " + unit);
    return;
  }
  if (b.action === "operation") {
    assert(u.role === "admin", "Yetkiniz yok.");
    const op = String(b.operation || "").trim();
    assert(
      op.length >= 2 && !s.operations.includes(op),
      "Benzersiz bölüm adı yazın.",
    );
    s.operations.push(op.slice(0, 60));
    s.matrix.push({
      operation: op.slice(0, 60),
      pre: u.id,
      operationOwner: u.id,
      gain: u.id,
      score: u.id,
    });
    audit("Bölüm eklendi: " + op);
    return;
  }
  if (b.action === "reassignUser") {
    // Kullanıcının tüm açık işlerini (öneri sorumluluğu, aksiyonlar, matris görevleri) tek seferde devreder.
    // Devir kaydedilir; "undoTransfer" ile geri alınabilir.
    assert(
      u.role === "admin",
      "Toplu devir yalnızca sistem yöneticisi tarafından yapılabilir.",
    );
    assert(
      us.some((x) => x.id === b.from),
      "Devredilecek kullanıcı bulunamadı.",
    );
    assert(
      validUser(b.to) && b.to !== b.from,
      "Devralacak aktif bir kullanıcı seçin.",
    );
    reason();
    const changes: TransferChange[] = [];
    for (const p of s.proposals) {
      if (CLOSED.includes(p.status)) continue;
      if (p.owner === b.from) {
        p.owner = b.to;
        changes.push({
          type: "owner",
          proposalId: p.id,
          prev: b.from,
          next: b.to,
        });
        log(
          p,
          "Kullanıcı devri: " +
            nameOf(b.from) +
            " → " +
            nameOf(b.to) +
            " · " +
            b.reason,
        );
      }
      for (const a of p.actions)
        if (
          a.owner === b.from &&
          !["Tamamlandı", "İptal edildi"].includes(a.status)
        ) {
          a.owner = b.to;
          changes.push({
            type: "action",
            proposalId: p.id,
            actionId: a.id,
            prev: b.from,
            next: b.to,
          });
          log(
            p,
            "Aksiyon devri: " +
              a.title +
              " · " +
              nameOf(b.from) +
              " → " +
              nameOf(b.to),
          );
        }
    }
    for (const r of s.matrix)
      for (const key of ["pre", "operationOwner", "gain", "score"])
        if (r[key] === b.from) {
          r[key] = b.to;
          changes.push({
            type: "matrix",
            operation: r.operation,
            key,
            prev: b.from,
            next: b.to,
          });
        }
    recordTransfer({
      kind: "user",
      from: b.from,
      to: b.to,
      reason: b.reason,
      changes,
    });
    const count = (t: string) => changes.filter((c) => c.type === t).length;
    audit(
      nameOf(b.from) +
        " kullanıcısının işleri " +
        nameOf(b.to) +
        " kullanıcısına devredildi: " +
        count("owner") +
        " öneri, " +
        count("action") +
        " aksiyon, " +
        count("matrix") +
        " matris görevi. " +
        b.reason,
    );
    return {
      proposals: count("owner"),
      actions: count("action"),
      matrixSlots: count("matrix"),
    } as any;
  }
  if (b.action === "undoTransfer") {
    // Devri geri alır (toplu devirde aynı batch'teki tüm devirler birlikte).
    // Devirden sonra başka biri tarafından değiştirilmiş kayıtlar atlanır, üzerine yazılmaz.
    const list = (s.transfers || []).filter((x) =>
      b.batch ? x.batch === b.batch : x.id === b.transferId,
    );
    assert(list.length, "Devir kaydı bulunamadı.");
    assert(
      list.every((t) => !t.undone),
      "Bu devir zaten geri alındı.",
    );
    assert(
      u.role === "admin" || list.every((t) => t.actor === u.id),
      "Devri yalnızca yapan kişi veya sistem yöneticisi geri alabilir.",
    );
    let reverted = 0,
      skipped = 0;
    for (const t of list) {
      let r0 = 0,
        s0 = 0;
      for (const c of [...t.changes].reverse()) {
        if (c.type === "matrix") {
          const r = s.matrix.find((x) => x.operation === c.operation);
          if (r && r[c.key!] === c.next) ((r[c.key!] = c.prev), r0++);
          else s0++;
          continue;
        }
        const p = s.proposals.find((x) => x.id === c.proposalId);
        const target: any =
          c.type === "owner" ? p : p?.actions.find((a) => a.id === c.actionId);
        if (
          p &&
          target &&
          target.owner === c.next &&
          !CLOSED.includes(p.status)
        ) {
          target.owner = c.prev;
          if (c.prevOperation && p.operation === c.nextOperation)
            p.operation = c.prevOperation;
          r0++;
          log(
            p,
            "Devir geri alındı: " +
              (c.type === "action" ? target.title + " · " : "") +
              nameOf(c.next) +
              " → " +
              nameOf(c.prev),
          );
        } else s0++;
      }
      t.undone = { at: now, actor: u.id, reverted: r0, skipped: s0 };
      reverted += r0;
      skipped += s0;
    }
    audit(
      "Devir geri alındı: " +
        reverted +
        " kayıt eski sorumluya döndü" +
        (skipped
          ? ", " + skipped + " kayıt sonradan değiştiği için atlandı"
          : "") +
        ".",
    );
    return { reverted, skipped } as any;
  }
  if (b.action === "defineOrg") {
    // Organizasyon tanımları: departman → müdürlük → (direktörlük) → (genel müdürlük).
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const o = b.org || {};
    const clean = (v: any) =>
      String(v || "")
        .trim()
        .slice(0, 80);
    const levels = {
      division: !!o.levels?.division,
      group: !!o.levels?.group && !!o.levels?.division,
    };
    const groups: string[] = [
      ...new Set<string>((o.groups || []).map(clean).filter(Boolean)),
    ];
    const divisions = (o.divisions || [])
      .map((d: any) => ({ name: clean(d.name), group: clean(d.group) }))
      .filter((d: any) => d.name);
    const directorates = (o.directorates || [])
      .map((d: any) => ({ name: clean(d.name), division: clean(d.division) }))
      .filter((d: any) => d.name);
    const departments = (o.departments || [])
      .map((d: any) => ({
        name: clean(d.name),
        directorate: clean(d.directorate),
      }))
      .filter((d: any) => d.name);
    const unique = (a: { name: string }[]) =>
      new Set(a.map((x) => x.name)).size === a.length;
    assert(
      unique(departments) && unique(directorates) && unique(divisions),
      "Aynı seviyede aynı ad iki kez kullanılamaz.",
    );
    assert(
      departments.every((d: any) =>
        directorates.some((x: any) => x.name === d.directorate),
      ),
      "Her departman tanımlı bir müdürlüğe bağlanmalı.",
    );
    if (levels.division)
      assert(
        directorates.every((d: any) =>
          divisions.some((x: any) => x.name === d.division),
        ),
        "Direktörlük seviyesi açıkken her müdürlük bir direktörlüğe bağlanmalı.",
      );
    if (levels.group)
      assert(
        divisions.every((d: any) => groups.includes(d.group)),
        "Genel müdürlük seviyesi açıkken her direktörlük bir genel müdürlüğe bağlanmalı.",
      );
    const used = us
      .filter((x) => x.active !== 0 && !["director", "gm"].includes(x.role))
      .map((x) => x.department);
    const missing = [...new Set(used)].filter(
      (d) => !departments.some((x: any) => x.name === d),
    );
    assert(
      !missing.length,
      "Aktif kullanıcıların bağlı olduğu departman silinemez: " +
        missing.join(", "),
    );
    s.settings = {
      ...(s.settings || {}),
      org: { departments, directorates, divisions, groups, levels },
    };
    audit(
      "Organizasyon tanımları güncellendi: " +
        departments.length +
        " departman, " +
        directorates.length +
        " müdürlük" +
        (levels.division ? ", " + divisions.length + " direktörlük" : "") +
        (levels.group ? ", " + groups.length + " genel müdürlük" : "") +
        ".",
    );
    return;
  }
  if (b.action === "notifySettings") {
    assert(
      u.role === "admin",
      "Bildirim kurallarını yalnızca sistem yöneticisi değiştirebilir.",
    );
    const disabled = (Array.isArray(b.disabled) ? b.disabled : []).filter(
      (x: any) => NOTIFY_KEYS.includes(x),
    );
    const days = Number(b.escalateAfterDays);
    assert(
      Number.isInteger(days) && days >= 1 && days <= 60,
      "Müdüre bildirim günü 1–60 arasında olmalı.",
    );
    s.settings = {
      ...(s.settings || {}),
      notify: { disabled, escalateAfterDays: days },
    };
    audit(
      "E-posta bildirim kuralları güncellendi" +
        (disabled.length ? " · kapalı: " + disabled.join(", ") : "") +
        ".",
    );
    return;
  }
  if (b.action === "currencySettings") {
    assert(
      u.role === "admin",
      "Bu ayarı yalnızca sistem yöneticisi değiştirebilir.",
    );
    assert(
      CURRENCIES.some(([c]) => c === b.currency),
      "Geçerli bir para birimi seçin.",
    );
    s.settings = { ...(s.settings || {}), currency: b.currency };
    audit(
      "Para birimi " +
        CURRENCIES.find(([c]) => c === b.currency)![1] +
        " olarak ayarlandı.",
    );
    return;
  }
  if (b.action === "recognitionSettings") {
    assert(
      u.role === "admin",
      "Bu ayarı yalnızca sistem yöneticisi değiştirebilir.",
    );
    s.settings = { ...(s.settings || {}), recognition: !!b.enabled };
    audit("Tanınma ekranı " + (b.enabled ? "açıldı." : "kapatıldı."));
    return;
  }
  if (b.action === "aiSettings") {
    // Paket kontrolü (IVME_EDITION) sunucu rotasında yapılır; burada yalnız kurum ayarı tutulur.
    assert(
      u.role === "admin",
      "Bu ayarı yalnızca sistem yöneticisi değiştirebilir.",
    );
    s.settings = { ...(s.settings || {}), ai: { mcp: !!b.mcp } };
    audit("Yapay zekâ (MCP) erişimi " + (b.mcp ? "açıldı." : "kapatıldı."));
    return;
  }
  if (b.action === "rewardSettings") {
    assert(
      u.role === "admin",
      "Ödül kurallarını yalnızca sistem yöneticisi değiştirebilir.",
    );
    let next;
    try {
      next = validateRewardSettings(b.settings);
    } catch (e: any) {
      throw new Error(e.message);
    }
    s.settings = { ...(s.settings || {}), rewards: next };
    audit(
      "Ödül kuralları güncellendi (" +
        (next.enabled ? "açık" : "kapalı") +
        ", " +
        next.rules.length +
        " kural).",
    );
    return;
  }
  if (b.action === "rewardDecide" || b.action === "rewardPaid") {
    assert(
      u.role === "reward" || u.role === "admin",
      "Ödül kararını ödül sorumlusu (İK) verir.",
    );
    const r = (s.rewards || []).find((x) => x.id === b.rewardId);
    assert(r, "Ödül kaydı bulunamadı.");
    const rp = s.proposals.find((x) => x.id === r!.proposalId);
    const note = (t: string) => rp && log(rp, t);
    if (b.action === "rewardPaid") {
      assert(
        r!.status === "Onaylandı",
        "Yalnız onaylanmış ödül ödendi işaretlenir.",
      );
      assert(
        /^\d{4}-(0[1-9]|1[0-2])$/.test(b.period || ""),
        "Bordro dönemini YYYY-AA biçiminde girin.",
      );
      r!.status = "Ödendi";
      r!.payrollPeriod = b.period;
      r!.paidAt = now;
      r!.paidBy = u.id;
      note("Ödül ödendi (bordro dönemi " + b.period + ").");
      emit({ type: "reward", proposalId: r!.proposalId, text: "paid" });
      return;
    }
    assert(r!.status === "Onay bekliyor", "Bu ödül için karar zaten verildi.");
    if (b.decision === "reject") {
      reason();
      r!.status = "Reddedildi";
      r!.note = String(b.reason).slice(0, 500);
      r!.decidedBy = u.id;
      r!.decidedAt = now;
      note("Ödül verilmedi (ödül sorumlusu kararı).");
      emit({ type: "reward", proposalId: r!.proposalId, text: "rejected" });
      return;
    }
    assert(b.decision === "approve", "Karar seçin.");
    // İK değeri değiştirebilir; değişirse gerekçe zorunludur ve paylar yeniden hesaplanır.
    if (
      b.total !== undefined &&
      b.total !== null &&
      Number(b.total) !== r!.total
    ) {
      const total = Number(b.total);
      assert(
        r!.kind !== "gift" && Number.isFinite(total) && total > 0,
        "Geçerli bir değer girin.",
      );
      assert(
        r!.kind !== "salary" || total <= 12,
        "Maaş katı en fazla 12 olabilir.",
      );
      reason();
      const split = (s.settings?.rewards || DEFAULT_REWARD_SETTINGS).split;
      r!.note =
        "Değer " +
        rewardText(r!.kind, r!.total) +
        " → " +
        rewardText(r!.kind, total) +
        ": " +
        String(b.reason).slice(0, 400);
      r!.total = total;
      r!.recipients = shares(
        r!.kind,
        total,
        r!.recipients.map((x) => x.userId),
        split,
      );
    } else if (b.reason) r!.note = String(b.reason).slice(0, 500);
    r!.status = "Onaylandı";
    r!.decidedBy = u.id;
    r!.decidedAt = now;
    note("Ödül onaylandı (ödül sorumlusu).");
    emit({ type: "reward", proposalId: r!.proposalId, text: "approved" });
    return;
  }
  if (b.action === "defineList") {
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const key = b.key as ListKey;
    assert(Object.keys(LIST_META).includes(key), "Liste tanınmadı.");
    const { items, renames } = validateList(
      key,
      b.items,
      listOf(s, key),
      s.proposals,
    );
    // Kayıtlar maddenin adını taşır: yeniden adlandırma eski kayıtlara da uygulanır.
    const changed = applyRenames(s.proposals, key, renames);
    s.settings = {
      ...(s.settings || {}),
      lists: { ...(s.settings?.lists || {}), [key]: items },
    };
    audit(
      LIST_META[key].title +
        " güncellendi" +
        (renames.length
          ? " · yeniden adlandırılan: " +
            renames.map((r) => r.from + " → " + r.to).join(", ") +
            " (" +
            changed +
            " kayıt)"
          : "") +
        ".",
    );
    return;
  }
  if (b.action === "defineScoring") {
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const scoring = validateScoring(b.scoring);
    s.settings = { ...(s.settings || {}), scoring };
    audit(
      "Puanlama kriterleri güncellendi: " +
        scoring.criteria.map((c) => c.name + " (" + c.weight + ")").join(", ") +
        " · ölçek 1–" +
        scoring.scale +
        ".",
    );
    return;
  }
  if (b.action === "defineTargetDays") {
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const targetDays = validateTargetDays(b.targetDays);
    s.settings = { ...(s.settings || {}), targetDays };
    applyTargetDays(s);
    audit("Aşama hedef süreleri güncellendi.");
    return;
  }
  if (b.action === "defineCampaigns") {
    assert(
      u.role === "admin",
      "Kampanyaları yalnızca sistem yöneticisi tanımlayabilir.",
    );
    const list: any[] = Array.isArray(b.campaigns) ? b.campaigns : [];
    assert(list.length <= 50, "En fazla 50 kampanya tanımlanabilir.");
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const campaigns: Campaign[] = list.map((c) => {
      const title = String(c.title || "")
        .trim()
        .slice(0, 80);
      assert(title.length >= 3, "Kampanya adı en az 3 karakter olmalı.");
      assert(
        day.test(c.start) && day.test(c.end) && c.start <= c.end,
        title + ": başlangıç ve bitiş tarihini kontrol edin.",
      );
      assert(
        !c.category || activeNames(s, "categories").includes(c.category),
        title + ": iyileştirme alanı geçersiz.",
      );
      assert(
        !c.operation || s.operations.includes(c.operation),
        title + ": bölüm geçersiz.",
      );
      return {
        id:
          typeof c.id === "string" && /^[a-z0-9-]{4,40}$/.test(c.id)
            ? c.id
            : "k-" + crypto.randomUUID().slice(0, 8),
        title,
        description:
          String(c.description || "")
            .trim()
            .slice(0, 500) || undefined,
        start: c.start,
        end: c.end,
        category: c.category || undefined,
        operation: c.operation || undefined,
        reward:
          String(c.reward || "")
            .trim()
            .slice(0, 200) || undefined,
      };
    });
    const kept = new Set(campaigns.map((c) => c.id));
    const used = (s.settings?.campaigns || []).filter(
      (c) => !kept.has(c.id) && s.proposals.some((p) => p.campaign === c.id),
    );
    assert(
      !used.length,
      used.map((c) => c.title).join(", ") +
        " kampanyasına bağlı öneri var; silmek yerine bitiş tarihini değiştirin.",
    );
    s.settings = { ...(s.settings || {}), campaigns };
    audit("Öneri kampanyaları güncellendi: " + campaigns.length + " kampanya.");
    return;
  }
  if (b.action === "defineSynonyms") {
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const groups: string[][] = (Array.isArray(b.synonyms) ? b.synonyms : [])
      .map((g: any) => [
        ...new Set<string>(
          (Array.isArray(g) ? g : [])
            .map((w: any) =>
              String(w || "")
                .trim()
                .toLocaleLowerCase("tr")
                .slice(0, 40),
            )
            .filter(Boolean),
        ),
      ])
      .filter((g: string[]) => g.length >= 2);
    assert(
      groups.length <= 200,
      "En fazla 200 eş anlamlı grubu tanımlanabilir.",
    );
    s.settings = { ...(s.settings || {}), synonyms: groups };
    audit("Eş anlamlı listesi güncellendi: " + groups.length + " grup.");
    return;
  }
  if (b.action === "defineLocations") {
    assert(
      u.role === "admin",
      "Tanımları yalnızca sistem yöneticisi değiştirebilir.",
    );
    const list: string[] = [
      ...new Set<string>(
        (Array.isArray(b.locations) ? b.locations : [])
          .map((x: any) =>
            String(x || "")
              .trim()
              .slice(0, 80),
          )
          .filter(Boolean),
      ),
    ];
    assert(list.length <= 300, "En fazla 300 lokasyon tanımlanabilir.");
    s.settings = { ...(s.settings || {}), locations: list };
    audit("Lokasyon listesi güncellendi: " + list.length + " lokasyon.");
    return;
  }
  if (b.action === "orgSettings") {
    assert(
      u.role === "admin",
      "Kurum bilgilerini yalnızca sistem yöneticisi değiştirebilir.",
    );
    const name = String(b.orgName || "").trim();
    assert(
      name.length >= 2 && name.length <= 60,
      "Kurum/birim adı 2–60 karakter olmalı.",
    );
    s.settings = { ...(s.settings || {}), orgName: name };
    audit("Kurum adı güncellendi: " + name);
    return;
  }
  if (b.action === "reportSettings") {
    assert(
      u.role === "admin",
      "Rapor ayarlarını yalnızca sistem yöneticisi değiştirebilir.",
    );
    const disabled = Array.isArray(b.disabledReports)
      ? b.disabledReports
      : null;
    assert(
      disabled && disabled.every((x: any) => REPORT_IDS.includes(x)),
      "Geçersiz rapor seçimi.",
    );
    const before = s.settings?.disabledReports || [];
    s.settings = {
      ...(s.settings || {}),
      disabledReports: Array.from(new Set(disabled as string[])),
    };
    const name = (id: string) => REPORTS.find((r) => r.id === id)?.title || id;
    const off = disabled!.filter((x: string) => !before.includes(x)).map(name);
    const on = before.filter((x) => !disabled!.includes(x)).map(name);
    audit(
      "Durum panosu ayarı: " +
        [
          off.length ? "pasif: " + off.join(", ") : "",
          on.length ? "aktif: " + on.join(", ") : "",
        ]
          .filter(Boolean)
          .join(" · "),
    );
    return;
  }
  const p = s.proposals.find((p) => p.id === b.id);
  assert(p, "Öneri bulunamadı.");
  if (!p) return;
  const ctx = { users: us, matrix: s.matrix, org: s.settings?.org };
  const admin = u.role === "admin",
    manager = managesProposal(p, u, ctx);
  const responsible = admin || p.owner === u.id;
  if (b.action === "cancel") {
    assert(admin || manager, "İptal yetkiniz yok.");
    assert(
      !["Reddedildi", "İptal edildi", NOT_IMPLEMENTED].includes(p.status),
      "Kayıt zaten kapalı.",
    );
    reason();
    cancelRewards(p, "Öneri iptal edildi.");
    for (const a of [...p.actions, ...p.support])
      if (a.status !== "Tamamlandı") a.status = "İptal edildi";
    if (p.gain) p.gain.valid = false;
    if (p.score) p.score.valid = false;
    setStage(p, "İptal edildi");
    log(p, "İptal gerekçesi: " + b.reason);
    return;
  }
  if (b.action === "rollback") {
    assert(admin || manager, "Geri alma yetkiniz yok.");
    reason();
    const target = STAGES.indexOf(b.target);
    const n = STAGES.indexOf(p.status);
    const last =
      n >= 0
        ? n - 1
        : STAGES.indexOf(
            p.status === "Revizyon bekliyor"
              ? p.revisionTarget || STAGES[0]
              : p.status === "Kazanç düzeltmesi bekliyor"
                ? STAGES[4]
                : p.lastActiveStage || STAGES[0],
          );
    assert(
      target >= 0 && target < 7 && target <= last,
      "Yalnızca daha önce ulaşılan bir aşamaya dönülebilir.",
    );
    assert(
      !(s.rewards || []).some(
        (r) => r.proposalId === p.id && r.status === "Ödendi",
      ),
      "Ödülü ödenmiş öneri geri alınamaz.",
    );
    cancelRewards(p, "Öneri " + b.target + " aşamasına geri alındı.");
    if (p.gain) {
      p.gain.previous = [
        ...(p.gain.previous || []),
        { ...p.gain, previous: undefined },
      ];
      if (target <= 4) {
        p.gain.approved = false;
        p.gain.valid = false;
      } else if (target === 5) p.gain.approved = false;
    }
    if (p.score) p.score.valid = false;
    p.revisionTarget = undefined;
    setStage(p, b.target);
    log(p, "Geri alma gerekçesi: " + b.reason);
    return;
  }
  if (b.action === "comment") {
    assert(canSee(p, u, ctx), "Bu öneriye yorum yazma yetkiniz yok.");
    const text = String(b.text || "").trim();
    assert(text.length >= 2, "Mesajınızı yazın.");
    p.comments = [
      ...(p.comments || []),
      { at: now, actor: u.id, text: text.slice(0, 2000) },
    ];
    emit({ type: "comment", proposalId: p.id, text: text.slice(0, 300) });
    return;
  }
  assert(!CLOSED.includes(p.status), "Kapalı kayıtta işlem yapılamaz.");
  if (b.action === "endorse") {
    // Fikre destek: görme yetkisi gerekmez (çalışan, benzer öneri uyarısında başkasının fikrini görür ve
    // aynısını yeniden göndermek yerine destekleyebilir). Kimlik dışarı verilmez; geçmişe yazılmaz.
    assert(
      p.author !== u.id && !(p.coAuthors || []).includes(u.id),
      "Kendi önerini destekleyemezsin.",
    );
    const list = new Set(p.endorsements || []);
    if (b.on === false) list.delete(u.id);
    else list.add(u.id);
    p.endorsements = Array.from(list);
    (p as any)._touched = true;
    return;
  }
  if (b.action === "forward") {
    assert(responsible, "Yönlendirme yetkiniz yok.");
    assert(
      [STAGES[0], STAGES[1]].includes(p.status),
      "Yönlendirme değerlendirme aşamalarında yapılabilir.",
    );
    reason();
    const prev = p.owner;
    const prevOperation = p.operation;
    if (b.toUser) {
      // Kişiye yönlendirme: bölüm aynı kalır, değerlendirme başka bir kişiye verilir.
      assert(
        validUser(b.toUser) && b.toUser !== p.owner,
        "Yönlendirilecek aktif ve farklı bir kişi seçin.",
      );
      p.owner = b.toUser;
    } else {
      assert(s.operations.includes(b.operation), "Bölüm seçin.");
      p.operation = b.operation;
      p.owner = ownerFor(p, p.status);
    }
    log(
      p,
      "Yönlendirildi: " +
        nameOf(prev) +
        " → " +
        nameOf(p.owner) +
        (b.toUser ? "" : " · Bölüm: " + p.operation) +
        " · " +
        b.reason,
    );
    recordTransfer({
      kind: "proposal",
      from: prev,
      to: p.owner,
      reason: "Yönlendirme: " + b.reason,
      changes: [
        {
          type: "owner",
          proposalId: p.id,
          prev,
          next: p.owner,
          ...(prevOperation !== p.operation
            ? { prevOperation, nextOperation: p.operation }
            : {}),
        },
      ],
    });
    return;
  }
  if (b.action === "transfer") {
    assert(admin || manager, "Devir yetkiniz yok.");
    reason();
    assert(validUser(b.owner), "Aktif kullanıcı seçin.");
    const old = p.owner;
    p.owner = b.owner;
    log(
      p,
      "İş devredildi: " +
        nameOf(old) +
        " → " +
        nameOf(p.owner) +
        " · " +
        b.reason,
    );
    recordTransfer({
      kind: b.batch ? "bulk" : "proposal",
      from: old,
      to: b.owner,
      reason: b.reason,
      changes: [{ type: "owner", proposalId: p.id, prev: old, next: b.owner }],
      ...(b.batch ? { batch: String(b.batch) } : {}),
    });
    return;
  }
  if (b.action === "revision") {
    assert(
      responsible && [STAGES[0], STAGES[1]].includes(p.status),
      "Bu aşamada revizyon istenemez.",
    );
    reason();
    p.revisionTarget = p.status;
    p.stageLog = [
      ...(p.stageLog || []),
      { stage: p.status, from: p.stageAt, to: now },
    ];
    p.status = "Revizyon bekliyor";
    p.owner = p.author;
    p.stageAt = now;
    log(p, "Revizyon istendi: " + b.reason);
    emit({ type: "revision", proposalId: p.id, text: b.reason });
    return;
  }
  if (b.action === "resubmit") {
    assert(p.author === u.id || admin, "Yetkiniz yok.");
    assert(p.status === "Revizyon bekliyor", "Kayıt revizyonda değil.");
    assert(
      b.problem?.length >= 10 && b.solution?.length >= 5,
      "Açıklamaları tamamlayın.",
    );
    log(
      p,
      "Öneri revize edildi. Önceki mevcut durum: " +
        p.problem +
        " · Önceki çözüm: " +
        p.solution,
    );
    p.problem = b.problem;
    p.solution = b.solution;
    setStage(p, p.revisionTarget || STAGES[0]);
    p.revisionTarget = undefined;
    return;
  }
  if (b.action === "duplicate") {
    // Mükerrer kararı: insan verir, gerekçe zorunlu; eski kayıtla bağlantı iki yönlü saklanır.
    assert(
      responsible && [STAGES[0], STAGES[1]].includes(p.status),
      "Bu aşamada mükerrer kararı verilemez.",
    );
    reason();
    const original = s.proposals.find((x) => x.id === b.of);
    assert(
      original && original.id !== p.id,
      "Bağlanacak önceki öneriyi seçin.",
    );
    p.duplicateOf = original!.id;
    original!.duplicates = [
      ...new Set([...(original!.duplicates || []), p.id]),
    ];
    p.rejectReason = "Mükerrer öneri";
    if (p.gain) p.gain.valid = false;
    if (p.score) p.score.valid = false;
    const old = p.status;
    setStage(p, "Reddedildi");
    log(
      p,
      old +
        " ret gerekçesi: Mükerrer öneri · " +
        original!.id +
        " ile aynı konu · " +
        b.reason,
    );
    log(original!, "Mükerrer öneri bağlandı: " + p.id);
    emit({
      type: "rejected",
      proposalId: p.id,
      text: original!.id + " ile aynı konu. " + b.reason,
    });
    return;
  }
  if (b.action === "reject") {
    assert(
      responsible && [STAGES[0], STAGES[1]].includes(p.status),
      "Bu aşamada ret verilemez.",
    );
    reason();
    assert(
      !b.reasonCode || activeNames(s, "rejectReasons").includes(b.reasonCode),
      "Geçerli bir ret nedeni seçin.",
    );
    const old = p.status;
    if (p.gain) p.gain.valid = false;
    if (p.score) p.score.valid = false;
    if (b.reasonCode) p.rejectReason = b.reasonCode;
    setStage(p, "Reddedildi");
    log(
      p,
      old +
        " ret gerekçesi: " +
        (b.reasonCode ? b.reasonCode + " · " : "") +
        b.reason,
    );
    emit({ type: "rejected", proposalId: p.id, text: b.reason });
    return;
  }
  if (b.action === "accept") {
    assert(responsible, "Yetkiniz yok.");
    assert(
      [STAGES[0], STAGES[1]].includes(p.status),
      "Bu aşamada kabul verilemez.",
    );
    if (p.status === STAGES[1]) {
      p.evaluator = u.id;
      assert(validUser(u.manager), "Değerlendiricinin müdürü tanımlı değil.");
    }
    setStage(p, p.status === STAGES[0] ? STAGES[1] : STAGES[2]);
    if (typeof b.note === "string" && b.note.trim())
      log(p, "Kabul notu: " + b.note.trim().slice(0, 1000));
    return;
  }
  if (b.action === "addAction") {
    assert(
      responsible && [STAGES[2], STAGES[3]].includes(p.status),
      "Aksiyon ekleme yetkiniz yok.",
    );
    assert(
      b.title?.trim() &&
        validUser(b.owner) &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.due),
      "İş, sorumlu ve hedef tarih zorunlu.",
    );
    p.actions.push({
      id: crypto.randomUUID(),
      title: b.title,
      owner: b.owner,
      due: b.due,
      status: "Başlamadı",
      description: String(b.description || "")
        .trim()
        .slice(0, 1000),
    });
    log(p, "Aksiyon eklendi: " + b.title);
    emit({
      type: "action",
      proposalId: p.id,
      actionId: p.actions[p.actions.length - 1].id,
    });
    return;
  }
  if (b.action === "editWork") {
    assert(
      b.kind !== "support",
      "Destek için yalnızca birim seçimi kullanılır.",
    );
    const a = (b.kind === "support" ? p.support : p.actions).find(
      (a) => a.id === b.itemId,
    );
    assert(a && (responsible || manager), "İş düzenleme yetkiniz yok.");
    reason();
    assert(
      validUser(b.owner) && b.due && b.title?.trim(),
      "İş, sorumlu ve tarih zorunlu.",
    );
    log(
      p,
      "İş güncellendi: " +
        a.title +
        " · Sorumlu: " +
        a.owner +
        " → " +
        b.owner +
        " · Tarih: " +
        a.due +
        " → " +
        b.due +
        " · " +
        b.reason,
    );
    const ownerChanged = a.owner !== b.owner;
    Object.assign(a, { title: b.title, owner: b.owner, due: b.due });
    if (ownerChanged && b.kind !== "support")
      emit({ type: "action", proposalId: p.id, actionId: a.id });
    if (typeof b.description === "string")
      a.description = b.description.trim().slice(0, 1000);
    if (b.kind === "support") a.blocking = !!b.blocking;
    return;
  }
  if (b.action === "actionUpdate") {
    const a = p.actions.find((a) => a.id === b.itemId);
    assert(a && (responsible || a.owner === u.id), "Aksiyon yetkiniz yok.");
    assert(
      ["Başlamadı", "Devam ediyor", "Tamamlandı", "Yapılamadı"].includes(
        b.status,
      ),
      "Geçersiz durum.",
    );
    if (b.status === "Yapılamadı") {
      // Aksiyon kapanışı zorunlu seçimdir: yapıldı ya da yapılamadı; yapılamadıysa nedeni yazılır.
      reason();
      a.status = b.status;
      a.evidence = String(b.reason).trim().slice(0, 1000);
      a.doneAt = now;
      log(p, "Aksiyon: " + a.title + " · Yapılamadı · Neden: " + a.evidence);
      return;
    }
    a.status = b.status;
    if (
      b.status === "Tamamlandı" &&
      typeof b.evidence === "string" &&
      b.evidence.trim()
    ) {
      a.evidence = b.evidence.trim().slice(0, 1000);
      a.doneAt = now;
    }
    log(
      p,
      "Aksiyon: " +
        a.title +
        " · " +
        b.status +
        (a.evidence && b.status === "Tamamlandı"
          ? " · Sonuç: " + a.evidence
          : ""),
    );
    return;
  }
  if (b.action === "start") {
    assert(
      responsible && p.status === STAGES[2] && p.actions.length,
      "Önce aksiyon planı ekleyin.",
    );
    setStage(p, STAGES[3]);
    return;
  }
  if (b.action === "finish") {
    // Uygulama sonucu zorunlu seçim: "implemented" (uygulandı) ya da "notImplemented" (uygulanamadı).
    // Uygulanamayan öneri kazanç adımına gitmez; nedeniyle "Uygulanamadı" durumunda kapanır.
    assert(
      ["implemented", "notImplemented"].includes(b.outcome),
      "Öneri uygulandı mı, uygulanamadı mı? Birini seçin.",
    );
    if (b.outcome === "notImplemented") {
      assert(
        responsible && [STAGES[2], STAGES[3]].includes(p.status),
        "Yetkiniz yok.",
      );
      assert(
        activeNames(s, "notImplementedReasons").includes(b.reasonCode),
        "Uygulanamama nedenini seçin.",
      );
      reason();
      for (const a of p.actions)
        if (!["Tamamlandı", "Yapılamadı"].includes(a.status))
          a.status = "İptal edildi";
      for (const a of p.support)
        if (!["Tamamlandı", "İptal edildi"].includes(a.status))
          a.status = "İptal edildi";
      if (p.gain) p.gain.valid = false;
      p.notImplemented = {
        reason: b.reasonCode,
        note: String(b.reason).trim().slice(0, 1000),
        at: now,
        by: u.id,
      };
      const old = p.status;
      setStage(p, NOT_IMPLEMENTED);
      log(
        p,
        old +
          " uygulanamama gerekçesi: " +
          b.reasonCode +
          " · " +
          p.notImplemented.note,
      );
      emit({
        type: "notImplemented",
        proposalId: p.id,
        text: b.reasonCode + ". " + p.notImplemented.note,
      });
      return;
    }
    assert(responsible && p.status === STAGES[3], "Yetkiniz yok.");
    assert(
      p.actions.length &&
        p.actions.every((a) =>
          ["Tamamlandı", "Yapılamadı"].includes(a.status),
        ) &&
        p.actions.some((a) => a.status === "Tamamlandı"),
      "Tüm aksiyonlar sonuçlanmalı (yapıldı ya da yapılamadı) ve en az biri yapılmış olmalı.",
    );
    assert(
      !p.support.some(
        (a) => a.blocking && !["Tamamlandı", "İptal edildi"].includes(a.status),
      ),
      "İlerlemeyi engelleyen destek işleri tamamlanmalı.",
    );
    setStage(p, STAGES[4]);
    return;
  }
  if (b.action === "support" || b.action === "supportFlag") {
    assert(responsible, "Destek birimi seçme yetkiniz yok.");
    assert(s.units.includes(b.unit), "Geçerli bir destek birimi seçin.");
    if (b.action === "supportFlag")
      assert(typeof b.selected === "boolean", "Seçim bilgisi geçersiz.");
    const selected = b.action === "support" ? true : b.selected;
    const open = p.support.filter(
      (a) =>
        a.unit === b.unit && !["Tamamlandı", "İptal edildi"].includes(a.status),
    );
    if (selected) {
      if (open.length) {
        const changed = open.some((a) => !a.blocking);
        for (const a of open) a.blocking = true;
        if (changed) log(p, b.unit + " bekleniyor olarak işaretlendi.");
      } else {
        p.support.push({
          id: crypto.randomUUID(),
          unit: b.unit,
          status: "Bekliyor",
          blocking: true,
          since: now,
        });
        log(p, b.unit + " bekleniyor olarak işaretlendi.");
      }
    } else if (open.length) {
      for (const a of open) a.status = "Tamamlandı";
      log(p, b.unit + " bekleme işareti kaldırıldı.");
    }
    return;
  }
  if (b.action === "addAttachment") {
    // Uygulama başladıktan sonra "sonra" fotoğrafı: öneren, birlikte önerenler, sorumlu ve aksiyon sorumluları ekleyebilir.
    const involved =
      p.author === u.id ||
      (p.coAuthors || []).includes(u.id) ||
      responsible ||
      p.actions.some((a: any) => a.owner === u.id);
    assert(involved, "Bu öneriye dosya ekleme yetkiniz yok.");
    assert(
      STAGES.indexOf(p.status) >= 3 ||
        p.status === "Kazanç düzeltmesi bekliyor",
      "Sonra fotoğrafı uygulama başladıktan sonra eklenir.",
    );
    const a = b.attachment || {};
    assert(
      a.name &&
        /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/.test(
          a.data,
        ) &&
        a.data.length < 700000,
      "500 KB altında PNG/JPG/WebP/PDF ekleyin.",
    );
    assert(p.attachments.length < 6, "Bir öneride en fazla 6 ek olabilir.");
    p.attachments.push({
      name: String(a.name).slice(0, 120),
      data: a.data,
      kind: "after",
      at: now,
      by: u.id,
    });
    log(p, "Sonra görseli eklendi: " + String(a.name).slice(0, 120));
    return;
  }
  if (b.action === "supportTicket") {
    // Destek biriminin kendi sistemindeki talep/iş emri numarası (ör. IT: INC-10293, Teknik: İE-2026-77).
    // Değerlendirici takibi oradan yapar; numara boş bırakılırsa silinir.
    assert(responsible, "Talep numarasını yalnızca öneri sorumlusu girebilir.");
    const a = p.support.find((a) => a.id === b.itemId);
    assert(
      a && !["Tamamlandı", "İptal edildi"].includes(a.status),
      "Açık bir destek beklemesi seçin.",
    );
    const ticket = String(b.ticket || "")
      .trim()
      .slice(0, 40);
    assert(
      !ticket || /^[\p{L}\p{N}][\p{L}\p{N} ._\/#-]*$/u.test(ticket),
      "Talep numarasında harf, rakam ve - _ / # . kullanılabilir.",
    );
    if ((a.ticket || "") === ticket) return;
    a.ticket = ticket || undefined;
    log(p, a.unit + " talep no " + (ticket ? ": " + ticket : "silindi."));
    return;
  }
  if (b.action === "supportUpdate") {
    const a = p.support.find((a) => a.id === b.itemId);
    assert(a && (responsible || a.owner === u.id), "Destek işi yetkiniz yok.");
    assert(
      ["Bekliyor", "Devam ediyor", "Tamamlandı", "İptal edildi"].includes(
        b.status,
      ),
      "Geçersiz durum.",
    );
    a.status = b.status;
    log(p, a.unit + " · " + a.title + " · " + b.status);
    return;
  }
  if (b.action === "gain") {
    assert(
      responsible &&
        [STAGES[4], "Kazanç düzeltmesi bekliyor"].includes(p.status),
      "Kazanç giriş yetkiniz yok.",
    );
    const amount = Number(b.amount),
      cost = Number(b.cost);
    assert(
      Number.isFinite(amount) &&
        Number.isFinite(cost) &&
        amount >= 0 &&
        cost >= 0,
      "Geçerli kazanç ve maliyet girin.",
    );
    assert(
      ["Tek seferlik", "Aylık", "Yıllık"].includes(b.period) &&
        activeNames(s, "gainTypes").includes(b.type),
      "Kazanç türü ve dönem seçin.",
    );
    assert(
      b.explanation?.trim().length >= 10 && b.before && b.after,
      "Önce, sonra ve hesaplama açıklaması zorunlu.",
    );
    assert(
      b.type === "Parasal" || amount === 0,
      "Parasal olmayan kazançta tutar sıfır olmalı.",
    );
    p.gain = {
      amount,
      cost,
      period: b.period,
      type: b.type,
      before: b.before,
      after: b.after,
      explanation: b.explanation,
      approved: false,
      valid: true,
      previous: p.gain
        ? [...(p.gain.previous || []), { ...p.gain, previous: undefined }]
        : [],
    };
    setStage(p, STAGES[5]);
    return;
  }
  if (b.action === "gainReturn") {
    assert(responsible && p.status === STAGES[5], "Yetkiniz yok.");
    reason();
    p.stageLog = [
      ...(p.stageLog || []),
      { stage: p.status, from: p.stageAt, to: now },
    ];
    p.status = "Kazanç düzeltmesi bekliyor";
    p.owner = ownerFor(p, STAGES[4]);
    p.stageAt = now;
    if (p.gain) p.gain.approved = false;
    log(p, "Kazanç düzeltmeye gönderildi: " + b.reason);
    emit({ type: "stage", proposalId: p.id, from: STAGES[5], to: p.status });
    return;
  }
  if (b.action === "gainApprove") {
    assert(responsible && p.status === STAGES[5] && p.gain, "Yetkiniz yok.");
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";
    p.gain.approved = true;
    p.gain.valid = true;
    p.gain.approver = u.id;
    p.gain.approvedAt = now;
    // Denetim izi: onaylanan kazanç, onay anındaki para birimi ve (varsa) onay notuyla saklanır. Tanımlar sonradan
    // değişse de (ör. para birimi) eski kararın dayanağı kayıttan yeniden kurulabilir.
    p.gain.currency = s.settings?.currency || "₺";
    if (note) p.gain.approvalNote = note;
    log(p, "Kazanç onaylandı" + (note ? ": " + note : "."));
    setStage(p, STAGES[6]);
    return;
  }
  if (b.action === "score") {
    assert(
      responsible && p.status === STAGES[6] && p.gain?.approved,
      "Puanlama için onaylı kazanç gerekli.",
    );
    const scoring = scoringOf(s);
    assert(
      Array.isArray(b.values) &&
        b.values.length === scoring.criteria.length &&
        b.values.every(
          (x: any) => Number.isInteger(x) && x >= 1 && x <= scoring.scale,
        ),
      "Her kriter için 1–" + scoring.scale + " arası puan girin.",
    );
    // Puan, verildiği andaki kriterlerle saklanır: kriterler sonradan değişse de eski puan değişmez.
    p.score = {
      previous: p.score
        ? [...(p.score.previous || []), { ...p.score, previous: undefined }]
        : [],
      values: b.values,
      total: scoreTotal(b.values, scoring),
      scale: scoring.scale,
      criteria: scoring.criteria.map((c, i) => ({
        name: c.name,
        weight: c.weight,
        value: b.values[i],
      })),
      valid: true,
      actor: u.id,
      at: now,
    };
    log(
      p,
      "Puanlama: " +
        p.score.total +
        "/100 · " +
        scoring.criteria
          .map((c, i) => c.name + " " + b.values[i] + "/" + scoring.scale)
          .join(", "),
    );
    setStage(p, STAGES[7]);
    // Ödül: kurallar açıksa otomatik kayıt oluşur ve İK'ya düşer (tutar bilgisi geçmişe yazılmaz).
    const reward = buildReward(
      p,
      s.settings?.rewards || DEFAULT_REWARD_SETTINGS,
      now,
    );
    if (reward) {
      s.rewards = [...(s.rewards || []), reward];
      // Ödül türü/değeri geçmişe yazılmaz: öneriyi gören herkes geçmişi görür; ayrıntı yalnız İK ve kişiye görünür.
      log(p, "Ödül değerlendirmesi ödül sorumlusuna iletildi.");
      emit({ type: "reward", proposalId: p.id, text: "created" });
    }
    return;
  }
  throw new Error("İşlem tanınmadı.");
}
