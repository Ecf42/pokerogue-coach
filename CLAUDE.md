# PokéRogue Coach

App pessoal do Eric para o PokéRogue (pokerogue.net): monta times iniciais criativos com o que ele já desbloqueou e, na próxima fase, vira um agente que dá conselhos durante a run.

## Como o projeto funciona

* **Claude Code faz o trabalho pesado** aqui no repositório: extração de dados, lógica, testes e build.
* **O app roda no claude.ai** como artifact (página publicada). O build gera um único `dist/index.html`, que o Eric leva para o chat do claude.ai para publicar no artifact existente.
* Artifact atual: https://claude.ai/artifact/4LgQ81Jofa752d1zWJb6ro (v3 publicada em 18/11/2026 direto do Claude Code com a ferramenta Artifact, `url` desse link e `capabilities: {sample: {images: true}}`). Dá para republicar daqui assim, sem levar o arquivo ao chat.
* O agente usa a capability `sample` do runtime de artifacts: a página chama o Claude no plano do próprio usuário, sem chave de API. Detalhes em `docs/sample-capability.md`. Ler antes de mexer no agente.

## Restrições da página (valem para tudo que for para `dist/index.html`)

* Um único arquivo HTML, com dados, CSS e JS embutidos.
* Scripts externos só de `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `unpkg.com`. Fontes só do Google Fonts.
* `fetch` para outros sites é bloqueado. Imagens remotas não carregam (só `data:` e `blob:`). Por isso não tem sprite: usamos bolinhas com as cores dos tipos.
* `alert`, `confirm`, `prompt`, `window.print` e downloads iniciados pela página não funcionam. Diálogos têm que ser da própria página; para exportar, botão de Copiar.
* `localStorage` pode falhar: sempre com try/catch, e só para conveniência (o save carregado fica lá).
* Tamanho atual ~560 KB (gamedata ~310 KB, dex ~70 KB, biomas ~36 KB). Limite do artifact é 16 MB, mas manter enxuto.

## Estrutura

```
scripts/extract_game_data.py   gera data/gamedata.json, data/biomes.json e data/dex.json a partir do código do PokéRogue
scripts/decrypt_save.py        .prsv -> JSON
scripts/save_unlocks.py        data.json -> desbloqueios compactos (fixtures/mysave_unlocks.json)
scripts/build_page.py          src/ + data/ + fixtures/ -> dist/index.html
src/logic.js                   lógica do gerador (roda no navegador e no node)
src/agent.js                   agente: ferramentas, instruções, leitura de sessão e histórico (navegador e node)
src/template.html              UI (placeholders __GAME__, __BIOMES__, __DEX__, __UNLOCKS__, __LABEL__, __LOGIC__, __AGENT__)
tests/test_logic.js            node tests/test_logic.js (gerador de times)
tests/test_data.js             node tests/test_data.js (dados extraídos e acessores tmsOf, candyCosts, biomeOdds, nextBiomeOdds)
tests/test_agent.js            node tests/test_agent.js (ferramentas do agente, sessão e histórico sintéticos)
tests/test_routes.js           node tests/test_routes.js (rota de biomas e caça)
tests/test_farm.js             node tests/test_farm.js (caçador de desbloqueios)
docs/sample-capability.md      API para chamar o Claude de dentro da página
fixtures/                      saves do Eric (os .prsv ficam fora do git)
```

Fluxo: `python scripts/extract_game_data.py` (quando o jogo atualizar), `node tests/test_data.js`, `node tests/test_logic.js`, `node tests/test_agent.js`, `node tests/test_routes.js`, `node tests/test_farm.js`, `python scripts/build_page.py`.

## Fonte dos dados

* Sempre o código do jogo: https://github.com/pagefaultgames/pokerogue. Sites como pokeroguedex.com estão desatualizados (ex.: os pools da Ice Cave mudaram).
* O script faz clone sparse em `.cache/pokerogue` (`src/data`, `src/enums`) e em `.cache/pokerogue-locales` (`en`, `pt-BR`: nomes dos biomas, nome e descrição das habilidades, nomes dos itens). O commit do jogo usado fica em `src` dos dois JSON.
* Arquivos úteis no repo do jogo:
  * `src/data/balance/species/generation-0X.ts`: status, tipos, habilidades, custo de inicial (`starterCost`), passiva (às vezes por índice de forma), evoluções, golpes por nível, `tms`, `forms` (status de cada forma) e `formChanges` (gatilhos, inclusive por item)
  * `src/data/balance/moves/egg-moves.ts`: os 4 egg moves de cada inicial (a ordem importa, ver bits abaixo)
  * `src/data/moves/move.ts`: tipo, categoria e poder dos golpes
  * `src/data/balance/biomes/*.ts`: pools por raridade e horário, treinadores, clima, e os links entre biomas
  * `src/data/balance/tm-pool-tiers.ts`: tier de loja de cada TM. TMs de uma espécie = as dela mais as das pré evoluções (`SpeciesDataRegistry.getTms`)
  * `src/enums/form-change-item.ts`: itens de forma. Valor < 150 vai para o pool Rogue (`RARE_FORM_CHANGE_ITEM`: Megas, orbes, Max Mushrooms, Reveal Glass...), o resto para o Ultra (placas, memórias, drives, Gracidea...). Mega/Primal exigem Mega Bracelet; Gmax exige Dynamax Band (`modifier/modifier-type.ts`)
  * `src/data/balance/starters.ts`: doces para passiva, as duas reduções de custo e o ovo, por custo original do inicial
  * `src/data/challenge.ts`: regras de desafio e de pontos
  * `src/enums/`: SpeciesId, MoveId, AbilityId, BiomeId etc. O parser de enum em `extract_game_data.py` resolve valores explícitos

## Formato do save

`.prsv` = `CryptoJS.AES.encrypt(json, "x0i2O7WRiANTqPmZ")` (OpenSSL "Salted__", KDF MD5, AES-256-CBC). A chave é pública e igual para todo mundo. No navegador: `CryptoJS.AES.decrypt(txt, chave).toString(CryptoJS.enc.Utf8)`.

**data (save principal)**: `trainerId, secretId, gender, dexData, starterData, gameStats, unlocks, achvUnlocks, voucherUnlocks, voucherCounts, eggs, gameVersion, timestamp, eggPity, unlockPity`

* `dexData[speciesId]`: `$sa` seen attr, `$ca` caught attr (0 = não capturado), `$na` natureAttr, `$s` vistos, `$c` capturados, `$hc` chocados, `$i` IVs (6 números)
* `starterData[speciesId]`: `$m` moveset salvo, `$em` eggMoves, `$x` doces, `$f` amizade, `$a` abilityAttr, `$pa` passiveAttr, `$vr` valueReduction, `$wc` vitórias no Clássico
* O jogo também pode exportar com nomes completos (`caughtAttr`, `natureAttr`...). O app aceita os dois.

Bits:
* `natureAttr`: nature `n` desbloqueada se `(na >> (n + 1)) & 1`
* Ordem das natures no enum: `nature = plus*5 + minus` sobre **[atk, def, spe, spa, spd]** (não é a ordem dos status base!). Ex.: Adamant = 3 = +atk −spa, Timid = 10 = +spe −atk
* `abilityAttr`: bit 0 habilidade 1, bit 1 habilidade 2, bit 2 oculta (o slot vale para a forma final)
* `passiveAttr`: bit 0 desbloqueada, bit 1 ligada
* `eggMoves`: bit `i` = egg move de índice `i` em `egg-moves.ts`
* custo real = `starterCost - valueReduction`

**runHistoryData**: `{timestamp: {entry, isVictory, isFavorite}}`. `entry` é a sessão: `gameMode, party[], enemyParty[], modifiers[], waveIndex, arena, pokeballCounts, money, score, playTime, trainer...`. Cada membro da party tem `species, formIndex, level, abilityIndex, passive, nature, ivs, stats, moveset[{moveId}]`. Os ids são numéricos (usar os enums).

## Formato dos dados extraídos

**data/gamedata.json**: `src` (commit do jogo), `starters`, `moves`, `tms`, `abilities`, `candy`.
* `moves[i]` = `[nome, tipo, categoria P/E/X, poder, tier de TM]` (tier 0 = não é TM, 1 comum, 2 ótimo, 3 ultra)
* `starters[]`: `k` inicial, `id`, `f` forma final (maior BST, primeiro em empate), `ty`, `st`, `ab`, `pa`, `paf`, `em`, `c`, `lg`, `mv`, `ch`, `tm`, `fo`
  * `tm`: bitset hexadecimal sobre `tms` (ler com `L.tmsOf(s, GAME)`). TMs da linha toda, só os implementados e com tier
  * `fo`: formas por item de qualquer ramo da linha. `sp` espécie que usa, `n` nome, `k` formKey, `it` item, `rare`, `acc` (`mega`, `gmax` ou null), `ty`, `st`, `ab`, `pa`, `de` (forma de origem, se não for a padrão)
* `abilities[KEY]` = `[nome, descrição pt-BR]`, só as que aparecem nos iniciais e formas
* `candy[custo-1]` = `[passiva, redução 1, redução 2, ovo]` (ler com `L.candyCosts(custoOriginal, GAME)`)

**data/biomes.json**: `src`, `tierOdds` (`[n, d]` por tier), `biomes[]` com `k`, `nome`, `links` (`[bioma, n]`: aparece com chance 1/n), `trainerChance` (1 em n, 0 = nunca), `weather`, `terrain` (pesos), `pool[tier][horário]` e `trainers[tier]`.
* Selvagem: comum 356/512, incomum 124, raro 26, super raro 5, ultra raro 1. Chefe: 44/64, 14, 5, 1. Tier vazio cai para o de baixo; depois sorteio uniforme no pool `ALL` + horário. `L.biomeOdds` calcula por espécie.
* Próximo bioma: com Map você escolhe entre os links que apareceram; sem Map é sorteio entre eles. `L.nextBiomeOdds` calcula as duas coisas.

## Regras do Clássico que a lógica respeita

* Até 6 iniciais, soma de custos até 10 pontos (o app permite mudar o orçamento para desafios).
* Uma espécie por linha evolutiva.
* Mega Bracelet e Dynamax Band normalmente saem na loja (raridade Rogue). A wave 115 do Clássico só dá os dois durante eventos (`timed-events.ts`, `classicWaveRewards`); o evento atual vai de 17/07 a 31/12/2026. Itens de forma só aparecem se alguém do time puder usar: pedras de Mega, orbes e Max Mushrooms são raridade Rogue (`rare: 1` nos dados); placas, memórias, drives e similares são Ultra.
* A passiva em batalha é a da espécie e forma atuais, não a do inicial: Charmander tem Sheer Force, mas o Charizard usa Battle Bond e a Mega Y usa Turboblaze. Nos dados: `pa` (inicial), `paf` (forma final, quando difere) e `pa` de cada forma em `fo`.
* O rival final usa Rayquaza (Air Lock anula clima enquanto ele está em campo). Eternatus é o chefe final da wave 200.

## Convenções

* UI e textos em português do Brasil, linguagem natural. **Nunca usar travessão ou hífen como pontuação** nos textos do app ou nas respostas do agente.
* Nomes de golpes, habilidades, natures e itens em inglês, como aparecem no jogo. Tipos em português (Fogo, Água...).
* `src/logic.js` não pode depender do DOM: tem que rodar no node para os testes.
* Toda mudança na lógica ganha teste em `tests/`. Antes de entregar, rodar os testes e fazer o build. Tirar print do `dist/index.html` em 420px de largura (o Eric usa muito no celular) e conferir. Sem Playwright, dá com o Edge headless (`msedge --headless=new --screenshot --window-size=420,3000`), mas ele não desce de ~490px de viewport: colocar a página num `<iframe>` de 420px e fotografar o wrapper.

## Estado atual (v5)

Abas Gerar, Lendas, Coleção, Farm, Rotas e Coach. Temas: Lendário + ruins, Equilibrado, Late game absurdo, Interações legais, Mega e Gigantamax, Sol, Chuva, Areia, Neve, Monotipo, Só os fracos, Máximo poder (mochila 0/1 por score), Desafio, Caos. Para cada membro: melhor nature desbloqueada, habilidades e passiva liberadas (a da forma final, com a do inicial embaixo quando muda), 4 golpes sugeridos (só golpes por nível e egg moves liberados), até 3 TMs "se aparecerem" com tier e motivo, formas Mega/Gmax, o porquê do membro no tema, status, IVs, travar e trocar membro, fraquezas repetidas do time (considerando habilidades como Levitate e Thick Fat). Upload de .prsv descriptografa no navegador.

Aba Coach (v3): chat com o Claude via `sample`, modos Conversa, Carry, Conselheiro da run e Raio X das runs. Ferramentas da página (`src/agent.js`): `buscar_iniciais`, `detalhes`, `gerar_time` (o time aparece na aba Gerar), `analisar_time`, `habilidade`, `bioma`. "Carregar run" aceita a sessão exportada ou o histórico de runs; a página resume (`summarizeSession`, `summarizeHistory`) e só o resumo vai para o Claude. "Anexar print" manda imagens. Sem `window.claude` (fora do claude.ai) a aba mostra um aviso e o resto funciona.

Aba Farm (v5): `L.farmTargets` lista passivas e reduções de custo (doces que faltam), ovos da mesma espécie (chance por ovo de egg move novo e de habilidade oculta, regras de `rates.ts`: raro 1/x com x = 12, 8, 6, 4 pelo `et` tier de ovo do inicial, oculta 1/8) e natures que faltam (botão Onde caçar abre a Rotas). Prioridade = ganho em score x força relativa / esforço. O agente usa a mesma lista pela ferramenta `alvos_de_farm`.

Aba Rotas (v4): de um bioma até outro bioma ou até um Pokémon, pela wave e com ou sem Map (`A.routeAnswer`, a mesma resposta da ferramenta `rota_biomas` do agente).

**Publicar com `capabilities: {sample: {images: true}}`** (o Anexar print precisa de `images`).

Score de um inicial: `BST + 8*encaixe da nature + 40*IVs/186 + 8*egg moves + 30 se passiva liberada`.

## Roadmap

### Fase 1: dados (feita em 18/11/2026)
Tudo extraído e testado (`tests/test_data.js`). Em uso na UI desde a v2 (TMs, passiva final, formas).

1. Biomas: pools (raridade, horário, chefes) e links com chances. Gerar `data/biomes.json`.
2. TMs por espécie e tiers da loja, para o sugeridor de golpes considerar TMs como "se aparecer".
3. Formas: Megas, Gigantamax e itens de forma, com status da forma.
4. Custos de doces para passiva e redução de custo.
5. Descrição curta das habilidades mais relevantes (para o agente explicar interações).

### Fase 2: temas novos (feita em 18/11/2026)
Testes em `tests/test_logic.js`. O Desafio por enquanto sorteia uma regra de `CHALLENGES` em `logic.js` (letra, geração, dois tipos, nenhum tipo repetido, sem evolução, só físicos, só especiais, time lento, só baratos); o agente da Fase 3 vai inventar regras novas. Interações ficam em `INTERACTIONS`, cada uma com o requisito que precisa estar liberado no save.
* **Equilibrado**: otimizar cobertura defensiva (nenhum tipo acertando 3 ou mais membros sem resistência no time) e ofensiva (golpes super efetivos contra todos os tipos).
* **Late game absurdo**: priorizar o que escala no fim: BST alto, Mega/Gmax disponível, habilidades que acumulam (Beast Boost, Soul Heart, Moxie), setup + recuperação.
* **Interações legais**: lista curada com o porquê de cada uma. Exemplos: Gholdengo (Good as Gold), Cherrim com Drought de passiva, Koraidon/Miraidon, Palafin (Zero to Hero), Shedinja (Wonder Guard), Ditto, Smeargle, Slaking, Regigigas, Greninja Battle Bond, Zygarde Power Construct, Minior, Wishiwashi, Aegislash.
* **Mega / Gigantamax**: só quem tem forma por item.
* **Desafios**: o agente inventa uma regra e monta o time dentro dela.

### Fase 3: agente (feita em 18/11/2026)
Falta testar com o Claude de verdade no claude.ai (aqui foi testado com um `window.claude` falso no Edge headless) e com arquivos reais de sessão e histórico (os testes usam exemplos sintéticos no formato de `src/@types/save-data.ts`). `rota_biomas` e `alvos_de_farm` ficam para as Fases 4 e 5.
Chat dentro da página usando `sample` com ferramentas da própria página. Ferramentas sugeridas (resultados pequenos):
* `buscar_iniciais(filtro)`: lista resumida dos desbloqueios que batem com o filtro
* `detalhes(pokemon)`: status, habilidades, natures e egg moves liberados, golpes possíveis
* `gerar_time(tema, travados, orcamento)`: chama `L.generate`
* `analisar_time(membros)`: fraquezas, resistências, cobertura
* `rota_biomas(de, alvo)`: menor caminho até um Pokémon (Fase 4)
* `alvos_de_farm()`: caçador de desbloqueios (Fase 5)

Modos:
* **Carry**: o usuário escolhe o Pokémon principal e o agente monta o suporte em volta dele (cobrir fraquezas, clima/campo, Intimidate), mais itens e o momento de evoluir ou usar Mega.
* **Conselheiro da run**: o usuário manda print da tela (`images`) ou a sessão exportada; o agente lê time, wave e bioma e diz quem trocar, qual bioma escolher e o que caçar, considerando as lutas fixas que vêm.
* **Raio X das runs**: lê o runHistory e aponta padrões.

Instruções do agente ficam num turno `user` fixo no começo da conversa: responder em português, direto, sem travessões, citar números do save quando ajudarem, e não inventar dados que as ferramentas não deram.

### Fase 4: rota de biomas (feita em 18/11/2026)
Em `logic.js`: `linkOutcomes`, `reachTable` (programação dinâmica: V_k(b) = chance de chegar ao alvo em até k trocas; com Map pega o melhor link que apareceu, sem Map a média), `switchesLeft` (trocas depois das waves 10..180; na 190 o jogo força o END), `planRoute` (chance, valor de cada próximo link, caminho ideal desempatando pela chegada mais cedo) e `huntSpecies` (biomas onde o Pokémon ou uma pré evolução aparece, via `dex.prevo`; passagem = 9 batalhas comuns e 1 chefe, aproximado).
Busca no grafo de biomas maximizando a probabilidade de chegar ao bioma alvo em N trocas, considerando que o Map permite escolher o caminho.

### Fase 5: caçador de desbloqueios (feita em 18/11/2026)
Ranking do que dá mais retorno: passivas perto de liberar, Pokémon que ficam baratos com poucos doces, natures e egg moves que faltam nos melhores Pokémon.

### Fase 6 (pesquisa): ler a run ao vivo
Investigar como o pokerogue.net guarda o save e a sessão no navegador (localStorage, criptografia, sync com o servidor) e se um userscript ou extensão consegue mandar a sessão atual para o app sem exportar arquivo.
