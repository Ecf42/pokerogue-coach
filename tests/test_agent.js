// node tests/test_agent.js : ferramentas do agente, leitura de sessão e histórico, instruções
const L = require("../src/logic.js");
const A = require("../src/agent.js");
const game = require("../data/gamedata.json"), biomes = require("../data/biomes.json"), dex = require("../data/dex.json");
const owned = L.buildOwned(game, require("../fixtures/mysave_unlocks.json"));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FALHOU:", m); } };
const throws = f => { try { f(); return false; } catch (e) { return true; } };
const ctx = A.makeCtx({ game, biomes, dex, owned, label: "17/11/2026" });
const T = Object.fromEntries(A.tools(ctx).map(t => [t.name, t]));
const size = x => Buffer.byteLength(JSON.stringify(x));

// ---- definição das ferramentas (limites do sample: nome, descrição até 1 KB, schema até 4 KB)
for (const t of A.tools(ctx)) {
  ok(/^[A-Za-z0-9_-]{1,128}$/.test(t.name), `nome inválido: ${t.name}`);
  ok(t.description && Buffer.byteLength(t.description) <= 1024, `${t.name}: descrição grande demais`);
  ok(size(t.inputSchema) <= 4096 && t.inputSchema.type === "object", `${t.name}: schema inválido`);
}

// ---- buscar_iniciais
const fogo = T.buscar_iniciais.run({ tipo: "Fogo", limite: 25 });
ok(fogo.total === owned.filter(m => m.ty.includes("FIRE")).length && fogo.iniciais.every(x => x.tipos.includes("Fogo")), "filtro por tipo em português");
ok(T.buscar_iniciais.run({ tipo: "fire" }).total === fogo.total, "filtro por tipo em inglês");
ok(T.buscar_iniciais.run({ custo_max: 2, ordenar: "custo" }).iniciais.every(x => x.custo <= 2), "custo máximo");
ok(T.buscar_iniciais.run({ lendario: true, limite: 99 }).iniciais.length <= 25, "limite de 25");
ok(throws(() => T.buscar_iniciais.run({ tipo: "Plasma" })), "tipo inválido deveria dar erro");
ok(T.buscar_iniciais.run({ mega: true }).iniciais.every(x => x.forma), "filtro de Mega");

// ---- detalhes
const some = owned.find(m => m.passiveStart) || owned[0];
const d = T.detalhes.run({ pokemon: some.fin });
ok(d.desbloqueado && d.pokemon === some.fin && d.custo === some.cost && d.status.HP === some.st[0], "detalhes de um inicial desbloqueado");
ok(Array.isArray(d.golpes_sugeridos) && d.golpes_sugeridos.length && d.doces && d.doces.tem === some.candy, "detalhes traz golpes e doces");
ok(T.detalhes.run({ pokemon: A.norm(some.name) }).pokemon === some.fin, "acha pelo nome do inicial, sem acento nem espaço");
const locked = game.starters.find(s => !owned.some(m => m.k === s.k));
ok(T.detalhes.run({ pokemon: L.pname(locked.k) }).desbloqueado === false, "inicial não desbloqueado");
ok(T.detalhes.run({ pokemon: "Charmeleon" }).desbloqueado === false, "espécie intermediária vem do dex");
ok(throws(() => T.detalhes.run({ pokemon: "Pikachuzão" })), "nome inexistente deveria dar erro");

// ---- gerar_time
let seen = null; ctx.onTeam = r => { seen = r; };
const g = T.gerar_time.run({ tema: "Equilibrado" });
ok(g.membros.length > 0 && seen && seen.team.length === g.membros.length, "gerar_time devolve e avisa a página");
ok(T.gerar_time.run({ tema: "equilibrado" }).tema === "Equilibrado", "tema sem maiúscula");
const lk = owned[3];
ok(T.gerar_time.run({ tema: "Caos total", travados: [lk.fin] }).membros.some(x => x.pokemon === lk.fin), "travado entra no time");
ok(throws(() => T.gerar_time.run({ tema: "Inventado" })), "tema inválido deveria dar erro");
ok(throws(() => T.gerar_time.run({ tema: "Caos total", travados: ["Pikachuzão"] })), "travado inexistente deveria dar erro");
const mono = T.gerar_time.run({ tema: "Monotipo", tipo: "Água", orcamento: 15 });
ok(mono.custo.endsWith("/15") && mono.info === "Monotipo de Água", "monotipo com tipo e orçamento");

// ---- analisar_time
const an = T.analisar_time.run({ membros: ["Squirtle", "Psyduck", "Poliwag", "Gyarados"] });
ok(an.membros.length >= 3 && Array.isArray(an.fraquezas_repetidas), "analisar_time");
ok(an.fraquezas_repetidas.some(x => x.startsWith("Elétrico")), "time de Água tem Elétrico como fraqueza repetida");
ok(T.analisar_time.run({ membros: ["Garchomp", "Xyz"] }).nao_encontrados.includes("Xyz"), "lista quem não achou");

// ---- habilidade e bioma
ok(T.habilidade.run({ nome: "Drought" }).descricao.startsWith("Convoca um sol forte"), "descrição de habilidade");
ok(throws(() => T.habilidade.run({ nome: "Superpoder" })), "habilidade inexistente");
const ic = T.bioma.run({ nome: "Caverna de Gelo" });
ok(ic.bioma === "Caverna de Gelo" && ic.proximos[0].startsWith("Floresta Nevada") && ic.lideres.includes("Grusha"), "bioma Caverna de Gelo");
ok(T.bioma.run({ nome: "ice cave" }).bioma === "Caverna de Gelo", "bioma pelo nome em inglês");

// ---- tamanho das respostas (sample aceita até 32 KB por ferramenta; queremos bem menos)
for (const [n, r] of [["buscar", T.buscar_iniciais.run({ limite: 25 })], ["detalhes", d], ["gerar", g], ["bioma", ic]]) ok(size(r) < 8000, `${n}: resposta grande (${size(r)} bytes)`);

// ---- sessão sintética no formato do jogo (SessionSaveData)
const mv = k => dex.moves.indexOf(k), sp = k => dex.species.find(r => r[1] === k)[0];
const session = {
  gameMode: 0, waveIndex: 60, money: 5000, arena: { biome: dex.biomes.indexOf("ICE_CAVE") }, pokeballCounts: { 0: 5, 1: 2, 2: 0 },
  party: [
    { id: 11, species: sp("CHARIZARD"), level: 52, abilityIndex: 2, passive: true, nature: 15, hp: 90, stats: [150, 100, 90, 140, 95, 120], moveset: [{ moveId: mv("FLAMETHROWER") }, { moveId: mv("AIR_SLASH") }] },
    { id: 12, species: sp("BLASTOISE"), level: 50, abilityIndex: 0, passive: false, nature: 5, hp: 160, stats: [160, 90, 120, 95, 115, 85], moveset: [{ moveId: mv("SURF") }] },
  ],
  enemyParty: [{ id: 99, species: sp("WALREIN"), level: 58, abilityIndex: 0, boss: true }],
  modifiers: [{ typeId: "LEFTOVERS", args: [11], stackCount: 1 }, { typeId: "EXP_SHARE", args: [], stackCount: 2 }],
  enemyModifiers: [], trainer: null,
};
ok(A.detectSave(session) === "session", "detecta sessão");
const ss = A.summarizeSession(ctx, session);
ok(ss.modo === "Clássico" && ss.wave === 60 && ss.bioma === "Caverna de Gelo", "cabeçalho da sessão");
ok(ss.time[0].pokemon === "Charizard" && ss.time[0].habilidade === "Solar Power" && ss.time[0].passiva === "Battle Bond", "Charizard com habilidade oculta e passiva");
ok(ss.time[0].itens.join() === "Leftovers" && ss.itens_do_time.join() === "Exp Share x2", "itens segurados e do time");
ok(ss.time[0].golpes.join() === "Flamethrower,Air Slash" && ss.time[0].hp === "90/150" && ss.time[0].nature.startsWith("Modest"), "golpes, HP e nature");
ok(!ss.time[1].passiva, "passiva desligada não aparece");
ok(ss.inimigos[0].pokemon === "Walrein" && ss.inimigos[0].chefe, "inimigo chefe");
ok(ss.proximas_lutas_fixas[0] === "wave 62: Recruta da equipe vilã (2ª)", `próxima luta fixa (${ss.proximas_lutas_fixas[0]})`);
ok(ss.pokebolas.join() === "Poké Ball: 5,Great Ball: 2", "pokébolas");

// ---- histórico sintético (RunHistoryData)
const run = (wave, win, party, enemy, biome) => ({ entry: { ...session, waveIndex: wave, party: party.map(k => ({ species: sp(k), level: 50 })), enemyParty: enemy.map(k => ({ species: sp(k), level: 60 })), arena: { biome: dex.biomes.indexOf(biome) } }, isVictory: win, isFavorite: false });
const hist = { 1700000000000: run(200, true, ["CHARIZARD", "GARCHOMP"], ["ETERNATUS"], "END"), 1700100000000: run(66, false, ["CHARIZARD"], ["WALREIN"], "ICE_CAVE"), 1700200000000: run(70, false, ["BLASTOISE"], ["WALREIN"], "ICE_CAVE") };
ok(A.detectSave(hist) === "history", "detecta histórico");
const hs = A.summarizeHistory(ctx, hist);
ok(hs.runs === 3 && hs.vitorias === 1 && hs.wave_media === 112, "contagens do histórico");
ok(hs.biomas_onde_perdeu[0] === "Caverna de Gelo (2)" && hs.inimigos_nas_derrotas[0] === "Walrein (2)" && hs.mais_usados[0] === "Charizard (2)", "padrões do histórico");
ok(hs.ultimas[0].data === "2023-11-17" && hs.ultimas[0].wave === 70, "ordem do histórico (mais recente primeiro)");
ok(A.detectSave({ starterData: {}, dexData: {} }) === "system" && A.detectSave({ x: 1 }) === null, "detecta save principal e lixo");

// ---- instruções e turnos
const turns = A.buildTurns(ctx, "carry", null, [{ role: "assistant", content: "oi" }, { role: "user", content: "monta um time" }]);
ok(turns[0].role === "user" && turns[1].role === "user" && turns[turns.length - 1].role === "user", "turnos começam e terminam em user");
ok(turns[0].content.includes("MODO CARRY") && turns[0].content.includes("430 iniciais") === (owned.length === 430), "instruções com modo e save");
const withRun = A.rules(ctx, "conselheiro", { tipo: "session", resumo: ss });
ok(withRun.includes("RUN ATUAL") && withRun.includes("Caverna de Gelo"), "instruções levam o resumo da run");
for (const t of [A.rules(ctx, "raiox", { tipo: "history", resumo: hs }), ...Object.values(A.MODES).map(m => m.guia), ...A.tools(ctx).map(t => t.description)]) ok(!/[—–]| - /.test(t), `texto com travessão ou hífen: ${t.slice(0, 60)}`);
ok(A.buildTurns(ctx, "conversa", null, Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }))).length <= 17, "conversa longa é cortada");

console.log(fail ? `${fail} falhas` : "tudo ok");
process.exit(fail ? 1 : 0);
