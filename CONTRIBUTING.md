# Contributing to Crowdtone

Thanks for wanting to help. The project is deliberately small and readable —
please keep it that way.

## Getting set up

```bash
npm install
cp .env.example .env.local   # keys are optional; the demo dataset needs none
npm run dev
```

`npm test` runs the vitest suite. Every pull request should keep it green, and
new logic in `lib/` should arrive with tests — that's where all the pure,
testable behavior lives by design.

## Ground rules for changes

- **`lib/` stays pure.** Parsing, clustering, scoring, validation, and action
  building are plain functions with no I/O, which is what makes them testable.
  Network calls live in the API routes and the thin clients (`ytclient.ts`,
  `llm.ts`).
- **Every LLM response gets validated** before anything touches the UI or, far
  more importantly, YouTube. If you add a prompt, add a validator and tests
  for the malformed shapes the model will eventually return.
- **Writes are sacred.** Anything that changes a live channel must: check
  ownership server-side, default to a dry run, require an explicit
  `confirm: true`, and return an undo ticket when undo is possible. No
  exceptions — this is the property that makes the tool trustworthy.
- **Degrade, don't die.** No YouTube key → demo dataset. No LLM key →
  keyword heuristics. No OAuth → read-only previews. A missing credential
  should never produce a blank screen.
- **Official endpoints only.** No scraping, no undocumented APIs, nothing
  that violates the YouTube API Services Terms.

## Dependency policy

The runtime dependency list is `next`, `react`, `react-dom`, and `sharp`, and
that's a feature. OAuth, sessions, YouTube clients, and the LLM client are
hand-rolled on `fetch` and `node:crypto`. Think hard before proposing a new
dependency; "it would save 30 lines" is not enough.

## Filing issues

Include the mode you were in (Fix a video / Plan the next one / Patrol), what
you pasted, and whether keys were configured. Never paste your `.env.local`,
tokens, or OAuth codes into an issue.
