// MCP ucu (yalnız yapay zekâ paketi): POST /api/mcp, başlık "Authorization: Bearer ivme_…".
// Şirket içi yapay zekâ istemcisi (MCP destekli sohbet arayüzü vb.) buraya bağlanır.
// Süreç paketinde (IVME_EDITION boş ya da "surec") ve Tanımlar'dan açılmadıkça 404 döner.
import { db, edition, json, users } from "../../../lib/server";
import { migrateState } from "../../../lib/migrate";
import { userFromToken } from "../../../lib/tokens";
import { handleRpc } from "../../../lib/mcp-protocol";
import { runTool } from "../../../lib/mcp-tools";

async function workspace() {
  const row = await db()
    .prepare("SELECT data FROM workspace WHERE id=?")
    .bind("main")
    .first<any>();
  const all = await users();
  return { state: migrateState(JSON.parse(row.data), all), all };
}

export async function POST(req: Request) {
  if (edition() !== "ai") return json({ error: "Bulunamadı." }, 404);
  // Tarayıcıdan başka bir siteden gelen istekler reddedilir (MCP güvenlik önerisi: Origin kontrolü).
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    return json({ error: "Geçersiz kaynak." }, 403);
  const { state, all } = await workspace();
  if (!state.settings?.ai?.mcp) return json({ error: "Bulunamadı." }, 404);
  const u = await userFromToken(req);
  if (!u)
    return json({ error: "Geçerli bir erişim anahtarı gerekli." }, 401, {
      "WWW-Authenticate": 'Bearer realm="ivme"',
    });
  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "JSON okunamadı." },
      },
      400,
    );
  }
  if (Array.isArray(msg))
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Toplu istek desteklenmez." },
      },
      400,
    );
  const out = await handleRpc(msg, (name, args) =>
    runTool(name, args, state, all as any, u),
  );
  if (out === null) return new Response(null, { status: 202 });
  return json(out);
}

export async function GET() {
  // Sunucudan istemciye akış (SSE) kullanılmıyor.
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
