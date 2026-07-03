# Phase 0 Discovery — Aria's Journal implementation note

Source inspected: `~/Documents/Claude/Projects/Aria Summer Plan/tracker/` (the Summer Tracker, git repo `cksainia/aria-summer`, build v29) plus its Cloudflare Worker (`book-lookup-worker.js`). Date: 2026-07-02.

## 1. Firebase project config

The tracker is a **single-file vanilla JS app** (`index.html`, ~189 KB, no build step) loading Firebase **11.6.1 via CDN ESM**. Config (public, client-side):

```js
projectId:  "aria-tracker-c89d3"
authDomain: "aria-tracker-c89d3.firebaseapp.com"
storageBucket: "aria-tracker-c89d3.firebasestorage.app"
appId: "1:943653530208:web:014a7a7abf4b4ab2627105"
messagingSenderId: "943653530208"
apiKey: "AIzaSyDoCkJn-kRXftq6ahPocbwWJiM8GhTjQdU"
```

**Critical, hard-won constraint:** Firestore is initialized with
`initializeFirestore(app, { experimentalForceLongPolling: true })`. A source comment (dated **today**, 2026-07-02) says the SDK's default streaming write channel *hangs* on the family's network while long-polling round-trips in <500 ms. **The journal app must ship with forced long-polling too.**

- **No Cloud Functions exist.** The one server-side piece (Claude book lookups) is a **Cloudflare Worker** (`book-lookup.<account>.workers.dev`, `ANTHROPIC_API_KEY` as a Worker secret, CORS-locked to `https://cksainia.github.io`, model `claude-haiku-4-5`).
- **Cloud Storage is never used** by the tracker (bucket exists in config only).
- **No firebase.json, .firebaserc, or firestore.rules anywhere** — Firestore security rules are console-managed and their current content is **unknown** (see Open Items).
- **No emulator setup exists.** The journal repo will introduce emulators from scratch.
- **Quota sensitivity:** comments document a **write storm on Jul 1 that burned 37K writes in a day** (device ping-pong). The code is now full of defenses: 800–1200 ms debounced writes, read-before-write gates, a per-session "migration push" cap, and a **version gate** (each tab polls `version.json`; stale builds refuse to write). The project is very likely on the **free Spark plan** — see Open Items.

## 2. Auth model

- **Firebase Auth, email/password**, `browserLocalPersistence`. Exactly **two accounts**:
  - Parent — UID `ForoefZlHRbJIwZgCraAxAUfq1n2`
  - Aria — UID `O93lhqGLBye4TLzYrREpRaEBm972`
- Roles are a **client-side hardcoded UID→role map** (`parent` / `aria`); unknown UIDs are signed out. **No custom claims, no member/profile docs.**
- In-app "Parent mode" is a UI toggle, not a security boundary — same shape as the journal spec's PIN-as-UX-gate rule.

**Implication for the journal:** we reuse the same two accounts, but the spec requires rules-enforced roles. Since no role infrastructure exists, Phase 1 must add it: either **custom claims** (set once via an Admin-SDK script) or `families/{familyId}/members/{uid}` role docs that rules read. Recommendation: **role docs** (no Admin script / no Functions dependency, works fully in the emulator, matches the spec's §7 `members` model).

## 3. Firestore schema (entire database = 2 documents)

```text
families/aria            ← parent-only writes; FULL-DOC setDoc (NO merge), debounced 1.2 s
  completions: { "<YYYY-MM-DD>": { <taskId>: true, ..., journalCount: <int> } }
  habits, books, beast, beastSeed, booksSeed, resources, ixl, beastRestore, deletedBooks

families/aria-claims     ← Aria's self-marks; she writes it, parent reads/confirms.
  comp:      { "<YYYY-MM-DD>": { <taskId>: true } }        FULL-DOC setDoc (NO merge), 0.8 s debounce
  hab:       { "<YYYY-MM-DD>": { <habitId>: true } }
  journal:   { "<YYYY-MM-DD>": <claimed sentence count> }
  beast, ixl, gratitude, reward
```

- Day keys are `YYYY-MM-DD` from **device-local time** (`ymd(new Date())`) — same convention the journal spec mandates for `dateKey`. 
- Cloud is source of truth; snapshots replace local state.

## 4. The tracker's "Journal Writing" target path

The Journaling course is defined in every phase's track list as
`{ id:"journal", icon:"✍️", unit:"sentences", goal:20, kind:"count", cadence:"daily" }` — done when the day's count ≥ 20.

Data flow today (fully manual):
1. **Aria claims:** a stepper writes `families/aria-claims → journal["<dateKey>"] = n` (today only).
2. **Parent confirms:** an "Accept" action copies it to `families/aria → completions["<dateKey>"].journalCount = n` (parent may also set it directly via prompt).
3. Task completion, stars, and streaks derive from `completions[dateKey].journalCount ≥ goal`.

So the **manual entry the journal app must replace is `families/aria-claims`.`journal.<dateKey>`** (the claim), with the parent-confirm step unchanged — or optionally bypassed later.

## 5. Deploy setup

- **Hosting: GitHub Pages** (repo `cksainia/aria-summer`, `main` branch root, `.nojekyll`), i.e. `https://cksainia.github.io/aria-summer/`. **Not Firebase Hosting.**
- Deploy = commit + push to `main`. No scripts, no CI. Convention: commit message `v<N> <codename>: <summary>`, bumping **both** `window.APP_BUILD` in `index.html` and `version.json` (`{"build": N}`) — that pair drives the stale-tab write gate.
- PWA: `manifest.webmanifest` + a deliberately minimal `sw.js` (caches app shell only; a comment explains a broader cache broke images).

## 6. Existing UI conventions worth reusing

CSS custom-property tokens (`:root`): cream bg `#F6F4EF`, ink `#16233A`, muted `#6B7280`, line `#E7E1D6`, soft `#FAF8F3`; accents **teal `#0D9488`** (+`#CCFBF1`), **gold `#E8A020`** (+`#FFF3D6`), **coral `#E8503A`** (+`#FEE8E4`), **violet `#7C3AED`** (+`#EDE9FE`), **green `#059669`** (+`#D1FAE5`), navy `#1E3A8A`; soft shadow `0 6px 22px rgba(20,35,58,.08)`.

Patterns: system font stack; 999px pill chips; 14–16px-radius cards with 1px `--line` borders; emoji-in-rounded-square task icons (46px); uppercase letter-spaced 13px section headers; header gradient teal→navy; max-width 680px center column; bottom padding for fixed footer nav; `viewport-fit=cover` + apple PWA meta; sync-status line showing role + version.

The journal's warmer/peppier palette (spec §10) is a superset of this — same cream/coral/teal family, so the apps will feel related. Map these into Tailwind theme tokens rather than copying CSS.

## 7. Hosting decision for the journal (spec §2.5)

**Recommendation: sibling app in its own new repo (`journal`), deployed to Firebase Hosting in the same `aria-tracker-c89d3` project** (the default Hosting site is unused — no conflict with the tracker on GitHub Pages).
- Not a route inside the tracker: it's a no-build single HTML file; a Vite/React/TipTap app can't live inside it sanely.
- Firebase Hosting (vs. GitHub Pages) gives us `firebase deploy` alongside rules/emulators config in the same repo, and first-party auth-domain behavior. Fallback if you prefer one deploy story: GitHub Pages + Actions works too — flag your preference.

## 8. Sync adapter contract (spec §2.6)

**Contract — "journal feeds the claim":**

> On any journal section create/update/archive/restore, recompute the day's total sentence count from **all live (non-archived) sections** of `journalDays/aria_{childId}_{yyyyMMdd}` and write it to the tracker claim path:
>
> **Target:** `families/aria-claims` → field `journal.<dateKey>` (integer)
> **Key:** `dateKey` = the journal day's stored `YYYY-MM-DD` (device-local at write time, per both apps' existing convention)
> **Semantics:** absolute value, recomputed — never incremented → idempotent; edits update, never duplicate
> **Sync log:** per spec §8, written to the journal's own `syncLog` (source totals, target path, timestamp, error)

Parent confirmation in the tracker then works exactly as today (Accept → `completions[dateKey].journalCount`), satisfying "eliminate the manual sentence-count entry" for Aria while keeping the parent-confirm ritual.

**⚠️ One real race to design around:** the tracker writes `families/aria-claims` as a **full-document `setDoc` with no merge** from device-local state. If Aria has a stale tracker tab open and taps anything, her push can clobber a journal-written count until the journal's next recompute. Two mitigations, in order of preference:
1. **Tiny tracker patch (v30):** change `pushClaims` to merge/union the `journal` map (the tracker already has `unionClaims` with "dst wins" semantics) — ~5 lines, eliminates the race class.
2. **Zero-touch fallback:** accept the small window; the adapter recomputes on every section event, so any clobber self-heals on the next journal edit.

I recommend 1 + 2 together. The adapter interface takes `{dateKey, sentences, words, sections}` so future fields (words, accuracy) are additive.

## 9. Open items / flags (need your input or console access)

1. **Current Firestore rules are unknown** (console-only, no local file). Before we deploy any rules from the journal repo — which would **replace** the live rules project-wide — I need them exported (paste from console, or `firebase login` here and I'll pull them via CLI). The journal repo will then become the rules-as-code home for the whole project, with emulator tests.
2. **Billing plan:** the spec's architecture (Firestore-trigger sync function in Phase 3, callable Claude functions in Phase 4) requires **Cloud Functions → Blaze plan**. Signals suggest the project is on free Spark (no Functions; Claude went through a Cloudflare Worker instead). Options: (a) upgrade to Blaze (still ~$0 at this usage), or (b) follow the house pattern — Cloudflare Workers for Claude calls and client-side adapter writes for sync. Decide before Phase 3.
3. **Firebase CLI auth** on this machine (for emulators, rules deploy, hosting deploy) — needs a one-time `firebase login`.
4. **GitHub repo creation** (`journal`, single word) — ready to run via `gh` after you approve this note; confirm it should live under `cksainia` and be private.
5. **Cloud Storage** (Phase 6 drawings) has never been enabled/used — will need Storage rules when we get there.
6. **Write frugality is a first-class requirement** given the Jul-1 quota blowout: debounced autosave (spec already says 2–5 s), section-level (not keystroke-level) writes, and no unbounded listeners.
