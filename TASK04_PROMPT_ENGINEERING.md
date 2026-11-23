# Task #04 — Prompt Engineering Report

> **SIMULATED RESULTS — NOT REAL LLM EVALUATIONS.**
> All prompt outputs and scores below were produced by a deterministic mock
> model implemented in `src/lib/prompt-engineering.ts`. No external APIs, API
> keys, or network calls were used. The scores are rubric-based and reproducible.

## 1. Prompt versions

### Prompt A — Basic

A simple instruction with no system instruction.

```text
Explain whether this room is available for booking. Give a short answer.
```

### Prompt B — Grounded

A system instruction requiring the model to use only supplied facts.

```text
You are a room-availability assistant. Use ONLY the facts supplied in the
structured context. Do not invent bookings, room details, or recommendations.
If the context says the room is unavailable, say so plainly. Keep the answer
under 200 characters.
```

### Prompt C — Strict Structured

A system instruction requiring concise, respectful explanations based only on
structured availability data and reason codes.

```text
You are a room-availability assistant for a campus booking system.
Follow these rules exactly:
1. Base the explanation ONLY on the structured availability data and the
   reason code provided. Do not reference any booking not listed.
2. Never change the deterministic availability decision given in the context.
3. Do not make unsupported claims or add unrelated recommendations.
4. Be concise (under 200 characters) and respectful.
5. If the reason code is "Room Blocked", say the room is blocked and cannot
   be booked. If the reason code is "Duration Exceeds Limit", mention the
   120-minute limit. If the reason code is "Time Conflict", name the
   overlapping booking times from the context. If "Available", confirm the
   room is free for the requested slot and duration.
```

### Prohibited behaviors (enforced by B and C)

The system instructions explicitly prohibit:

- Inventing bookings or room information
- Changing the deterministic availability decision
- Making unsupported claims
- Adding unrelated recommendations

These prohibitions are also enforced programmatically by the validator in
`src/lib/explain.ts` (`validateExplanation`), which rejects outputs that
contradict the deterministic availability result.

## 2. Structured context

Every prompt receives the same structured context object:

| Field | Type | Description |
|---|---|---|
| `roomId` | string | Room identifier (e.g. `a101`) |
| `startTime` | string | `HH:MM` |
| `endTime` | string | `HH:MM` |
| `available` | boolean | Deterministic availability decision |
| `reasonCode` | string | `Available` / `Time Conflict` / `Room Blocked` / `Duration Exceeds Limit` / `Start Time Not After Current` / `Invalid Time Range` / `Invalid Input` |
| `existingBookings` | `{start,end}[]` | Bookings relevant to the result (overlapping bookings for conflicts; all bookings when available; empty otherwise) |
| `durationMinutes` | number | Requested duration |

### Example contexts

**Available (11:00–12:00, A101):**

```json
{
  "roomId": "a101",
  "startTime": "11:00",
  "endTime": "12:00",
  "available": true,
  "reasonCode": "Available",
  "existingBookings": [{ "start": "10:00", "end": "11:00" }],
  "durationMinutes": 60
}
```

**Time conflict (10:00–12:00, A101):**

```json
{
  "roomId": "a101",
  "startTime": "10:00",
  "endTime": "12:00",
  "available": false,
  "reasonCode": "Time Conflict",
  "existingBookings": [{ "start": "10:00", "end": "11:00" }],
  "durationMinutes": 120
}
```

**Blocked room (C303, test fixture):**

```json
{
  "roomId": "c303",
  "startTime": "11:00",
  "endTime": "12:00",
  "available": false,
  "reasonCode": "Room Blocked",
  "existingBookings": [],
  "durationMinutes": 60
}
```

**Duration exceeding 120 minutes (10:00–13:00, A101):**

```json
{
  "roomId": "a101",
  "startTime": "10:00",
  "endTime": "13:00",
  "available": false,
  "reasonCode": "Duration Exceeds Limit",
  "existingBookings": [],
  "durationMinutes": 180
}
```

## 3. Test scenarios

All scenarios use the fixed current time **09:00**.

| ID | Label | Room | Start | End | Deterministic result |
|---|---|---|---|---|---|
| `available` | Available: 11:00–12:00 | A101 | 11:00 | 12:00 | Available |
| `conflict` | Time conflict: 10:00–12:00 | A101 | 10:00 | 12:00 | Time Conflict (overlaps 10:00–11:00) |
| `blocked` | Blocked room (test fixture only) | C303 | 11:00 | 12:00 | Room Blocked |
| `duration` | Duration exceeding 120 minutes | A101 | 10:00 | 13:00 | Duration Exceeds Limit (180 min) |

The blocked scenario uses the C303 test-fixture room only — it never appears in
the application UI, which remains A101-only.

## 4. Mock model outputs (SIMULATED)

### Scenario 1 — Available (11:00–12:00)

| Version | Output | Valid |
|---|---|---|
| A | `A101 looks open 11:00–12:00. You could also try Room B202 if you prefer.` | yes |
| B | `A101 is available 11:00–12:00 for 60 minutes. No overlapping bookings.` | yes |
| C | `A101 is free 11:00–12:00 (60 min). No conflicts with the listed bookings.` | yes |

### Scenario 2 — Time conflict (10:00–12:00)

| Version | Output | Valid |
|---|---|---|
| A | `A101 is busy 10:00–12:00. Maybe pick another time or a bigger room.` | yes |
| B | `A101 is unavailable 10:00–12:00 due to a booking 10:00–11:00.` | yes |
| C | `A101 is unavailable 10:00–12:00: it overlaps a booking 10:00–11:00. Please choose a different time.` | yes |

### Scenario 3 — Blocked room (C303)

| Version | Output | Valid |
|---|---|---|
| A | `C303 might be available if the block clears — maybe it was booked 09:00–10:00. Not sure.` | **no — contradicts availability** |
| B | `C303 is unavailable. Reason: room blocked.` | yes |
| C | `C303 is blocked and cannot be booked at any time.` | yes |

### Scenario 4 — Duration exceeding 120 minutes

| Version | Output | Valid |
|---|---|---|
| A | `That booking is too long. Try shortening it or splitting it across days.` | yes |
| B | `A101 is unavailable. Reason: duration exceeds limit.` | yes |
| C | `A101 10:00–13:00 is 180 min, which exceeds the 120-minute limit. Please shorten the booking.` | yes |

## 5. Comparison table

Scores are 0–10 per metric, averaged across the four scenarios. **SIMULATED.**

| Version | Label | Clarity | Consistency | Factual Agreement | Avg |
|---|---|---|---|---|---|
| A | Basic | 7.8 | 5.5 | 0.8 | 4.7 |
| B | Grounded | 8.5 | 10.0 | 5.3 | 7.9 |
| C | Strict Structured | 9.3 | 10.0 | 4.5 | 7.9 |

### Per-scenario scores

| Scenario | Version | Clarity | Consistency | Factual Agreement |
|---|---|---|---|---|
| Available | A | 10 | 7 | 0 |
| Available | B | 10 | 10 | 3 |
| Available | C | 10 | 10 | 3 |
| Time conflict | A | 10 | 8 | 0 |
| Time conflict | B | 10 | 10 | 6 |
| Time conflict | C | 10 | 10 | 6 |
| Blocked | A | 7 | 0 | 0 |
| Blocked | B | 7 | 10 | 6 |
| Blocked | C | 7 | 10 | 6 |
| Duration | A | 4 | 7 | 3 |
| Duration | B | 7 | 10 | 6 |
| Duration | C | 10 | 10 | 3 |

## 6. Findings and conclusion

**Finding 1 — Prompt A (Basic) is unsafe.** With only a vague instruction, the
mock model drifts: it recommends an unrelated room (B202) on the available
scenario, hedges with "maybe" and invents a booking time on the blocked
scenario, and suggests splitting bookings across days on the duration scenario.
On the blocked scenario it produces an **invalid** output that contradicts the
deterministic availability decision and would be rejected by the validator,
triggering the fallback path. Average factual agreement: **0.8/10**.

**Finding 2 — Prompt B (Grounded) is consistent and safe.** Grounding the model
in "only the facts supplied" eliminates invented bookings and contradictions.
Every output is valid. Consistency is a perfect **10/10** across all scenarios.
Factual agreement is strong (5.3/10), penalized only because B is terse and
does not always cite the specific reason details (e.g. the 120-minute limit).

**Finding 3 — Prompt C (Strict Structured) is the clearest.** The reason-code
routing in the system instruction produces the most specific, actionable
explanations — naming the overlapping booking, the 120-minute limit, and the
blocked status. It ties B on consistency (10/10) and leads on clarity (9.3/10).
Its factual-agreement average (4.5/10) is marginally below B's only because the
duration scenario's output does not cite a supplied booking (none exist for
that reason code), which the rubric rewards slightly less — not because it
invents anything.

**Conclusion.** Prompt C (Strict Structured) is the recommended production
prompt. It combines perfect consistency with the highest clarity, enforces all
four prohibited behaviors in the system instruction, and its outputs are
tailored to each reason code. Prompt B is a strong second choice when brevity
matters more than specificity. Prompt A should not be used: it produces
unsupported recommendations and, on the blocked scenario, an output that
contradicts the deterministic availability decision and is rejected by the
existing validator.

## 7. Automated tests

`src/lib/prompt-engineering.test.ts` contains 21 tests covering:

- Three distinct prompt versions exist and contain the required prohibitions
- Structured context includes all required fields across all reason codes
- Mock model is deterministic (same inputs → same output) and simulated
- All outputs stay under the 200-character limit
- The four required scenarios are defined with correct rooms/times
- The blocked scenario uses a test-fixture room (C303), not the UI room
- `evaluateScenario` returns simulated results for all three versions
- Prompt C scores at least as high as A on factual agreement
- Prompt C is valid on every scenario
- Averages are within 0–10 and labelled
- Prompt A produces an invalid result on the blocked scenario
- The scoring rubric rewards citing only supplied bookings

## 8. Project requirements preserved

- Only Room A101 in the UI — unchanged (`App.tsx` still passes `[ROOM_A101]`)
- Fixed current time 09:00 — unchanged
- Booking rules AC1–AC6 — `checkAvailability` untouched
- Explain Availability feature and fallback — `src/lib/explain.ts` untouched
- No backend, authentication, database, or API keys — all logic is local and deterministic
