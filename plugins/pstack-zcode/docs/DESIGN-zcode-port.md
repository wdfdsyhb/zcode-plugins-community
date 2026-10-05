# pstack → ZCode port — design

Data: 2026-08-20
Fonte: [cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack) v0.14.1, MIT, de Lauren Tan (poteto).
Baseline pristine commitado antes de qualquer mudança (ver git history).

## Objetivo

Ter o pstack inteiro — 41 skills (~20 de workflow + 21 `principle-*`), 22 playbooks
roteados por `/poteto-mode`, 2 subagentes (`poteto-agent`, `comment-sicko`), scripts
CLI (orch/watch-pr, bun + TypeScript) e o pacote de automações "benny" — instalável
e funcional como plugin do ZCode.

## Abordagem escolhida: fork com camada de adaptação

Copia-se o plugin inteiro e adapta-se tudo que é específico do Cursor, mantendo o
`.cursor-plugin/` intacto (o fork continua instalável no Cursor; mesmo padrão
multi-harness do superpowers). Adiciona-se `.zcode-plugin/plugin.json` e um
`marketplace.json` na raiz para instalação via marketplace local.

Alternativas descartadas:

1. **Núcleo curado** (só poteto-mode + skills principais) — descartada: o pedido foi
   o plugin completo; perderia arena/swarm/interrogate/reflect, que são a máquina de
   paralelismo do pstack.
2. **Skills soltas em `~/.agents/skills/`** — descartada: sem manifesto de plugin não
   há contribuição de agentes (`poteto-agent`, `comment-sicko` viram `subagent_type`
   apenas via plugin) nem história de instalação/updates.

## Mapeamento de conceitos Cursor → ZCode

| Cursor | ZCode |
|---|---|
| `Task` tool com `subagent_type` + `model` | `Agent` tool com `subagent_type` (sem `model`) |
| Roteamento multi-modelo por papel (sol/grok/fable/opus) | Roteamento por **tipo de subagente** + prompts diversos: `poteto-agent`, `comment-sicko`, `code-reviewer`, `code-architect`, `code-explorer`, `general-purpose`, `Explore` |
| `~/.cursor/rules/pstack-models.mdc` (regra always-apply) | `~/.zcode/pstack-roles.md` (arquivo lido sob demanda pelas skills; fallback inline) |
| `/setup-pstack` escolhe modelos | `/setup-pstack` escolhe **subagente por papel** e escreve `~/.zcode/pstack-roles.md` |
| `AskQuestion` | `AskUserQuestion` |
| `/create-skill` (built-in do Cursor) | plugin oficial `skill-creator` + playbook próprio `authoring-a-skill` |
| `cursor-team-kit`: `/deslop`, `control-cli`, `control-ui` | removidos como dependência dura; `/deslop` coberto pela skill `unslop`; controle de UI apontado para o plugin `browser-use` quando disponível |
| bugbot / agentic security review | code review do ZCode (`code-reviewer`) com a mesma postura cética (bugbot-triage mantido como referência genérica de triagem de bot) |
| `/loop` (Cursor) | automações agendadas do ZCode (ferramentas Cron: CronCreate/CronUpdate/CronList/CronDelete) |
| `.cursor/automations/benny/` instalado no repo alvo | skills copiadas para `<repo>/.zcode/skills/` + agendamento via Cron |
| `/add-plugin pstack` (marketplace do Cursor) | marketplace local: este repo é um marketplace (raiz `marketplace.json`); instalação em Settings → Plugin Management → Discover → **+** → diretório local |
| `subagent_type: "Comment Sicko"` | `subagent_type: "comment-sicko"` (nome normalizado; `subagent_type` não aceita espaço) |

### Degradação assumida: diversidade de modelo

O ZCode não expõe escolha de modelo por subagente. Painéis multi-modelo (how critics,
arena runners, interrogate reviewers etc.) viram **N subagentes em paralelo com o
mesmo modelo**, diferenciados por tipo de subagente e prompt. A diversidade sobrevive
na forma de perspectiva (reviewer vs architect vs explorer), não de família de modelo.
"A second opinion is the same prompt against a different model" vira "...against a
different subagent type".

## Mudanças por área

1. **Manifestos** — novo `.zcode-plugin/plugin.json` (`name: pstack`, `skills: ./skills/`, `agents: ./agents/`, atribuição ao autor original); `.cursor-plugin/` intocado; `marketplace.json` na raiz listando o plugin com `source: "./"`.
2. **`skills/poteto-mode/SKILL.md`** — seção Subagents reescrita (defaults de `Agent` call: `run_in_background: true`, sem `model`, roteamento por papel lendo `~/.zcode/pstack-roles.md`); referências a built-ins do Cursor trocadas pelos equivalentes ZCode; nota de que o "mode" do Cursor vira skill invocável normal.
3. **`skills/setup-pstack/SKILL.md`** — reescrita completa: detecta tipos de subagente disponíveis na sessão (built-ins + contribuídos por plugins), mapeia papel→subagente, escreve `~/.zcode/pstack-roles.md` com shape análogo ao original.
4. **Skills de fan-out** (`how`, `why`, `arena`, `swarm`, `interrogate`, `reflect`, `architect`, `recall`, `no-comments`, `show-me-your-work`, `automate-me`, `create-verification-skill`, `maintain-verification-skill`) — substituição de `Task`→`Agent`, remoção do campo `model`, painéis → listas de subagentes, `AskQuestion`→`AskUserQuestion`, `~/.cursor/rules/...`→`~/.zcode/pstack-roles.md`.
5. **Playbooks** (babysit, shipping, autonomous-run, autopilot-*, orchestrate, authoring-a-skill, opening-a-pr, eval, pause-safely, session-pickup, worktree-cleanup, visual-parity, bug-fix) — mesmo tratamento; `/loop` → Cron; bugbot → review de bot genérico; control-cli/control-ui → browser-use.
6. **Scripts TS** — `watch-pr`: marcador `CURSOR_AUTOMATION_ID` → `ZCODE_AUTOMATION_ID`; detecção de autor de bot passa a aceitar `zcode` além de `cursor` (paginação GraphQL "cursor" não é tocada — falso positivo). Testes atualizados. `orch`/`bootstrap`/`worktree-audit.sh` não referenciam o harness.
7. **Benny** — `FOR_AGENTS.md` e `setup-benny` passam a instalar em `<repo>/.zcode/skills/` e a registrar os dois prompts de automação via CronCreate; `control-adapter.md` aponta para `browser-use`.
8. **docs/guide + README** — install/get-started reescritos para o ZCode; seção de modelos substituída pela de subagentes; atribuição ao upstream mantida em destaque (MIT).
9. **Frontmatter** — campos extras do Cursor (`icon`, `color`, `reminder`, `mode`, `disable-model-invocation`) mantidos: inócuos se ignorados, preservam compatibilidade com o Cursor. `name:` normalizado para kebab-case onde necessário (`Comment Sicko` → `comment-sicko`; `Poteto Mode` → `poteto-mode`).

## Interações conhecidas

- `tdd` e `teach` já existem em `~/.agents/skills/` do usuário. Precedência do ZCode:
  skills de plugin são as últimas, então `tdd`/`teach` do pstack ficam sombreados quando
  invocados pelo nome simples. Comportamento permanece equivalente (TDD/ensino); para o
  flavor do poteto, remover as skills antigas ou invocar qualificado (`pstack:tdd`).
- ~41 skills + 2 agentes entram na lista global de skills do ZCode (mesmo impacto que
  superpowers).

## Instalação (usuário final)

1. Settings → Plugin Management → Discover → **+** → adicionar diretório local
   `~/projects/personal/pstack-zcode` (a raiz é um marketplace listando `pstack`).
2. Instalar **pstack**.
3. Opcional: `/setup-pstack` para escolher subagente por papel.
4. Uso: `/poteto-mode <pedido>`.

## Verificação

- `bun test` nos scripts (orch, watch-pr) passa.
- `grep` pós-porta não encontra Cursor-isms de prose/code (exceto paginação GraphQL
  e menções históricas deliberadas ao upstream).
- Manifesto `.zcode-plugin/plugin.json` valida contra o formato (name regex
  `^[a-z0-9][a-z0-9._-]{0,127}$`, campos `skills`/`agents`).
- Estrutura de skills: todo `skills/*/SKILL.md` com frontmatter `name`+`description`,
  `name` igual ao diretório em kebab-case.
