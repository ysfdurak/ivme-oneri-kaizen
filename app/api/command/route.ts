import {
  current,
  db,
  json,
  users,
  password,
  tempPassword,
  sameOrigin,
  edition, wsId, showcase } from "../../../lib/server";
import { applyCommand } from "../../../lib/workflow";
import { planImport, STATE_MAX_BYTES } from "../../../lib/proposal-import";
import { migrateState } from "../../../lib/migrate";
import { ROLES } from "../../../lib/model";
import { ensureSchema, notifyEvents } from "../../../lib/outbox";
import { env } from "cloudflare:workers";
const appUrl = (req: Request) =>
  String((env as any).APP_URL || new URL(req.url).origin).replace(/\/$/, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({ error: "Geçersiz istek." }, 403);
    const u = await current(req);
    if (!u) return json({ error: "Oturum açın." }, 401);
    if (u.must_change) return json({ error: "Şifrenizi değiştirin." }, 403);
    const raw = await req.text();
    // Karakter değil bayt: Türkçe harfler UTF-8'de 2 bayttır.
    if (new TextEncoder().encode(raw).length > 2300000)
      return json({ error: "Dosya boyutu sınırı aşıldı." }, 400);
    const b = JSON.parse(raw);
    await ensureSchema();
    const us = await users();
    const ws = wsId(req);
    // Vitrin: kullanıcı tabloları bütün ziyaretçiler için ortaktır; kişi ekleme, düzenleme, aktarım, şifre ve
    // bildirim tercihi gibi kullanıcı kaydını değiştiren işlemler demoda kapalıdır (yazılan ad başkasına görünmesin).
    if (
      showcase() &&
      ["myPrefs", "importUsers", "importProposals", "resetPassword", "user", "deleteImported"].includes(b.action)
    )
      return json(
        { error: "Canlı demoda kullanıcı tanımları ve aktarım kapalı. Kendi kurulumunda kullanılabilir." },
        400,
      );
    if (b.action === "myPrefs") {
      // Kişinin kendi bildirim tercihi: anında, günlük özet veya kapalı.
      if (!["instant", "digest", "off"].includes(b.notify))
        return json({ error: "Geçersiz tercih." }, 400);
      await db()
        .prepare("UPDATE users SET notify=? WHERE id=?")
        .bind(b.notify, u.id)
        .run();
      return json({ ok: true });
    }
    if (b.action === "importUsers") return importUsers(b, u, us);
    if (b.action === "importProposals") return importProposals(b, u, us);
    if (b.action === "aiSettings" && edition() !== "ai")
      return json(
        {
          error:
            "Bu kurulum süreç paketidir; yapay zekâ (MCP) erişimi bulunmaz.",
        },
        400,
      );
    if (b.action === "resetPassword") {
      // Yönetici, şifresini unutan kişiye yeni geçici şifre verir; kişi ilk girişte yenisini belirler, kilit kalkar.
      if (u.role !== "admin") return json({ error: "Yetkiniz yok." }, 403);
      const t = us.find((x) => x.id === b.userId);
      if (!t) return json({ error: "Kullanıcı bulunamadı." }, 404);
      if (t.id === u.id)
        return json({ error: "Kendi şifreni sıfırlayamazsın; başka bir yönetici sıfırlayabilir." }, 400);
      if (!t.active) return json({ error: "Pasif kullanıcının şifresi sıfırlanamaz." }, 400);
      const temp = tempPassword();
      await db().batch([
        db()
          .prepare("UPDATE users SET password=?,must_change=1,failures=0,locked_until=0 WHERE id=?")
          .bind(await password(temp), t.id),
        db().prepare("DELETE FROM sessions WHERE user_id=?").bind(t.id),
      ]);
      return json({ ok: true, temp: { name: t.name, username: t.username, password: temp } });
    }
    if (b.action === "user") {
      if (u.role !== "admin") return json({ error: "Yetkiniz yok." }, 403);
      if (
        !/^[a-z0-9._-]{3,40}$/.test(b.username) ||
        !b.name?.trim() ||
        !b.department?.trim() ||
        !b.directorate?.trim() ||
        !ROLES[b.role]
      )
        return json({ error: "Kullanıcı bilgilerini tamamlayın." }, 400);
      b.email = String(b.email || "")
        .trim()
        .toLowerCase();
      if (b.email && !EMAIL_RE.test(b.email))
        return json({ error: "Geçerli bir e-posta adresi yazın." }, 400);
      if (
        b.email &&
        us.some((x: any) => x.email === b.email && x.id !== b.userId)
      )
        return json(
          { error: "Bu e-posta başka bir kullanıcıda kayıtlı." },
          400,
        );
      // Departman/birim Tanımlar'daki listeden seçilmeli; müdürlük departmandan otomatik gelir.
      // Pasife alma serbesttir: açık işler kişide kalır, Kullanıcılar sayfasından istenince devredilir.
      {
        const row = await db()
          .prepare("SELECT data FROM workspace WHERE id=?")
          .bind(ws)
          .first<any>();
        const org = migrateState(JSON.parse(row.data), us).settings!.org!;
        if (b.role === "director") {
          if (
            !org.levels.division ||
            !org.divisions.some((d) => d.name === b.directorate)
          )
            return json(
              { error: "Direktör için tanımlı bir direktörlük seçin." },
              400,
            );
        } else if (b.role === "gm") {
          if (!org.levels.group || !org.groups.includes(b.directorate))
            return json(
              { error: "Genel müdür için tanımlı bir genel müdürlük seçin." },
              400,
            );
        } else {
          const dept = org.departments.find((d) => d.name === b.department);
          if (!dept)
            return json(
              { error: "Departmanı Tanımlar'daki listeden seçin." },
              400,
            );
          b.directorate = dept.directorate;
        }
      }
      if (b.manager && !us.some((x) => x.id === b.manager && x.active))
        return json({ error: "Geçerli yönetici seçin." }, 400);
      if (us.some((x) => x.username === b.username && x.id !== b.userId))
        return json({ error: "Kullanıcı adı kullanımda." }, 400);
      if (b.userId) {
        const old = us.find((x) => x.id === b.userId);
        if (!old) return json({ error: "Kullanıcı bulunamadı." }, 404);
        if (b.manager === b.userId)
          return json({ error: "Kişi kendi yöneticisi olamaz." }, 400);
        if (b.userId === u.id && (b.role !== "admin" || b.active === false))
          return json(
            { error: "Kendi yönetici yetkinizi kaldıramazsınız." },
            400,
          );
        await db()
          .prepare(
            "UPDATE users SET username=?,name=?,department=?,directorate=?,role=?,manager=?,active=?,email=? WHERE id=?",
          )
          .bind(
            b.username,
            b.name,
            b.department,
            b.directorate,
            b.role,
            b.manager || "",
            b.active === false ? 0 : 1,
            b.email || null,
            b.userId,
          )
          .run();
      } else {
        // Yeni hesap: tek kullanımlık geçici şifre. Yalnız bu yanıtta yöneticiye döner, hiçbir yerde saklanmaz (yalnız özeti).
        const temp = tempPassword();
        await db()
          .prepare(
            "INSERT INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until,email) VALUES (?,?,?,?,?,?,?,?,1,1,0,0,?)",
          )
          .bind(
            crypto.randomUUID(),
            b.username,
            b.name,
            b.department,
            b.directorate,
            b.role,
            b.manager || "",
            await password(temp),
            b.email || null,
          )
          .run();
        return json({ ok: true, temp: { name: b.name, username: b.username, password: temp } });
      }
      return json({ ok: true });
    }
    // Eşzamanlılık: Kullanıcının gördüğü sürümden sonra yalnızca BAŞKA öneriler değiştiyse işlem
    // güncel veri üzerine uygulanır. İşlem yapılan önerinin kendisi değiştiyse 409 döner.
    // Öneri dışı işlemler (matris, birim, operasyon) için tam sürüm eşleşmesi aranır.
    const conflict = {
      error:
        "Başka bir kullanıcı bu kaydı güncelledi. Liste yenilendi; işleminizi tekrar yapın.",
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await db()
        .prepare("SELECT * FROM workspace WHERE id=?")
        .bind(ws)
        .first<any>();
      const s = migrateState(JSON.parse(row.data), us);
      if (b.version !== row.version) {
        const target = b.id
          ? s.proposals.find((p: any) => p.id === b.id)
          : null;
        // Yeni öneri var olan hiçbir kaydı değiştirmez; arada başka öneriler değişmiş olması onu eskitmez.
        const stale =
          b.action === "create"
            ? false
            : !b.id || !target || (target.rev || 0) > b.version;
        if (stale || typeof b.version !== "number") return json(conflict, 409);
      }
      const id = applyCommand(s, b, { ...u, mustChange: u.must_change }, us);
      // Bildirim olayları kayda yazılmaz; yazma başarılı olursa e-postaya çevrilir.
      const events = (s as any)._events || [];
      delete (s as any)._events;
      const touched = s.proposals.find((p: any) => p.id === (b.id || id));
      if (touched) touched.rev = row.version + 1;
      for (const p of s.proposals as any[])
        if (p._touched) {
          p.rev = row.version + 1;
          delete p._touched;
        }
      const r = await db()
        .prepare(
          "UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?",
        )
        .bind(JSON.stringify(s), ws, row.version)
        .run();
      if (r.meta.changes) {
        // Departmanın bağlı olduğu müdürlük değiştiyse kullanıcı kayıtları da güncellenir.
        // Geri alınan aktarımın açtığı pasif kullanıcılar, başka hiçbir kayıtta geçmiyorsa silinir.
        if (b.action === "deleteImported") {
          // Paket kaydının kendisi hariç: öneriler, ödüller, matris ve devirlerde geçiyor mu?
          const data = JSON.stringify([
            s.proposals,
            s.rewards,
            s.matrix,
            s.transfers,
          ]);
          for (const uid of (id as any)?.userCandidates || [])
            if (!data.includes('"' + uid + '"'))
              await db()
                .prepare("DELETE FROM users WHERE id=? AND active=0")
                .bind(uid)
                .run();
        }
        if (b.action === "defineOrg" && !showcase())
          for (const d of s.settings?.org?.departments || [])
            await db()
              .prepare(
                "UPDATE users SET directorate=? WHERE department=? AND role NOT IN ('director','gm')",
              )
              .bind(d.directorate, d.name)
              .run();
        try {
          await notifyEvents(events, s, appUrl(req));
        } catch (err) {
          console.error("Bildirim hatası", err); // E-posta sorunu işlemi asla bozmaz.
        }
        return json({ ok: true, id, version: row.version + 1 });
      }
      // Arada başka bir yazma oldu: güncel veriyle tekrar dene.
    }
    return json(
      { error: "Sistem şu an yoğun. Birkaç saniye sonra tekrar deneyin." },
      409,
    );
  } catch (e: any) {
    // Yetki hatası 403, kural ya da biçim hatası 400 (lib/workflow.ts › assert işaretler).
    return json({ error: e.message || "İşlem tamamlanamadı." }, e.status === 403 ? 403 : 400);
  }
}

/** Excel/CSV'den toplu kullanıcı yükleme (yalnız yönetici).
 * Satır: ad, kullanıcı adı, e-posta, departman, rol, yönetici kullanıcı adı. Kullanıcı adı varsa güncellenir.
 * Yeni kişilere tek kullanımlık rastgele şifre verilir; ilk girişte değiştirmeleri istenir. */
async function importUsers(b: any, u: any, us: any[]) {
  if (u.role !== "admin") return json({ error: "Yetkiniz yok." }, 403);
  const rows: any[] = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [];
  if (!rows.length) return json({ error: "Yüklenecek satır yok." }, 400);
  const row = await db()
    .prepare("SELECT data FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  const org = migrateState(JSON.parse(row.data), us).settings!.org!;
  const roleByLabel = new Map(
    Object.entries(ROLES).flatMap(([k, v]) => [
      [k, k],
      [String(v).toLocaleLowerCase("tr"), k],
    ]),
  );
  const errors: string[] = [];
  const plan: any[] = [];
  const seenUser = new Set<string>(),
    seenMail = new Set<string>();
  rows.forEach((r, i) => {
    const line = "Satır " + (i + 2) + ": ";
    const username = String(r.username || "")
      .trim()
      .toLowerCase();
    const email = String(r.email || "")
      .trim()
      .toLowerCase();
    const role =
      roleByLabel.get(
        String(r.role || "Çalışan")
          .trim()
          .toLocaleLowerCase("tr"),
      ) || roleByLabel.get(String(r.role || "").trim());
    const dept = org.departments.find(
      (d) =>
        d.name.toLocaleLowerCase("tr") ===
        String(r.department || "")
          .trim()
          .toLocaleLowerCase("tr"),
    );
    if (!String(r.name || "").trim()) return errors.push(line + "ad boş");
    if (!/^[a-z0-9._-]{3,40}$/.test(username))
      return errors.push(line + "kullanıcı adı geçersiz (" + username + ")");
    if (seenUser.has(username))
      return errors.push(line + "kullanıcı adı dosyada iki kez var");
    if (email && !EMAIL_RE.test(email))
      return errors.push(line + "e-posta geçersiz");
    if (email && seenMail.has(email))
      return errors.push(line + "e-posta dosyada iki kez var");
    if (!role || ["director", "gm"].includes(role))
      return errors.push(line + "rol tanınmadı (" + r.role + ")");
    if (!dept)
      return errors.push(
        line + "departman Tanımlar'da yok (" + r.department + ")",
      );
    seenUser.add(username);
    if (email) seenMail.add(email);
    plan.push({
      username,
      email,
      name: String(r.name).trim(),
      role,
      dept,
      managerName: String(r.manager || "")
        .trim()
        .toLowerCase(),
    });
  });
  const known = new Set([
    ...us.map((x: any) => x.username),
    ...plan.map((p) => p.username),
  ]);
  plan.forEach((p) => {
    if (p.managerName && !known.has(p.managerName))
      errors.push(
        p.username +
          ": yönetici kullanıcı adı bulunamadı (" +
          p.managerName +
          ")",
      );
    const other = us.find(
      (x: any) => x.email === p.email && x.username !== p.username,
    );
    if (p.email && other)
      errors.push(p.username + ": e-posta başka kullanıcıda kayıtlı");
  });
  if (errors.length)
    return json(
      {
        error: "Dosyada düzeltilmesi gereken satırlar var.",
        errors: errors.slice(0, 50),
      },
      400,
    );
  if (b.dryRun) {
    const updates = plan.filter((p) =>
      us.some((x: any) => x.username === p.username),
    ).length;
    return json({
      ok: true,
      preview: { create: plan.length - updates, update: updates },
    });
  }
  const ids = new Map(us.map((x: any) => [x.username, x.id]));
  for (const p of plan)
    if (!ids.has(p.username)) ids.set(p.username, crypto.randomUUID());
  const created: { name: string; username: string; password: string }[] = [];
  const stmts: any[] = [];
  for (const p of plan) {
    const id = ids.get(p.username)!;
    const existing: any = us.find((x: any) => x.username === p.username);
    // Mevcut kişide boş bırakılan e-posta ve yönetici hücresi eski değeri korur (dosya eksik sütunla gelebilir).
    const manager = p.managerName
      ? ids.get(p.managerName) || ""
      : existing?.manager || "";
    if (existing)
      stmts.push(
        db()
          .prepare(
            "UPDATE users SET name=?,email=?,department=?,directorate=?,role=?,manager=? WHERE id=?",
          )
          .bind(
            p.name,
            p.email || existing.email || null,
            p.dept.name,
            p.dept.directorate,
            p.role,
            manager,
            id,
          ),
      );
    else {
      const temp = tempPassword();
      created.push({ name: p.name, username: p.username, password: temp });
      stmts.push(
        db()
          .prepare(
            "INSERT INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until,email) VALUES (?,?,?,?,?,?,?,?,1,1,0,0,?)",
          )
          .bind(
            id,
            p.username,
            p.name,
            p.dept.name,
            p.dept.directorate,
            p.role,
            manager,
            await password(temp),
            p.email || null,
          ),
      );
    }
  }
  await db().batch(stmts);
  return json({ ok: true, created, updated: plan.length - created.length });
}

/** Eski sistemden toplu öneri aktarımı (yalnız yönetici). Önce dryRun ile önizleme, sonra onay.
 * E-posta gönderilmez, ödül kaydı oluşmaz; sistemde olmayan önerenler pasif kullanıcı olarak açılır. */
async function importProposals(b: any, u: any, us: any[]) {
  if (u.role !== "admin") return json({ error: "Yetkiniz yok." }, 403);
  const rows: any[] = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return json({ error: "Aktarılacak satır yok." }, 400);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db()
      .prepare("SELECT * FROM workspace WHERE id=?")
      .bind("main")
      .first<any>();
    const s = migrateState(JSON.parse(row.data), us);
    const { errors, plan, newUsers, summary } = planImport(rows, s, us);
    if (errors.length)
      return json(
        {
          error: "Dosyada düzeltilmesi gereken satırlar var.",
          errors: errors.slice(0, 50),
          errorCount: errors.length,
          summary,
        },
        400,
      );
    // Yeni (pasif) kullanıcılar önce bellekte eklenir; boyut kontrolü geçmeden veritabanına yazılmaz.
    const fresh = newUsers.map((n) => ({
      id: crypto.randomUUID(),
      ...n,
      role: "employee",
      manager: "",
      active: 0,
    }));
    const all = [...us, ...fresh];
    const count = applyCommand(
      s,
      { action: "importProposals", plan, newUserIds: fresh.map((x) => x.id) },
      u,
      all,
    );
    for (const p of s.proposals as any[])
      if (p._touched) {
        p.rev = row.version + 1;
        delete p._touched;
      }
    delete (s as any)._events; // Aktarım bildirim üretmez.
    const data = JSON.stringify(s);
    const bytes = new TextEncoder().encode(data).length;
    if (bytes > STATE_MAX_BYTES)
      return json(
        {
          error:
            "Aktarım sonrası veri, bu kurulumun tek kayıt sınırını (yaklaşık 2 MB) aşıyor. Dosyayı daha az satırla aktarın ya da kurum sunucusuna (VPS) geçin.",
          summary: { ...summary, bytes },
        },
        400,
      );
    if (b.dryRun)
      return json({
        ok: true,
        preview: {
          ...summary,
          bytes,
          newUsers: newUsers.map((n) => n.username),
        },
      });
    if (fresh.length)
      await db().batch(
        await Promise.all(
          fresh.map(async (n) =>
            db()
              .prepare(
                "INSERT INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until,email) VALUES (?,?,?,?,?,?,?,?,1,0,0,0,NULL)",
              )
              .bind(
                n.id,
                n.username,
                n.name,
                n.department,
                n.directorate,
                "employee",
                "",
                await password(crypto.randomUUID()),
              ),
          ),
        ),
      );
    const r = await db()
      .prepare(
        "UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?",
      )
      .bind(data, "main", row.version)
      .run();
    if (r.meta.changes)
      return json({
        ok: true,
        imported: count,
        newUsers: fresh.length,
        version: row.version + 1,
      });
    us = await users(); // Arada yazma oldu: yeni açılan kullanıcılar artık mevcut; tekrar planla.
  }
  return json(
    { error: "Sistem şu an yoğun. Birkaç saniye sonra tekrar deneyin." },
    409,
  );
}
