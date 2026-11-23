# Task #05 — Test Report: Normal and Failure Cases

## Overview

This report documents a reproducible test suite covering nine scenarios for the
Smart Campus Room Availability Checker's Explain Availability feature, plus
three invariance checks confirming the availability decision is never changed by
explanation generation (including failure cases).

All tests are automated in `src/lib/explain.test.ts` and run via `npm run test`.
No real API calls, keys, backend, or network dependencies are used. Timeout and
API failure are simulated locally by injecting custom adapters into
`explainAvailability`.

## Files changed

| File | Change |
|---|---|
| `src/lib/explain.ts` | Added `ExplainAdapter` type, `ExplainTimeoutError`, `ExplainApiError`, and an optional `adapter` parameter to `explainAvailability` (defaults to the existing `mockLlmExplain`). Backward-compatible — no caller changed. |
| `src/lib/explain.test.ts` | Added 12 Task #05 scenario tests (S1–S12) alongside the existing AC1–AC5 tests. |
| `TASK05_TEST_REPORT.md` | This report. |

No other files were modified. The A101-only UI, fixed 09:00 current time, room
fixtures, booking rules AC1–AC6, and the Explain Availability feature are all
preserved.

## Test matrix

| ID | Scenario | Input | Expected result | Observed result | Status | Evidence |
|---|---|---|---|---|---|---|
| S1 | Available | A101, 11:00–12:00, current 09:00 | `available=true`, reason `Available`; explanation `ready`, no fallback | `available=true`, `reasonLabel='Available'`, `status='ready'`, `usingFallback=false` | PASS | `src/lib/explain.test.ts` → `Task #05 > S1 — available: A101 11:00–12:00 is available` |
| S2 | Overlapping booking | A101, 10:00–12:00 (overlaps 10:00–11:00 booking) | `available=false`, reason `Time Conflict`; explanation `ready` | `available=false`, `reasonLabel='Time Conflict'`, `status='ready'`, `usingFallback=false` | PASS | `src/lib/explain.test.ts` → `Task #05 > S2 — overlapping booking: A101 10:00–12:00 overlaps 10:00–11:00` |
| S3 | Blocked room (fixture only) | C303, 11:00–12:00 | `available=false`, reason `Room Blocked`; explanation `ready` | `available=false`, `reasonLabel='Room Blocked'`, `status='ready'`, `usingFallback=false` | PASS | `src/lib/explain.test.ts` → `Task #05 > S3 — blocked room: C303 (test fixture) is blocked` |
| S4 | Invalid time | A101, start=end=12:00 | `available=false`, reason `Invalid Time Range`; safe fallback text | `available=false`, `reasonLabel='Invalid Time Range'`, non-empty fallback text | PASS | `src/lib/explain.test.ts` → `Task #05 > S4 — invalid time: start >= end` |
| S5 | Past time | A101, 09:00–10:00 (start not after current 09:00) | `available=false`, reason `Start Time Not After Current`; safe fallback text | `available=false`, `reasonLabel='Start Time Not After Current'`, non-empty fallback text | PASS | `src/lib/explain.test.ts` → `Task #05 > S5 — past time: start at 09:00 is not strictly after current 09:00` |
| S6 | Empty LLM output | A101, 11:00–12:00; adapter returns `''` | `status='error'`, `usingFallback=true`, text = deterministic reason | `status='error'`, `usingFallback=true`, `text === result.reason` | PASS | `src/lib/explain.test.ts` → `Task #05 > S6 — empty LLM output produces safe fallback` |
| S7 | Excessively long LLM output | A101, 11:00–12:00; adapter returns 250 chars | `status='error'`, `usingFallback=true`, text = deterministic reason, ≤200 chars | `status='error'`, `usingFallback=true`, `text === result.reason`, length ≤200 | PASS | `src/lib/explain.test.ts` → `Task #05 > S7 — excessively long LLM output produces safe fallback` |
| S8 | Simulated timeout | A101, 11:00–12:00; adapter throws `ExplainTimeoutError` | `status='error'`, `usingFallback=true`, text = deterministic reason | `status='error'`, `usingFallback=true`, `text === result.reason` | PASS | `src/lib/explain.test.ts` → `Task #05 > S8 — simulated timeout produces safe fallback` |
| S9 | Simulated API failure | A101, 11:00–12:00; adapter throws `ExplainApiError` | `status='error'`, `usingFallback=true`, text = deterministic reason | `status='error'`, `usingFallback=true`, `text === result.reason` | PASS | `src/lib/explain.test.ts` → `Task #05 > S9 — simulated API failure produces safe fallback` |
| S10 | Decision invariance (available) | A101, 11:00–12:00; run explanation | `available` and `reasonLabel` identical before/after | identical | PASS | `src/lib/explain.test.ts` → `Task #05 > S10 — availability decision identical before and after explanation (available)` |
| S11 | Decision invariance (failure) | A101, 11:00–12:00; adapter throws API error | `available` and `reasonLabel` identical before/after | identical | PASS | `src/lib/explain.test.ts` → `Task #05 > S11 — availability decision identical before and after explanation (failure case)` |
| S12 | Fallback consistency (unavailable) | C303 blocked; adapter throws timeout | fallback text validates as consistent; `available` stays `false` | `validateExplanation(outcome.text, result) === null`, `available=false` | PASS | `src/lib/explain.test.ts` → `Task #05 > S12 — fallback text for an unavailable result is consistent (no flip)` |

## Evidence references (exact paths and test names)

All Task #05 tests live in:

```
src/lib/explain.test.ts
```

Under the describe block:

```
Task #05 — Normal and failure-case scenarios
```

Individual test names (copy-paste into `npm run test -- -t "<name>"` to rerun):

- `S1 — available: A101 11:00–12:00 is available`
- `S2 — overlapping booking: A101 10:00–12:00 overlaps 10:00–11:00`
- `S3 — blocked room: C303 (test fixture) is blocked`
- `S4 — invalid time: start >= end`
- `S5 — past time: start at 09:00 is not strictly after current 09:00`
- `S6 — empty LLM output produces safe fallback`
- `S7 — excessively long LLM output produces safe fallback`
- `S8 — simulated timeout produces safe fallback`
- `S9 — simulated API failure produces safe fallback`
- `S10 — availability decision identical before and after explanation (available)`
- `S11 — availability decision identical before and after explanation (failure case)`
- `S12 — fallback text for an unavailable result is consistent (no flip)`

The adapter injection that makes S6–S9 possible is in `src/lib/explain.ts`:
`ExplainAdapter` type, `ExplainTimeoutError`, `ExplainApiError`, and the
optional third parameter of `explainAvailability`.

## Verification results

| Check | Command | Result |
|---|---|---|
| Tests | `npm run test` | 80 passed, 0 failed (4 files) |
| Build | `npm run build` | Passed — built in 1.86s |
| Lint | `npm run lint` | Passed — no errors or warnings |
| Typecheck | `npm run typecheck` | Passed — no TypeScript errors |

No tests failed. All 12 Task #05 scenarios and all 68 pre-existing tests pass.

## How timeout and API failure are simulated

`explainAvailability` now accepts an optional `adapter` parameter (default:
the existing `mockLlmExplain`). Tests inject custom adapters:

- **S6 (empty):** `() => ''`
- **S7 (long):** `() => 'A'.repeat(250)`
- **S8 (timeout):** `() => { throw new ExplainTimeoutError(); }`
- **S9 (API failure):** `() => { throw new ExplainApiError(); }`

The orchestrator's `try/catch` catches any thrown error and returns the
deterministic `result.reason` as fallback text with `status='error'` and
`usingFallback=true`. No real network or timeout is involved.

## UI screenshot guidance

Screenshots were **not** captured automatically. To capture them manually in
the Bolt Preview:

### Available case (S1)

1. Open the Preview — the app shows only Room A101.
2. Set Start Time to `11:00` and End Time to `12:00`.
3. Press **Check Availability** — a green "Available" result card appears.
4. Press **Explain** — a sky-blue explanation panel appears below the result
   with text like "Room A101 is free 11:00–12:00 (60 min). There are no
   overlapping bookings for this slot."
5. Screenshot the result card and explanation panel.

### Overlap case (S2)

1. Set Start Time to `10:00` and End Time to `12:00`.
2. Press **Check Availability** — a red "Unavailable" card appears with the
   "Time Conflict" badge.
3. Press **Explain** — the explanation names the overlapping 10:00–11:00
   booking.
4. Screenshot the result card and explanation panel.

### Explanation fallback case (S6/S8/S9)

The fallback path is triggered when explanation generation fails (empty,
over-length, timeout, or API error). In the live UI the default adapter
succeeds, so the amber "Explanation unavailable — showing reason" panel is not
shown by default. To demonstrate it:

- Run the automated tests S6, S8, or S9 (`npm run test -- -t "S6"`), which
  inject the failing adapters and assert the fallback. The test output is the
  evidence; no UI screenshot is produced because the fallback is only reachable
  in the UI when the real adapter fails (which the deterministic mock never
  does).

If a UI screenshot of the fallback panel is still desired, temporarily replace
the adapter passed in `App.tsx`'s `handleExplain` with one that throws, then
press Explain — an amber panel titled "Explanation unavailable — showing
reason" will appear. Revert the change afterward.

## Conclusion

All nine required scenarios (available, overlapping booking, blocked room,
invalid time, past time, empty LLM output, excessively long LLM output,
timeout, and simulated API failure) are covered by automated tests, plus three
invariance checks. Every test passes. The deterministic availability decision
is never changed by explanation generation — not in normal cases, not in
failure cases. Blocked-room testing uses the C303 test fixture only and never
exposes additional rooms in the A101-only UI. No backend, authentication,
database, API keys, or network calls were added.
