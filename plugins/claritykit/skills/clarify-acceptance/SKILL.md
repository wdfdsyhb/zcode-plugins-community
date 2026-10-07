---
name: clarify-acceptance
description: Generate the acceptance evidence a behavior module with ClarityKit artifacts needs — a transition-coverage checklist from the behavior model and a UX comparison against the approved prototype. The governing workflow owns the verdict and report location. Invoke ONLY when the user names clarify-acceptance or the governing workflow's verification step explicitly calls for ClarityKit evidence; never self-activate from testing talk.
---

# clarify-acceptance — the evidence, not the verdict

Verification and acceptance belong to the governing workflow (or the user). This capability
supplies the two things generic verification misses when ClarityKit artifacts exist:

1. **Behavior coverage** — is every specified behavior actually exercised by tests?
2. **UX fidelity** — does the running UI match the approved prototype?

## Method

1. **Re-read the ClarityKit artifacts**: `behavior.yaml` (if any), acceptance criteria content,
   approved prototype + `ui-notes.md`.
2. **Build the transition-coverage checklist.** For every transition in `behavior.yaml`
   (or every branch in a light-tier spec):

   | From | —event→ | To | Covered by (test/evidence) | Result |

   Run the project's test suite. Map each transition to the test (unit/integration/e2e) that
   proves it. **List every transition with no coverage explicitly** — that list is the output
   the governing workflow most needs. For interactive modules, the e2e walkthrough should
   drive the real app through: happy path, every failure path, every cancel/retry path.
3. **Build the UX comparison (UI modules).** Run the app; compare against the approved
   prototype: layout structure, interaction flow, per-state representations. Each difference
   is marked `approved-deviation` (user signed off earlier) or `finding`.
4. **Hand both tables to the governing workflow** (or present them directly in a bare
   conversation). The verdict, the report file, and what happens next are not ClarityKit's.
   If a diagram would help the user judge a finding, draw it (following
   `references/mermaid-safe-syntax.md`, with a `%% title:` directive) and publish via
   `clarity publish` (never start the server yourself — that's the user-invoked
   `clarity-preview` skill). Both tables themselves are
   decision-grade: they belong in the conversation, not only in a file. Artifacts go in the
   staging dir (`docs/clarity/acceptance/`; run `clarity root` to see the derived root) —
   never invent other locations. All tools via the `clarity` CLI; if missing, retry once
   after `export PATH="$HOME/.local/bin:$PATH"`, then stop and report — never improvise.

## Rules

- No evidence, no claim: a transition without a passing test or scripted check is "untested",
  never "looks fine".
- Report failures neutrally and completely — coverage exists to protect the user's experience.
- The sign-off belongs to the user, within the governing workflow — never self-approve.

