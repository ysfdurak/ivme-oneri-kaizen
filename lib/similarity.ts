// Benzer öneri bulucu: değiştirilebilir sağlayıcı.
// Süreç paketinde yalnızca "kelime" sağlayıcısı vardır (tamamen İvme içinde çalışır, veri hiçbir yere gitmez).
// Yapay zekâ paketinde, müşteri isterse, kurumun kendi sunucusundaki bir modele bağlanan bir sağlayıcı aynı
// arayüzle eklenir; o çalışmazsa her zaman kelime sağlayıcısına geri dönülür. Kararı her durumda insan verir.
import type { Proposal } from "./model";
import { findSimilar, SimilarHit, SimilarInput } from "./similar";

export type SimilarityProvider = {
  /** Ekranda ve kayıtta görünen ad. */
  name: string;
  find(
    target: SimilarInput,
    proposals: Proposal[],
    synonyms: string[][],
    limit?: number,
  ): Promise<SimilarHit[]>;
};

export const keywordProvider: SimilarityProvider = {
  name: "kelime",
  find: async (target, proposals, synonyms, limit = 5) =>
    findSimilar(target, proposals, synonyms, limit),
};

/** Kullanılacak sağlayıcıyı seçer. Bugün tek seçenek kelime eşleştirmesi; şirket içi model sağlayıcısı
 * eklendiğinde burada (paket "ai" ve ayar açıksa) seçilir. */
export function similarityProvider(): SimilarityProvider {
  return keywordProvider;
}

/** Sağlayıcı hata verirse kelime eşleştirmesine düşer; benzer öneri listesi asla boş hata ekranına dönmez. */
export async function findSimilarSafe(
  target: SimilarInput,
  proposals: Proposal[],
  synonyms: string[][],
  limit = 5,
) {
  const p = similarityProvider();
  try {
    return {
      provider: p.name,
      hits: await p.find(target, proposals, synonyms, limit),
    };
  } catch (err) {
    console.error(
      "Benzerlik sağlayıcısı hata verdi, kelime eşleştirmesine dönüldü",
      err,
    );
    return {
      provider: keywordProvider.name,
      hits: findSimilar(target, proposals, synonyms, limit),
    };
  }
}
