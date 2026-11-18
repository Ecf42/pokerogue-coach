// Agente do PokéRogue Coach: ferramentas da página, instruções e leitura de sessão e histórico de runs.
// Sem DOM: roda no navegador (window.PRA) e no node (require). Depende de logic.js.
(function (root) {
  const L = typeof module !== "undefined" ? require("./logic.js") : root.PRL;
  const { title, pname, TYPE_PT, TYPES, NATS } = L;

  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const tyPt = ts => ts.filter(Boolean).map(t => TYPE_PT[t] || t);
  const pct = x => String(Math.round(x * 1000) / 10).replace(".", ","); // para exibir: 43,4
  const NAT_STAT = ["Atk", "Def", "Vel", "SpA", "SpD"];
  const natName = n => { const p = Math.floor(n / 5), q = n % 5; return p === q ? `${NATS[n]} (neutra)` : `${NATS[n]} (+${NAT_STAT[p]} −${NAT_STAT[q]})`; };
  const MODE_PT = { CLASSIC: "Clássico", ENDLESS: "Infinito", SPLICED_ENDLESS: "Infinito com fusões", DAILY: "Diário", CHALLENGE: "Desafio" };
  const BALLS = ["Poké Ball", "Great Ball", "Ultra Ball", "Rogue Ball", "Master Ball", "Luxury Ball"];

  // ---------------------------------------------------------------- contexto

  // Tudo o que as ferramentas leem. owned vem de L.buildOwned; label é a data do save.
  function makeCtx({ game, biomes, dex, owned, label }) {
    const dexById = new Map(dex.species.map(r => [r[0], r]));
    const dexByKey = new Map(dex.species.map(r => [r[1], r]));
    const startersByKey = new Map(game.starters.map(s => [s.k, s]));
    return { game, biomes, dex, owned, label, dexById, dexByKey, startersByKey, lastTeam: null, onTeam: null };
  }

  function typeKey(s) {
    const q = norm(s);
    return TYPES.find(t => norm(t) === q || norm(TYPE_PT[t]) === q) || null;
  }

  // Acha um inicial desbloqueado pelo nome do inicial ou da forma final (sem acento, sem espaço)
  function findOwned(ctx, name) {
    const q = norm(name);
    if (!q) return null;
    const exact = ctx.owned.find(m => [m.name, m.fin, m.k, m.finKey].some(x => norm(x) === q));
    if (exact) return exact;
    // nome exato de outra espécie (Farfetchd não desbloqueado) não pode cair na busca parcial (Farfetchd de Galar)
    if (ctx.game.starters.some(s => [s.k, s.f, pname(s.k), pname(s.f)].some(x => norm(x) === q)) || findDex(ctx, name)) return null;
    const part = ctx.owned.filter(m => norm(m.fin).includes(q) || norm(m.name).includes(q));
    return part.length === 1 ? part[0] : null;
  }
  function findDex(ctx, name) {
    const q = norm(name);
    return ctx.dex.species.find(r => norm(r[1]) === q || norm(pname(r[1])) === q) || null;
  }
  function abilityOf(ctx, row, slot) {
    const a = ctx.dex.abilities;
    const k = a[row[4 + slot]];
    return k && k !== "NONE" ? k : a[row[4]];
  }

  function brief(m) {
    const fs = L.bigForms(m);
    return {
      pokemon: m.fin, inicial: m.name, custo: m.cost, total: m.bst, tipos: tyPt(m.ty),
      habilidades: m.abil.map(title), passiva: m.passive ? title(m.passive) : "não liberada",
      ...(m.lg ? { lendario: ["", "Lendário", "Sublendário", "Mítico"][m.lg] } : {}),
      ...(fs.length ? { forma: fs.map(f => L.formText(m, f)).join("; ") } : {}),
    };
  }

  function memberOut(ctx, m, r) {
    const fs = L.bigForms(m);
    return {
      pokemon: m.fin, inicial: m.name, custo: m.cost, nature: natName(m.nat),
      habilidade: m.abil.map(title).join(" ou "), passiva: m.passive ? title(m.passive) : "não liberada",
      golpes: L.suggestMoves(m, ctx.game, r.ctx).map(x => x.name),
      tms_se_aparecerem: L.suggestTMs(m, ctx.game, r.ctx).map(x => `${x.name} (${x.tierNome}, ${x.why})`),
      ...(fs.length ? { forma: fs.map(f => L.formText(m, f)).join("; ") } : {}),
      ...(r.notes && r.notes[m.k] ? { porque: r.notes[m.k] } : {}),
    };
  }

  // ---------------------------------------------------------------- ferramentas

  const SORTS = {
    forca: (a, b) => b.score - a.score,
    custo: (a, b) => a.cost - b.cost || b.score - a.score,
    custo_beneficio: (a, b) => b.score / (b.cost + 1) - a.score / (a.cost + 1),
  };

  function themeKey(s) {
    const q = norm(s);
    return Object.keys(L.THEMES).find(k => norm(k) === q || norm(L.THEMES[k]) === q || norm(L.THEMES[k]).includes(q)) || null;
  }

  function tools(ctx) {
    return [
      {
        name: "buscar_iniciais",
        description: "Lista iniciais que o jogador JÁ DESBLOQUEOU, com filtros. Retorna {total, iniciais:[{pokemon (forma final), inicial, custo, total, tipos, habilidades liberadas, passiva, forma Mega/Gmax}]}. Use para achar opções antes de montar time.",
        inputSchema: { type: "object", properties: {
          tipo: { type: "string", description: "Tipo em português ou inglês, ex.: Fogo" },
          texto: { type: "string", description: "Parte do nome" },
          habilidade: { type: "string", description: "Habilidade ou passiva liberada, ex.: Intimidate" },
          custo_max: { type: "number" },
          lendario: { type: "boolean" },
          mega: { type: "boolean", description: "Só quem tem Mega ou Gigantamax" },
          ordenar: { type: "string", enum: ["forca", "custo", "custo_beneficio"] },
          limite: { type: "number", description: "Até 25, padrão 12" },
        } },
        run(i) {
          let list = ctx.owned;
          if (i.tipo) { const t = typeKey(i.tipo); if (!t) throw new Error("Tipo desconhecido: " + i.tipo); list = list.filter(m => m.ty.includes(t)); }
          if (i.texto) { const q = norm(i.texto); list = list.filter(m => norm(m.name).includes(q) || norm(m.fin).includes(q)); }
          if (i.habilidade) { const q = norm(i.habilidade); list = list.filter(m => [...m.abil, m.passive].filter(Boolean).some(a => norm(a).includes(q))); }
          if (i.custo_max != null && i.custo_max !== "") list = list.filter(m => m.cost <= Number(i.custo_max));
          if (i.lendario === true) list = list.filter(m => m.lg); else if (i.lendario === false) list = list.filter(m => !m.lg);
          if (i.mega === true) list = list.filter(m => L.bigForms(m).length);
          list = [...list].sort(SORTS[i.ordenar] || SORTS.forca);
          const lim = Math.min(25, Math.max(1, Number(i.limite) || 12));
          return { total: list.length, iniciais: list.slice(0, lim).map(brief) };
        },
      },
      {
        name: "detalhes",
        description: "Tudo sobre um Pokémon no save do jogador: custo, status, habilidades e passiva (liberadas ou não), natures liberadas, IVs, egg moves, golpes sugeridos, TMs que valem se aparecerem, Mega/Gmax, doces e interações. Aceita o nome do inicial ou da forma final.",
        inputSchema: { type: "object", properties: { pokemon: { type: "string" } }, required: ["pokemon"] },
        run(i) {
          const m = findOwned(ctx, i.pokemon);
          if (!m) {
            const s = ctx.game.starters.find(x => [x.k, x.f, pname(x.k), pname(x.f)].some(y => norm(y) === norm(i.pokemon)));
            if (s) return { pokemon: pname(s.f), inicial: pname(s.k), desbloqueado: false, custo: s.c, total: s.st.reduce((a, b) => a + b, 0), tipos: tyPt(s.ty), habilidades: s.ab.filter(a => a !== "NONE").map(title) };
            const d = findDex(ctx, i.pokemon);
            if (d) return { pokemon: pname(d[1]), desbloqueado: false, observacao: "Não é inicial desbloqueado; pode ser forma intermediária ou espécie que o jogador não tem.", tipos: tyPt([d[2], d[3]]), total: d[7], habilidades: [4, 5, 6].map(j => ctx.dex.abilities[d[j]]).filter(a => a && a !== "NONE").map(title) };
            throw new Error("Não achei esse Pokémon: " + i.pokemon);
          }
          const s = ctx.startersByKey.get(m.k);
          const cc = L.candyCosts(m.base, ctx.game) || {};
          const egg = (s.em || []).map((mi, j) => mi == null ? null : `${title(ctx.game.moves[mi][0])}${m.egg.includes(mi) ? "" : " (não liberado)"}`).filter(Boolean);
          const it = L.INTERACTIONS.find(x => x.k === m.k);
          const pFinal = s.paf || s.pa;
          return {
            pokemon: m.fin, inicial: m.name, desbloqueado: true, custo: m.cost, custo_original: m.base, total: m.bst,
            status: { HP: m.st[0], Atk: m.st[1], Def: m.st[2], SpA: m.st[3], SpD: m.st[4], Vel: m.st[5] }, tipos: tyPt(m.ty),
            habilidades_liberadas: m.abil.map(title), todas_habilidades: m.allAb.map(title),
            passiva: m.passive ? title(m.passive) + " (liberada)" : (pFinal ? title(pFinal) + " (não liberada)" : "nenhuma"),
            ...(s.paf ? { passiva_antes_de_evoluir: title(s.pa) } : {}),
            nature_sugerida: natName(m.nat), natures_liberadas: m.nats.map(n => NATS[n]),
            ivs: m.iv.join("/"), egg_moves: egg,
            golpes_sugeridos: L.suggestMoves(m, ctx.game, null).map(x => `${x.name} (${TYPE_PT[x.t]}, ${x.c === "X" ? "status" : x.p})`),
            tms_se_aparecerem: L.suggestTMs(m, ctx.game, null).map(x => `${x.name} (${x.tierNome}, ${x.why})`),
            formas: L.bigForms(m).map(f => ({ forma: L.formText(m, f), tipos: tyPt(f.ty), total: f.st.reduce((a, b) => a + b, 0), habilidade: title(f.ab[0]), passiva: f.pa ? title(f.pa) : null })),
            doces: { tem: m.candy, ...(m.paUnlocked ? {} : { para_passiva: cc.passiva }), ...(m.vr < 2 ? { para_reduzir_custo: cc.reducao && cc.reducao[m.vr] } : {}) },
            ...(it && it.need(m) ? { interacao: it.why(m) } : {}),
          };
        },
      },
      {
        name: "gerar_time",
        description: "Gera um time inicial com os desbloqueios do jogador usando um tema do gerador da página. Retorna {tema, info, custo, membros:[{pokemon, custo, nature, habilidade, passiva, golpes, tms_se_aparecerem, forma, porque}], fraquezas}. O time aparece também na aba Gerar.",
        inputSchema: { type: "object", properties: {
          tema: { type: "string", description: "Um de: " + Object.values(L.THEMES).join(", ") },
          travados: { type: "array", items: { type: "string" }, description: "Pokémon que precisam estar no time" },
          orcamento: { type: "number", description: "Pontos, padrão 10" },
          tamanho: { type: "number", description: "Membros, padrão 6" },
          tipo: { type: "string", description: "Só para o tema Monotipo" },
        }, required: ["tema"] },
        run(i) {
          const theme = themeKey(i.tema);
          if (!theme) throw new Error("Tema desconhecido. Use um de: " + Object.values(L.THEMES).join(", "));
          const locked = (Array.isArray(i.travados) ? i.travados : []).map(n => { const m = findOwned(ctx, n); if (!m) throw new Error("Não está desbloqueado ou não achei: " + n); return m.k; });
          const budget = Math.max(1, Math.min(60, Number(i.orcamento) || 10)), size = Math.max(1, Math.min(6, Number(i.tamanho) || 6));
          const opts = { theme, budget, size, locked, monoType: i.tipo ? typeKey(i.tipo) || undefined : undefined };
          const r = L.generate(ctx.owned, opts);
          ctx.lastTeam = { r, opts };
          if (ctx.onTeam) ctx.onTeam(r, opts);
          return {
            tema: L.THEMES[theme], info: theme === "mono" && r.info ? "Monotipo de " + TYPE_PT[r.info] : r.info, custo: `${r.cost}/${budget}`,
            membros: r.team.map(m => memberOut(ctx, m, r)),
            fraquezas: L.teamWeak(r.team).slice(0, 5).map(x => `${TYPE_PT[x.t]} acerta ${x.weak} (${x.res} resistem)`),
          };
        },
      },
      {
        name: "analisar_time",
        description: "Analisa um time (iniciais do jogador ou qualquer espécie, como o time atual da run): tipos que acertam vários sem resistência, tipo que acerta 3 ou mais sem ninguém resistir, e tipos contra os quais falta golpe super efetivo. Retorna dados compactos.",
        inputSchema: { type: "object", properties: { membros: { type: "array", items: { type: "string" } } }, required: ["membros"] },
        run(i) {
          const names = Array.isArray(i.membros) ? i.membros.slice(0, 6) : [];
          if (!names.length) throw new Error("Mande a lista de membros.");
          const team = [], unknown = [];
          for (const n of names) {
            const m = findOwned(ctx, n);
            if (m) { team.push({ nome: m.fin, ty: m.ty, abil: m.abil, passive: m.passive, cov: m.cov }); continue; }
            const d = findDex(ctx, n);
            if (d) { const ty = [d[2], d[3]].filter(Boolean); team.push({ nome: pname(d[1]), ty, abil: [], passive: null, cov: ty, stabOnly: true }); continue; }
            unknown.push(n);
          }
          const b = L.balanceReport(team);
          return {
            membros: team.map(m => `${m.nome} (${tyPt(m.ty).join("/")})`),
            fraquezas_repetidas: L.teamWeak(team).map(x => `${TYPE_PT[x.t]}: ${x.weak} fracos, ${x.res} resistem`),
            acerta_3_ou_mais_sem_resistencia: tyPt(b.holesDef),
            sem_golpe_super_efetivo_contra: tyPt(b.holesOff),
            ...(team.some(m => m.stabOnly) ? { observacao: "Para quem não é inicial do jogador, a cobertura considera só os tipos dele, e habilidades não entram." } : {}),
            ...(unknown.length ? { nao_encontrados: unknown } : {}),
          };
        },
      },
      {
        name: "habilidade",
        description: "Descrição oficial (em português) de uma habilidade do jogo. Retorna {nome, descricao}.",
        inputSchema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
        run(i) {
          const q = norm(i.nome);
          const k = Object.keys(ctx.game.abilities).find(a => norm(a) === q || norm(ctx.game.abilities[a][0]) === q);
          if (k) return { nome: ctx.game.abilities[k][0], descricao: ctx.game.abilities[k][1] };
          const d = ctx.dex.abilities.find(a => norm(a) === q);
          if (d) return { nome: title(d), descricao: "Sem descrição nos dados da página." };
          throw new Error("Habilidade não encontrada: " + i.nome);
        },
      },
      {
        name: "bioma",
        description: "Dados de um bioma: próximos biomas com a chance de aparecerem e de cair neles sem Map, chance de treinador, clima, selvagens mais prováveis (média dos horários), chefes e líderes. Retorna dados compactos.",
        inputSchema: { type: "object", properties: { nome: { type: "string", description: "Nome em português ou inglês, ex.: Caverna de Gelo" } }, required: ["nome"] },
        run(i) {
          const q = norm(i.nome);
          const b = ctx.biomes.biomes.find(x => norm(x.k) === q || norm(x.nome) === q) || ctx.biomes.biomes.find(x => norm(x.nome).includes(q));
          if (!b) throw new Error("Bioma não encontrado: " + i.nome);
          const top = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n).map(([s, p]) => `${pname(s)} ${pct(p)}%`);
          const wt = Object.values(b.weather).reduce((x, y) => x + y, 0);
          return {
            bioma: b.nome,
            proximos: L.nextBiomeOdds(ctx.biomes, b.k).map(x => `${x.nome}: aparece ${pct(x.aparece)}%, sem Map ${pct(x.semMap)}%`),
            treinador: b.trainerChance ? `1 em ${b.trainerChance} batalhas` : "não tem",
            clima: Object.entries(b.weather).map(([w, n]) => `${title(w)} ${pct(n / wt)}%`),
            selvagens: top(L.biomeOdds(ctx.biomes, b.k), 15),
            chefes: b.pool.BOSS ? top(L.biomeOdds(ctx.biomes, b.k, null, true), 10) : [],
            lideres: (b.trainers.BOSS || []).map(title),
          };
        },
      },
      {
        name: "alvos_de_farm",
        description: "Caçador de desbloqueios: o que mais vale farmar no save (passivas perto de liberar, reduções de custo, ovos da mesma espécie com chance de egg move ou habilidade oculta, natures que faltam), do mais para o menos útil. Retorna {total, alvos:[{pokemon, alvo, situacao}]}.",
        inputSchema: { type: "object", properties: {
          tipo: { type: "string", enum: ["tudo", "prontos", "passiva", "custo", "ovo", "nature"], description: "prontos = dá para liberar agora com os doces que tem" },
          pokemon: { type: "string", description: "Só deste Pokémon" },
          limite: { type: "number", description: "Até 20, padrão 10" },
        } },
        run(i) {
          let list = farmList(ctx, i.tipo);
          if (i.pokemon) { const m = findOwned(ctx, i.pokemon); if (!m) throw new Error("Não está desbloqueado ou não achei: " + i.pokemon); list = list.filter(x => x.k === m.k); }
          const lim = Math.min(20, Math.max(1, Number(i.limite) || 10));
          return { total: list.length, alvos: list.slice(0, lim).map(x => { const t = farmText(x); return { pokemon: x.pokemon, alvo: t.titulo, situacao: t.detalhe }; }) };
        },
      },
      {
        name: "rota_biomas",
        description: "Rota de biomas no Clássico. Alvo pode ser um bioma (chance de chegar até o fim da run e qual link escolher na próxima troca) ou um Pokémon (melhores biomas para achar ele ou a pré evolução, com chance de ver numa passagem e de chegar lá). Considera se o jogador tem Map. Retorna dados compactos.",
        inputSchema: { type: "object", properties: {
          de: { type: "string", description: "Bioma atual" },
          alvo: { type: "string", description: "Bioma ou Pokémon" },
          wave: { type: "number", description: "Wave atual (calcula quantas trocas faltam). Padrão 1" },
          tem_map: { type: "boolean" },
        }, required: ["de", "alvo"] },
        run(i) { return routeAnswer(ctx, i); },
      },
    ];
  }

  // ---- caçador de desbloqueios (Fase 5): lista filtrada e texto de cada item, usados pela ferramenta e pela aba Farm
  function farmList(ctx, tipo) {
    const all = L.farmTargets(ctx.owned, ctx.game);
    if (!tipo || tipo === "tudo") return all;
    if (tipo === "prontos") return all.filter(x => x.falta === 0);
    return all.filter(x => x.tipo === tipo);
  }
  function farmText(x) {
    const doces = x.custoDoces == null ? "" : x.falta === 0 ? `Pronto: tem ${x.doces} de ${x.custoDoces} doces.` : `${x.falta === 1 ? "Falta 1 doce" : `Faltam ${x.falta} doces`} (tem ${x.doces} de ${x.custoDoces}).`;
    if (x.tipo === "passiva") return { titulo: `Passiva ${title(x.passiva)}${x.liga ? ` (liga ${x.liga})` : ""}`, detalhe: doces };
    if (x.tipo === "custo") return { titulo: `Custo de ${String(x.de).replace(".", ",")} para ${String(x.para).replace(".", ",")} ${x.para === 1 ? "ponto" : "pontos"}`, detalhe: doces };
    if (x.tipo === "ovo") {
      const ms = x.eggMoves.map(e => title(e.k) + (e.rare ? " (raro)" : "")).join(", ");
      const partes = [];
      if (x.eggMoves.length) partes.push(`${pct(x.chanceEggMove)}% de liberar egg move novo (${ms})`);
      if (x.oculta) partes.push(`${pct(x.chanceOculta)}% de liberar ${title(x.oculta)}`);
      return { titulo: `Ovo da mesma espécie (${x.custoDoces} doces)`, detalhe: `Por ovo: ${partes.join("; ")}. ${doces}` };
    }
    return { titulo: `Nature ${x.natures.join(" ou ")}`, detalhe: "Capture ou choque um com essa nature para liberar." };
  }

  const END_NOME = "Fim do Clássico (???, waves 191 a 199)";
  function findBiome(ctx, s) {
    const q = norm(s);
    // o END se chama "???" no jogo, que some ao normalizar
    if ((!q && /\?/.test(String(s))) || q === "fim" || q === "fimdoclassico" || q === "end") return ctx.biomes.biomes.find(x => x.k === "END") || null;
    return q ? ctx.biomes.biomes.find(x => norm(x.k) === q || norm(x.nome) === q) || ctx.biomes.biomes.find(x => norm(x.nome).includes(q) || norm(x.k).includes(q)) || null : null;
  }

  // Resposta da rota, usada pela ferramenta do agente e pela aba Rotas
  function routeAnswer(ctx, i) {
    const from = findBiome(ctx, i.de);
    if (!from) throw new Error("Bioma de partida não encontrado: " + i.de);
    const wave = Math.max(1, Number(i.wave) || 1), map = !!i.tem_map, steps = L.switchesLeft(wave);
    const bname = k => (ctx.biomes.biomes.find(b => b.k === k) || {}).nome || k;
    // a troca acontece depois das waves múltiplas de 10; com n trocas, chega na wave seguinte à n-ésima
    const arrive = path => Math.ceil(wave / 10) * 10 + 10 * (path.length - 2) + 1;
    const pathText = path => path.map(bname).join(" > ") + ` (chega na wave ${arrive(path)})`;
    const base = { de: from.nome, wave, trocas_restantes: steps, map: map ? "sim" : "não" };
    const tb = findBiome(ctx, i.alvo);
    if (tb && tb.k === "END") return { ...base, alvo: END_NOME, chance_de_chegar: "100%", observacao: "No Clássico o jogo leva para lá sozinho depois da wave 190; não tem como chegar antes." };
    const d = tb ? null : findDex(ctx, i.alvo);
    if (tb && (!d || norm(tb.nome) === norm(i.alvo) || norm(tb.k) === norm(i.alvo))) {
      const r = L.planRoute(ctx.biomes, from.k, tb.k, steps, map);
      return {
        ...base, alvo: tb.nome, chance_de_chegar: pct(r.chance) + "%",
        minimo_de_trocas: r.min == null ? "inalcançável" : r.min,
        proxima_troca: r.next.map(x => `${x.nome}: aparece ${pct(x.aparece)}%, por ele ${pct(x.chance)}%`),
        caminho_ideal: r.path.length > 1 ? pathText(r.path) : r.path.map(bname).join(" > "),
        ...(map ? {} : { observacao: "Sem Map o jogo sorteia entre os links que aparecerem. Com Map seria " + pct(L.planRoute(ctx.biomes, from.k, tb.k, steps, true).chance) + "%." }),
      };
    }
    const sp = d || findDex(ctx, i.alvo);
    if (!sp) throw new Error("Não achei bioma nem Pokémon com esse nome: " + i.alvo);
    const h = L.huntSpecies(ctx.biomes, ctx.dex.prevo, sp[1], from.k, steps, map).slice(0, 5);
    if (!h.length) return { ...base, alvo: pname(sp[1]), resultado: "Não aparece nos pools de nenhum bioma (pode vir só de ovos, eventos ou encontros especiais)." };
    // caminho até cada bioma; no melhor alcançável, também a escolha da próxima troca (com as alternativas)
    const plan = x => (x.k === from.k || x.k === "END" || !x.chegar ? null : L.planRoute(ctx.biomes, from.k, x.k, steps, map));
    const top = h.find(x => x.k !== from.k && x.k !== "END" && x.chegar > 0);
    const res = {
      ...base, alvo: pname(sp[1]),
      melhores_biomas: h.map(x => {
        const r = plan(x);
        return {
          bioma: x.k === "END" ? END_NOME : x.nome, aparece_como: x.formas.map(pname).join(", "),
          por_batalha: pct(x.porBatalha) + "%", como_chefe: pct(x.chefe) + "%",
          numa_passagem: pct(x.passagem) + "%", chance_de_chegar: pct(x.chegar) + "%",
          caminho: x.k === from.k ? "você já está aqui" : x.k === "END" ? "o jogo leva depois da wave 190" : r && r.path.length > 1 ? pathText(r.path) : "inalcançável a tempo",
        };
      }),
      observacao: "Passagem = 10 waves no bioma. Aproximação: não conta sorte, eventos nem o reroll de lendários antes da wave 55.",
    };
    if (top) {
      const r = plan(top);
      res.rumo = top.nome;
      res.proxima_troca = r.next.filter(x => x.chance > 0).sort((a, b) => b.chance - a.chance).slice(0, 4)
        .map(x => `${x.nome}: aparece ${pct(x.aparece)}%, por ele ${pct(x.chance)}% de chegar em ${top.nome}`);
      if (map) res.como_usar = "Em cada troca, escolha o primeiro desta lista que aparecer no Map. O caminho mostrado é o ideal, quando a melhor opção aparece; depois de cada troca, calcule de novo a partir do bioma novo.";
    }
    return res;
  }

  // ---------------------------------------------------------------- arquivos do jogo

  // system = save principal; session = sessão exportada; history = histórico de runs
  function detectSave(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (obj.starterData && obj.dexData) return "system";
    if (Array.isArray(obj.party) && obj.waveIndex != null) return "session";
    const vals = Object.values(obj);
    if (vals.length && vals.every(v => v && v.entry && Array.isArray(v.entry.party))) return "history";
    return null;
  }

  const FIXED_PT = k => {
    const n = (k.match(/_(\d)$/) || [])[1];
    const base = k.replace(/_\d$/, "");
    const nome = { TOWN_YOUNGSTER: "Youngster da cidade", RIVAL: "Rival", EVIL_GRUNT: "Recruta da equipe vilã", EVIL_ADMIN: "Admin da equipe vilã",
      EVIL_BOSS: "Chefe da equipe vilã", ELITE_FOUR: "Elite Four", CHAMPION: "Campeão" }[base] || title(k);
    return n ? `${nome} (${n}ª)` : nome;
  };
  function nextFixed(ctx, wave, n = 4) {
    const out = ctx.dex.classicFixed.filter(([w]) => w > wave).slice(0, n).map(([w, k]) => `wave ${w}: ${FIXED_PT(k)}`);
    if (wave < 200) out.push("wave 200: chefe final (Eternatus)");
    return out;
  }

  function monOut(ctx, p, mods) {
    const d = ctx.dexById.get(p.species);
    const held = (mods || []).filter(x => Array.isArray(x.args) && x.args[0] === p.id && p.id != null)
      .map(x => title(x.typeId || x.className || "?") + ((x.stackCount || 1) > 1 ? ` x${x.stackCount}` : ""));
    const o = {
      pokemon: d ? pname(d[1]) : "#" + p.species, nivel: p.level,
      tipos: d ? tyPt([d[2], d[3]]) : [],
      habilidade: d ? title(abilityOf(ctx, d, Math.max(0, Math.min(2, p.abilityIndex || 0)))) : "?",
    };
    if (p.stats && p.hp != null) o.hp = `${p.hp}/${p.stats[0]}`;
    if (p.passive && d && ctx.dex.abilities[d[8]] !== "NONE") o.passiva = title(ctx.dex.abilities[d[8]]);
    if (p.nature != null) o.nature = natName(p.nature);
    if (Array.isArray(p.moveset) && p.moveset.length) o.golpes = p.moveset.map(mv => title(ctx.dex.moves[mv && mv.moveId] || "?"));
    if (held.length) o.itens = held;
    if (p.fusionSpecies) { const f = ctx.dexById.get(p.fusionSpecies); if (f) o.fusao = pname(f[1]); }
    if (p.boss) o.chefe = true;
    if (p.status && p.status.effect) o.status = p.status.effect;
    return o;
  }

  function biomeName(ctx, id) {
    const k = ctx.dex.biomes[id];
    const b = k && ctx.biomes.biomes.find(x => x.k === k);
    return b ? b.nome : k || "?";
  }

  // Resumo compacto de uma sessão (o que o agente precisa para aconselhar a run)
  function summarizeSession(ctx, s) {
    const mode = ctx.dex.gameModes[s.gameMode];
    const partyIds = new Set((s.party || []).map(p => p.id));
    const teamItems = (s.modifiers || []).filter(x => !(Array.isArray(x.args) && partyIds.has(x.args[0])))
      .map(x => title(x.typeId || x.className || "?") + ((x.stackCount || 1) > 1 ? ` x${x.stackCount}` : ""));
    const out = {
      modo: MODE_PT[mode] || mode, wave: s.waveIndex, bioma: biomeName(ctx, s.arena && s.arena.biome),
      dinheiro: s.money,
      pokebolas: Object.entries(s.pokeballCounts || {}).filter(([, n]) => n > 0).map(([k, n]) => `${BALLS[k] || k}: ${n}`),
      time: (s.party || []).map(p => monOut(ctx, p, s.modifiers)),
      itens_do_time: teamItems,
      inimigos: (s.enemyParty || []).map(p => monOut(ctx, p, s.enemyModifiers)),
    };
    if (s.trainer && s.trainer.trainerType != null) out.treinador = title(ctx.dex.trainers[s.trainer.trainerType] || "?");
    if (mode === "CLASSIC") {
      out.proximas_lutas_fixas = nextFixed(ctx, s.waveIndex);
      out.observacao = "Líder de ginásio a cada 30 waves (20, 50, 80... ou 30, 60, 90..., depende da run). O bioma muda a cada 10 waves.";
    }
    return out;
  }

  // Resumo do histórico de runs: linhas curtas por run e contagens para achar padrões
  function summarizeHistory(ctx, h) {
    const runs = Object.entries(h).map(([ts, v]) => ({ ts: Number(ts), ...v })).sort((a, b) => b.ts - a.ts);
    const count = (arr, n) => { const c = {}; for (const x of arr) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`); };
    const nm = p => { const d = ctx.dexById.get(p.species); return d ? pname(d[1]) : "#" + p.species; };
    const lost = runs.filter(r => !r.isVictory);
    const waves = runs.map(r => r.entry.waveIndex || 0);
    const faixa = w => { const a = Math.floor((w - 1) / 25) * 25 + 1; return `${a}-${a + 24}`; };
    return {
      runs: runs.length, vitorias: runs.filter(r => r.isVictory).length,
      wave_media: runs.length ? Math.round(waves.reduce((a, b) => a + b, 0) / runs.length) : 0,
      por_modo: count(runs.map(r => MODE_PT[ctx.dex.gameModes[r.entry.gameMode]] || "?"), 5),
      derrotas_por_faixa_de_wave: count(lost.map(r => faixa(r.entry.waveIndex || 1)), 8),
      biomas_onde_perdeu: count(lost.map(r => biomeName(ctx, r.entry.arena && r.entry.arena.biome)), 8),
      mais_usados: count(runs.flatMap(r => r.entry.party.map(nm)), 12),
      inimigos_nas_derrotas: count(lost.flatMap(r => (r.entry.enemyParty || []).map(nm)), 10),
      ultimas: runs.slice(0, 25).map(r => ({
        data: new Date(r.ts).toISOString().slice(0, 10), vitoria: !!r.isVictory,
        modo: MODE_PT[ctx.dex.gameModes[r.entry.gameMode]] || "?", wave: r.entry.waveIndex, bioma: biomeName(ctx, r.entry.arena && r.entry.arena.biome),
        time: r.entry.party.map(p => `${nm(p)} ${p.level}`).join(", "),
        inimigos: (r.entry.enemyParty || []).map(p => `${nm(p)} ${p.level}`).join(", "),
      })),
    };
  }

  // ---------------------------------------------------------------- instruções

  const MODES = {
    conversa: { nome: "Conversa", guia: "" },
    carry: { nome: "Carry", guia: "MODO CARRY: o jogador escolheu um Pokémon principal. Use detalhes nele, monte o suporte em volta (gerar_time com ele travado, ou buscar_iniciais e analisar_time) cobrindo as fraquezas dele, com clima ou campo que ele aproveite e Intimidate se houver. Diga também quais itens ele quer e quando evoluir ou usar Mega." },
    conselheiro: { nome: "Conselheiro da run", guia: "MODO CONSELHEIRO DA RUN: leia a run (resumo abaixo ou o print enviado). Diga quem trocar ou treinar, qual bioma escolher no próximo cruzamento (use as ferramentas bioma e rota_biomas, com a wave da run e se ele tem Map) e o que caçar, considerando as próximas lutas fixas. Se o print não deixar algo claro, diga o que precisa ver." },
    raiox: { nome: "Raio X das runs", guia: "MODO RAIO X: o resumo do histórico de runs está abaixo. Aponte padrões (onde e contra quem perde, quais times foram longe) e termine com 3 mudanças concretas para a próxima run." },
  };

  function rules(ctx, mode, runInfo) {
    const legs = ctx.owned.filter(m => m.lg).length;
    const parts = [
      "Você é o Coach de PokéRogue (pokerogue.net) dentro de uma página. Ajude o jogador a montar times e a jogar a run.",
      "Responda em português do Brasil, direto e curto (até uns 200 palavras, a não ser que peçam detalhe). Nunca use travessão nem hífen como pontuação. Use listas curtas quando ajudar.",
      "Nomes de golpes, habilidades, natures e itens em inglês, como aparecem no jogo. Tipos em português.",
      "Use as ferramentas para consultar os desbloqueios e os dados do jogo. Não invente números, habilidades, golpes ou chances que as ferramentas não deram; se não souber, diga. Cite números do save quando ajudarem (custo, IVs, total, doces).",
      "Regras do Clássico: até 6 iniciais, soma de custos até 10 pontos, uma espécie por linha evolutiva. A passiva em batalha é a da forma atual. Mega Bracelet e Dynamax Band saem na loja (raridade Rogue); durante eventos o Clássico dá os dois na wave 115.",
      `Save carregado: ${ctx.label}. ${ctx.owned.length} iniciais desbloqueados, ${legs} lendários ou míticos.`,
    ];
    const g = MODES[mode] && MODES[mode].guia;
    if (g) parts.push(g);
    if (runInfo) parts.push(`${runInfo.tipo === "history" ? "HISTÓRICO DE RUNS" : "RUN ATUAL"} (JSON resumido pela página):\n` + JSON.stringify(runInfo.resumo));
    return parts.join("\n\n");
  }

  // Monta a entrada do sample: turno fixo de instruções + conversa (só as últimas mensagens)
  function buildTurns(ctx, mode, runInfo, history, maxTurns = 16) {
    const h = history.slice(-maxTurns);
    while (h.length && h[0].role !== "user") h.shift();
    return [{ role: "user", content: rules(ctx, mode, runInfo) }, ...h];
  }

  const api = { makeCtx, tools, findOwned, findDex, findBiome, routeAnswer, farmList, farmText, detectSave, summarizeSession, summarizeHistory, nextFixed, rules, buildTurns, MODES, norm };
  if (typeof module !== "undefined") module.exports = api; else root.PRA = api;
})(this);
