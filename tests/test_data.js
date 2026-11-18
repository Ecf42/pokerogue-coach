// node tests/test_data.js : confere os dados extraídos do jogo (Fase 1) e os acessores de logic.js
const L = require("../src/logic.js");
const game = require("../data/gamedata.json");
const biomes = require("../data/biomes.json");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const S = Object.fromEntries(game.starters.map(s => [s.k, s]));
const mvName = i => game.moves[i][0];

// ---- TMs
for (const s of game.starters) {
  const tms = L.tmsOf(s, game);
  ok(tms.every(i => game.moves[i] && game.moves[i][4] > 0), `${s.k}: TM sem tier da loja`);
  ok(new Set(tms).size === tms.length, `${s.k}: TM repetido`);
}
const charTms = L.tmsOf(S.CHARMANDER, game).map(mvName);
ok(charTms.includes("FLAMETHROWER"), "Charmander deveria aprender Flamethrower por TM");
ok(game.moves.find(m => m[0] === "FLAMETHROWER")[4] === 3, "Flamethrower deveria ser TM ultra");
ok(game.moves.find(m => m[0] === "PAY_DAY")[4] === 1, "Pay Day deveria ser TM comum");
ok(S.DITTO && L.tmsOf(S.DITTO, game).length === 0, "Ditto não aprende TM");

// ---- doces (Bulbasaur custa 3)
const c3 = L.candyCosts(S.BULBASAUR.c, game);
ok(c3 && c3.passiva === 35 && c3.reducao[0] === 20 && c3.reducao[1] === 50 && c3.ovo === 15, "doces de custo 3 errados");
ok(L.candyCosts(10, game).passiva === 10, "doces de custo 10 errados");
ok(game.candy.length === 10, "tabela de doces deveria ter 10 linhas");

// ---- formas por item
const fo = (k, n) => (S[k].fo || []).find(f => f.n === n);
const mx = fo("CHARMANDER", "Mega X");
ok(mx && mx.it === "Charizardite X" && mx.rare === 1 && mx.acc === "mega" && mx.ty.join() === "FIRE,DRAGON", "Charizard Mega X");
ok(mx && mx.ab[0] === "TOUGH_CLAWS", "Charizard Mega X deveria ter Tough Claws");
ok(fo("CHARMANDER", "Mega Y") && fo("CHARMANDER", "Mega Y").ab[0] === "DROUGHT", "Charizard Mega Y deveria ter Drought");
const gmax = fo("CHARMANDER", "G-Max");
ok(gmax && gmax.acc === "gmax" && gmax.it === "Max Mushrooms" && gmax.rare === 1, "Charizard G-Max (Max Mushrooms fica no pool raro)");
ok((S.PICHU.fo || []).some(f => f.sp === "RAICHU" && f.n === "Mega X"), "Pichu deveria listar a Mega X do Raichu comum");
ok((S.PICHU.fo || []).filter(f => f.sp === "PIKACHU" && f.k === "gigantamax").length === 1, "G-Max do Pikachu duplicado");
const plate = (S.ARCEUS.fo || []).find(f => f.it === "Flame Plate");
ok(plate && plate.rare === 0 && plate.acc === null && plate.ty[0] === "FIRE", "Arceus Flame Plate (item comum, sem acessório)");
ok((S.APPLIN.fo || []).some(f => f.sp === "FLAPPLE") && (S.APPLIN.fo || []).some(f => f.sp === "APPLETUN"), "Applin: G-Max de Flapple e Appletun");
for (const s of game.starters) for (const f of s.fo || []) ok(f.st.length === 6 && f.ty.length >= 1, `${s.k} ${f.n}: forma sem status ou tipo`);

// ---- passiva da forma final
ok(S.CHARMANDER.pa === "SHEER_FORCE" && S.CHARMANDER.paf === "BATTLE_BOND", "passivas de Charmander/Charizard");
ok(!("paf" in S.BULBASAUR), "Bulbasaur e Venusaur têm a mesma passiva");

// ---- habilidades
const used = new Set();
for (const s of game.starters) {
  [...s.ab, s.pa, s.paf].forEach(a => used.add(a));
  for (const f of s.fo || []) [...f.ab, f.pa].forEach(a => used.add(a));
}
used.delete(undefined); used.delete(null); used.delete("NONE");
for (const a of used) ok(game.abilities[a] && game.abilities[a][1].length > 10, `habilidade sem descrição: ${a}`);
ok(game.abilities.DROUGHT[1].startsWith("Convoca um sol forte"), "descrição de Drought em português");

// ---- biomas
const B = Object.fromEntries(biomes.biomes.map(b => [b.k, b]));
ok(biomes.biomes.length === 35, `deveriam ser 35 biomas (${biomes.biomes.length})`);
ok(B.ICE_CAVE.nome === "Caverna de Gelo" && B.TOWN.nome === "Cidade", "nomes em português");
ok(B.ICE_CAVE.pool.COMMON.ALL.includes("SNOM") && B.ICE_CAVE.pool.ULTRA_RARE.ALL.join() === "ARTICUNO,REGICE", "pools da Ice Cave");
ok(B.ICE_CAVE.links.length === 1 && B.ICE_CAVE.links[0][0] === "SNOWY_FOREST", "Ice Cave só leva à Floresta Nevada");
ok(B.ICE_CAVE.trainers.BOSS.includes("GRUSHA"), "líderes da Ice Cave");
ok(B.ICE_CAVE.weather.SNOW === 4, "clima da Ice Cave");
let w = 0, bw = 0;
for (const t of ["COMMON", "UNCOMMON", "RARE", "SUPER_RARE", "ULTRA_RARE"]) w += biomes.tierOdds[t][0];
for (const t of ["BOSS", "BOSS_RARE", "BOSS_SUPER_RARE", "BOSS_ULTRA_RARE"]) bw += biomes.tierOdds[t][0];
ok(w === 512 && bw === 64, "chances de tier deveriam somar 512 e 64");
const seen = new Set(["TOWN"]), st = ["TOWN"];
while (st.length) for (const [to] of B[st.pop()].links) if (!seen.has(to)) { seen.add(to); st.push(to); }
ok(biomes.biomes.every(b => seen.has(b.k) || b.k === "END"), "todo bioma (menos END) alcançável a partir da Cidade");
for (const b of biomes.biomes) {
  ok(b.links.every(([to]) => B[to]), `${b.k}: link para bioma inexistente`);
  if (b.links.length) ok(b.links.some(l => l[1] === 1), `${b.k}: nenhum link garantido`);
  if (b.pool.COMMON) {
    const tot = Object.values(L.biomeOdds(biomes, b.k)).reduce((x, y) => x + y, 0);
    ok(near(tot, 1), `${b.k}: chances de encontro somam ${tot}`);
  }
  if (b.pool.BOSS) ok(near(Object.values(L.biomeOdds(biomes, b.k, "DAY", true)).reduce((x, y) => x + y, 0), 1), `${b.k}: chances de chefe`);
  const nx = L.nextBiomeOdds(biomes, b.k);
  if (nx.length) ok(near(nx.reduce((x, y) => x + y.semMap, 0), 1), `${b.k}: próximos biomas somam != 1`);
}
// Ice Cave: Articuno é ultra raro (1/512) dividido com Regice; Amaura sozinho no super raro (5/512)
const ic = L.biomeOdds(biomes, "ICE_CAVE", "DAY");
ok(near(ic.ARTICUNO, 1 / 512 / 2) && near(ic.AMAURA, 5 / 512), "chance de Articuno/Amaura na Ice Cave");
// Caverna: Badlands e Lago sempre, Laboratório com 1/2. Sem Map: Lab = 1/2 * 1/3
const cave = Object.fromEntries(L.nextBiomeOdds(biomes, "CAVE").map(x => [x.k, x]));
ok(near(cave.LABORATORY.aparece, 0.5) && near(cave.LABORATORY.semMap, 1 / 6) && near(cave.BADLANDS.semMap, 5 / 12), "links da Caverna");
ok(L.nextBiomeOdds(biomes, "ICE_CAVE")[0].semMap === 1, "link único");

console.log(`${game.starters.length} iniciais, ${game.tms.length} TMs, ${Object.keys(game.abilities).length} habilidades, ${biomes.biomes.length} biomas (jogo ${game.src.commit.slice(0, 7)} de ${game.src.date})`);
console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
