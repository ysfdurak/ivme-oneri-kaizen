#!/usr/bin/env bash
# Süreç ve API testlerini çalıştırır.
set -e
cd "$(dirname "$0")/.."
TSX=$(ls node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs | head -1)
node "$TSX" tests/workflow.test.ts
node "$TSX" tests/csv.test.ts
node "$TSX" tests/improvements.test.ts
node "$TSX" tests/dashboard.test.ts
node "$TSX" tests/round3.test.ts
node "$TSX" tests/round5.test.ts
node "$TSX" tests/round6.test.ts
node "$TSX" tests/mcp.test.ts
node "$TSX" tests/round8.test.ts
node "$TSX" tests/round9.test.ts
node "$TSX" tests/round10.test.ts
node "$TSX" tests/round11.test.ts
node "$TSX" tests/round12.test.ts
node "$TSX" tests/vitrin.test.ts
node "$TSX" tests/i18n.test.ts
node "$TSX" tests/round14.test.ts
node "$TSX" tests/round15.test.ts
node "$TSX" tests/audit.test.ts
rm -rf /tmp/kaizen-server-tests
node_modules/.bin/tsc lib/*.ts app/api/*/route.ts --outDir /tmp/kaizen-server-tests --module commonjs --target es2022 --moduleResolution node --skipLibCheck --esModuleInterop --types @cloudflare/workers-types,node >/dev/null || true
mkdir -p /tmp/kaizen-server-tests/lib/vitrin /tmp/kaizen-server-tests/lib/i18n && cp lib/vitrin/*.json /tmp/kaizen-server-tests/lib/vitrin/ && mkdir -p /tmp/kaizen-server-tests/lib/vitrin/en && cp lib/vitrin/en/*.json /tmp/kaizen-server-tests/lib/vitrin/en/ && cp lib/i18n/*.json /tmp/kaizen-server-tests/lib/i18n/
node tests/server.integration.cjs
node tests/improvements.integration.cjs
node tests/round5.integration.cjs
node tests/round6.integration.cjs
node tests/mcp.integration.cjs
node tests/round12.integration.cjs
node tests/round13.integration.cjs
node tests/vitrin.integration.cjs
