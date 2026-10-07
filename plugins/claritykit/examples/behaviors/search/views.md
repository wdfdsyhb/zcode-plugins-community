# search — Light-tier Behavior

> Fixture: light tier (no YAML model — linear flow with a few branches). One
> hand-crafted flowchart plus criteria is enough; say which tier and why: search is
> a one-shot transform with no persistent state machine.

## Scenario episodes

1. **Happy** — Kayla types "municipal sewers"; results list appears within ~300ms
   (local FTS); the phrase is highlighted in snippets.
2. **No results** — "sew3rs" typo: an explicit "无结果" state with the query echoed
   and a one-tap "搜索标题" fallback (decided: never a blank screen).
3. **Snapshot missing** — the matching article was saved without a snapshot: shown
   in results under a "仅标题匹配" group, opened as link+title only.

## Flow view

```mermaid
%% title: search · flow
%% group: search
%% caption: one-shot flow with the no-result and snapshot-missing branches
flowchart TD
  A(["用户输入关键词"]) --> B["本地全文检索（标题/标签/正文）"]
  B --> C{"命中结果?"}
  C -- "无" --> D["显示「无结果」+ 建议回退到标题搜索"]
  C -- "有" --> E{"含缺快照的条目?"}
  E -- "是" --> F["分组显示：「正文匹配」/「仅标题匹配」"]
  E -- "否" --> G["显示结果列表 + 摘要高亮"]
  F --> G
  D --> H(["结束"])
  G --> H
```

## Acceptance criteria

- Given any saved set When 输入关键词 Then results within ~300ms from local index
- Given no matches When search Then explicit 无结果 state with title-search fallback
- Given a snapshot-less bookmark matching only by title When search Then it appears
  under 仅标题匹配, never silently dropped
