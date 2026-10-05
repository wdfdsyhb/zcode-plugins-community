# benny

benny gives you two ZCode scheduled automations for slack issue reports. one triages each report. the other reproduces confirmed bugs and may prepare a small draft fix.

the files in this directory are dormant setup and automation sources. they do not appear as slash skills.

## set it up

1. point the ZCode agent at [`FOR_AGENTS.md`](./FOR_AGENTS.md) and name the target repository.
2. let setup merge this whole directory into the target at `.zcode/automations/benny/`. it must preserve destination-only files and review conflicts instead of overwriting local edits.
3. confirm the pstack plugin is enabled for the user (Settings → Plugin Management) so shared dependencies (`how`, `why`, `tdd`, `unslop`, principle skills) resolve for automation sessions.
4. keep user-owned configuration outside the copied pack, for example in `.zcode/benny/`. adapt [`configuration.example.yaml`](./templates/configuration.example.yaml) and [`feature-map.example.md`](./skills/reproduce-and-fix-issues/references/feature-map.example.md).
5. commit `.zcode/automations/benny/`, the workspace `.zcode/config.json` when it declares automation-relevant MCP servers, and any secret-free configuration before enabling either automation.
6. register each automation with the Cron tools (`CronCreate`), review the prompt, then send a harmless test report and verify every source-channel post stays in the original thread.
