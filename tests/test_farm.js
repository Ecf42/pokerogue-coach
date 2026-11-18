// node tests/test_farm.js : caçador de desbloqueios (Fase 5)
const L = require("../src/logic.js");
const A = require("../src/agent.js");
const game = require("../data/gamedata.json"), biomes = require("../data/biomes.json"), dex = require("../data/dex.json");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const S = Object.fromEntries(game.starters.map(s => [s.k, s]));
const IV = [20, 20, 20, 20, 20, 20];
// [valueReduction, abilityAttr, passiveAttr, eggMoves, natureAttr, ivs, doces]; natureAttr com só Hardy = 2
const own = rows => L.buildOwned(game, Object.fromEntries(rows.map(([k, ...u]) => [S[k].id, u])));
const by = (list, k, tipo) => list.find(x => x.k === k && x.tipo === tipo);

ok(S.CHARMANDER.c === 3 && S.CHARMANDER.et === 0, "Charmander custa 3 e tem ovo comum");
const f1 = L.farmTargets(own([["CHARMANDER", 0, 0b011, 0, 0b0011, 2, IV, 40]]), game);
const pa = by(f1, "CHARMANDER", "passiva");
ok(pa && pa.custoDoces === 35 && pa.falta === 0 && pa.passiva === "BATTLE_BOND", "passiva do Charizard pronta com 40 doces (custa 35)");
const cu = by(f1, "CHARMANDER", "custo");
ok(cu && cu.custoDoces === 20 && cu.falta === 0 && cu.de === 3 && cu.para === 2, "primeira redução custa 20");
const ov = by(f1, "CHARMANDER", "ovo");
ok(ov && ov.custoDoces === 15 && ov.eggMoves.length === 2 && ov.eggMoves.some(e => e.rare), "ovo: faltam 2 egg moves, um raro");
ok(near(ov.chanceEggMove, (11 / 12) / 3 + 1 / 12) && ov.oculta === "SOLAR_POWER" && near(ov.chanceOculta, 1 / 8), `chances do ovo (${ov.chanceEggMove})`);
ok(by(f1, "CHARMANDER", "nature") && by(f1, "CHARMANDER", "nature").natures.length > 0, "só Hardy: falta nature");
for (let i = 1; i < f1.length; i++) ok(f1[i - 1].prioridade >= f1[i].prioridade, "ordenado por prioridade");

// tudo liberado: nada para farmar
const f2 = L.farmTargets(own([["CHARMANDER", 2, 0b111, 0b11, 0b1111, 2 ** 26 - 2, IV, 0]]), game);
ok(f2.length === 0, `nada para farmar quando está tudo liberado (${f2.map(x => x.tipo)})`);

// poucos doces
const f3 = L.farmTargets(own([["CHARMANDER", 1, 0b011, 0, 0, 2, IV, 10]]), game);
ok(by(f3, "CHARMANDER", "passiva").falta === 25 && by(f3, "CHARMANDER", "custo").custoDoces === 50 && by(f3, "CHARMANDER", "custo").falta === 40, "faltas com 10 doces e uma redução já feita");
ok(by(f3, "CHARMANDER", "ovo").eggMoves.length === 4 && near(by(f3, "CHARMANDER", "ovo").chanceEggMove, 1), "sem egg move nenhum, todo ovo libera um");

// tier de ovo muda a chance do raro (lendário: 1/4)
const leg = game.starters.find(s => s.et === 3 && s.em.every(x => x != null));
const f4 = L.farmTargets(own([[leg.k, 0, 0b001, 0, 0b0111, 2, IV, 0]]), game);
ok(near(by(f4, leg.k, "ovo").chanceEggMove, 1 / 4), `ovo lendário: raro com 1/4 (${leg.k})`);

// pesos: mais perto de liberar vem antes, mesmo Pokémon
const near1 = L.farmTargets(own([["CHARMANDER", 0, 0b011, 0, 2 ** 26 - 2, 2 ** 26 - 2, IV, 34]]), game);
const far1 = L.farmTargets(own([["CHARMANDER", 0, 0b011, 0, 2 ** 26 - 2, 2 ** 26 - 2, IV, 0]]), game);
ok(by(near1, "CHARMANDER", "passiva").prioridade > by(far1, "CHARMANDER", "passiva").prioridade, "quem está perto de liberar sobe");

// ---- texto e ferramenta
const t1 = A.farmText(pa), t3 = A.farmText({ ...by(f3, "CHARMANDER", "passiva"), falta: 1 });
ok(t1.titulo === "Passiva Battle Bond" && t1.detalhe.startsWith("Pronto"), "texto da passiva pronta");
ok(t3.detalhe.startsWith("Falta 1 doce ("), "singular de doce");
ok(A.farmText(ov).detalhe.includes("38,9% de liberar egg move novo") && A.farmText(ov).detalhe.includes("12,5% de liberar Solar Power"), "texto do ovo");
const owned = L.buildOwned(game, require("../fixtures/mysave_unlocks.json"));
const ctx = A.makeCtx({ game, biomes, dex, owned, label: "x" });
const T = Object.fromEntries(A.tools(ctx).map(t => [t.name, t]));
const all = L.farmTargets(owned, game);
ok(T.alvos_de_farm.run({ tipo: "prontos" }).total === all.filter(x => x.falta === 0).length, "filtro prontos");
ok(T.alvos_de_farm.run({ tipo: "ovo", limite: 50 }).alvos.length === 20, "limite de 20");
const one = owned[0];
ok(T.alvos_de_farm.run({ pokemon: one.fin, limite: 20 }).alvos.every(a => a.pokemon === one.fin), "filtro por Pokémon");
ok(Buffer.byteLength(JSON.stringify(T.alvos_de_farm.run({ limite: 20 }))) < 6000, "resposta pequena");
for (const x of all.slice(0, 200)) { const t = A.farmText(x); ok(!/[—–]| - /.test(t.titulo + t.detalhe), "texto com travessão: " + t.detalhe); }

// ---- custo com redução (GameData.getSpeciesStarterValue): quem custa 1 cai pela metade
ok(L.starterValue(3, 0) === 3 && L.starterValue(3, 2) === 1 && L.starterValue(2, 2) === 0.5 && L.starterValue(1, 1) === 0.5 && L.starterValue(1, 2) === 0.25, "custo com reduções");
const one1 = game.starters.find(s => s.c === 1);
const o1 = own([[one1.k, 1, 0b001, 0, 0b0011, 2, IV, 999]]);
ok(o1[0].cost === 0.5, "inicial de 1 ponto com uma redução custa 0,5");
const c1 = by(L.farmTargets(o1, game), one1.k, "custo");
ok(c1 && c1.de === 0.5 && c1.para === 0.25, "redução de quem custa 1 aparece no farm");
ok(A.farmText(c1).titulo === "Custo de 0,5 para 0,25 pontos", "texto com vírgula: " + A.farmText(c1).titulo);
// time com custo fracionado cabe no orçamento
const many = own(game.starters.filter(s => s.c === 1).slice(0, 8).map(s => [s.k, 2, 0b001, 0, 0b0011, 2, IV, 0]));
const g1 = L.generate(many, { theme: "caos", budget: 1, size: 4, rng: () => 0.5 });
ok(g1.team.length === 4 && g1.cost <= 1, `4 iniciais de 0,25 cabem em 1 ponto (${g1.team.length}, ${g1.cost})`);

// ---- ficha e simulação de compras
const ch = own([["CHARMANDER", 0, 0b011, 0, 0b0001, 2 | (1 << 4), IV, 40]])[0];
const sh = L.starterSheet(ch, game);
ok(sh.doces === 40 && sh.custo === 3 && sh.passos.map(p => p.tipo).join() === "passiva,custo,ovo", "passos da ficha");
ok(sh.passos[0].pode && sh.passos[1].pode && sh.passos[1].custo === 20 && sh.passos[2].pode, "40 doces pagam qualquer um");
ok(sh.habilidades.length === 2 && sh.habilidades.find(h => h.slot === "Oculta").liberada === false, "oculta trancada");
ok(sh.passiva.final === "BATTLE_BOND" && sh.passiva.inicial === "SHEER_FORCE" && !sh.passiva.liberada, "passiva da forma final e do inicial");
ok(sh.eggMoves.length === 4 && sh.eggMoves.filter(e => e.liberado).length === 1 && sh.eggMoves[3].rare, "egg moves");
ok(near(sh.eggMoves.filter(e => !e.liberado).reduce((a, e) => a + e.chance, 0), sh.ovo.chanceEggMove), "chances dos egg moves somam a do ovo");
ok(sh.natures.length === 25 && sh.natures.filter(n => n.liberada).length === 2 && sh.natures.filter(n => n.melhor).length === 1, "natures");
let sm = L.sheetBuy(ch, game, {}, "passiva");
ok(sm.candy === 5 && sm.passive, "comprar passiva gasta 35");
const sh2 = L.starterSheet(ch, game, sm);
ok(sh2.passiva.liberada && sh2.score === ch.score + 30 && !sh2.passos[1].pode, "passiva liberada sobe o score e sobram 5 doces");
ok(L.sheetBuy(ch, game, sm, "custo") === null, "sem doces para redução");
sm = L.sheetBuy(ch, game, { candy: 200 }, "custo"); sm = L.sheetBuy(ch, game, sm, "custo");
const sh3 = L.starterSheet(ch, game, sm);
ok(sh3.custo === 1 && sh3.passos[1].feito && sm.candy === 200 - 20 - 50, "duas reduções: custo 1");
sm = L.sheetBuy(ch, game, sm, "ovo"); sm = L.sheetBuy(ch, game, sm, "ovo");
const sh4 = L.starterSheet(ch, game, sm);
ok(sh4.ovo.comprados === 2 && near(sh4.ovo.algumaOculta, 1 - (7 / 8) ** 2), "dois ovos: chance de oculta");
ok(ch.candy === 40 && ch.vr === 0, "simulação não mexe no save");

console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
