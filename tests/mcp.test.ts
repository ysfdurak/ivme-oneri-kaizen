// MCP katmanı: araçlar web ile aynı yetkiyi uygular, anonimliği korur, salt okumadır; protokol mesajları doğru yanıtlanır.
import assert from "node:assert/strict";
import { applyCommand } from "../lib/workflow";
import { migrateState } from "../lib/migrate";
import { initialState, DEMO_USERS } from "../lib/seed";
import { canSee } from "../lib/model";
import { runTool, MCP_TOOLS, ToolError } from "../lib/mcp-tools";
import { handleRpc, SUPPORTED_VERSIONS } from "../lib/mcp-protocol";
import { editionFrom } from "../lib/edition";

(async () => {
  const users: any[] = DEMO_USERS.map((u) => ({
    ...u,
    directorate: "Lojistik Müdürlüğü",
    active: 1,
  }));
  const by = (id: string) => users.find((u) => u.id === id)!;
  const s = migrateState(initialState(), users);
  const call = (b: any, u: any) => applyCommand(s, b, u, users);
  const op = s.operations[0];
  const base = {
    action: "create",
    problem: "Rampada paletler bekliyor, forklift geçemiyor.",
    solution: "Ara stok alanı açılsın.",
    operation: op,
  };
  const a = call(
    { ...base, title: "Rampa önünde palet birikmesi" },
    by("calisan"),
  )!;
  const anon = call(
    { ...base, title: "Rampada bekleyen paletler", anonymous: true },
    by("calisan"),
  )!;
  const pa = s.proposals.find((p) => p.id === a)!;
  const tool = (name: string, args: any, viewer: any) =>
    runTool(name, args, s, users, viewer);
  const before = JSON.stringify(s);

  // Paket ayarı: yalnız "ai" yapay zekâ paketidir; boş ya da başka her değer süreç paketi.
  assert.equal(editionFrom("ai"), "ai");
  assert.equal(editionFrom(" AI "), "ai");
  assert.equal(editionFrom(undefined), "surec");
  assert.equal(editionFrom("evet"), "surec");

  // Bekleyen işler: sorumlu kendi kuyruğunu görür.
  const owner = by(pa.owner);
  const mine: any = await tool("bekleyen_islerim", {}, owner);
  assert.ok(mine.oneriler.some((x: any) => x.id === a));
  assert.equal(mine.ozet.oneri, mine.oneriler.length);
  const empty: any = await tool("bekleyen_islerim", {}, by("it"));
  assert.ok(
    !empty.oneriler.some((x: any) => x.id === a),
    "başkasının işi listelenmez",
  );

  // Görme yetkisi web ile aynı: göremeyen kişi detayı alamaz.
  const outsider = users.find(
    (u) => !canSee(pa, u, { users, matrix: s.matrix, org: s.settings?.org }),
  )!;
  assert.ok(outsider, "örnekte öneriyi göremeyen biri olmalı");
  await assert.rejects(
    () => tool("oneri_detayi", { id: a }, outsider),
    ToolError,
  );
  const detail: any = await tool(
    "oneri_detayi",
    { id: a.toLowerCase() },
    owner,
  );
  assert.equal(detail.id, a);
  assert.equal(detail.oneren, by("calisan").name);
  assert.ok(Array.isArray(detail.son_hareketler));

  // Anonimlik: değerlendiricinin modeli de önerenin adını göremez; önerenin kendisi görür.
  const anonForOwner: any = await tool(
    "oneri_detayi",
    { id: anon },
    by(s.proposals.find((p) => p.id === anon)!.owner),
  );
  assert.equal(anonForOwner.oneren, "Anonim çalışan");
  assert.ok(!JSON.stringify(anonForOwner).includes(by("calisan").name));
  const anonForAuthor: any = await tool(
    "oneri_detayi",
    { id: anon },
    by("calisan"),
  );
  assert.equal(anonForAuthor.oneren, by("calisan").name);

  // Benzer öneriler: kayıtlı öneri ya da serbest metinle; yöntem bilgisi döner.
  const sim: any = await tool("benzer_oneriler", { id: a }, owner);
  assert.equal(sim.yontem, "kelime");
  assert.ok(sim.sonuclar.some((x: any) => x.id === anon));
  const simText: any = await tool(
    "benzer_oneriler",
    { baslik: "Palet birikmesi rampada" },
    by("calisan"),
  );
  assert.ok(simText.sonuclar.length > 0);
  await assert.rejects(() => tool("benzer_oneriler", {}, owner), /numara/);

  // Gecikenler: hedef süreyi aşan öneri listelenir, sorumlu ve müdürlük kırılımıyla.
  pa.stageAt = new Date(Date.now() - 30 * 86400000).toISOString();
  const late: any = await tool("gecikenler", {}, by("admin"));
  assert.ok(late.oneriler.some((x: any) => x.id === a && x.gecikme_gun > 0));
  assert.ok(late.sorumluya_gore.length > 0 && late.mudurluge_gore.length > 0);
  const lateHigh: any = await tool(
    "gecikenler",
    { en_az_gun: 300 },
    by("admin"),
  );
  assert.ok(!lateHigh.oneriler.some((x: any) => x.id === a));

  // Kazanç özeti: yalnız onaylı ve geçerli kazanç; tarih kontrolü.
  const g0: any = await tool(
    "kazanc_ozeti",
    { baslangic: "2026-11-01", bitis: "2026-11-30" },
    by("admin"),
  );
  pa.gain = {
    amount: 1200,
    type: "Parasal",
    period: "Aylık",
    approved: true,
    valid: true,
    approvedAt: "2026-11-01T10:00:00Z",
  } as any;
  const gain: any = await tool(
    "kazanc_ozeti",
    { baslangic: "2026-11-01", bitis: "2026-11-30" },
    by("admin"),
  );
  assert.equal(gain.oneri_sayisi, g0.oneri_sayisi + 1);
  const monthly = (x: any) =>
    x.doneme_gore.find((d: any) => d.ad === "Aylık") || {
      oneri: 0,
      tutar_tl: 0,
    };
  assert.equal(monthly(gain).tutar_tl - monthly(g0).tutar_tl, 1200);
  const later: any = await tool(
    "kazanc_ozeti",
    { baslangic: "2099-01-01" },
    by("admin"),
  );
  assert.equal(later.oneri_sayisi, 0);
  await assert.rejects(
    () => tool("kazanc_ozeti", { baslangic: "01.11.2026" }, by("admin")),
    /YYYY/,
  );
  delete (pa as any).gain;
  pa.stageAt = new Date().toISOString();

  // Salt okuma: hiçbir araç çalışma alanını değiştirmez (gecikme/kazanç denemeleri geri alındı).
  assert.equal(JSON.stringify(s).length, before.length);

  // Protokol.
  const run = (n: string, x: any) => tool(n, x, owner);
  const init: any = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    },
    run,
  );
  assert.equal(init.result.protocolVersion, "2025-03-26");
  const init2: any = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    },
    run,
  );
  assert.equal(init2.result.protocolVersion, SUPPORTED_VERSIONS[0]);
  assert.equal(
    await handleRpc(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      run,
    ),
    null,
  );
  const list: any = await handleRpc(
    { jsonrpc: "2.0", id: 3, method: "tools/list" },
    run,
  );
  assert.equal(list.result.tools.length, MCP_TOOLS.length);
  assert.ok(
    list.result.tools.every((t: any) => t.annotations.readOnlyHint === true),
  );
  const ok: any = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "oneri_detayi", arguments: { id: a } },
    },
    run,
  );
  assert.equal(ok.result.structuredContent.id, a);
  assert.ok(JSON.parse(ok.result.content[0].text).id === a);
  const denied: any = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "oneri_detayi", arguments: { id: "KZ-YOK" } },
    },
    run,
  );
  assert.equal(
    denied.result.isError,
    true,
    "yetki/bulunamadı hatası modele okunur sonuç olarak döner",
  );
  assert.equal(
    (
      (await handleRpc(
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "sil" },
        },
        run,
      )) as any
    ).error.code,
    -32602,
  );
  assert.equal(
    (
      (await handleRpc(
        { jsonrpc: "2.0", id: 7, method: "resources/list" },
        run,
      )) as any
    ).error.code,
    -32601,
  );
  assert.equal(
    ((await handleRpc({ id: 8, method: "ping" } as any, run)) as any).error
      .code,
    -32600,
  );

  console.log(
    "MCP checks passed: edition flag, 5 read-only tools with web visibility and anonymity, protocol messages.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
