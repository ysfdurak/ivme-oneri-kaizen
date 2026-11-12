// Teslim paketi hazırlar: node scripts/paketle.mjs surec | ai
//   surec → yapay zekâ (MCP) dosyaları pakete HİÇ konmaz; arayüzdeki erişim bileşeni boş yer tutucuyla değişir.
//           Müşteriye "bu kurulumda yapay zekâ bağlantı kodu yok" denebilir.
//   ai    → tam kod; MCP yine de Tanımlar'dan açılana kadar kapalıdır.
// Çıktı: paket/ivme-<paket>/ klasörü (+ zip aracı varsa paket/ivme-<paket>.zip).
import {
  cpSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const kind = process.argv[2];
if (!["surec", "ai"].includes(kind)) {
  console.error("Kullanım: node scripts/paketle.mjs surec | ai");
  process.exit(1);
}
const root = process.cwd();
const out = join(root, "paket", "ivme-" + kind);
const skip = [
  "node_modules",
  ".wrangler",
  "dist",
  ".next",
  ".sites-runtime",
  ".git",
  "paket",
  "tsconfig.tsbuildinfo",
];
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// Kök klasördeki her öğe ayrı kopyalanır (paket klasörü kökün içinde olduğu için kökü bütün olarak kopyalamak olmaz).
for (const name of readdirSync(root)) {
  if (skip.includes(name)) continue;
  cpSync(join(root, name), join(out, name), {
    recursive: true,
    filter: (src) =>
      !/scripts[\\/]test-verisi[\\/](state|users)\.json$/.test(src),
  });
}

export const AI_FILES = [
  "app/api/mcp",
  "app/api/tokens",
  "lib/mcp-tools.ts",
  "lib/mcp-protocol.ts",
  "lib/tokens.ts",
  "tests/mcp.test.ts",
  "tests/mcp.integration.cjs",
];
if (kind === "surec") {
  for (const f of AI_FILES)
    rmSync(join(out, f), { recursive: true, force: true });
  writeFileSync(
    join(out, "app/mcp-access.tsx"),
    '"use client";\n// Süreç paketi: yapay zekâ (MCP) erişimi bu kurulumda yoktur.\nexport default function McpAccess() {\n  return null;\n}\n',
  );
  // Test betiğinden MCP testleri çıkarılır.
  const t = join(out, "scripts/test.sh");
  if (existsSync(t)) {
    const fs = await import("node:fs");
    fs.writeFileSync(
      t,
      fs
        .readFileSync(t, "utf8")
        .split("\n")
        .filter((l) => !/mcp\./.test(l))
        .join("\n"),
    );
  }
}
writeFileSync(
  join(out, "PAKET.txt"),
  "İvme paketi: " +
    kind +
    "\nOrtam değişkeni: IVME_EDITION=" +
    kind +
    "\nHazırlanma: " +
    new Date().toISOString() +
    "\n",
);
try {
  execSync(
    `cd "${join(root, "paket")}" && rm -f ivme-${kind}.zip && zip -qr ivme-${kind}.zip ivme-${kind}`,
  );
  console.log("Hazır:", join("paket", "ivme-" + kind + ".zip"));
} catch {
  console.log("Hazır (klasör):", out);
}
