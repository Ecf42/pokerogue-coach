// node tests/test_logic.js  : gera um time de cada tema com o save de exemplo e checa as regras básicas
const L = require("../src/logic.js");
const game = require("../data/gamedata.json");
const owned = L.buildOwned(game, require("../fixtures/mysave_unlocks.json"));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
ok(owned.length > 0, "nenhum inicial carregado");
for (const theme of Object.keys(L.THEMES)) {
  for (let i = 0; i < 20; i++) {
    const r = L.generate(owned, { theme, budget: 10, size: 6 });
    ok(r.cost <= 10, `${theme}: passou de 10 pontos (${r.cost})`);
    ok(r.team.length <= 6, `${theme}: mais de 6 membros`);
    ok(new Set(r.team.map(m => m.finKey)).size === r.team.length, `${theme}: linha evolutiva repetida`);
    for (const m of r.team) ok(L.suggestMoves(m, game, r.ctx).length > 0, `${theme}: ${m.name} sem golpes`);
  }
}
// sorteio com semente, para os testes serem reprodutíveis
const seeded = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const S = Object.fromEntries(game.starters.map(s => [s.k, s]));
const ALL_IVS = [31, 31, 31, 31, 31, 31];
// save sintético: [valueReduction, abilityAttr, passiveAttr, eggMoves, natureAttr, ivs, doces]
const fake = (k, pa = 1, ab = 7) => L.buildOwned(game, { [S[k].id]: [0, ab, pa, 0, 2 ** 26 - 2, ALL_IVS, 0] })[0];

// ---- passiva: vale a da forma final
const ch = fake("CHARMANDER");
ok(ch.passive === "BATTLE_BOND" && ch.passiveStart === "SHEER_FORCE", "Charizard deveria usar Battle Bond (Charmander tem Sheer Force)");
ok(fake("CHARMANDER", 0).passive === null, "passiva não liberada deveria ficar vazia");
ok(fake("BULBASAUR").passive === "GRASSY_SURGE" && fake("BULBASAUR").passiveStart === null, "Venusaur mantém a passiva do Bulbasaur");
const cyn = fake("CYNDAQUIL");
ok(L.setterOf(cyn, "sol") && L.setterOf(cyn, "sol").ab === "DROUGHT", "Typhlosion de Hisui liga o sol pela passiva final");

// ---- TMs "se aparecer"
for (const m of [ch, cyn, fake("DRATINI"), fake("MAGIKARP")]) {
  const tms = L.suggestTMs(m, game, null), known = new Set([...m.mv, ...m.egg].map(i => game.moves[i][0]));
  ok(tms.length <= 3, `${m.k}: mais de 3 TMs sugeridos`);
  for (const x of tms) {
    ok(m.tms.some(i => game.moves[i][0] === x.k), `${m.k}: ${x.k} não é TM dele`);
    ok(!known.has(x.k), `${m.k}: ${x.k} ele já aprende sem TM`);
    ok(x.tier >= 1 && x.tier <= 3 && x.tierNome && x.why, `${m.k}: TM sem tier ou motivo`);
  }
}
for (const m of owned) {
  const st = L.suggestTMs(m, game, null).filter(x => x.c === "X").map(x => x.why);
  ok(new Set(st).size === st.length, `${m.k}: dois TMs de status do mesmo tipo (${st})`);
}
ok(L.suggestTMs(ch, game, null).length > 0, "Charmander deveria ter algum TM sugerido");
ok(L.suggestTMs(fake("DITTO"), game, null).length === 0, "Ditto não aprende TM");

// ---- defesa com habilidades
const lev = { ty: ["GHOST"], abil: ["LEVITATE"], passive: null };
ok(L.defMult(lev, "GROUND") === 0 && L.defMult({ ty: ["GHOST"], abil: [], passive: null }, "GROUND") === 1, "Levitate anula Terra");
ok(L.defMult({ ty: ["ICE"], abil: [], passive: "THICK_FAT" }, "FIRE") === 1, "Thick Fat na passiva corta Fogo pela metade");

// ---- Equilibrado: melhor que times aleatórios
const holes = r => { const b = L.balanceReport(r.team); return b.holesDef.length * 3 + b.holesOff.length; };
let he = 0, hc = 0;
for (let i = 0; i < 10; i++) {
  he += holes(L.generate(owned, { theme: "equilibrado", budget: 10, size: 6 }, seeded(i)));
  hc += holes(L.generate(owned, { theme: "caos", budget: 10, size: 6 }, seeded(i)));
}
ok(he < hc, `Equilibrado deveria ter menos buracos que Caos (${he} vs ${hc})`);
ok(L.balanceReport([fake("SQUIRTLE"), fake("PSYDUCK"), fake("POLIWAG")]).holesDef.some(t => t === "ELECTRIC" || t === "GRASS"), "três Água: Elétrico ou Planta é buraco");

// ---- Late game, Mega, Interações, Desafio
for (let i = 0; i < 20; i++) {
  const lt = L.generate(owned, { theme: "late", budget: 10, size: 6 }, seeded(i));
  ok(lt.team.some(m => lt.notes[m.k]), "Late game sem nenhum motivo explicado");
  const mg = L.generate(owned, { theme: "mega", budget: 10, size: 6 }, seeded(i));
  ok(mg.team.length && mg.team.every(m => L.bigForms(m).length), "Mega com membro sem Mega/Gmax");
  const it = L.generate(owned, { theme: "interacoes", budget: 10, size: 6 }, seeded(i));
  ok(it.team.some(m => it.notes[m.k]), "Interações sem nenhuma interação no time");
  for (const m of it.team) if (it.notes[m.k]) ok(L.INTERACTIONS.find(x => x.k === m.k).need(m), `${m.k}: interação sem o requisito liberado`);
  const de = L.generate(owned, { theme: "desafio", budget: 10, size: 6 }, seeded(i));
  ok(de.challenge && de.team.length > 0, "Desafio sem regra ou sem time");
  de.team.forEach((m, j) => ok(de.challenge.ok(m, de.team.filter((_, x) => x !== j)), `Desafio ${de.challenge.id}: ${m.fin} quebra a regra`));
  const de2 = L.generate(owned, { theme: "desafio", budget: 10, size: 6, challenge: de.challenge, locked: de.team.slice(1).map(m => m.k) }, seeded(i + 99));
  ok(de2.challenge === de.challenge, "trocar membro deveria manter a mesma regra do desafio");
}
for (const x of L.INTERACTIONS) ok(S[x.k], `interação para inicial inexistente: ${x.k}`);
ok(L.genOf(fake("BULBASAUR")) === 1 && L.genOf(fake("SPRIGATITO")) === 9 && L.genOf(fake("ALOLA_VULPIX")) === 7, "geração dos iniciais");

// ---- textos: sem travessão nem hífen como pontuação
const texts = [...Object.values(L.THEMES), ...L.INTERACTIONS.map(x => x.why(fake(x.k)))];
for (let i = 0; i < 30; i++) for (const th of Object.keys(L.THEMES)) {
  const r = L.generate(owned, { theme: th, budget: 10, size: 6 }, seeded(i));
  texts.push(r.info, ...Object.values(r.notes), ...r.team.flatMap(m => L.suggestTMs(m, game, r.ctx).map(x => x.why)));
}
for (const t of texts) ok(!/[—–]| - /.test(t || ""), `texto com travessão ou hífen: ${t}`);

const top = owned.filter(m => m.lg).sort((a, b) => b.score - a.score).slice(0, 3).map(m => m.name);
console.log("Top lendários:", top.join(", "));
console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
