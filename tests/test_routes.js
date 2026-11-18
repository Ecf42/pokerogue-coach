// node tests/test_routes.js : rota de biomas (Fase 4)
const L = require("../src/logic.js");
const A = require("../src/agent.js");
const game = require("../data/gamedata.json"), biomes = require("../data/biomes.json"), dex = require("../data/dex.json");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const keys = biomes.biomes.map(b => b.k);

// ---- links
for (const b of biomes.biomes) {
  const o = L.linkOutcomes(b);
  if (b.links.length) ok(near(o.reduce((s, x) => s + x.p, 0), 1), `${b.k}: resultados dos links somam != 1`);
}
ok(L.linkOutcomes(biomes.biomes.find(b => b.k === "END")).length === 0, "END não tem saída");

// ---- trocas restantes no Clássico
ok(L.switchesLeft(1) === 18 && L.switchesLeft(10) === 18 && L.switchesLeft(11) === 17 && L.switchesLeft(55) === 13 && L.switchesLeft(180) === 1 && L.switchesLeft(181) === 0, "trocas restantes");

// ---- tabela de alcance
const z = L.reachTable(biomes, "ICE_CAVE", 0, true);
ok(keys.every(k => z[k] === (k === "ICE_CAVE" ? 1 : 0)), "com 0 trocas só o próprio alvo");
ok(L.reachTable(biomes, "SNOWY_FOREST", 1, false).ICE_CAVE === 1, "Caverna de Gelo leva sempre à Floresta Nevada");
const c1m = L.reachTable(biomes, "LABORATORY", 1, true).CAVE, c1 = L.reachTable(biomes, "LABORATORY", 1, false).CAVE;
ok(near(c1m, 0.5) && near(c1, 1 / 6), `Caverna para Laboratório em 1 troca: com Map 1/2, sem Map 1/6 (${c1m}, ${c1})`);
ok(near(c1, L.nextBiomeOdds(biomes, "CAVE").find(x => x.k === "LABORATORY").semMap), "bate com nextBiomeOdds");
for (const t of ["ICE_CAVE", "SPACE", "LABORATORY", "TEMPLE"]) {
  let prev = null;
  for (let s = 0; s <= 18; s += 3) {
    const m = L.reachTable(biomes, t, s, true), n = L.reachTable(biomes, t, s, false);
    ok(keys.every(k => m[k] >= n[k] - 1e-12 && m[k] <= 1 + 1e-12 && n[k] >= 0), `${t}/${s}: com Map nunca pior que sem, e entre 0 e 1`);
    if (prev) ok(keys.every(k => m[k] >= prev[k] - 1e-12), `${t}: mais trocas nunca diminuem a chance`);
    prev = m;
  }
  for (const f of keys) {
    const min = L.minSwitches(biomes, f, t);
    if (min == null) { ok(L.reachTable(biomes, t, 18, true)[f] === 0, `${f} para ${t}: inalcançável deveria ter chance 0`); continue; }
    if (min > 0) ok(L.reachTable(biomes, t, min - 1, true)[f] === 0, `${f} para ${t}: chance antes do mínimo de trocas`);
    ok(L.reachTable(biomes, t, min, true)[f] > 0, `${f} para ${t}: chance zero no mínimo de trocas`);
  }
}

// ---- plano
const p = L.planRoute(biomes, "TOWN", "ICE_CAVE", 18, true);
ok(near(p.chance, 1) && p.min === 5 && p.path[0] === "TOWN" && p.path[p.path.length - 1] === "ICE_CAVE" && p.path.length === 6, `caminho Cidade para Caverna de Gelo: ${p.path.join(">")}`);
for (let i = 1; i < p.path.length; i++) ok(biomes.biomes.find(b => b.k === p.path[i - 1]).links.some(l => l[0] === p.path[i]), "caminho só usa links existentes");
const pm = L.planRoute(biomes, "MOUNTAIN", "SPACE", 1, true);
ok(near(pm.chance, 1 / 3) && pm.next.find(x => x.k === "SPACE").chance === 1, "Montanha para Espaço em 1 troca: 1/3");
ok(L.planRoute(biomes, "TOWN", "XYZ", 3, true) === null, "alvo inexistente");

// ---- caça
const h = L.huntSpecies(biomes, dex.prevo, "CHARIZARD", "TOWN", 18, true);
ok(h.length && h.every(x => x.formas.every(f => ["CHARIZARD", "CHARMELEON", "CHARMANDER"].includes(f))), "Charizard procura a linha toda");
ok(h.every(x => x.passagem > 0 && x.passagem <= 1 && x.chegar >= 0 && x.chegar <= 1 && near(x.total, x.passagem * x.chegar)), "chances da caça entre 0 e 1");
const ar = L.huntSpecies(biomes, dex.prevo, "ARTICUNO", "ICE_CAVE", 0, true)[0];
ok(ar.k === "ICE_CAVE" && near(ar.porBatalha, 1 / 512 / 2) && ar.chegar === 1, "Articuno na Caverna de Gelo");

const fm = L.huntSpecies(biomes, dex.prevo, "FLUTTER_MANE", "TOWN", 18, false).find(x => x.k === "END");
ok(fm && fm.chegar === 1, "END: o jogo leva sozinho, chance de chegar 100%");

// ---- ferramenta do agente
const owned = L.buildOwned(game, require("../fixtures/mysave_unlocks.json"));
const ctx = A.makeCtx({ game, biomes, dex, owned, label: "x" });
const T = Object.fromEntries(A.tools(ctx).map(t => [t.name, t]));
const r1 = T.rota_biomas.run({ de: "Cidade", alvo: "Caverna de Gelo" });
ok(r1.chance_de_chegar === "43,4%" && r1.trocas_restantes === 18 && r1.caminho_ideal.startsWith("Cidade > Planície"), `rota sem Map: ${r1.chance_de_chegar}`);
ok(T.rota_biomas.run({ de: "town", alvo: "ice cave", tem_map: true }).chance_de_chegar === "100%", "rota com Map e nomes em inglês");
ok(T.rota_biomas.run({ de: "Cidade", alvo: "Caverna de Gelo", wave: 185 }).chance_de_chegar === "0%", "sem trocas restantes");
const r2 = T.rota_biomas.run({ de: "Planície", alvo: "Charizard", wave: 30, tem_map: true });
ok(r2.alvo === "Charizard" && r2.melhores_biomas.length > 0 && r2.melhores_biomas[0].aparece_como, "rota até um Pokémon");
ok(/ovos/.test(T.rota_biomas.run({ de: "Cidade", alvo: "Mew" }).resultado || ""), "Pokémon que não aparece em bioma");
for (const bad of [{ de: "Lugar", alvo: "Cidade" }, { de: "Cidade", alvo: "Xyzzy" }]) { let e = false; try { T.rota_biomas.run(bad); } catch (x) { e = true; } ok(e, "entrada inválida deveria dar erro"); }
ok(Buffer.byteLength(JSON.stringify(r2)) < 4000, "resposta da rota pequena");
ok(T.rota_biomas.run({ de: "Cidade", alvo: "Flutter Mane" }).melhores_biomas[0].bioma.startsWith("Fim do Clássico"), "Pokémon do END");
ok(T.rota_biomas.run({ de: "Cidade", alvo: "???" }).chance_de_chegar === "100%", "alvo END");

console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
