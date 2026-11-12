import {
  current,
  db,
  seed,
  password,
  hash,
  publicUser,
  json,
  cookie,
  sameOrigin,
  demoMode,
  edition,
  showcase,
} from "../../../lib/server";
import { SHOWCASE_ROLES, SHOWCASE_USERNAMES } from "../../../lib/vitrin";
// Kullanıcı adının var olup olmadığı veya hesabın kilitli olduğu dışarıdan anlaşılmasın diye tek mesaj kullanılır.
const LOGIN_FAILED =
  "Kullanıcı adı veya şifre yanlış. Art arda 5 hatalı denemede hesap 5 dakika kilitlenir.";
export async function GET(req: Request) {
  try {
    await seed();
    const user = await current(req);
    return json({
      user: user ? publicUser(user) : null,
      demo: demoMode(),
      edition: edition(),
      ...(showcase() ? { showcase: SHOWCASE_ROLES } : {}),
    });
  } catch {
    return json({ error: "Veri tabanına erişilemiyor." }, 503);
  }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return json({ error: "Geçersiz istek." }, 403);
    await seed();
    const b: any = await req.json();
    if (b.action === "logout") {
      const token = req.headers
        .get("cookie")
        ?.match(/(?:^|; )ivme_session=([^;]+)/)?.[1];
      if (token)
        await db()
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await hash(token))
          .run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    if (b.action === "showcase") {
      // Vitrin demosu: rol düğmesiyle şifresiz giriş. Yalnız tanımlı örnek kullanıcılar.
      if (!showcase()) return json({ error: "Geçersiz istek." }, 403);
      const name = String(b.username || "");
      if (!SHOWCASE_USERNAMES.has(name))
        return json({ error: "Bu rol demoda yok." }, 400);
      await db()
        .prepare("UPDATE users SET active=1, must_change=0 WHERE username=?")
        .bind(name)
        .run();
      const u = await db()
        .prepare("SELECT * FROM users WHERE username=?")
        .bind(name)
        .first<any>();
      if (!u)
        return json(
          {
            error:
              "Demo verisi hazırlanıyor, birkaç saniye sonra tekrar deneyin.",
          },
          503,
        );
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db()
        .prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)")
        .bind(await hash(token), u.id, Date.now() + 43200000)
        .run();
      return json({ user: publicUser(u) }, 200, {
        "Set-Cookie": cookie(token),
      });
    }
    if (b.action === "password") {
      if (showcase())
        return json({ error: "Demoda şifre değiştirilemez." }, 400);
      const u = await current(req);
      if (!u) return json({ error: "Oturum açın." }, 401);
      if (!b.password || b.password.length < 10 || b.password === "Kaizen123!")
        return json(
          {
            error:
              "Başlangıç şifresinden farklı, en az 10 karakterlik şifre belirleyin.",
          },
          400,
        );
      if (
        (await password(
          String(b.oldPassword || ""),
          u.password.split(":")[0],
        )) !== u.password
      )
        return json({ error: "Mevcut şifre yanlış." }, 400);
      const p = await password(b.password);
      await db().batch([
        db()
          .prepare("UPDATE users SET password=?, must_change=0 WHERE id=?")
          .bind(p, u.id),
        db().prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id),
      ]);
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db()
        .prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)")
        .bind(await hash(token), u.id, Date.now() + 43200000)
        .run();
      return json({ user: publicUser({ ...u, must_change: 0 }) }, 200, {
        "Set-Cookie": cookie(token),
      });
    }
    const u = await db()
      .prepare("SELECT * FROM users WHERE username=? AND active=1")
      .bind(String(b.username || "").toLowerCase())
      .first<any>();
    if (!u || u.locked_until > Date.now())
      return json({ error: LOGIN_FAILED }, 401);
    if (
      (await password(String(b.password || ""), u.password.split(":")[0])) !==
      u.password
    ) {
      await db()
        .prepare(
          "UPDATE users SET failures=failures+1,locked_until=? WHERE id=?",
        )
        .bind(u.failures >= 4 ? Date.now() + 300000 : 0, u.id)
        .run();
      return json({ error: LOGIN_FAILED }, 401);
    }
    await db()
      .prepare("UPDATE users SET failures=0,locked_until=0 WHERE id=?")
      .bind(u.id)
      .run();
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db()
      .prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)")
      .bind(await hash(token), u.id, Date.now() + 43200000)
      .run();
    return json({ user: publicUser(u) }, 200, { "Set-Cookie": cookie(token) });
  } catch {
    return json({ error: "İşlem tamamlanamadı. Tekrar deneyin." }, 500);
  }
}
