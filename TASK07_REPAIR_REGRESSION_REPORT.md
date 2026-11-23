# Task #07 — Repair and Regression-Test Report

## Selected findings

| Finding | Severity | Description |
|---|---|---|
| F-02 | Low | Inconsistent handling of the 24:00 time boundary between `timeStringToMinutes` and `checkAvailability` |
| F-03 | Low | Unstable React keys (array index) in `BookingList` |

Both were confirmed in the Task #06 agentic review and independently verified by the manual checklist inspection (16/16 agreement).

## F-02 — Inconsistent 24:00 time boundary

### Root cause

`timeStringToMinutes` rejected any hour > 23, so `"24:00"` returned `null` (→ "Invalid Input" in `selection.ts`). But `checkAvailability` accepted `end = 1440` (it only rejected `end > 1440`). The two functions disagreed on the 24:00 boundary: the numeric checker allowed a booking ending at midnight, but the string parser could not produce the value 1440 to feed it.

### Why the fix is necessary

AC1 states `0 <= start < end <= 1440`. A booking ending at 24:00 (1440 minutes) is valid per AC1. Without the fix, a programmatic caller passing `end = 1440` to `checkAvailability` would succeed, while the equivalent string `"24:00"` would be rejected as invalid input — an inconsistency that could cause confusion and would break any future caller that round-trips times through strings. The fix makes the parser and the checker agree: `"24:00"` is the only valid hour-24 value and maps to 1440.

### Files and lines changed

**`src/lib/availability.ts`** — `timeStringToMinutes` (lines 28–37)

Before:

```typescript
export function timeStringToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
```

After:

```typescript
export function timeStringToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || m < 0 || m > 59) return null;
  // "24:00" is the only valid hour-24 value and maps to 1440 (end of day),
  // matching checkAvailability which allows end = MINUTES_PER_DAY.
  if (h === 24) return m === 0 ? MINUTES_PER_DAY : null;
  if (h > 24) return null;
  return h * 60 + m;
}
```

### New regression tests

Added to `src/lib/availability.test.ts`:

1. `parses "24:00" as 1440 (end of day), matching checkAvailability` — asserts `timeStringToMinutes('24:00') === 1440`
2. `rejects "24:01" and other invalid hour-24 values` — asserts `"24:01"`, `"24:30"`, `"24:59"` all return `null`
3. `allows a booking ending exactly at 24:00 (end = 1440)` — asserts `checkAvailability(roomB202, 1380, 1440, ...)` is available
4. `rejects a booking ending after 24:00 (end = 1441)` — asserts `checkAvailability(roomB202, 1380, 1441, ...)` is "Invalid Time Range"
5. `parser and checker agree at the 24:00 boundary` — round-trips `"24:00"` through the parser into `checkAvailability` and asserts available

### Expected vs observed

| Test | Expected | Observed | Result |
|---|---|---|---|
| `timeStringToMinutes('24:00')` | `1440` | `1440` | PASS |
| `timeStringToMinutes('24:01')` | `null` | `null` | PASS |
| `checkAvailability(b202, 1380, 1440, 540)` | available | available, `reasonLabel='Available'` | PASS |
| `checkAvailability(b202, 1380, 1441, 540)` | unavailable | unavailable, `reasonLabel='Invalid Time Range'` | PASS |
| Round-trip `"24:00"` → checker | available | available | PASS |

## F-03 — Unstable React keys in BookingList

### Root cause

`BookingList` rendered each booking list item with `key={i}`, using the array index as the React key. React keys identify which items change, are added, or are removed. Array indices are unstable: if bookings were ever inserted, removed, or reordered, React could reuse the wrong DOM node and render stale content.

### Why the fix is necessary

Even though the current fixtures are static, index keys are a known React anti-pattern that invites subtle rendering bugs the moment data becomes dynamic. Replacing the index with a stable key derived from the booking data (start, end, and index for disambiguation) ensures correct reconciliation if bookings ever change. The fix preserves the existing UI and behavior — only the key changes.

### Files and lines changed

**`src/components/BookingList.tsx`** — line 18

Before:

```tsx
<li
  key={i}
  className="..."
>
```

After:

```tsx
<li
  key={`${b.start}-${b.end}-${i}`}
  className="..."
>
```

The key combines `start`, `end`, and `i` (for disambiguation if two bookings ever share the same times). No other line changed.

### Expected vs observed

No behavioral change is visible — the booking list renders identically. The build and typecheck confirm the JSX is valid. The existing filter/selection tests that exercise room rendering still pass.

## Verification commands and results

| Check | Command | Result |
|---|---|---|
| Tests | `npm run test` | **85 passed, 0 failed** (4 files) |
| Build | `npm run build` | **Passed** — 1.66s |
| Lint | `npm run lint` | **Passed** — no errors |
| Typecheck | `npm run typecheck` | **Passed** — no errors |

Test breakdown:
- `src/lib/availability.test.ts` — 24 tests (19 original + 5 new regression)
- `src/lib/explain.test.ts` — 28 tests (all pass, including Task #05 LLM failure scenarios)
- `src/lib/prompt-engineering.test.ts` — 21 tests (all pass)
- `src/lib/filter.test.ts` — 12 tests (all pass)

All original booking tests and all LLM-feature tests still pass.

## Remaining unresolved findings from Task #06

| Finding | Severity | Status | Reason |
|---|---|---|---|
| F-01 | Low | Unresolved | `formatTime(1440)` renders "24:00". This is now consistent with the parser (which accepts "24:00"), and "24:00" is a valid end-of-day representation. Cosmetic only; no behavioral fix needed. |
| F-04 | Informational | Unresolved | `hasControlOrHtml` rejects all `<` characters. Safe-side behavior; no live impact. |
| F-05 | Informational | Unresolved | `explaining` state set/cleared synchronously. No-op for the deterministic mock. |
| F-06 | Informational | Unresolved | Tautological condition in `scorePrompt`. Dead left operand; no functional impact. |
| F-07 | Informational | Unresolved | Factual-agreement regex works by coincidence. No live impact. |
| F-08 | Low | Resolved | Missing `formatTime(1440)` test — the existing test file already asserts `formatTime(1440) === '24:00'` (line 21), and the new regression tests cover the 24:00 boundary end-to-end. |

## Demonstration readiness

**READY.**

Justification:
- All 85 tests pass (0 failures), including 5 new regression tests for the 24:00 boundary.
- Build, lint, and typecheck are all clean.
- The UI remains A101-only with fixed 09:00 current time — no UI or fixture changes.
- The Explain Availability feature and its deterministic fallback are untouched and fully tested (28 explain tests pass).
- No backend, database, authentication, or API keys were added.
- Both fixes are focused: 1 function updated, 1 JSX key changed, 5 tests added.
