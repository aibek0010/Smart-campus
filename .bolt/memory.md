# Project memory

## Product intent & audience

- Software engineering assignment project (structured task series; currently at Task 07 of at least 08).
- Core feature: room booking availability checking with time-overlap detection.
- Audience: course graders and human reviewers; production-quality code expected.

## Brand personality & voice

- Engineering-focused, precise, minimal-diff communication style.
- Responses follow structured lettered formats (A–G) with before/after tables and exact command outputs.

## Visual design & UX direction

- Vite + React + TypeScript + Tailwind CSS stack.
- UI uses Lucide React icons; `@/` path alias maps to `src/`.
- No additional UI/icon/theme packages permitted unless explicitly requested.

## Decisions, constraints & rationale

- `src/lib/availability.ts` is the central module; `checkAvailability` validates rooms against bookings.
- Time values are minutes in range 0–1440 (24-hour day).
- Return type includes `available: boolean` and a `reasonLabel` string; labels sourced from a `REASON_LABELS` constant (e.g. `invalidTimeRange` → "Invalid Time Range").
- R01 fix: `Number.isFinite` guard on `start`, `end`, `currentTime` at function top — rejects NaN/Infinity inputs.
- R02 fix: per-booking validation (finite, 0–1440, `start < end`) inside overlap loop — malformed bookings return `available: false` with `invalidTimeRange` label (safe-failure strategy, no silent ignore).
- Existing acceptance criteria AC1–AC6 must remain satisfied for valid inputs.
- Risk-reproduction tests (7 total, from Task 04) must not be modified to pass; production code is fixed instead.
- No package installs, dependency upgrades, or unrelated refactors allowed.

## Open questions & assumptions

- Pre-existing `caniuse-lite is outdated` Browserslist warning acknowledged; requires human-approved dependency update, deferred.
- `currentTime` NaN guard is defensive only — UI currently passes fixed `540`.
- Safe-failure for malformed bookings is conservative (room unbookable); no repair/normalization attempted.
- Task 08 not yet started; assignment workflow ongoing.