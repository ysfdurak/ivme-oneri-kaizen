// MCP protokolü (JSON-RPC 2.0, "Streamable HTTP" taşıması, yalnız istek/yanıt).
// Saf: çağıran rota kimliği doğrular ve araçları çalıştıran fonksiyonu verir; bu dosya yalnız mesajı yorumlar.
// Desteklenen yöntemler: initialize, notifications/*, ping, tools/list, tools/call.
import { MCP_TOOLS, ToolError } from "./mcp-tools";

export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = {
  name: "ivme",
  title: "İvme · Öneri ve Kaizen Merkezi",
  version: "1.0.0",
};

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};
type Runner = (name: string, args: any) => Promise<any>;

const error = (id: any, code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});
const result = (id: any, value: any) => ({ jsonrpc: "2.0", id, result: value });

/** Tek bir JSON-RPC mesajını işler. Bildirimlere (id yok) yanıt verilmez: null döner. */
export async function handleRpc(msg: Rpc, run: Runner) {
  if (
    !msg ||
    typeof msg !== "object" ||
    msg.jsonrpc !== "2.0" ||
    typeof msg.method !== "string"
  )
    return error(msg?.id, -32600, "Geçersiz istek.");
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  const id = msg.id;
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return result(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked)
          ? asked
          : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "İvme öneri sistemine salt okuma erişimi. Kullanıcı yalnızca web'de görebildiği kayıtları görür. Kabul, ret, devir gibi kararlar web arayüzünde verilir; burada önerme, özetleme ve bulma yapılır.",
      });
    }
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: MCP_TOOLS.map((t) => ({
          ...t,
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const name = msg.params?.name;
      if (!MCP_TOOLS.some((t) => t.name === name))
        return error(id, -32602, "Bilinmeyen araç: " + name);
      try {
        const value = await run(name, msg.params?.arguments || {});
        return result(id, {
          content: [{ type: "text", text: JSON.stringify(value, null, 1) }],
          structuredContent: value,
        });
      } catch (e: any) {
        // Araç hatası (ör. yetki yok) modele okunur bir sonuç olarak döner; sunucu hatası değildir.
        if (e instanceof ToolError)
          return result(id, {
            content: [{ type: "text", text: e.message }],
            isError: true,
          });
        console.error("MCP araç hatası", e);
        return error(id, -32603, "Araç çalıştırılamadı.");
      }
    }
    default:
      return error(id, -32601, "Desteklenmeyen yöntem: " + msg.method);
  }
}
