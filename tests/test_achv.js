// node tests/test_achv.js : conquistas (aba Metas)
const L = require("../src/logic.js");
const game = require("../data/gamedata.json"), biomes = require("../data/biomes.json");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
const S = Object.fromEntries(game.starters.map(s => [s.k, s]));
const IV = [20, 20, 20, 20, 20, 20];
const own = ks => L.buildOwned(game, Object.fromEntries(ks.map(k => [S[k].id, [0, 0b111, 1, 0, 2, IV, 0]])));
const owned = L.buildOwned(game, require("../fixtures/mysave_unlocks.json"));

// ---- dados
ok(game.achv.length === 76 && game.achv.every(a => a.k && a.n && a.d && a.p > 0), "76 conquistas com nome, descrição e pontos");
ok(game.achv.filter(a => /^MONO_GEN_/.test(a.k)).map(a => a.v).join() === "1,2,3,4,5,6,7,8,9", "Monogeração 1 a 9");
ok(game.achv.filter(a => a.c === "MonoTypeChallengeAchv").length === 18, "18 Monotipo");
ok(game.achv.find(a => a.k === "_10K_MONEY").d.includes("10.000"), "descrição com o valor");
ok(game.starters.filter(s => s.ds).length === 27 && S.BULBASAUR.ds && !S.PIKACHU, "iniciais padrão do Novo Começo");
ok(JSON.stringify(S.ZUBAT.ln.map(x => [x[0], x[1]])) === '[["ZUBAT",1],["GOLBAT",1],["CROBAT",2]]', "linha do Zubat com geração");

// ---- regra por linha
const [zubat] = own(["ZUBAT"]), [eevee] = own(["EEVEE"]), [mime] = own(["MIME_JR"]);
ok(L.bestInLine(zubat, x => x[1] === 1).k === "GOLBAT", "Monogeração 1: Zubat para no Golbat (Crobat é da geração 2)");
ok(L.bestInLine(zubat, x => x[1] === 2) === null, "Zubat não entra na geração 2 (o inicial é da 1)");
ok(L.bestInLine(eevee, x => x[2].includes("FAIRY")) === null, "Eevee não é Fada, não pode ser escolhido no Monotipo Fada");
ok(L.bestInLine(eevee, x => x[2].includes("NORMAL")).k === "EEVEE", "Monotipo Normal: Eevee não pode evoluir");
ok(L.bestInLine(mime, x => x[2].includes("FAIRY")).k === "MR_MIME", "Monotipo Fada: Mime Jr para no Mr. Mime");
ok(L.bestInLine(zubat, x => x[2].includes("POISON")).final, "Monotipo Venenoso: Crobat pode");

for (const [nome, pred] of [["gen 1", x => x[1] === 1], ["Água", x => x[2].includes("WATER")], ["Dragão", x => x[2].includes("DRAGON")]]) {
  const r = L.ruleTeam(owned, pred, 10, 6);
  ok(r.team.length > 0 && r.team.length <= 6 && r.team.reduce((s, x) => s + x.m.cost, 0) <= 10, `${nome}: time cabe em 10 pontos`);
  ok(r.team.every(x => pred(x.m.ln[0]) && x.m.ln.some(y => y[0] === x.b.k && pred(y))), `${nome}: todos cumprem a regra`);
  ok(new Set(r.team.map(x => x.m.finKey)).size === r.team.length, `${nome}: uma espécie por linha`);
}

// ---- planos
const P = L.achvPlans(owned, game, biomes, null);
const by = k => P.find(e => e.k === k);
ok(by("MONO_FIRE").d === "Complete o desafio Monotipo: Fogo.", "Monotipo com o tipo em português: " + by("MONO_FIRE").d);
ok(P.length === 76 && P.every(e => e.tem === null), "76 planos, sem saber quais já tem");
ok(P.filter(e => e.tipo === "time").length === 33, "33 conquistas com time (9 gerações, 18 tipos e mais 6)");
const fs = by("FRESH_START");
ok(fs.time.length > 0 && fs.time.every(x => S[x.m.k].ds) && fs.time.reduce((s, x) => s + x.m.cost, 0) <= 10, "Novo Começo só com iniciais padrão");
const un = by("UNEVOLVED_CLASSIC_VICTORY");
ok(un.time[0].b && !un.time[0].b.final && un.time[0].m.ln.some((y, i) => y[0] === un.time[0].b.k && un.time[0].m.ln.some(z => z[4] === i)), "Sem Evoluir: o primeiro ainda pode evoluir");
ok(by("MEGA_EVOLVE").time[0].m.forms.some(f => f.acc === "mega"), "Mega: o primeiro tem Mega");
ok(by("BREEDERS_IN_SPACE").tipo === "rota" && by("BREEDERS_IN_SPACE").alvo === "SPACE" && by("BREEDERS_IN_SPACE").chance > 0.5, "Criadores no Espaço: rota até o Espaço");
for (const k of ["CATCH_LEGENDARY", "CATCH_MYTHICAL", "CATCH_SUB_LEGENDARY"]) {
  const e = by(k);
  ok(e.tipo === "caca" && e.biomas.length === 3 && e.biomas.every(b => b.k !== "END" && b.total > 0 && b.total <= 1), `${k}: 3 biomas, sem o END`);
}
ok(by("CATCH_MYTHICAL").biomas.every(b => b.especies.every(k => game.starters.some(s => s.lg === 3 && s.ln.some(x => x[0] === k)))), "míticos de verdade");
for (let i = 1; i < P.length; i++) if (P[i - 1].tipo === "time" && P[i].tipo === "time") ok(P[i - 1].facil >= P[i].facil, "times da mais fácil para a mais difícil");

// conquistas que já tem vão para o fim
const tem = { MONO_GEN_ONE_VICTORY: 1, CLASSIC_VICTORY: 1 };
const P2 = L.achvPlans(owned, game, biomes, tem);
ok(P2.slice(-2).every(e => e.tem) && P2.filter(e => e.tem).length === 2, "as que já tem ficam por último");

// textos sem travessão
for (const e of P) ok(!/[—–]| - /.test(e.dica + e.d), "texto com travessão: " + e.k);

console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
