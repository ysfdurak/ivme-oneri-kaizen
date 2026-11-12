// Ürün paketi. Kod tek; paket ortam değişkeniyle seçilir.
//   IVME_EDITION=surec (varsayılan) → yalnız süreç: dışarıya hiçbir yapay zekâ bağlantısı yok, MCP ucu kapalı (404).
//   IVME_EDITION=ai               → yapay zekâ paketi: MCP ucu ve erişim anahtarları kullanılabilir; yine de
//                                   Tanımlar'dan sistem yöneticisi açana kadar kapalıdır (settings.ai.mcp).
// Süreç paketini teslim ederken scripts/paketle.mjs MCP dosyalarını pakete hiç koymaz.
export type Edition = "surec" | "ai";
export function editionFrom(value: unknown): Edition {
  return String(value || "")
    .trim()
    .toLowerCase() === "ai"
    ? "ai"
    : "surec";
}
