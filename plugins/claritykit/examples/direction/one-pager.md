# Reading List — Direction

> Fixture note: this examples/ tree walks the whole clarity-flow design flow for a
> small "read-it-later" app. Content is the demo; diagram labels use the user's
> language (Chinese) as a fixture for that feature.

## User

A heavy reader who saves 10–30 articles a day across phone and laptop and loses track
of what they saved — specific enough to exclude "people who occasionally bookmark".

## Job & current workaround

"Never lose an article I meant to read." Today: the browser bookmarks bar (no full
text, no tags, no search) plus a chat-with-self full of pasted URLs. Both hurt: the
bookmarks bar cannot be searched by content, and the chat log is write-only in practice.

## Observable success

"Three months in, I'd know it worked if I actually re-read saved articles at least
weekly — checkable in the app's own reading history — instead of hoarding links."

## Non-goals (deliberately NOT solving)

1. **Social / sharing** — no public profiles, no follow, no recommendations.
2. **Read-later clients sync** — not a Wallabag/Pocket replacement; no third-party import.
3. **Content recommendation or ranking** — ordering is manual (newest + pinned), on purpose.

## Why now / biggest risk

Why now: switching cost is near zero for a single-user local-first tool.
Biggest risk: full-text snapshots rot when sites change or block fetchers.
