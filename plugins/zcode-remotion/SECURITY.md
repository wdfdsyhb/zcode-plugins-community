# Security Policy

## Supported versions

Only the latest release line receives security fixes.

## Reporting a vulnerability

Please use [GitHub Security Advisories](https://github.com/AIwork4me/zcode-remotion/security/advisories/new)
(privately visible to maintainers). Do not open a public issue for security problems.

This plugin ships no executable hooks, no MCP servers, and no `userConfig` — its attack
surface is limited to Markdown skill/command content and the Node.js dev scripts in
`scripts/` (static verifier + tests, upstream compatibility/drift checks, compat smoke
test — all offline logic except version/link checks). The Remotion skills it bootstraps
are fetched by your own machine from the official `remotion-dev/skills` channel; review
them before enabling, as you would any agent skill.
