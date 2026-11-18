# PokéRogue Coach

Gerador de times iniciais e agente conselheiro (aba Coach) para o PokéRogue.
O plano completo, o formato do save e as regras do projeto estão no `CLAUDE.md`.

```
python scripts/extract_game_data.py   # atualiza os dados quando o jogo mudar
node tests/test_data.js               # testes dos dados
node tests/test_logic.js              # testes do gerador
node tests/test_agent.js              # testes do agente
python scripts/build_page.py          # gera dist/index.html para publicar no claude.ai
```
