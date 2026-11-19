// Tarayıcıda React JSX çalışma zamanının yerine geçer (vite.config.ts → i18nJsx eklentisi).
// Ekrana giden metinleri lib/i18n.ts → translate() ile çevirip gerçek çalışma zamanına iletir.
// Türkçe seçiliyken hiçbir şey değiştirmez. Değerler (value, key, id…) hiç çevrilmez; yalnız görünen metin.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- bu satır bazı derlemelerde hatasız olduğundan @ts-expect-error kullanılamaz
// @ts-ignore: gerçek çalışma zamanı (eklenti bu dosyanın kendi içe aktarmasını yeniden yönlendirmez)
import * as real from "react/jsx-runtime";
import { getLocale, translate as tr0, translateParts as tp0 } from "../lib/i18n";
import { currency, withCurrency } from "../lib/model";
// "₺" yer tutucusu çeviriden sonra kurumun para birimiyle değişir (Tanımlar → Para birimi).
const translate = (s: string) => withCurrency(tr0(s));
const translateParts = (p: string[]) => {
  const o = tp0(p);
  return o === null ? null : withCurrency(o);
};

const ATTRS = ["title", "placeholder", "aria-label", "aria-description", "aria-valuetext", "alt"];
// İçeriği kod ya da kullanıcı girdisi olan öğelerin içeriği çevrilmez (başlık, yer tutucu gibi nitelikleri çevrilir).
const SKIP = new Set(["code", "pre", "textarea", "script", "style", "kbd", "samp"]);

const prim = (c: unknown) => typeof c === "string" || typeof c === "number";

function children(c: any): any {
  if (typeof c === "string") return translate(c);
  if (!Array.isArray(c)) return c;
  // Yalnız metin ve sayıdan oluşan çocuklar birleştirilip tek kalıpla denenir ("Toplam {0} öneri").
  const kids = c.filter((x) => x !== null && x !== undefined && x !== false && x !== true && x !== "");
  if (kids.length > 1 && kids.every(prim) && kids.some((x) => typeof x === "string")) {
    const out = translateParts(kids.map(String));
    if (out !== null) return out;
  }
  let changed = false;
  const next = c.map((x) => {
    if (typeof x !== "string") return x;
    const y = translate(x);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? next : c;
}

function wrap(type: any, props: any) {
  if (!props || (getLocale() === "tr" && currency() === "₺")) return props;
  const intrinsic = typeof type === "string";
  let next = props;
  if ("children" in props && !(intrinsic && SKIP.has(type))) {
    const c = children(props.children);
    if (c !== props.children) next = { ...props, children: c };
  }
  if (intrinsic) {
    for (const a of ATTRS) {
      const v = props[a];
      if (typeof v === "string") {
        const y = translate(v);
        if (y !== v) next = next === props ? { ...props, [a]: y } : ((next[a] = y), next);
      }
    }
    // <option> ve <input type=button|submit> görünen değeri
    if (type === "input" && (props.type === "submit" || props.type === "button") && typeof props.value === "string") {
      next = { ...next, value: translate(props.value) };
    }
  }
  return next;
}

export const Fragment = real.Fragment;
export const jsx = (type: any, props: any, key?: any) => real.jsx(type, wrap(type, props), key);
export const jsxs = (type: any, props: any, key?: any) => real.jsxs(type, wrap(type, props), key);
export const jsxDEV = (type: any, props: any, key?: any, isStatic?: any, source?: any, self?: any) =>
  (real as any).jsxDEV
    ? (real as any).jsxDEV(type, wrap(type, props), key, isStatic, source, self)
    : real.jsx(type, wrap(type, props), key);

// JSX dışında ekrana çıkan tarayıcı pencereleri ve form doğrulama mesajları.
if (typeof window !== "undefined" && !(window as any).__ivmeI18n) {
  (window as any).__ivmeI18n = true;
  const { alert, confirm, prompt } = window;
  window.alert = (m?: any) => alert.call(window, typeof m === "string" ? translate(m) : m);
  window.confirm = (m?: string) => confirm.call(window, typeof m === "string" ? translate(m) : m);
  window.prompt = (m?: string, d?: string) => prompt.call(window, typeof m === "string" ? translate(m) : m, d);
  const validity = HTMLInputElement.prototype.setCustomValidity;
  for (const proto of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype, HTMLSelectElement.prototype])
    proto.setCustomValidity = function (m: string) {
      return validity.call(this, translate(m));
    };
}
