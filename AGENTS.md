# AGENTS.md

> Instructions for AI coding agents working in the **Smart Campus Room
> Availability Checker** repository. Read this file completely before making
> any change. Preserve all existing application functionality.

## Project Purpose

A prototype single-page web app that lets a user check whether a campus room
is available for a requested time slot. The scope is the **availability
decision only** — there is no booking creation, no persistence, no login, and
no backend.

Key product facts:

- The UI shows exactly **one room: Room A101**. Other rooms (B202, C303, etc.)
  exist only as fixtures for automated tests and must never appear in the UI.
- The current time is **fixed at 09:00** and is read-only in the UI.
- Booking data is fictional and hardcoded in `src/data/rooms.ts`.
- An **Explain Availability** feature produces a short, advisory natural-language
  explanation of the availability result using a deterministic local mock
  model — never a real LLM or external API.

## Architecture and Repository Structure

### Technology stack

- **React 18** + **TypeScript 5** + **Vite 5** (build/dev server)
- **Tailwind CSS 3** for styling
- **lucide-react** for icons
- **Vitest 2** for unit tests (Node environment, no DOM/jsdom)
- **ESLint 9** (flat config) + **typescript-eslint** for linting
- Path alias `@/` → `src/` (configured in `tsconfig.app.json`, `vite.config.ts`,
  and `vitest.config.ts`)

### Directory layout

```
.
├── index.html                # Vite HTML entry
├── package.json              # Scripts and dependencies
├── vite.config.ts            # Vite + @ alias + lucide-react optimizeDeps
├── vitest.config.ts          # Vitest config (node env, src/**/*.test.ts)
├── tsconfig.json             # References app + node configs
├── tsconfig.app.json         # App TS config: strict, @/* path alias
├── eslint.config.js          # Flat ESLint config
├── tailwind.config.js
├── postcss.config.js
├── AGENTS.md                 # This file
├── src/
│   ├── main.tsx              # React DOM entry point
│   ├── App.tsx               # Main UI component (A101-only, fixed 09:00)
│   ├── index.css             # Tailwind directives
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── FilterPanel.tsx   # Attendees + equipment filter inputs
│   │   ├── RoomCard.tsx      # Selectable room card
│   │   ├── ResultCard.tsx    # Availability result display
│   │   └── BookingList.tsx   # Existing bookings list for a room
│   ├── data/
│   │   └── rooms.ts          # Room fixtures (A101, B202, C303, D404, E505)
│   └── lib/
│       ├── availability.ts   # Core deterministic availability checker
│       ├── explain.ts        # Explain feature: mock model + validation + fallback
│       ├── filter.ts         # Room filtering by capacity + equipment
│       ├── selection.ts      # Orchestrates filter → selection → availability
│       ├── prompt-engineering.ts  # Task #04 prompt experiment (simulated)
│       └── *.test.ts         # Co-located unit tests
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `src/lib/availability.ts` | **Core deterministic checker.** Exports `checkAvailability`, `timeStringToMinutes`, `formatTime`, types `Booking`/`Room`/`AvailabilityResult`, and constants `MAX_DURATION_MINUTES` (120) and `MINUTES_PER_DAY` (1440). Implements booking rules AC1–AC6 as a pure read-only function — never mutates room or booking data. |
| `src/lib/explain.ts` | **Explain Availability feature.** `mockLlmExplain` produces an advisory explanation from the deterministic result. `validateExplanation` enforces length (≤200 chars), rejects control/HTML characters, and rejects text that contradicts the availability decision. `explainAvailability` orchestrates adapter → validate → fallback to `result.reason` on any failure. Supports an injectable `ExplainAdapter` for test simulation (timeout, API failure). No network calls or API keys. |
| `src/lib/filter.ts` | `filterRooms` filters by capacity ≥ attendees AND room has all selected equipment. Pure function. |
| `src/lib/selection.ts` | `evaluateSelection` ties filtering, room selection, time parsing, and availability checking into one `SelectionView`. Handles invalid time strings → "Invalid Input" result. |
| `src/lib/prompt-engineering.ts` | Task #04 experiment comparing three prompt designs (A Basic, B Grounded, C Strict Structured) using a deterministic mock model. All results are simulated, not real LLM evaluations. |
| `src/data/rooms.ts` | Room fixtures. `ROOM_A101` is the UI room. `ROOM_B202`, `ROOM_C303`, `ROOM_D404`, `ROOM_E505` are test-only fixtures. Also exports `Equipment` type, `CatalogRoom` type, and `ALL_EQUIPMENT`. |
| `src/App.tsx` | Main component. Renders only `[ROOM_A101]`. Fixed current time 09:00. Manages filter state, room selection, time inputs, check action, and explain action with fallback panel. |
| `src/components/*` | Presentational components. `FilterPanel` (inputs), `RoomCard` (selectable card), `ResultCard` (availability result), `BookingList` (existing bookings). |

### Booking rules (AC1–AC6)

Implemented in `checkAvailability` in this order:

| Rule | Code line(s) | Description |
|---|---|---|
| AC1 | 52–65 | Valid time interval: `0 <= start < end <= 1440`. Start must be strictly after `currentTime`. |
| AC2 | 77–84 | Maximum booking duration is 120 minutes. |
| AC3 | 87–93 | A blocked room is unavailable at any time. |
| AC4 | 96–105 | No overlap with existing bookings; touching endpoints are allowed (`start < booking.end && end > booking.start`). |
| AC5 | 108–113 | If all rules pass, the room is available. |
| AC6 | (implicit) | The checker is a pure read-only function — it never mutates room or booking data. |

## Local Setup

Install dependencies (uses `package-lock.json`):

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Preview the production build:

```bash
npm run build
npm run preview
```

> The development server runs automatically in the Bolt environment. In a
> local terminal, use `npm run dev`.

## Safe Commands

These are the exact scripts defined in `package.json`:

| Command | Script | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Start the Vite dev server with HMR |
| `npm run build` | `vite build` | Production build to `dist/` |
| `npm run preview` | `vite preview` | Preview the production build locally |
| `npm run test` | `vitest run` | Run all unit tests once |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
| `npm run lint` | `eslint .` | Lint all source files |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json` | Type-check without emitting |

**Recommended verification sequence after any change:**

```bash
npm run test
npm run build
npm run lint
npm run typecheck
```

All four must pass before claiming a task is complete.

## Coding Conventions

### TypeScript

- **Strict mode** is enabled (`tsconfig.app.json`). All function parameters
  must have explicit types. Avoid implicit `any`.
- Use `type` for object shapes and `interface` where appropriate; the codebase
  uses both (e.g. `interface Booking`, `type ExplainAdapter`).
- Prefer `null` over `undefined` for "no value" returns from parsers
  (e.g. `timeStringToMinutes` returns `number | null`).
- Times are represented as **minutes from midnight** (0–1440) internally,
  converted to `HH:MM` strings only at boundaries via `formatTime`.

### Imports and path aliases

- Use the `@/` alias for all project-internal imports: `@/lib/availability`,
  `@/data/rooms`, `@/components/RoomCard`. Never use deep relative paths like
  `../../lib/availability`.
- Import types with `import type { ... }` when only types are needed.
- Import every symbol you reference — no implicit globals.

### React and components

- Function components only. No class components.
- Components are default-exported from `src/components/` and named after their
  purpose (`RoomCard`, `BookingList`, `FilterPanel`, `ResultCard`).
- Use React hooks (`useState`) for local state. No global state or context.
- Use stable, data-derived keys for list items — never bare array indices.
- Styling: Tailwind CSS utility classes only. No custom CSS beyond
  `src/index.css` Tailwind directives.
- Icons: `lucide-react`. Import only the icons used.

### Module design

- Prefer **pure functions** and minimal changes. The availability checker,
  filter, and selection modules are all pure.
- Keep booking rules in `src/lib/availability.ts`, separate from UI and
  fixture data.
- Co-locate unit tests next to the module they test
  (`src/lib/availability.test.ts`).
- Reuse shared room fixtures from `src/data/rooms.ts`. Do not duplicate.
- Do not mutate booking fixtures or room data — always treat as read-only.
- Use at most two design patterns, only when justified.

## Testing Expectations

### What exists

The test suite uses **Vitest** with a Node environment (no DOM). Tests are
co-located in `src/lib/*.test.ts`:

| Test file | Tests | Covers |
|---|---|---|
| `src/lib/availability.test.ts` | 24 | `formatTime`, `timeStringToMinutes`, `checkAvailability` (all AC1–AC6 cases, boundary cases including 24:00) |
| `src/lib/explain.test.ts` | 28 | `validateExplanation`, `mockLlmExplain`, `explainAvailability` fallback, Task #05 nine failure scenarios (empty, long, timeout, API failure), decision invariance |
| `src/lib/prompt-engineering.test.ts` | 21 | Task #04 prompts, structured context, mock model determinism, scoring rubric |
| `src/lib/filter.test.ts` | 12 | `filterRooms` capacity/equipment filtering, `evaluateSelection` integration |

Run the full suite:

```bash
npm run test
```

### Agent testing obligations

- **Always run `npm run test` before and after modifying booking logic,
  availability rules, or the explain feature.** All tests must pass.
- **Add or update tests** when you modify `checkAvailability`,
  `timeStringToMinutes`, `validateExplanation`, `explainAvailability`,
  `filterRooms`, or `evaluateSelection`. A change to logic without a
  corresponding test is incomplete.
- **Add regression tests** for any bug you fix, covering both the failing case
  and the corrected behavior.
- Tests must be deterministic — no network calls, no real APIs, no timers.
  Use the injectable `ExplainAdapter` to simulate failures locally.
- Test times in minutes from midnight (e.g. `660` = 11:00). Use the
  `CURRENT_09` / `FIXED_CURRENT_MINUTES` convention for the 09:00 current time.
- Assert exact `available`, `reasonLabel`, and `reason` values for
  availability results.
- Never bypass or skip tests to make a change pass.

## Allowed Agent Actions

- Read any source file, configuration file, or test file in the repository.
- Review and analyze code for correctness, security, quality, and performance.
- Propose small, focused changes to application or test code.
- Add or update unit tests alongside logic changes.
- Run safe local commands: `npm run test`, `npm run build`, `npm run lint`,
  `npm run typecheck`, `npm run dev`.
- Create or update documentation files (`.md`) when requested.
- Use the `@/` path alias for all internal imports.

## Prohibited Agent Actions

- **Reading, exposing, or committing secrets or credentials.** Do not print
  `.env` values, API keys, tokens, or passwords. Do not hardcode secrets.
- **Production deployments.** Do not deploy, publish, or push to any remote.
- **Destructive shell commands.** No `rm -rf`, `git reset --hard`, forced
  overwrites, or deleting files outside explicit instruction.
- **Deleting important project files without approval.** Do not delete source,
  test, configuration, or documentation files unless explicitly asked.
- **Unreviewed dependency installation or upgrades.** Do not run
  `npm install <package>` or upgrade versions without human approval. Do not
  add new dependencies unless explicitly required.
- **Changing environment configuration without approval.** Do not modify
  `.env`, `.bolt/config.json`, or deployment configuration.
- **Bypassing tests or security checks.** Do not skip tests, disable lint
  rules, or silence type errors to force a pass.
- **Unreviewed large refactors.** Do not restructure modules, rename exports,
  or change architectural patterns without human review.
- **Introducing a backend, database, authentication, or booking creation.**
  The app is frontend-only with fictional data. No Supabase, no API calls,
  no login.
- **Changing booking rules without a demonstrated requirement.** AC1–AC6 are
  fixed unless explicitly requested.
- **Making the current time editable or showing rooms other than A101 in the
  UI.**
- **Connecting a real LLM or external API** to the Explain feature. The mock
  model is deterministic and local by design.

## Human Review and Approval

- **All AI-generated changes require human review** before being accepted,
  merged, or deployed. No exception.
- The agent must present: files changed, rationale, diff summary, and test
  evidence (pass/fail counts) for every change.
- The agent must not claim a task is complete until a human has reviewed the
  output.
- If a change is experimental or uncertain, the agent must label it as such
  and request explicit approval before proceeding.
- Destructive or hard-to-reverse actions (deleting files, dropping data,
  changing dependencies) require per-action confirmation, not blanket approval.

## Definition of Done

An agent may claim a coding task is complete only when **all** of the
following are true:

1. **Functionality preserved.** The A101-only UI, fixed 09:00 current time,
   booking rules AC1–AC6, and the Explain Availability feature with fallback
   all work as before.
2. **Tests pass.** `npm run test` passes with zero failures. New or modified
   logic has corresponding tests.
3. **Build passes.** `npm run build` completes without errors.
4. **Lint passes.** `npm run lint` reports no errors or warnings.
5. **Type-check passes.** `npm run typecheck` reports no errors.
6. **No prohibited changes.** No backend, database, auth, real API, new
   dependencies, or deleted files were introduced without approval.
7. **Changes documented.** The agent reports which files changed, why, and
   what test evidence supports the change.
8. **Human review requested.** The agent explicitly states that the change is
   ready for human review and has not self-merged or self-deployed.

If any of these conditions are unmet, the task is **not done** and the agent
must report the gap honestly.
