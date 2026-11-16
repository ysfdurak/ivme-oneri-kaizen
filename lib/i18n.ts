// İvme · dil desteği (Türkçe / English).
//
// Kaynak dil Türkçedir: kodda metinler Türkçe yazılır ve sözlüğün anahtarı da bu Türkçe metindir
// (lib/i18n/en.json → { "Türkçe metin": "English text" }). Sözlükte olmayan metin olduğu gibi kalır.
//
// Arayüzde metinleri tek tek sarmak gerekmez: app/i18n-jsx.ts, React'in JSX çalışma zamanını sarar ve
// ekrana giden her yazıyı (çocuk metinler ile title / placeholder / aria-label / alt) translate() ile çevirir.
// Veri kodları (aşama adları, sınıflar, ret nedenleri…) veritabanında Türkçe kalır; ekranda çevrilir.
//
// Şablonlar: "{0} öneri bekliyor" gibi anahtarlar, değişken kısmı herhangi bir metin olan kalıplardır.
// Çeviride {0} yer tutucusu kullanılır; {0|proposal|proposals} sayıya göre tekil / çoğul seçer.
// Yakalanan değer sözlükte varsa (ör. aşama adı) o da çevrilir.
import en from "./i18n/en.json";

export type Locale = "tr" | "en";
export const LOCALES: Locale[] = ["tr", "en"];
export const LANG_COOKIE = "ivme_lang";

export function localeFrom(value: unknown): Locale | null {
  const v = String(value ?? "").trim().toLowerCase().slice(0, 2);
  return v === "en" || v === "tr" ? v : null;
}

let current: Locale = "tr";
/** Tarayıcıda <html lang> değerinden başlar (sunucu çerez ve IVME_LANG'e göre yazar). */
if (typeof document !== "undefined") current = localeFrom(document.documentElement.lang) ?? "tr";
export const getLocale = () => current;
export const setLocale = (l: Locale) => void (current = l);
/** Sayı ve tarih biçimi için Intl dil kodu. */
export const intlLocale = (l: Locale = current) => (l === "en" ? "en-GB" : "tr-TR");

const dict: Record<string, string> = en as any;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const LETTER = /[A-Za-zÇĞİŞÖÜçğışöü]/;

type Pattern = { re: RegExp; to: string; literal: number };
let patterns: Pattern[] | null = null;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compile(): Pattern[] {
  const list: Pattern[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(k)) continue;
    // Yan yana iki yer tutucu ("{0}{1}") hangi metnin hangisine ait olduğunu belirsiz bırakır; parça parça çevrilir.
    if (/\}\{/.test(k)) continue;
    const literal = k.replace(/\{\d+\}/g, "");
    // Yalnız yer tutucudan oluşan ya da çok kısa kalıplar her metni yakalar; atlanır.
    if ((literal.match(/[A-Za-zÇĞİŞÖÜçğışöü]/g) || []).length < 3) continue;
    const order: number[] = [];
    const src = k
      .split(/(\{\d+\})/)
      .map((part) => {
        const m = /^\{(\d+)\}$/.exec(part);
        if (!m) return escape(part).replace(/ /g, "\\s+");
        order.push(Number(m[1]));
        return "([\\s\\S]*?)";
      })
      .join("");
    // Kalıptaki {n} sırası çeviride aynı numarayla kullanılır; yakalama sırasını numaraya eşle.
    const to = v.replace(/\{(\d+)(\|[^}]*)?\}/g, (_, n, rest) => "{" + order.indexOf(Number(n)) + (rest || "") + "}");
    list.push({ re: new RegExp("^\\s*" + src + "\\s*$", "d"), to, literal: literal.length });
  }
  // Daha uzun sabit metni olan kalıp önce denenir (daha özgül).
  return list.sort((a, b) => b.literal - a.literal);
}

const cache: Record<Locale, Map<string, string>> = { tr: new Map(), en: new Map() };
const plural = (value: string, forms: string) => {
  const [one, many] = forms.split("|");
  const n = Number(String(value).replace(/[.,\s]/g, ""));
  return n === 1 ? one : (many ?? one);
};
function fill(to: string, caps: string[], l: Locale) {
  return to.replace(/\{(\d+)(?:\|([^}]*))?\}/g, (_, i, forms) => {
    const v = caps[Number(i)] ?? "";
    return forms !== undefined ? plural(v, forms) : translate(v, l);
  });
}

const cap = (x: string) => x.charAt(0).toLocaleUpperCase("tr") + x.slice(1);
const low = (x: string) => (x.charAt(0) === "İ" ? "i" : x.charAt(0).toLowerCase()) + x.slice(1);
/**
 * Birleştirilmiş metinler için son çare:
 *  - küçük harfle başlayan metin ("bölüm") büyük harfli karşılığıyla aranır,
 *  - "Etiket: değer" biçiminde etiket ve değer ayrı çevrilir,
 *  - " · " ile ayrılmış parçalar tek tek çevrilir.
 * Hiçbir parça değişmezse undefined döner.
 */
function composite(key: string, l: Locale): string | undefined {
  if (/^[a-zçğıöşü]/.test(key)) {
    const up = dict[cap(key)];
    if (up !== undefined && up !== cap(key)) return low(up);
  }
  if (key.includes(" · ")) {
    const parts = key.split(" · ");
    const next = parts.map((x) => translate(x, l));
    if (next.some((x, i) => x !== parts[i])) return next.join(" · ");
  }
  const m = /^([^:]{2,60}): (.+)$/.exec(key);
  if (m && dict[m[1]] !== undefined) return dict[m[1]] + ": " + translate(m[2], l);
  if (m && dict[m[1] + ":"] !== undefined) return dict[m[1] + ":"] + " " + translate(m[2], l);
  return undefined;
}

/** Metni seçili dile çevirir. Baştaki ve sondaki boşluklar korunur. */
export function translate(text: string, l: Locale = current): string {
  if (l === "tr" || typeof text !== "string" || !LETTER.test(text)) return text;
  const hit = cache[l].get(text);
  if (hit !== undefined) return hit;
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const key = norm(text);
  let out: string | undefined = dict[key];
  if (out === undefined) {
    // "Kayıt: X" ya da "X." gibi küçük farklar için sondaki nokta / iki nokta denenir.
    const m = /^(.*?)([.:…!?])$/.exec(key);
    if (m && dict[m[1]] !== undefined) out = dict[m[1]] + m[2];
  }
  if (out === undefined) {
    patterns ??= compile();
    for (const p of patterns) {
      const m = p.re.exec(key);
      if (m) {
        out = fill(p.to, m.slice(1), l);
        break;
      }
    }
  }
  if (out === undefined) out = composite(key, l);
  const result = out === undefined ? text : lead + out + trail;
  if (cache[l].size < 20000) cache[l].set(text, result);
  return result;
}

/**
 * JSX'te yan yana gelen metin ve sayı çocuklarını birlikte çevirir ("Toplam ", 5, " öneri" → "Total 5 proposals").
 * Kalıbın değişken kısımları çocuk sınırlarına denk gelmelidir; böylece kalıp, başka parçaların içine taşmaz.
 * Uyan kalıp yoksa null döner (çocuklar tek tek çevrilir).
 */
export function translateParts(parts: string[], l: Locale = current): string | null {
  if (l === "tr") return null;
  const joined = parts.join("");
  if (!LETTER.test(joined)) return null;
  const lead = /^\s*/.exec(joined)![0];
  const trail = /\s*$/.exec(joined)![0];
  const exact = dict[norm(joined)];
  if (exact !== undefined) return lead + exact + trail;
  // Her konum için hangi çocuk sınırında olduğu (sınırın yanındaki boşluklar dahil).
  const edge = new Map<number, number>();
  let at = 0;
  const mark = (pos: number, i: number) => {
    edge.set(pos, i);
    for (let j = pos; j < joined.length && /\s/.test(joined[j]); ) edge.set(++j, i);
    for (let j = pos; j > 0 && /\s/.test(joined[j - 1]); ) edge.set(--j, i);
  };
  mark(0, 0);
  parts.forEach((p, i) => mark((at += p.length), i + 1));
  patterns ??= compile();
  for (const p of patterns) {
    const m = p.re.exec(joined) as (RegExpExecArray & { indices?: [number, number][] }) | null;
    if (!m) continue;
    // Her değişken tam olarak bir çocuğa denk gelmeli.
    const ok = (m.indices || []).slice(1).every((r) => {
      if (!r) return true;
      const a = edge.get(r[0]), b = edge.get(r[1]);
      return a !== undefined && b !== undefined && (b === a + 1 || (r[0] === r[1] && b === a));
    });
    if (ok) return lead + fill(p.to, m.slice(1).map((x) => x.trim()), l) + trail;
  }
  return null;
}

/** Açıkça çağırmak için: t("{0} öneri", n). Değişkenler {0}, {1}… yerine konur. */
export function t(text: string, ...vars: (string | number)[]): string {
  const filled = vars.length ? text.replace(/\{(\d+)\}/g, (_, i) => String(vars[Number(i)] ?? "")) : text;
  return translate(filled);
}

let reverse: Map<string, string[]> | null = null;
/**
 * İngilizce bir sabiti Türkçe koduna geri çevirir (ör. Excel aktarımında "Completed" → "Tamamlandı").
 * Büyük / küçük harf önemsizdir; bulunamazsa değer olduğu gibi döner. Aynı İngilizce karşılığı olan
 * birden çok Türkçe metin varsa, verilen aday listesindeki ilk eşleşme seçilir.
 */
export function untranslate(value: string, candidates?: string[]): string {
  if (typeof value !== "string" || !value.trim()) return value;
  const v = value.trim().toLowerCase();
  if (candidates) return candidates.find((c) => (dict[c] ?? c).toLowerCase() === v) ?? value;
  if (!reverse) {
    reverse = new Map();
    for (const [k, en] of Object.entries(dict))
      if (!/\{\d/.test(k) && en) reverse.set(en.toLowerCase(), [...(reverse.get(en.toLowerCase()) || []), k]);
  }
  return reverse.get(v)?.[0] ?? value;
}

/** Yüzde: Türkçede "%14", İngilizcede "14%". */
export const pct = (v: number | string) => (current === "en" ? v + "%" : "%" + v);

/** Dosya çıktıları (CSV) için hücre hücre çeviri. */
export const translateCells = (rows: unknown[][]) =>
  rows.map((r) => r.map((c) => (typeof c === "string" ? translate(c) : c)));
