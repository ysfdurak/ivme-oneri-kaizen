// Kişisel MCP erişim anahtarları: GET listele, POST {action:"create", name} | {action:"revoke", id}.
// Yalnız yapay zekâ paketinde ve MCP Tanımlar'dan açıkken.
import { current, db, edition, json, sameOrigin } from "../../../lib/server";
import {
  createToken,
  listTokens,
  revokeToken,
  TOKEN_DAYS,
} from "../../../lib/tokens";

async function enabled() {
  if (edition() !== "ai") return false;
  const row = await db()
    .prepare("SELECT data FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  return !!JSON.parse(row.data).settings?.ai?.mcp;
}

export async function GET(req: Request) {
  const u = await current(req);
  if (!u) return json({ error: "Oturum açın." }, 401);
  if (!(await enabled())) return json({ enabled: false, tokens: [] });
  return json({
    enabled: true,
    days: TOKEN_DAYS,
    tokens: await listTokens(u.id),
  });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Geçersiz istek." }, 403);
  const u = await current(req);
  if (!u || u.must_change) return json({ error: "Oturum açın." }, 401);
  if (!(await enabled()))
    return json({ error: "Yapay zekâ erişimi kapalı." }, 403);
  const b: any = await req.json().catch(() => ({}));
  try {
    if (b.action === "create")
      return json({
        ok: true,
        ...(await createToken(u.id, String(b.name || "").trim())),
      });
    if (b.action === "revoke")
      return json({ ok: await revokeToken(u.id, String(b.id || "")) });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
  return json({ error: "İşlem tanınmadı." }, 400);
}
