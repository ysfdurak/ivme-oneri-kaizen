// Çeviri kapsamı denetimi: kaynak koddaki Türkçe metinleri bulur ve lib/i18n/en.json'da karşılığı olmayanları listeler.
//   node scripts/i18n/anahtarlar.mjs            → eksikleri yazar (çıkış kodu 0)
//   node scripts/i18n/anahtarlar.mjs --strict   → eksik varsa çıkış kodu 1
// Anahtarlar: düz metin, şablon (${} → {0}), JSX karışık çocuk ve + zincirleri. Yeni metin eklediğinde
// İngilizcesini lib/i18n/en.json'a ekle; değişmemesi gereken metinler (kod, veri anahtarı) KASITLI listesine.
import ts from "typescript";
import fs from "node:fs"; import path from "node:path";
const root = new URL("../../", import.meta.url).pathname;
const strict = process.argv.includes("--strict");
const files = fs.readdirSync(root + "app").filter((f) => /\.tsx?$/.test(f) && f !== "i18n-jsx.ts").map((f) => "app/" + f)
  .concat(fs.readdirSync(root + "app/api").map((d) => "app/api/" + d + "/route.ts"))
  .concat(fs.readdirSync(root + "lib").filter((f) => /\.m?ts$/.test(f) && !/^connector-|^i18n/.test(f)).map((f) => "lib/" + f));
const TR = /[çğışöüÇĞİŞÖÜâîû]/;
const HUMAN_PROP = /^(label|title|hint|error|text|description|desc|cta|message|subject|empty|placeholder|note|detail|summary|help|body|heading|name|reason|tip|lead|caption|unit|suffix|first|parentLabel|what|why|how|action|info|warn|warning|ok|step|sub|value)$/;
const HUMAN_CALL = /^(err|setError|assert|alert|confirm|add|note|Error|setToast|notify|setMsg|setInfo|setNote|fail|bad|warn|t|setCustomValidity|.*\.setCustomValidity|toast|showToast|setMessage|setStatus|setWarn)$/;
const keys = new Map();
const norm = (s) => s.replace(/\s+/g, " ").trim();
const humanish = (s) => /[A-Za-zÇĞİŞÖÜçğışöü]{2}/.test(s) && !/^[a-z0-9_.\-/:#@?=&]+$/.test(s) && !/^[a-z]+[A-Z]/.test(s) && !/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|PRAGMA)\b/.test(s) && !/^https?:/.test(s);
const add = (k, where) => { k = norm(k); if (!k || !/[A-Za-zÇĞİŞÖÜçğışöü]{2}/.test(k.replace(/\{\d+\}/g, ""))) return; if (!keys.has(k)) keys.set(k, where); };
for (const rel of files) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const at = (n) => rel + ":" + (sf.getLineAndCharacterOfPosition(n.getStart()).line + 1);
  const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
  // Literal parçalar + ifade yer tutucuları.
  const tmplKey = (n) => { let s = n.head.text, i = 0; for (const sp of n.templateSpans) { s += "{" + i++ + "}" + sp.literal.text; } return s; };
  const flatPlus = (n, parts) => {
    if (ts.isParenthesizedExpression(n)) return flatPlus(n.expression, parts);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { flatPlus(n.left, parts); flatPlus(n.right, parts); return parts; }
    parts.push(n); return parts;
  };
  const accept = (n, text) => {
    const p = n.parent;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return false;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return TR.test(text) ? "cmp" : false;
    if (ts.isCaseClause(p)) return false;
    if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return false;
    if (ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent))) { const a = (ts.isJsxAttribute(p) ? p : p.parent).name.getText(); if (/^(className|key|id|htmlFor|href|src|type|name|value|role|accept|autoComplete|inputMode|lang|style|data-.*|form|method|target|rel|pattern|defaultValue|ref)$/.test(a)) return TR.test(text) && a === "value" ? true : false; return humanish(text); }
    if (TR.test(text)) return true;
    if (ts.isPropertyAssignment(p) && HUMAN_PROP.test(p.name.getText().replace(/"/g, ""))) return humanish(text) && /[A-ZÇĞİŞÖÜ]|\s/.test(text);
    if (ts.isCallExpression(p) && HUMAN_CALL.test(p.expression.getText().split(".").pop())) return humanish(text);
    if (ts.isNewExpression(p) && /Error/.test(p.expression.getText())) return humanish(text);
    if (ts.isConditionalExpression(p) || ts.isArrayLiteralExpression(p) || ts.isBinaryExpression(p) || ts.isReturnStatement(p)) return humanish(text) && /^[A-ZÇĞİŞÖÜ]/.test(text) && /[a-zçğışöü]{3}/.test(text) && !/[A-Z]{2}|[a-z][A-Z]|[{}()<>=;]/.test(text);
    return false;
  };
  const visit = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const kids = n.children.filter(c => !(ts.isJsxText(c) && !c.text.trim() && /\n/.test(c.text)));
      const hasText = kids.some(c => ts.isJsxText(c) && /[A-Za-zÇĞİŞÖÜçğışöü]{2}/.test(c.text));
      const hasExpr = kids.some(c => ts.isJsxExpression(c) && c.expression);
      const onlyPrim = kids.every(c => ts.isJsxText(c) || (ts.isJsxExpression(c) && (!c.expression || !/^\s*(<|\(\s*<)/.test(c.expression.getText()) && !/&&\s*\(?\s*</.test(c.expression.getText()) && !/\?\s*\(?\s*</.test(c.expression.getText()))));
      if (hasText && hasExpr && onlyPrim) {
        let s = "", i = 0; for (const c of kids) { if (ts.isJsxText(c)) s += c.text.replace(/\s*\n\s*/g, " "); else if (c.expression) { if (isStr(c.expression)) s += c.expression.text; else s += "{" + i++ + "}"; } }
        add(s, at(n) + " jsx-join");
      }
    }
    if (ts.isJsxText(n)) { if (/[A-Za-zÇĞİŞÖÜçğışöü]{2}/.test(n.text)) add(n.text, at(n) + " jsx"); }
    else if (isStr(n)) { const r = accept(n, n.text); if (r) add(n.text, at(n) + (r === "cmp" ? " cmp" : " str")); }
    else if (ts.isTemplateExpression(n)) { const k = tmplKey(n); if (TR.test(k) || accept(n, k)) add(k, at(n) + " tmpl"); }
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) && !ts.isParenthesizedExpression(n.parent)) {
      const parts = flatPlus(n, []);
      if (parts.some(x => isStr(x) && /[A-Za-zÇĞİŞÖÜçğışöü]{2}/.test(x.text)) && parts.some(x => !isStr(x))) {
        let s = "", i = 0; for (const x of parts) s += isStr(x) ? x.text : ts.isTemplateExpression(x) ? tmplKey(x).replace(/\{(\d+)\}/g, () => "{" + i++ + "}") : "{" + i++ + "}";
        if (TR.test(s) || accept(n, s)) add(s, at(n) + " plus");
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const dict = JSON.parse(fs.readFileSync(root + "lib/i18n/en.json", "utf8"));
const known = JSON.parse(fs.readFileSync(root + "scripts/i18n/kasitli.json", "utf8"));
const collapse = (k) => { let i = 0; return k.replace(/(\{\d+\})+/g, () => "{" + i++ + "}"); };
const missing = [...keys].filter(([k]) => dict[k] === undefined && dict[collapse(k)] === undefined && !known.includes(k));
for (const [k, w] of missing) console.log(w + "\t" + k);
console.log(keys.size + " metin, " + missing.length + " eksik çeviri.");
if (strict && missing.length) process.exit(1);
