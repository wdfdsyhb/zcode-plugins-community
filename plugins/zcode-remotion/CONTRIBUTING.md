# Contributing

- Run `node --test scripts/verify-plugin.test.mjs` and
  `node scripts/verify-plugin.mjs --offline` locally before every commit; CI
  enforces both across Linux/macOS/Windows and Node 18/24 (plus 20/22 on
  Linux). The online `node scripts/verify-plugin.mjs` run is the
  post-push/CI gate. On pull requests that touch behavior-relevant files
  (skills/, commands/, scripts/, compatibility/, manifests, workflows), CI
  additionally runs the real Remotion compatibility smoke — it is a merge
  gate, so compatibility failures surface before merge, not on main.
- `compatibility/remotion.json` is the canonical machine-readable upstream
  baseline and the single source of the official skill list. Update it only
  from a real verification run (see `scripts/compat-smoke.mjs` and
  docs/verification-report.md) — never by editing the version numbers by
  hand. The daily `upstream-compatibility` workflow proposes validated
  updates automatically; high-risk drift (major bump / skill topology
  change) always needs a human. A merged change to `compatibility/remotion.json`
  changes shipped plugin compatibility state and therefore requires a plugin
  patch release so existing ZCode installs can receive the new baseline.
- Never vendor content from `remotion-dev/skills` or the Remotion repo into this
  plugin — Remotion License forbids redistribution. Reference upstream by URL or
  via the official installer instead.
- Prefer official Remotion mechanisms over reimplementing Remotion behavior
  (e.g. `npx remotion upgrade` over hand-rolled upgrades).
- Content is English; descriptions are bilingual (EN + 中文 trigger words).
- After changing user-facing behavior, update README + README.zh-CN.md +
  CHANGELOG in the same PR (the verifier checks version/baseline consistency).
  Before publishing a release, run `node scripts/release-check.mjs --github`.
- Before releasing, rerun the end-to-end journey audit documented in
  docs/verification-report.md.
