import { applyTargetDays } from "./definitions";
// Kayıtlı çalışma alanı verisini güncel yapıya çevirir. Her okumada çağrılır; değişiklik ilk yazmada kalıcı olur.
// - "Operasyon değerlendirmesi" aşaması "Bölüm değerlendirmesi" oldu (Kasım 2026, adlandırma kararı).
// - Organizasyon tanımları (departman → müdürlük) yoksa kullanıcılardan çıkarılır.
// - Lokasyon listesi yoksa boş başlatılır.
import type { State } from "./model";
const RENAMES: Record<string, string> = {
  "Operasyon değerlendirmesi": "Bölüm değerlendirmesi",
};
const ren = (v?: string) => (v && RENAMES[v]) || v;
export function migrateState(
  s: State,
  users: { department: string; directorate: string; role?: string }[] = [],
) {
  for (const p of s.proposals) {
    p.status = ren(p.status)!;
    p.revisionTarget = ren(p.revisionTarget);
    p.lastActiveStage = ren(p.lastActiveStage);
    for (const l of p.stageLog || []) l.stage = ren(l.stage)!;
  }
  s.settings = { ...(s.settings || {}) };
  if (!s.settings.org) {
    const departments: { name: string; directorate: string }[] = [];
    for (const u of users)
      if (
        u.department &&
        u.directorate &&
        !departments.some((d) => d.name === u.department)
      )
        departments.push({ name: u.department, directorate: u.directorate });
    const directorates = [
      ...new Set(departments.map((d) => d.directorate)),
    ].map((name) => ({
      name,
      division: "",
    }));
    s.settings.org = {
      departments,
      directorates,
      divisions: [],
      groups: [],
      levels: { division: false, group: false },
    };
  }
  if (!s.settings.locations) s.settings.locations = [];
  if (!s.transfers) s.transfers = [];
  if (!s.rewards) s.rewards = [];
  // Kurumun hedef süreleri gecikme hesaplarına uygulanır.
  applyTargetDays(s);
  return s;
}
