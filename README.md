# Aria's Journal

A kid-friendly daily journaling PWA for Aria — React (Vite) + TypeScript + Tailwind + Firebase.
Standalone app; feeds daily sentence totals to the [Summer Tracker](https://github.com/cksainia/aria-summer) (Phase 3).

- Build spec: `aria-journal-app-spec` (v3)
- Phase 0 discovery note: [PHASE0-DISCOVERY.md](PHASE0-DISCOVERY.md)

## Local development (emulators — no production access)

```bash
npm install
npm run emulators   # Firebase Auth + Firestore emulators (needs Java: brew install openjdk)
npm run seed        # once per emulator start: creates the two family accounts
npm run dev         # http://localhost:5173/journal/
```

Sign in with `aria@example.test` or `parent@example.test`, password `test123`.
Dev mode uses the `demo-aria-journal` emulator namespace — it **cannot** reach production.

## Tests

```bash
npm test            # unit tests (counting, date keying)
npm run test:rules  # Firestore security-rules tests against the emulator
```

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages at
`https://cksainia.github.io/journal/` (same origin as the tracker → shared sign-in).

## Data safety on deploys

Deploys push **static files only** (GitHub Pages). Nothing in the pipeline can
touch journal data:

- All entries/reviews/settings live in **production Firestore** — app deploys
  never read or write it.
- Seed scripts (`seed`, `seed:db`) use the emulator's `Bearer owner` bypass,
  which **does not exist in production**; dev also runs under the
  `demo-aria-journal` project id, which has no cloud counterpart.
- Firestore **rules** deploy only via an explicit manual
  `firebase deploy --only firestore:rules` — never from CI.
- The only destructive UI is the parent-only "Manage entries" delete, behind
  auth + rules (+ PIN); the child can archive but never delete.

## Architecture notes

- **Forced long-polling** (`experimentalForceLongPolling`) — the default Firestore
  streaming transport hangs on the family network. Do not remove.
- **Firestore rules are the security boundary** (`firestore.rules`); the parent PIN
  (later phase) is UX only. Child accounts can archive but never hard-delete.
- **AI is optional by design**: `src/services/claude/` — Phases 1–3 run entirely on
  `mockClaudeService.ts`; the live Cloud-Function service (Phase 4) swaps in behind
  the same schema-validated interface.
- **Write-frugal**: debounced autosave (3s + blur), totals updated only on change.
