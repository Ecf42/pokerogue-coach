# Como a página chama o Claude (capability `sample`)

Resumo da API do runtime de artifacts do claude.ai (contrato 0.2.96, consultado em 17/11/2026).
É isso que transforma a página num agente: o código da página pede uma resposta ao Claude e pode oferecer funções da própria página como ferramentas.

## Declaração

O artifact precisa declarar a capability. Isso é feito no chat do claude.ai na hora de publicar, não no HTML:

```
capabilities: { sample: { images: true } }   // images: true só se a página manda imagens (prints da run)
```

## Uso básico

```js
const sample = await claude.use("sample");   // null = indisponível: esconder o recurso
if (!sample) hideAgent();

const { text, truncated } = await sample(input, options);
const data = await sample.json(input, options);   // mesma coisa, mas devolve o JSON já parseado
```

`window.claude` só tem `use`. Ele resolve depois do carregamento (até ~10 s); a página precisa funcionar sem ele.

## Input

* Uma string, ou uma lista de turnos `[{role: "user"|"assistant", content}]` que começa e termina em `user`.
* Não existe system prompt: as instruções vão num primeiro turno `user` que a página sempre mantém.
* Cada chamada é sem memória. O Claude só vê o que a página manda. O histórico do chat é a página que guarda.
* Limite de 256 KiB de texto por chamada. Não mandar o save inteiro: mandar resumos ou deixar o agente consultar por ferramentas.

## Options principais

| opção | para que serve |
|---|---|
| `onText({text, delta})` | streaming. `text` é a resposta inteira até agora: atribuir, nunca concatenar |
| `signal` | AbortController novo por chamada, para o botão Parar |
| `tools` | funções da página que o Claude pode chamar (ver abaixo) |
| `images` | Blob/File/FileList (prints da tela do jogo). Exige `images: true` na declaração |
| `modelTier` | `"quick"` (rápido, sem pensar), `"default"`, `"complex"` (raciocínio pesado) |
| `cache` | ligado por padrão (5 min). Usar `cache: false` em chat. Com `tools` não pode passar cache |

## Ferramentas (o que faz ser um agente)

```js
await sample(turnos, {
  cache: false,
  tools: [{
    name: "gerar_time",
    description: "Gera um time inicial com os desbloqueios do jogador. Retorna lista de membros com custo, nature, habilidade e golpes.",
    inputSchema: { type: "object", properties: { tema: { type: "string" }, travados: { type: "array", items: { type: "string" } } }, required: ["tema"] },
    execute: async (input, { signal }) => resumo(L.generate(owned, { theme: String(input.tema), locked: input.travados || [] }))
  }]
});
```

* O Claude lê só `name`, `description` e `inputSchema`. A descrição precisa dizer o que a ferramenta retorna.
* `execute` roda na página. Retornar dados pequenos (no máximo 32 KB, quanto menor melhor). Para erro, `throw`: o Claude recebe a mensagem e continua.
* Cada rodada de ferramenta é uma requisição paga separada e relê tudo. Poucas ferramentas, resultados enxutos.
* Rodadas no `default` levam de 30 a 90 s numa chamada com 2 ou 3 ferramentas. Mostrar progresso de dentro do `execute`.
* Conferir `(await sample.limits()).tools` antes de oferecer ferramentas.

## Custo e consentimento

* Usa o plano do Claude de quem está vendo a página. A primeira chamada pede permissão.
* Só chamar em ação explícita do usuário (botão Enviar, Analisar). Nunca em loop ou timer.

## Erros

Toda falha é uma promise rejeitada com `{code, message, text?}`. Decidir pelo `code`:

* `cancelled`: o usuário parou. Só restaurar a UI.
* `not_granted`, `sampling_disabled`, `not_declared`, `capability_disabled`, `capability_removed`: esconder o agente.
* `images_unavailable` / `tools_unavailable`: esconder só imagens / ferramentas.
* `rate_limited`, `session_expired`, `image_rejected`, `refused`, `empty_completion`, `invalid_json`, `upstream_error`: avisar e deixar o usuário tentar de novo.
* Nunca tentar de novo automaticamente.
