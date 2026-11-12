// Benzer öneri bulma. Ücretli yapay zekâ kullanmaz; şirket sunucusunda çalışır.
// Yöntem: Türkçe küçük harfe çevir → noktalama ve dolgu kelimeleri at → kelimeleri köküne yaklaştır
// (ilk 5 harf) → eş anlamlıları tek köke indir → başlık (2 kat ağırlık), sorun ve çözüm kelime kümelerini
// karşılaştır (Jaccard benzerliği) → aynı bölüm ve aynı alan için küçük bonus ekle.
import { Proposal } from "./model";

const STOP = new Set(
  (
    "ve ile için bir bu şu o da de ki mi mu mı mü ama fakat veya ya hem gibi kadar daha çok az en her " +
    "aynı anda olan olarak olması olmak yapılması yapılmalı yapmak edilmesi edilmeli var yok sonra önce " +
    "üzerinde içinde arasında nedeniyle dolayı göre yerine zaman şekilde durum durumda bazı tüm hep " +
    "ise değil olup oldu oluyor olur olabilir ediyor yapılıyor biz siz onlar ben sen benim bizim"
  ).split(" "),
);
const STEM = 5;

/** Kelimeyi köküne yaklaştırır: Türkçe ekler sonda olduğu için ilk 5 harf çoğu zaman yeterlidir. */
const stem = (w: string) => (w.length > STEM ? w.slice(0, STEM) : w);

export function tokenize(text: string, synonyms: string[][] = []) {
  const map = new Map<string, string>();
  for (const group of synonyms) {
    const head = stem(group[0].toLocaleLowerCase("tr").trim());
    for (const w of group) map.set(stem(w.toLocaleLowerCase("tr").trim()), head);
  }
  return new Set(
    text
      .toLocaleLowerCase("tr")
      .replace(/[^a-zçğıöşü0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
      .map((w) => map.get(stem(w)) || stem(w)),
  );
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

export type SimilarInput = { id?: string; title: string; problem: string; solution: string; operation: string; category?: string };
export type SimilarHit = { proposal: Proposal; score: number; shared: string[]; sameOperation: boolean; sameCategory: boolean };

/** Eşik: örnek veriyle ayarlandı; düşük tutulur, çünkü karar her zaman insanda. */
export const SIMILAR_THRESHOLD = 0.16;

export function findSimilar(
  target: SimilarInput,
  proposals: Proposal[],
  synonyms: string[][] = [],
  limit = 5,
): SimilarHit[] {
  const tTitle = tokenize(target.title, synonyms);
  const tBody = tokenize(target.problem + " " + target.solution, synonyms);
  const hits: SimilarHit[] = [];
  for (const p of proposals) {
    if (p.id === target.id || p.status === "İptal edildi") continue;
    const pTitle = tokenize(p.title, synonyms);
    const pBody = tokenize(p.problem + " " + p.solution, synonyms);
    const titleScore = jaccard(tTitle, pTitle);
    const bodyScore = jaccard(new Set([...tTitle, ...tBody]), new Set([...pTitle, ...pBody]));
    const sameOperation = p.operation === target.operation;
    const sameCategory = !!target.category && p.category === target.category;
    const score = (2 * titleScore + bodyScore) / 3 + (sameOperation ? 0.06 : 0) + (sameCategory ? 0.02 : 0);
    if (score < SIMILAR_THRESHOLD) continue;
    // Eşleşme nedeni olarak ortak kelimeler orijinal yazımıyla gösterilir.
    const sharedStems = [...new Set([...tTitle, ...tBody])].filter((x) => pTitle.has(x) || pBody.has(x));
    const words = (target.title + " " + target.problem + " " + target.solution)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/);
    const shared = sharedStems
      .map((st) => words.find((w) => stem(w.toLocaleLowerCase("tr")) === st) || st)
      .slice(0, 6);
    hits.push({ proposal: p, score: Math.round(score * 100) / 100, shared, sameOperation, sameCategory });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
