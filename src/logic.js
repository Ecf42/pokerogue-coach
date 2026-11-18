// Lógica do gerador de times do PokéRogue (roda no navegador e no node)
(function (root) {
  const NATS = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax","Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash","Calm","Gentle","Sassy","Careful","Quirky"];
  const TYPES = ["NORMAL","FIRE","WATER","ELECTRIC","GRASS","ICE","FIGHTING","POISON","GROUND","FLYING","PSYCHIC","BUG","ROCK","GHOST","DRAGON","DARK","STEEL","FAIRY"];
  const CHART = {
    NORMAL:{ROCK:.5,GHOST:0,STEEL:.5},
    FIRE:{FIRE:.5,WATER:.5,GRASS:2,ICE:2,BUG:2,ROCK:.5,DRAGON:.5,STEEL:2},
    WATER:{FIRE:2,WATER:.5,GRASS:.5,GROUND:2,ROCK:2,DRAGON:.5},
    ELECTRIC:{WATER:2,ELECTRIC:.5,GRASS:.5,GROUND:0,FLYING:2,DRAGON:.5},
    GRASS:{FIRE:.5,WATER:2,GRASS:.5,POISON:.5,GROUND:2,FLYING:.5,BUG:.5,ROCK:2,DRAGON:.5,STEEL:.5},
    ICE:{FIRE:.5,WATER:.5,GRASS:2,ICE:.5,GROUND:2,FLYING:2,DRAGON:2,STEEL:.5},
    FIGHTING:{NORMAL:2,ICE:2,POISON:.5,FLYING:.5,PSYCHIC:.5,BUG:.5,ROCK:2,GHOST:0,DARK:2,STEEL:2,FAIRY:.5},
    POISON:{GRASS:2,POISON:.5,GROUND:.5,ROCK:.5,GHOST:.5,STEEL:0,FAIRY:2},
    GROUND:{FIRE:2,ELECTRIC:2,GRASS:.5,POISON:2,FLYING:0,BUG:.5,ROCK:2,STEEL:2},
    FLYING:{ELECTRIC:.5,GRASS:2,FIGHTING:2,BUG:2,ROCK:.5,STEEL:.5},
    PSYCHIC:{FIGHTING:2,POISON:2,PSYCHIC:.5,DARK:0,STEEL:.5},
    BUG:{FIRE:.5,GRASS:2,FIGHTING:.5,POISON:.5,FLYING:.5,PSYCHIC:2,GHOST:.5,DARK:2,STEEL:.5,FAIRY:.5},
    ROCK:{FIRE:2,ICE:2,FIGHTING:.5,GROUND:.5,FLYING:2,BUG:2,STEEL:.5},
    GHOST:{NORMAL:0,PSYCHIC:2,GHOST:2,DARK:.5},
    DRAGON:{DRAGON:2,STEEL:.5,FAIRY:0},
    DARK:{FIGHTING:.5,PSYCHIC:2,GHOST:2,DARK:.5,FAIRY:.5},
    STEEL:{FIRE:.5,WATER:.5,ELECTRIC:.5,ICE:2,ROCK:2,STEEL:.5,FAIRY:2},
    FAIRY:{FIRE:.5,FIGHTING:2,POISON:.5,DRAGON:2,DARK:2,STEEL:.5}
  };
  const eff = (a, ds) => ds.reduce((m, d) => m * (CHART[a][d] ?? 1), 1);

  const BAD = new Set(["HYPER_BEAM","GIGA_IMPACT","EXPLOSION","SELF_DESTRUCT","MEMENTO","FINAL_GAMBIT","FOCUS_PUNCH","SKY_ATTACK","RAZOR_WIND","SKULL_BASH","DREAM_EATER","SNORE","FAKE_OUT","FIRST_IMPRESSION","FUTURE_SIGHT","DOOM_DESIRE","BELCH","SYNCHRONOISE","LAST_RESORT","MISTY_EXPLOSION","STEEL_BEAM","MIND_BLOWN","SPIT_UP","NATURAL_GIFT","FLING","ROLLOUT","ICE_BALL","UPROAR","STRUGGLE","BIDE","DIG","FLY","DIVE","BOUNCE","PHANTOM_FORCE","SHADOW_FORCE","SOLAR_BEAM_X","PRISMATIC_LASER","ETERNABEAM","ROAR_OF_TIME","BLAST_BURN","HYDRO_CANNON","FRENZY_PLANT","METEOR_ASSAULT","RAGE","THRASH_X","SELF_DESTRUCT","HEAD_SMASH_X","ECHOED_VOICE","FURY_CUTTER","SNAP_TRAP","SKY_DROP","GEOMANCY_X","CHILLY_RECEPTION","SHEER_COLD","FISSURE","GUILLOTINE","HORN_DRILL","THRASH","PETAL_DANCE","STRUGGLE_BUG"]);
  const CHARGE = new Set(["SOLAR_BEAM","SOLAR_BLADE","METEOR_BEAM","ELECTRO_SHOT","FREEZE_SHOCK","ICE_BURN"]);
  const SETUP_P = ["DRAGON_DANCE","SWORDS_DANCE","SHELL_SMASH","VICTORY_DANCE","BULK_UP","COIL","BELLY_DRUM","HONE_CLAWS","CURSE","TIDY_UP","NO_RETREAT","CLANGOROUS_SOUL","FILLET_AWAY","HOWL","WORK_UP","GROWTH"];
  const SETUP_E = ["QUIVER_DANCE","NASTY_PLOT","TAIL_GLOW","GEOMANCY","SHELL_SMASH","TAKE_HEART","CALM_MIND","CLANGOROUS_SOUL","FILLET_AWAY","WORK_UP","GROWTH"];
  const HEAL = ["RECOVER","ROOST","SLACK_OFF","SOFT_BOILED","MOONLIGHT","MORNING_SUN","SYNTHESIS","STRENGTH_SAP","SHORE_UP","MILK_DRINK","HEAL_ORDER","WISH","LUNAR_BLESSING","JUNGLE_HEALING"];

  const WEATHER = {
    sol:   { setters:["DROUGHT","ORICHALCUM_PULSE","DESOLATE_LAND"], users:["CHLOROPHYLL","SOLAR_POWER","PROTOSYNTHESIS","FLOWER_GIFT","LEAF_GUARD","HARVEST","ORICHALCUM_PULSE","FLASH_FIRE"], types:["FIRE","GRASS"], nome:"Sol" },
    chuva: { setters:["DRIZZLE","PRIMORDIAL_SEA"], users:["SWIFT_SWIM","RAIN_DISH","HYDRATION","DRY_SKIN"], types:["WATER","ELECTRIC"], nome:"Chuva" },
    areia: { setters:["SAND_STREAM","SAND_SPIT"], users:["SAND_RUSH","SAND_FORCE","SAND_VEIL"], types:["ROCK","GROUND","STEEL"], nome:"Areia" },
    neve:  { setters:["SNOW_WARNING"], users:["SLUSH_RUSH","ICE_BODY","SNOW_CLOAK","ICE_FACE"], types:["ICE"], nome:"Neve" },
    eletrico: { setters:["ELECTRIC_SURGE","HADRON_ENGINE"], users:["QUARK_DRIVE","SURGE_SURFER","HADRON_ENGINE"], types:["ELECTRIC"], nome:"Campo Elétrico" },
    psiquico: { setters:["PSYCHIC_SURGE"], users:[], types:["PSYCHIC"], nome:"Campo Psíquico" },
    grama: { setters:["GRASSY_SURGE"], users:["GRASS_PELT"], types:["GRASS"], nome:"Campo de Grama" },
    nevoa: { setters:["MISTY_SURGE"], users:[], types:["FAIRY"], nome:"Campo de Névoa" }
  };

  const title = s => s.toLowerCase().split("_").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
  const REG = { ALOLA:"de Alola", GALAR:"de Galar", HISUI:"de Hisui", PALDEA:"de Paldea" };
  function pname(k) {
    if (k === "BATTLE_BOND_GRENINJA") return "Greninja (Battle Bond)";
    if (k === "BLOODMOON_URSALUNA") return "Ursaluna Bloodmoon";
    const p = k.split("_")[0];
    if (REG[p]) return title(k.slice(p.length + 1)) + " " + REG[p];
    return title(k);
  }

  function role(st) { return st[1] >= st[3] ? "P" : "E"; }

  function natureScore(st, r, n) {
    const plus = Math.floor(n / 5), minus = n % 5;
    if (plus === minus) return 0;
    const spe = st[5] >= 80 ? 2.5 : st[5] >= 60 ? 1.2 : 0.3;
    // ordem das natures no jogo: atk, def, spe, spa, spd
    const w = [r === "P" ? 3 : 0.1, 0.8, spe, r === "E" ? 3 : 0.1, 0.8];
    return w[plus] - w[minus];
  }

  // Custo com reduções (GameData.getSpeciesStarterValue): cada redução tira 1 ponto; quem já custa 1 cai pela metade.
  function starterValue(base, vr) {
    let c = base;
    for (let v = 0; v < vr; v++) c = c > 1 ? c - 1 : c / 2;
    return c;
  }

  function buildOwned(game, unlocks) {
    const out = [];
    for (const s of game.starters) {
      const u = unlocks[s.id];
      if (!u) continue;
      const [vr, a, pa, emb, na, iv, candy] = u;
      const abil = [0, 1, 2].filter(i => (a >> i) & 1 && s.ab[i] !== "NONE").map(i => s.ab[i]);
      const uniq = [...new Set(abil)];
      const nats = []; for (let i = 0; i < 25; i++) if ((na >> (i + 1)) & 1) nats.push(i);
      const egg = s.em.filter((m, i) => m != null && (emb >> i) & 1);
      const r = role(s.st);
      let best = nats[0] ?? 0, bs = -99;
      for (const n of nats) { const v = natureScore(s.st, r, n); if (v > bs) { bs = v; best = n; } }
      const bst = s.st.reduce((x, y) => x + y, 0);
      const ivSum = iv.reduce((x, y) => x + y, 0);
      // A passiva em batalha é a da espécie atual (PokemonSpecies.getPassiveAbility): usamos a da forma final.
      // passiveStart guarda a do inicial quando é diferente, só para mostrar.
      const passive = pa & 1 ? (s.paf || s.pa) : null;
      const passiveStart = passive && s.paf ? s.pa : null;
      const score = bst + bs * 8 + (ivSum / 186) * 40 + egg.length * 8 + (passive ? 30 : 0);
      const names = new Set([...s.mv, ...egg].map(i => game.moves[i][0]));
      out.push({ k: s.k, id: s.id, name: pname(s.k), fin: pname(s.f), finKey: s.f, ty: s.ty, st: s.st, bst, cost: starterValue(s.c, vr), base: s.c, lg: s.lg,
        abil: uniq, allAb: s.ab.filter(x => x !== "NONE"), passive, passiveStart, egg, nats, nat: best, natFit: bs, iv, ivSum, role: r, mv: s.mv, score,
        ch: s.ch, et: s.et || 0, tms: tmsOf(s, game), forms: s.fo || [], candy: candy || 0, vr, paUnlocked: !!(pa & 1),
        hasSetup: (r === "P" ? SETUP_P : SETUP_E).some(n => names.has(n)), hasHeal: HEAL.some(n => names.has(n)) });
    }
    // tipos de dano dos golpes sugeridos (sem clima): usado na cobertura ofensiva do tema Equilibrado
    for (const m of out) m.cov = [...new Set(suggestMoves(m, game, null).filter(x => x.c !== "X" && x.p > 0).map(x => x.t))];
    return out;
  }

  function weatherMod(mv, ctx) {
    const [k, t] = mv;
    if (ctx === "sol") { if (t === "FIRE" || k === "HYDRO_STEAM") return 1.5; if (t === "WATER") return 0.5; }
    if (ctx === "chuva") { if (t === "WATER") return 1.5; if (t === "FIRE") return 0.5; }
    return 1;
  }

  // Valor de um golpe de dano para esse Pokémon (STAB, categoria certa, clima). null = não é golpe de dano útil.
  function moveScore(d, m, ctx) {
    const [k, t, c, p] = d;
    if (c === "X" || p <= 0 || BAD.has(k)) return null;
    let s = p * (m.ty.includes(t) ? 1.5 : 1) * (c === m.role ? 1 : 0.5) * weatherMod(d, ctx);
    if (CHARGE.has(k) && !(ctx === "sol" && (k === "SOLAR_BEAM" || k === "SOLAR_BLADE"))) s *= 0.5;
    if (p > 150) s *= 0.8;
    return s;
  }

  const TYPE_PT = { NORMAL:"Normal", FIRE:"Fogo", WATER:"Água", ELECTRIC:"Elétrico", GRASS:"Planta", ICE:"Gelo", FIGHTING:"Lutador", POISON:"Venenoso", GROUND:"Terra",
    FLYING:"Voador", PSYCHIC:"Psíquico", BUG:"Inseto", ROCK:"Pedra", GHOST:"Fantasma", DRAGON:"Dragão", DARK:"Sombrio", STEEL:"Aço", FAIRY:"Fada" };
  const TM_TIER_NOME = ["", "Comum", "Great", "Ultra"];

  // TMs que valem a pena SE aparecerem na loja: melhoram um golpe sugerido, trazem cobertura nova, ou dão setup/cura
  // a quem não tem. Devolve até n [{k, name, t, c, p, tier, tierNome, why}], do mais útil para o menos.
  function suggestTMs(m, game, ctx, n = 3) {
    const cur = suggestMoves(m, game, ctx);
    const curAtk = cur.filter(x => x.c !== "X" && x.p > 0).map(x => ({ ...x, s: moveScore([x.k, x.t, x.c, x.p], m, ctx) || 0 }));
    const hit = new Set();
    for (const x of curAtk) for (const d of TYPES) if (eff(x.t, [d]) > 1) hit.add(d);
    const known = new Set([...m.mv, ...m.egg].map(i => game.moves[i][0]));
    const curNames = new Set(cur.map(x => x.k));
    const hasSetup = cur.some(x => SETUP_P.includes(x.k) || SETUP_E.includes(x.k)), hasHeal = cur.some(x => HEAL.includes(x.k));
    const cand = [];
    for (const i of m.tms || []) {
      const d = game.moves[i], [k, t, c, p, tier] = d;
      if (known.has(k) || curNames.has(k)) continue;
      const s = moveScore(d, m, ctx);
      if (s != null) {
        const same = curAtk.filter(x => x.t === t).sort((a, b) => b.s - a.s)[0];
        if (same) {
          if (s > same.s * 1.15) cand.push({ d, v: s - same.s, why: "mais forte que " + same.name });
        } else {
          const nw = TYPES.filter(x => eff(t, [x]) > 1 && !hit.has(x));
          if (m.ty.includes(t)) cand.push({ d, v: s * 1.3, why: "golpe do tipo dele" });
          else if (nw.length) cand.push({ d, v: s * (0.6 + 0.15 * nw.length), why: "cobre " + nw.map(x => TYPE_PT[x]).join(", ") });
        }
      } else if (!hasSetup && (m.role === "P" ? SETUP_P : SETUP_E).includes(k)) cand.push({ d, v: 70, why: "setup" });
      else if (!hasHeal && HEAL.includes(k)) cand.push({ d, v: 55, why: "cura" });
    }
    cand.sort((a, b) => b.v - a.v);
    const out = [], types = new Set();
    for (const x of cand) {
      if (out.length >= n) break;
      const [k, t, c, p, tier] = x.d;
      const slot = c === "X" ? "status:" + x.why : t; // no máximo um setup e uma cura
      if (types.has(slot)) continue;
      types.add(slot);
      out.push({ k, name: title(k), t, c, p, tier, tierNome: TM_TIER_NOME[tier], why: x.why });
    }
    return out;
  }

  function suggestMoves(m, game, ctx) {
    const pool = [...new Set([...m.mv, ...m.egg])].map(i => ({ i, d: game.moves[i], egg: m.egg.includes(i) }));
    const atk = [];
    for (const x of pool) {
      let s = moveScore(x.d, m, ctx);
      if (s == null) continue;
      if (x.egg) s *= 1.05;
      atk.push({ ...x, s, t: x.d[1] });
    }
    atk.sort((a, b) => b.s - a.s);
    const pick = [];
    const used = new Set();
    // golpe do mesmo tipo pra cada tipo do Pokémon
    for (const t of m.ty) { const b = atk.find(x => x.t === t); if (b && !used.has(b.i)) { pick.push(b); used.add(b.i); } }
    // cobertura: tipo diferente que acerte o que os STAB não acertam
    const covered = new Set(pick.map(x => x.t));
    const covScore = t => TYPES.filter(d => eff(t, [d]) > 1 && ![...covered].some(c => eff(c, [d]) > 1)).length;
    const cov = atk.filter(x => !covered.has(x.t) && !used.has(x.i)).map(x => ({ ...x, cs: x.s * (1 + covScore(x.t) * 0.15) })).sort((a, b) => b.cs - a.cs);
    if (cov[0]) { pick.push(cov[0]); used.add(cov[0].i); covered.add(cov[0].t); }
    // setup ou cura
    const names = new Map(pool.map(x => [x.d[0], x]));
    const setupList = m.role === "P" ? SETUP_P : SETUP_E;
    const setup = setupList.map(n => names.get(n)).find(Boolean);
    if (setup && pick.length < 4) { pick.push(setup); used.add(setup.i); }
    const heal = HEAL.map(n => names.get(n)).find(Boolean);
    if (heal && pick.length < 4 && !setup) { pick.push(heal); used.add(heal.i); }
    for (const x of atk) { if (pick.length >= 4) break; if (!used.has(x.i) && !pick.some(p => p.t === x.t)) { pick.push(x); used.add(x.i); } }
    if (heal && pick.length < 4 && !used.has(heal.i)) { pick.push(heal); used.add(heal.i); }
    for (const x of atk) { if (pick.length >= 4) break; if (!used.has(x.i)) { pick.push(x); used.add(x.i); } }
    // Pokémon sem golpe de dano (Ditto, Smeargle): mostra os golpes de status que ele tem
    for (const x of pool) { if (pick.length >= 4) break; if (!used.has(x.i)) { pick.push(x); used.add(x.i); } }
    return pick.slice(0, 4).map(x => ({ k: x.d[0], name: title(x.d[0]), t: x.d[1], c: x.d[2], p: x.d[3], egg: x.egg }));
  }

  function setterOf(m, w) {
    const W = WEATHER[w];
    const a = m.abil.find(x => W.setters.includes(x));
    if (a) return { how: "habilidade", ab: a };
    if (m.passive && W.setters.includes(m.passive)) return { how: "passiva", ab: m.passive };
    return null;
  }
  function userOf(m, w) {
    const W = WEATHER[w];
    const a = m.abil.find(x => W.users.includes(x)) || (m.passive && W.users.includes(m.passive) ? m.passive : null);
    return a || null;
  }

  function rnd(rng) { return rng ? rng() : Math.random(); }
  function pickW(arr, wf, rng) {
    const ws = arr.map(wf); const tot = ws.reduce((a, b) => a + b, 0);
    if (!tot) return null;
    let r = rnd(rng) * tot;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const spent = team => team.reduce((a, m) => a + m.cost, 0);

  function fill(team, pool, budget, size, wf, rng) {
    while (team.length < size) {
      const left = budget - spent(team);
      const c = pool.filter(m => m.cost <= left && !team.some(t => t.k === m.k || t.finKey === m.finKey));
      if (!c.length) break;
      const p = pickW(c, wf, rng);
      if (!p) break;
      team.push(p);
    }
    return team;
  }

  function knapsack(pool, budget, size, val) {
    // maximiza a soma de val(m) (padrão: score) com até `size` membros e custo <= budget
    const V = new Map(pool.map(m => [m, (val || (x => x.score))(m)]));
    // custos podem ser 0,5 ou 0,25 (redução de quem custa 1): a tabela trabalha em quartos de ponto
    const q = c => Math.round(c * 4), B = Math.floor(budget * 4 + 1e-9), K = size;
    let dp = Array.from({ length: K + 1 }, () => Array(B + 1).fill(null));
    dp[0][0] = { s: 0, t: [] };
    for (const m of pool) {
      const nd = dp.map(r => r.slice());
      const mc = q(m.cost);
      for (let k = 0; k < K; k++) for (let b = 0; b + mc <= B; b++) {
        const cur = dp[k][b]; if (!cur) continue;
        if (cur.t.some(t => t.finKey === m.finKey)) continue;
        const v = cur.s + V.get(m); const tgt = nd[k + 1][b + mc];
        if (!tgt || tgt.s < v) nd[k + 1][b + mc] = { s: v, t: [...cur.t, m] };
      }
      dp = nd;
    }
    let best = null;
    for (const r of dp) for (const c of r) if (c && (!best || c.s > best.s)) best = c;
    return best ? best.t : [];
  }

  // ---- Defesa considerando habilidades liberadas e a passiva.
  // Otimista quando há mais de uma habilidade liberada: você escolhe uma na seleção, aqui contam todas.
  const AB_IMMUNE = { LEVITATE: "GROUND", EARTH_EATER: "GROUND", FLASH_FIRE: "FIRE", WELL_BAKED_BODY: "FIRE", WATER_ABSORB: "WATER", STORM_DRAIN: "WATER",
    DRY_SKIN: "WATER", VOLT_ABSORB: "ELECTRIC", LIGHTNING_ROD: "ELECTRIC", MOTOR_DRIVE: "ELECTRIC", SAP_SIPPER: "GRASS" };
  const AB_HALF = { THICK_FAT: ["FIRE", "ICE"], HEATPROOF: ["FIRE"], WATER_BUBBLE: ["FIRE"], PURIFYING_SALT: ["GHOST"] };
  function defMult(m, a) {
    const abs = [...(m.abil || []), m.passive].filter(Boolean);
    if (abs.some(b => AB_IMMUNE[b] === a)) return 0;
    let x = eff(a, m.ty);
    if (abs.some(b => (AB_HALF[b] || []).includes(a))) x *= 0.5;
    return x;
  }

  function teamWeak(team) {
    return TYPES.map(a => {
      const weak = team.filter(m => defMult(m, a) > 1).length;
      const res = team.filter(m => defMult(m, a) < 1).length;
      return { t: a, weak, res };
    }).filter(x => x.weak >= 2 && x.weak > x.res).sort((x, y) => (y.weak - y.res) - (x.weak - x.res));
  }

  // ---- Equilibrado: nenhum tipo acertando 3 ou mais do time sem ninguém que resista, e golpes super efetivos contra todos os tipos.
  function balanceReport(team) {
    const def = TYPES.map(a => ({ t: a, weak: team.filter(m => defMult(m, a) > 1).length, res: team.filter(m => defMult(m, a) < 1).length }));
    const hit = new Set();
    for (const m of team) for (const t of m.cov || []) for (const d of TYPES) if (eff(t, [d]) > 1) hit.add(d);
    return {
      holesDef: def.filter(x => x.weak >= 3 && x.res === 0).map(x => x.t),
      soft: def.reduce((s, x) => s + Math.max(0, x.weak - x.res - 1), 0),
      holesOff: TYPES.filter(d => !hit.has(d)),
    };
  }
  function balanceValue(team) {
    const r = balanceReport(team);
    return team.reduce((s, m) => s + m.score, 0) / 100 + 4 * team.length - 3 * r.holesDef.length - 1.2 * r.holesOff.length - 0.4 * r.soft;
  }
  // busca local: alguns recomeços, cada um trocando membros não travados enquanto melhora
  function balancedTeam(base, pool, budget, size, rng) {
    let best = null, bestV = -Infinity;
    for (let r = 0; r < 6; r++) {
      let team = fill([...base], pool, budget, size, m => Math.pow(m.score / 450, 3), rng), v = balanceValue(team);
      for (let it = 0; it < 80; it++) {
        const free = team.filter(m => !base.includes(m));
        if (!free.length) break;
        const out = free[Math.floor(rnd(rng) * free.length)];
        const rest = team.filter(m => m !== out), left = budget - spent(rest);
        const cand = pool.filter(m => m.cost <= left && !rest.some(t => t.k === m.k || t.finKey === m.finKey));
        for (let c = 0; c < 12 && cand.length; c++) {
          const t2 = [...rest, cand[Math.floor(rnd(rng) * cand.length)]], v2 = balanceValue(t2);
          if (v2 > v) { team = t2; v = v2; break; }
        }
      }
      if (v > bestV) { bestV = v; best = team; }
    }
    return best;
  }

  // ---- Formas por item (Mega, Gigantamax, Primal)
  const statSum = st => st.reduce((a, b) => a + b, 0);
  function bigForms(m) { return (m.forms || []).filter(f => f.acc).sort((a, b) => statSum(b.st) - statSum(a.st)); }
  function formText(m, f) {
    const nome = f.acc === "gmax" ? "Gigantamax" : f.n;
    const de = f.sp !== m.finKey ? ` (como ${pname(f.sp)})` : "";
    return `${nome}${de} com ${f.it}`;
  }

  // ---- Late game: o que escala no fim da run
  const SNOWBALL = ["BEAST_BOOST", "SOUL_HEART", "MOXIE", "CHILLING_NEIGH", "GRIM_NEIGH", "AS_ONE_GLASTRIER", "AS_ONE_SPECTRIER", "SPEED_BOOST", "SUPREME_OVERLORD", "SIMPLE"];
  function lateGame(m) {
    let v = m.score + Math.max(0, m.bst - 500) * 0.5;
    const why = [];
    const f = bigForms(m)[0];
    if (f) { v += 40 + Math.max(0, statSum(f.st) - m.bst) * 0.6; why.push(formText(m, f)); }
    const sb = [...m.abil, m.passive].filter(Boolean).find(a => SNOWBALL.includes(a));
    if (sb) { v += 60; why.push(title(sb) + " acumula força ao longo da luta"); }
    if (m.hasSetup && m.hasHeal) { v += 50; why.push("tem setup e cura"); } else if (m.hasSetup) { v += 25; why.push("tem setup"); }
    return { v, why };
  }

  // ---- Interações legais (curadas e conferidas no código do jogo). need(m) usa só o que está liberado no save.
  const has = (m, a) => m.abil.includes(a) || m.passive === a;
  const INTERACTIONS = [
    { k: "GIMMIGHOUL", need: m => has(m, "GOOD_AS_GOLD"), why: () => "Good as Gold: golpes de status do oponente não pegam nele, então nada de sono, Toxic ou Taunt." },
    { k: "CHERUBI", ctx: "sol", need: m => has(m, "FLOWER_GIFT") && m.passive === "DROUGHT", why: () => "A passiva Drought liga o sol sozinha e o Flower Gift aproveita: no sol o Cherrim muda de forma e aumenta Ataque e Defesa Especial dele e dos aliados." },
    { k: "KORAIDON", ctx: "sol", need: m => has(m, "ORICHALCUM_PULSE"), why: () => "Orichalcum Pulse liga o sol ao entrar e aumenta o Ataque enquanto o sol durar." },
    { k: "MIRAIDON", ctx: "eletrico", need: m => has(m, "HADRON_ENGINE"), why: () => "Hadron Engine cria Campo Elétrico ao entrar e aumenta o Ataque Especial enquanto o campo durar." },
    { k: "FINIZEN", need: m => has(m, "ZERO_TO_HERO"), why: () => "Zero to Hero: troque o Palafin uma vez na luta e ele volta na forma Hero, com total 650 em vez de 457." },
    { k: "NINCADA", need: () => true, why: () => "Evolua o Nincada no nível 20 com um espaço vazio na equipe e você ganha também um Shedinja. Com Wonder Guard, golpes que não são super efetivos não causam dano nele." },
    { k: "DITTO", need: m => has(m, "IMPOSTER"), why: () => "Imposter: ao entrar ele se transforma no oponente, copiando golpes e status." },
    { k: "SMEARGLE", need: m => m.passive === "PRANKSTER", why: () => "Sketch copia para sempre um golpe do oponente, e a passiva Prankster dá prioridade a todos os golpes de status. Dá para montar um suporte rápido com o que você copiar." },
    { k: "SLAKOTH", need: () => true, why: m => `Slaking tem total 670 custando só ${m.cost} pontos. O preço é o Truant: ele só age em turnos alternados.` },
    { k: "REGIGIGAS", need: () => true, why: () => "Total 670, mas o Slow Start corta Ataque e Velocidade pela metade nos 5 primeiros turnos em campo. Precisa de quem segure a luta enquanto ele acorda." },
    { k: "BATTLE_BOND_GRENINJA", need: m => has(m, "BATTLE_BOND"), why: () => "Battle Bond: depois de nocautear um oponente ele vira Ash Greninja, com status maiores." },
    { k: "ZYGARDE", need: m => m.abil.includes("AURA_BREAK"), why: () => "Se você tiver a forma Power Construct, escolha ela na seleção: abaixo de metade do HP ele vira Zygarde Completo, com total 708." },
    { k: "MINIOR", need: m => has(m, "SHIELDS_DOWN"), why: () => "Shields Down: acima de metade do HP fica na forma Meteoro, resistente e imune a status; abaixo disso vira Núcleo, bem mais forte e rápido." },
    { k: "WISHIWASHI", need: m => has(m, "SCHOOLING"), why: m => "Schooling: a partir do nível 20 e com mais de 1/4 do HP ele vira cardume, com total 620 em vez de 175." + (m.passive === "REGENERATOR" ? " A passiva Regenerator cura ao trocar, o que ajuda a manter o cardume." : "") },
    { k: "HONEDGE", need: m => has(m, "STANCE_CHANGE"), why: () => "Stance Change: o Aegislash vira a forma Blade (ataque alto) ao atacar e volta para a Shield (defesa alta) com King's Shield." },
    { k: "PAWNIARD", need: m => has(m, "SUPREME_OVERLORD"), why: () => "Supreme Overlord: o Kingambit bate mais forte para cada aliado desmaiado. Bom para fechar lutas difíceis." },
    { k: "CYNDAQUIL", ctx: "sol", need: m => m.finKey === "HISUI_TYPHLOSION" && m.passive === "DROUGHT", why: () => "No PokéRogue a passiva do Typhlosion de Hisui é Drought: ele liga o próprio sol e os golpes de Fogo ficam 1,5x mais fortes." },
  ];
  function interactionsFor(owned) {
    return INTERACTIONS.map(x => ({ x, m: owned.find(m => m.k === x.k) })).filter(o => o.m && o.x.need(o.m));
  }

  // ---- Desafios: uma regra sorteada entre as que dá para cumprir com o save. (Na Fase 3 o agente inventa as regras.)
  const REGION_GEN = { ALOLA: 7, GALAR: 8, HISUI: 8, PALDEA: 9 };
  function genOf(m) {
    const p = m.k.split("_")[0];
    if (REGION_GEN[p]) return REGION_GEN[p];
    const i = [151, 251, 386, 493, 649, 721, 809, 905, 1025].findIndex(x => m.id <= x);
    return i < 0 ? null : i + 1;
  }
  const CHALLENGES = [
    (owned, size, rng) => {
      const c = {}; for (const m of owned) { const l = m.fin[0].toUpperCase(); c[l] = (c[l] || 0) + 1; }
      const ls = Object.keys(c).filter(l => c[l] >= size * 2), l = ls[Math.floor(rnd(rng) * ls.length)];
      return l && { id: "letra", desc: `Todo mundo com nome começando com ${l} (nome da forma final).`, ok: m => m.fin[0].toUpperCase() === l };
    },
    (owned, size, rng) => {
      const gs = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(g => owned.filter(m => genOf(m) === g).length >= size * 2), g = gs[Math.floor(rnd(rng) * gs.length)];
      return g && { id: "geracao", desc: `Só Pokémon da geração ${g}.`, ok: m => genOf(m) === g };
    },
    (owned, size, rng) => {
      const ts = TYPES.filter(t => owned.filter(m => m.ty.includes(t)).length >= 3);
      const a = ts.splice(Math.floor(rnd(rng) * ts.length), 1)[0], b = ts[Math.floor(rnd(rng) * ts.length)];
      return a && b && { id: "duotipo", desc: `Todo mundo tem que ser do tipo ${TYPE_PT[a]} ou ${TYPE_PT[b]}.`, ok: m => m.ty.includes(a) || m.ty.includes(b) };
    },
    () => ({ id: "arcoiris", desc: "Nenhum tipo repetido: ninguém do time divide tipo com outro.", ok: (m, team) => !team.some(t => t.ty.some(x => m.ty.includes(x))) }),
    () => ({ id: "estagio", desc: "Só Pokémon que não evoluem.", ok: m => m.ch === 1 }),
    () => ({ id: "fisico", desc: "Só atacantes físicos.", ok: m => m.role === "P" }),
    () => ({ id: "especial", desc: "Só atacantes especiais.", ok: m => m.role === "E" }),
    () => ({ id: "lento", desc: "Time lento: Velocidade base até 60 em todo mundo.", ok: m => m.st[5] <= 60 }),
    () => ({ id: "baratos", desc: "Só quem custa até 2 pontos.", ok: m => m.cost <= 2 }),
  ];
  function pickChallenge(avail, size, rng) {
    const ok = CHALLENGES.map(f => f(avail, size, rng)).filter(c => c && avail.filter(m => c.ok(m, [])).length >= size);
    return ok[Math.floor(rnd(rng) * ok.length)] || null;
  }

  const THEMES = {
    lenda: "Lendário + ruins", equilibrado: "Equilibrado", late: "Late game absurdo", interacoes: "Interações legais", mega: "Mega e Gigantamax",
    sol: "Time do Sol", chuva: "Time da Chuva", areia: "Tempestade de Areia", neve: "Neve",
    mono: "Monotipo", fracos: "Só os fracos", forte: "Máximo poder", desafio: "Desafio", caos: "Caos total"
  };

  function generate(owned, opts, rng) {
    const budget = opts.budget ?? 10, size = opts.size ?? 6, theme = opts.theme || "caos";
    const locked = (opts.locked || []).map(k => owned.find(m => m.k === k)).filter(Boolean);
    let team = [...locked];
    let ctx = null, info = "", challenge = null;
    const notes = {};
    const ex = new Set(opts.exclude || []);
    const avail = owned.filter(m => !team.some(t => t.k === m.k) && !ex.has(m.k));
    if (theme === "lenda") {
      if (!team.some(m => m.lg)) {
        const L = avail.filter(m => m.lg && m.cost <= budget - spent(team));
        const l = pickW(L, m => Math.pow(m.score / 500, 6), rng);
        if (l) team.push(l); else info = "Nenhum lendário cabe no orçamento.";
      }
      fill(team, avail.filter(m => !m.lg && m.bst <= 480), budget, size, m => 1 + m.egg.length + (m.passive ? 2 : 0), rng);
    } else if (theme === "equilibrado") {
      team = balancedTeam(team, avail, budget, size, rng);
      const r = balanceReport(team);
      const d = r.holesDef.length ? `${r.holesDef.map(t => TYPE_PT[t]).join(", ")} ainda acerta 3 ou mais sem ninguém que resista` : "nenhum tipo acerta 3 ou mais sem alguém que resista";
      const o = r.holesOff.length ? `faltam golpes super efetivos contra ${r.holesOff.map(t => TYPE_PT[t]).join(", ")}` : "tem golpe super efetivo contra todos os tipos";
      info = `Defesa: ${d}. Ataque: ${o}.`;
    } else if (theme === "late") {
      const left = budget - spent(team);
      const lg = new Map(avail.map(m => [m, lateGame(m)]));
      // um pouco de sorte para não sair sempre o mesmo time
      team = team.concat(knapsack(avail.filter(m => !team.some(t => t.finKey === m.finKey)), left, size - team.length, m => lg.get(m).v * (0.9 + 0.2 * rnd(rng))));
      for (const m of team) { const w = (lg.get(m) || lateGame(m)).why; if (w.length) notes[m.k] = w.join(" · "); }
      info = "Pensado para o fim da run: total alto, Mega ou Gigantamax, habilidades que acumulam e setup com cura.";
    } else if (theme === "interacoes") {
      const opt = interactionsFor(avail);
      if (!opt.length) info = "Nenhuma interação da lista está liberada no seu save ainda.";
      for (let n = 0; n < 2 && opt.length; n++) {
        const i = Math.floor(rnd(rng) * opt.length), o = opt.splice(i, 1)[0];
        if (o.m.cost > budget - spent(team) || team.length >= size || team.some(t => t.finKey === o.m.finKey)) continue;
        team.push(o.m); notes[o.m.k] = o.x.why(o.m); if (o.x.ctx && !ctx) ctx = o.x.ctx;
      }
      for (const o of interactionsFor(team)) if (!notes[o.m.k]) notes[o.m.k] = o.x.why(o.m);
      fill(team, avail, budget, size, m => Math.pow(m.score / 450, 3) * (ctx && userOf(m, ctx) ? 4 : 1), rng);
    } else if (theme === "mega") {
      const pool = avail.filter(m => bigForms(m).length);
      fill(team, pool, budget, size, m => Math.pow(statSum(bigForms(m)[0].st) / 500, 4) * Math.pow(m.score / 450, 2), rng);
      info = "Megas precisam do Mega Bracelet e Gigantamax do Dynamax Band. Até 31/12/2026 um evento dá os dois na wave 115 do Clássico; fora disso eles saem na loja, raridade Rogue, e as pedras só aparecem se alguém do time puder usar.";
      if (!pool.length) info = "Nenhum inicial seu tem Mega ou Gigantamax.";
    } else if (WEATHER[theme]) {
      ctx = theme;
      if (!team.some(m => setterOf(m, theme))) {
        const st = avail.filter(m => setterOf(m, theme) && m.cost <= budget - spent(team));
        const s = pickW(st, m => m.score, rng);
        if (s) team.push(s); else info = "Você ainda não tem quem ative " + WEATHER[theme].nome + " (habilidade ou passiva desbloqueada).";
      }
      const W = WEATHER[theme];
      const pool = avail.filter(m => userOf(m, theme) || m.ty.some(t => W.types.includes(t)));
      fill(team, pool, budget, size, m => (userOf(m, theme) ? 6 : 1) * Math.pow(m.score / 450, 3), rng);
    } else if (theme === "mono") {
      const types = TYPES.filter(t => owned.filter(m => m.ty.includes(t)).length >= 5);
      const t = opts.monoType || types[Math.floor(rnd(rng) * types.length)];
      info = t;
      fill(team, avail.filter(m => m.ty.includes(t)), budget, size, m => Math.pow(m.score / 450, 3) / (1 + m.cost * 0.2), rng);
    } else if (theme === "fracos") {
      fill(team, avail.filter(m => m.bst < 500), budget, size, m => 1 + m.egg.length, rng);
    } else if (theme === "forte") {
      const left = budget - spent(team);
      team = team.concat(knapsack(avail.filter(m => !team.some(t => t.finKey === m.finKey)), left, size - team.length));
    } else if (theme === "desafio") {
      challenge = opts.challenge || pickChallenge(avail, size, rng);
      if (!challenge) info = "Nenhum desafio da lista cabe no seu save.";
      else {
        // um por vez, porque algumas regras dependem de quem já entrou (Nenhum tipo repetido). O guloso pode travar
        // cedo, então tenta algumas vezes e fica com o time mais cheio (e, empatando, o de maior score).
        let best = team;
        for (let a = 0; a < 25 && best.length < size; a++) {
          const t = [...locked];
          while (t.length < size) {
            const left = budget - spent(t);
            const c = avail.filter(m => m.cost <= left && !t.some(x => x.k === m.k || x.finKey === m.finKey) && challenge.ok(m, t));
            const p = pickW(c, m => Math.pow(m.score / 450, 3), rng);
            if (!p) break;
            t.push(p);
          }
          const sc = x => x.length * 1e4 + x.reduce((s, m) => s + m.score, 0);
          if (sc(t) > sc(best)) best = t;
        }
        team = best;
        info = "Desafio: " + challenge.desc;
      }
    } else {
      fill(team, avail, budget, size, () => 1, rng);
    }
    return { team, ctx: ctx || null, info, cost: spent(team), notes, challenge };
  }

  // ---- Acessores dos dados da Fase 1 (TMs, doces, biomas). Regras conferidas no código do jogo.

  // TMs que a linha aprende, como índices em game.moves (o tier da loja está em game.moves[i][4]: 1 comum, 2 ótimo, 3 ultra).
  // s.tm é um bitset em hexadecimal sobre game.tms: o caractere c guarda os TMs c*4..c*4+3, bit menos significativo primeiro.
  function tmsOf(s, game) {
    const out = [], hex = s.tm || "";
    for (let c = 0; c < hex.length; c++) {
      const v = parseInt(hex[c], 16);
      for (let b = 0; b < 4; b++) if ((v >> b) & 1) out.push(game.tms[c * 4 + b]);
    }
    return out;
  }

  // Doces por custo ORIGINAL do inicial (src/data/balance/starters.ts): passiva, as duas reduções de custo e o ovo.
  function candyCosts(baseCost, game) {
    const r = game.candy[baseCost - 1];
    return r ? { passiva: r[0], reducao: [r[1], r[2]], ovo: r[3] } : null;
  }

  const WILD_TIERS = ["COMMON", "UNCOMMON", "RARE", "SUPER_RARE", "ULTRA_RARE"];
  const BOSS_TIERS = ["BOSS", "BOSS_RARE", "BOSS_SUPER_RARE", "BOSS_ULTRA_RARE"];
  const TIMES = ["DAWN", "DAY", "DUSK", "NIGHT"];

  // Chance de cada espécie num encontro do bioma: {SPECIES: prob}. Sem sorte e sem eventos.
  // Como o jogo faz (Arena.randomSpecies): sorteia o tier, tier vazio cai para o de baixo, depois sorteio uniforme
  // dentro do pool (ALL + horário). Sem `time`, faz a média dos quatro horários.
  // Não modela: lendários rerrolados antes da wave 55 (ou 80 se BST >= 660) e a evolução pelo nível do selvagem.
  function biomeOdds(biomes, key, time, boss) {
    const b = biomes.biomes.find(x => x.k === key);
    if (!b) return null;
    if (!time) {
      const acc = {};
      for (const t of TIMES) for (const [s, p] of Object.entries(biomeOdds(biomes, key, t, boss))) acc[s] = (acc[s] || 0) + p / TIMES.length;
      return acc;
    }
    const tiers = boss ? BOSS_TIERS : WILD_TIERS, out = {};
    const pool = j => [...((b.pool[tiers[j]] || {}).ALL || []), ...((b.pool[tiers[j]] || {})[time] || [])];
    tiers.forEach((t, i) => {
      const [n, d] = biomes.tierOdds[t];
      let j = i;
      while (j > 0 && !pool(j).length) j--;
      const sp = pool(j);
      for (const s of sp) out[s] = (out[s] || 0) + n / d / sp.length;
    });
    return out;
  }

  // Próximo bioma a partir de `key` (SelectBiomePhase). Link sem peso sempre aparece; link [X, n] aparece com chance 1/n.
  // Com Map você escolhe entre os que apareceram; sem Map o jogo sorteia um deles.
  // Devolve [{k, nome, aparece, semMap}]: aparece = chance de estar disponível, semMap = chance de cair nele sem Map.
  function nextBiomeOdds(biomes, key) {
    const b = biomes.biomes.find(x => x.k === key);
    if (!b || !b.links.length) return [];
    const nome = k => (biomes.biomes.find(x => x.k === k) || {}).nome || k;
    if (b.links.length === 1) return [{ k: b.links[0][0], nome: nome(b.links[0][0]), aparece: 1, semMap: 1 }];
    const res = b.links.map(([k, n]) => ({ k, nome: nome(k), aparece: 1 / n, semMap: 0 }));
    const opt = b.links.map((l, i) => i).filter(i => b.links[i][1] > 1);
    for (let mask = 0; mask < (1 << opt.length); mask++) {
      let p = 1;
      const avail = b.links.map((l, i) => i).filter(i => b.links[i][1] === 1);
      opt.forEach((i, bit) => {
        const q = 1 / b.links[i][1];
        if ((mask >> bit) & 1) { p *= q; avail.push(i); } else p *= 1 - q;
      });
      for (const i of avail) res[i].semMap += p / avail.length;
    }
    return res;
  }

  // ---- Fase 4: rota de biomas

  // Conjuntos de próximos biomas que podem aparecer a partir de b, com a chance de cada um (SelectBiomePhase):
  // link sem peso sempre aparece, link [X, n] aparece com chance 1/n.
  function linkOutcomes(b) {
    if (!b.links.length) return [];
    if (b.links.length === 1) return [{ p: 1, avail: [b.links[0][0]] }];
    const fixed = b.links.filter(l => l[1] === 1).map(l => l[0]), opt = b.links.filter(l => l[1] > 1), out = [];
    for (let mask = 0; mask < (1 << opt.length); mask++) {
      let p = 1; const avail = [...fixed];
      opt.forEach(([k, n], bit) => { if ((mask >> bit) & 1) { p *= 1 / n; avail.push(k); } else p *= 1 - 1 / n; });
      if (avail.length) out.push({ p, avail });
    }
    return out;
  }

  // Chance de chegar ao bioma alvo em até `steps` trocas, para cada bioma de partida ({BIOMA: prob}).
  // Com Map o jogador escolhe o melhor link que apareceu; sem Map o jogo sorteia entre os que apareceram.
  function reachTable(biomes, target, steps, hasMap) {
    const keys = biomes.biomes.map(b => b.k);
    const outs = Object.fromEntries(biomes.biomes.map(b => [b.k, linkOutcomes(b)]));
    let V = Object.fromEntries(keys.map(k => [k, k === target ? 1 : 0]));
    for (let s = 0; s < steps; s++) {
      const N = {};
      for (const k of keys) {
        if (k === target) { N[k] = 1; continue; }
        let v = 0;
        for (const o of outs[k]) v += o.p * (hasMap ? Math.max(...o.avail.map(x => V[x])) : o.avail.reduce((a, x) => a + V[x], 0) / o.avail.length);
        N[k] = v;
      }
      V = N;
    }
    return V;
  }

  // Trocas de bioma que ainda dá para fazer no Clássico a partir da wave atual: o jogo muda de bioma depois das waves
  // 10, 20, ..., 180; depois da 190 ele força o END (SelectBiomePhase).
  function switchesLeft(wave) {
    let n = 0;
    for (let m = 10; m <= 180; m += 10) if (m >= wave) n++;
    return n;
  }

  // menor número de trocas até o alvo, se todos os links aparecessem
  function minSwitches(biomes, from, target) {
    const B = Object.fromEntries(biomes.biomes.map(b => [b.k, b]));
    const dist = { [from]: 0 }, q = [from];
    while (q.length) { const c = q.shift(); if (c === target) return dist[c]; for (const [n] of B[c].links) if (!(n in dist)) { dist[n] = dist[c] + 1; q.push(n); } }
    return null;
  }

  // Plano para ir de `from` até `target` em até `steps` trocas.
  // next: para cada link de `from`, a chance de aparecer e a chance de chegar ao alvo se você for por ele.
  // path: caminho ideal escolhendo sempre o melhor link (supõe que os links com peso apareçam).
  function planRoute(biomes, from, target, steps, hasMap) {
    const B = Object.fromEntries(biomes.biomes.map(b => [b.k, b]));
    if (!B[from] || !B[target]) return null;
    const chance = reachTable(biomes, target, steps, hasMap)[from];
    const after = steps > 0 ? reachTable(biomes, target, steps - 1, hasMap) : null;
    const next = after ? nextBiomeOdds(biomes, from).map(x => ({ ...x, chance: after[x.k] })) : [];
    // tabelas por horizonte; no empate de chance, vence quem chega mais cedo (maior soma das chances nos horizontes menores)
    const tabs = Array.from({ length: Math.max(steps, 0) }, (_, h) => reachTable(biomes, target, h, hasMap));
    const early = (b, s) => tabs.slice(0, s).reduce((a, T) => a + T[b], 0);
    const path = [from];
    let cur = from;
    for (let s = steps; s > 0 && cur !== target; s--) {
      const T = tabs[s - 1], opts = B[cur].links.map(l => l[0]);
      if (!opts.length) break;
      cur = opts.reduce((a, b) => (T[b] > T[a] + 1e-12 || (Math.abs(T[b] - T[a]) <= 1e-12 && early(b, s) > early(a, s)) ? b : a));
      path.push(cur);
    }
    return { chance, next, path, min: minSwitches(biomes, from, target) };
  }

  // Onde caçar um Pokémon: biomas em que ele ou uma pré evolução aparece, com a chance por batalha, a chance de ver
  // pelo menos um durante uma passagem de 10 waves, e a de chegar lá a tempo. Aproximação: 9 batalhas comuns
  // (cada uma vira treinador com 1/trainerChance) e 1 chefe por passagem; não conta sorte, eventos nem o reroll de
  // lendários antes da wave 55 (80 com total 660 ou mais).
  function huntSpecies(biomes, prevo, key, from, steps, hasMap) {
    const line = [key];
    while (prevo[line[line.length - 1]]) line.push(prevo[line[line.length - 1]]);
    const out = [];
    for (const b of biomes.biomes) {
      const wild = biomeOdds(biomes, b.k), boss = b.pool.BOSS ? biomeOdds(biomes, b.k, null, true) : {};
      const pw = line.reduce((s, k) => s + (wild[k] || 0), 0), pb = line.reduce((s, k) => s + (boss[k] || 0), 0);
      if (!pw && !pb) continue;
      const battles = 9 * (b.trainerChance ? 1 - 1 / b.trainerChance : 1);
      const stay = 1 - Math.pow(1 - pw, battles) * (1 - pb);
      // o END não tem link de entrada: no Clássico o jogo leva todo mundo para lá depois da wave 190
      const reach = from === b.k || b.k === "END" ? 1 : reachTable(biomes, b.k, steps, hasMap)[from];
      out.push({ k: b.k, nome: b.nome, formas: line.filter(k => wild[k] || boss[k]), porBatalha: pw, chefe: pb, passagem: stay, chegar: reach, total: stay * reach });
    }
    return out.sort((a, b) => b.total - a.total || b.passagem - a.passagem);
  }

  // ---- Fase 5: caçador de desbloqueios

  // src/data/balance/rates.ts: ovo da mesma espécie tem 1/x de egg move raro (x pelo tier do ovo da espécie) e
  // (1 - 1/x)/3 para cada comum; habilidade oculta com 1/8.
  const BOOSTED_RARE_EGGMOVE = [12, 8, 6, 4], SAME_SPECIES_HA = 8;
  function eggOdds(m, s, game) {
    const x = BOOSTED_RARE_EGGMOVE[s.et || 0], pIdx = i => (i === 3 ? 1 / x : (1 - 1 / x) / 3);
    const missing = [0, 1, 2, 3].filter(i => s.em[i] != null && !m.egg.includes(s.em[i]))
      .map(i => ({ i, k: game.moves[s.em[i]][0], rare: i === 3, p: pIdx(i) }));
    const ha = s.ab[2] && s.ab[2] !== "NONE" && !m.abil.includes(s.ab[2]) ? s.ab[2] : null;
    return { missing, pMove: missing.reduce((a, x) => a + x.p, 0), ha, pHa: ha ? 1 / SAME_SPECIES_HA : 0 };
  }

  // Lista do que vale farmar, da maior prioridade para a menor. tipo: passiva, custo, ovo, nature.
  // ganho está na escala do score (passiva liberada = +30, egg move = +8, nature = +8 por ponto de encaixe).
  // prioridade = ganho x força relativa do Pokémon / (1 + doces que faltam / 10)
  function farmTargets(owned, game) {
    const S = new Map(game.starters.map(s => [s.k, s])), out = [];
    for (const m of owned) {
      const s = S.get(m.k), cc = candyCosts(m.base, game);
      if (!s || !cc) continue;
      const rel = Math.pow(m.score / 550, 3);
      // nature não custa doce, mas depende de sorte (capturar ou chocar com a nature certa): conta como esforço de ~20
      // doces, e o dobro para lendários e míticos, que quase não aparecem selvagens
      const add = (tipo, ganho, need, extra) => {
        const falta = need == null ? null : Math.max(0, need - m.candy);
        const esforco = need == null ? 20 * (m.lg ? 2 : 1) : falta;
        out.push({ k: m.k, pokemon: m.fin, inicial: m.name, tipo, ganho, doces: m.candy, custoDoces: need, falta,
          prioridade: ganho * rel / (1 + esforco / 10), ...extra });
      };
      const pFinal = s.paf || s.pa;
      if (!m.paUnlocked && pFinal) {
        const liga = Object.keys(WEATHER).find(w => WEATHER[w].setters.includes(pFinal));
        add("passiva", 30 + (liga ? 15 : 0), cc.passiva, { passiva: pFinal, ...(liga ? { liga: WEATHER[liga].nome } : {}) });
      }
      if (m.vr < 2) add("custo", 12 * m.score / 500 * (m.cost > 1 ? 1 : 0.5), cc.reducao[m.vr], { de: m.cost, para: starterValue(m.base, m.vr + 1) });
      const e = eggOdds(m, s, game);
      if (e.missing.length || e.ha) add("ovo", 8 * e.pMove + 12 * e.pHa, cc.ovo, { eggMoves: e.missing, chanceEggMove: e.pMove, oculta: e.ha, chanceOculta: e.pHa });
      let best = m.natFit;
      const fits = [];
      for (let n = 0; n < 25; n++) { const v = natureScore(m.st, m.role, n); if (v > m.natFit + 0.5) fits.push([n, v]); if (v > best) best = v; }
      if (fits.length) add("nature", 8 * (best - m.natFit), null, { natures: fits.sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => NATS[x[0]]) });
    }
    return out.sort((a, b) => b.prioridade - a.prioridade);
  }

  // Ficha de um inicial, no espírito do menu de doces do jogo: o que já está liberado, o que os doces compram e as
  // chances do ovo. sim = { candy, vr, passive, eggs } simula compras sem mexer no save.
  const STAT5 = ["Atk", "Def", "Vel", "SpA", "SpD"];
  function starterSheet(m, game, sim) {
    sim = sim || {};
    const s = game.starters.find(x => x.k === m.k), cc = candyCosts(m.base, game);
    const candy = sim.candy ?? m.candy, vr = sim.vr ?? m.vr, pa = sim.passive ?? m.paUnlocked, eggs = sim.eggs || 0;
    const pFinal = s.paf || s.pa, e = eggOdds(m, s, game);
    const passos = [];
    if (cc) {
      passos.push({ tipo: "passiva", passiva: pFinal, custo: cc.passiva, feito: pa, pode: !pa && candy >= cc.passiva });
      passos.push(vr < 2
        ? { tipo: "custo", de: starterValue(m.base, vr), para: starterValue(m.base, vr + 1), custo: cc.reducao[vr], feito: false, pode: candy >= cc.reducao[vr], n: vr + 1 }
        : { tipo: "custo", de: starterValue(m.base, vr), para: null, custo: null, feito: true, pode: false, n: 2 });
      passos.push({ tipo: "ovo", custo: cc.ovo, feito: false, pode: candy >= cc.ovo, util: e.missing.length > 0 || !!e.ha });
    }
    const slots = ["Habilidade 1", "Habilidade 2", "Oculta"];
    const habilidades = s.ab.map((k, i) => ({ k, slot: slots[i], liberada: m.abil.includes(k) })).filter(x => x.k !== "NONE");
    const eggMoves = s.em.map((id, i) => {
      if (id == null) return null;
      const d = game.moves[id], miss = e.missing.find(x => x.i === i);
      return { k: d[0], t: d[1], c: d[2], p: d[3], rare: i === 3, liberado: !miss, chance: miss ? miss.p : 0 };
    }).filter(Boolean);
    const natures = NATS.map((nome, i) => {
      const plus = Math.floor(i / 5), minus = i % 5;
      const fit = natureScore(m.st, m.role, i);
      return { i, nome, mais: plus === minus ? null : STAT5[plus], menos: plus === minus ? null : STAT5[minus], fit,
        liberada: m.nats.includes(i), melhor: i === m.nat, vale: !m.nats.includes(i) && fit > m.natFit + 0.5 };
    });
    return {
      k: m.k, nome: m.fin, inicial: m.name, ty: m.ty, lg: m.lg, st: m.st, bst: m.bst, iv: m.iv, ivSum: m.ivSum,
      doces: candy, base: m.base, custo: starterValue(m.base, vr), passos,
      passiva: { final: pFinal, inicial: s.paf ? s.pa : null, liberada: pa },
      habilidades, eggMoves, natures,
      ovo: { comprados: eggs, chanceEggMove: e.pMove, chanceOculta: e.pHa, oculta: e.ha,
        // pelo menos um sucesso nos ovos comprados (o primeiro sucesso já basta)
        algumEggMove: 1 - Math.pow(1 - e.pMove, eggs), algumaOculta: 1 - Math.pow(1 - e.pHa, eggs) },
      score: m.score - (m.passive ? 30 : 0) + (pa ? 30 : 0),
    };
  }
  // aplica uma compra na simulação; devolve a simulação nova ou null se não dá
  function sheetBuy(m, game, sim, tipo) {
    const sh = starterSheet(m, game, sim), p = sh.passos.find(x => x.tipo === tipo);
    if (!p || !p.pode) return null;
    const n = { candy: sh.doces - p.custo, vr: sim.vr ?? m.vr, passive: sim.passive ?? m.paUnlocked, eggs: sim.eggs || 0 };
    if (tipo === "passiva") n.passive = true;
    if (tipo === "custo") n.vr++;
    if (tipo === "ovo") n.eggs++;
    return n;
  }

  const api = { NATS, starterValue, starterSheet, sheetBuy, TYPES, TYPE_PT, CHART, eff, buildOwned, suggestMoves, suggestTMs, generate, teamWeak, THEMES, WEATHER, title, pname, setterOf, userOf,
    defMult, balanceReport, lateGame, bigForms, formText, INTERACTIONS, interactionsFor, CHALLENGES, genOf,
    tmsOf, candyCosts, biomeOdds, nextBiomeOdds, linkOutcomes, reachTable, switchesLeft, minSwitches, planRoute, huntSpecies, eggOdds, farmTargets };
  if (typeof module !== "undefined") module.exports = api; else root.PRL = api;
})(this);
