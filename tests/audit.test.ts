// Denetim izi: aylar önce onaylanan bir kazancın o günkü tutarı, maliyeti, dönemi, türü, onaylayanı, tarihi, para birimi
// ve onay notu kayıttan bulunur; sonradan değişen tanımlar (para birimi, puan kriterleri) eski kararın dayanağını bozmaz.
import assert from 'node:assert/strict';
import { applyCommand } from '../lib/workflow';
import { initialState, DEMO_USERS } from '../lib/seed';
import { gainFigures, STAGES } from '../lib/model';
const users = DEMO_USERS.map(u => ({ ...u, directorate: 'Lojistik Müdürlüğü', active: 1 }));
const by = (id: string) => users.find(u => u.id === id)!;
const admin = users[0], operation = by('operasyon'), manager = by('mudur');
const s: any = initialState();
const call = (b: any, u: any = admin) => applyCommand(s, b, u, users);
const id = call({ action: 'create', title: 'Denetim izi önerisi', problem: 'Mal kabulde çift sayım yapılıyor.', solution: 'Tek sayım ve barkod doğrulaması.', operation: 'Mal Kabul' });
const p: any = s.proposals.find((x: any) => x.id === id);
call({ action: 'accept', id }, by('on'));
call({ action: 'accept', id }, operation);
call({ action: 'addAction', id, title: 'Pilot', owner: 'operasyon', due: '2026-11-02' }, operation);
call({ action: 'start', id }, operation);
call({ action: 'actionUpdate', id, itemId: p.actions[0].id, status: 'Tamamlandı' }, operation);
call({ action: 'finish', id, outcome: 'implemented' }, operation);
call({ action: 'gain', id, amount: 2000, cost: 3000, period: 'Aylık', type: 'Parasal', before: '2 sayım', after: '1 sayım', explanation: 'Ayda 40 saat × 50 ₺ işçilik.' }, by('kazanc'));
call({ action: 'gainApprove', id, note: 'Ekim puantajıyla doğrulandı.' }, manager);
assert.equal(p.status, STAGES[6]);
const snapshot = JSON.parse(JSON.stringify(p.gain));
assert.deepEqual(
  { amount: snapshot.amount, cost: snapshot.cost, period: snapshot.period, type: snapshot.type, approver: snapshot.approver, currency: snapshot.currency, note: snapshot.approvalNote },
  { amount: 2000, cost: 3000, period: 'Aylık', type: 'Parasal', approver: 'mudur', currency: '₺', note: 'Ekim puantajıyla doğrulandı.' },
);
assert.ok(Date.parse(snapshot.approvedAt) > 0, 'onay tarihi');
assert.ok(p.history.some((h: any) => /Kazanç onaylandı: Ekim puantajıyla doğrulandı\./.test(h.text)), 'onay notu geçmişte');
call({ action: 'score', id, values: [4, 4, 4] }, by('puan'));
const score = JSON.parse(JSON.stringify(p.score));

// Aylar sonra tanımlar değişir: para birimi ve puan kriterleri.
s.settings = { ...(s.settings || {}), currency: '€', scoring: { scale: 10, criteria: [{ id: 'x', name: 'Yeni kriter', description: '', weight: 3 }] } };
// İkinci kişi yalnız kayıttan aynı sonucu kurar.
assert.deepEqual(p.gain, snapshot, 'kazanç kaydı değişmedi');
assert.equal(p.gain.currency, '₺', 'onay anındaki para birimi korunur');
const f = gainFigures(p.gain);
assert.deepEqual([f.annual, f.net, f.paybackMonths], [24000, 21000, 1.5], 'ilk yıl net kazanç ve geri dönüş kayıttan yeniden hesaplanır');
assert.deepEqual(p.score, score, 'puan kaydı değişmedi');
assert.deepEqual(p.score.criteria.map((c: any) => c.name), ['İyileştirmenin etkisi', 'Uygulamanın kalıcılığı', 'Yaygınlaştırılabilirlik'], 'puan, verildiği andaki kriterlerle saklanır');
console.log('Audit trail checks passed: approved gain (amount, cost, period, approver, date, currency, note) and score survive later definition changes and can be recomputed from the record.');
