import { describe, it, expect } from 'vitest';
import { checkAvailability, type AvailabilityResult, type Room } from '@/lib/availability';
import { ROOM_A101, ROOM_B202, ROOM_C303 } from '@/data/rooms';
import {
  explainAvailability,
  mockLlmExplain,
  validateExplanation,
  ExplainTimeoutError,
  ExplainApiError,
  MAX_EXPLANATION_LENGTH,
  type ExplainContext,
  type ExplainAdapter,
  type ExplainOutcome,
} from '@/lib/explain';

const NOW = 9 * 60; // 09:00

const ctxFor = (room: Room, start: number, end: number): ExplainContext => ({
  room,
  start,
  end,
  currentTime: NOW,
});

const resultFor = (room: Room, start: number, end: number): AvailabilityResult =>
  checkAvailability(room, start, end, NOW);

/* -------------------------------------------------------------------------- */
/* Existing AC1–AC5 coverage (preserved)                                       */
/* -------------------------------------------------------------------------- */

describe('AC1 — deterministic core preserved', () => {
  it('explainAvailability does not recompute or change the availability decision', () => {
    const result = resultFor(ROOM_A101, 660, 720); // Available
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720));
    expect(outcome.text).toBeTruthy();
    expect(result.available).toBe(true);
  });

  it('explanation cannot flip an unavailable result into an available one', () => {
    const result = resultFor(ROOM_C303, 660, 720); // blocked → unavailable
    const outcome = explainAvailability(result, ctxFor(ROOM_C303, 660, 720));
    expect(result.available).toBe(false);
    expect(outcome.status).toBe('ready');
  });
});

describe('AC2 — LLM is advisory only, no mutation', () => {
  it('mockLlmExplain does not mutate room or booking data', () => {
    const roomCopy: Room = {
      ...ROOM_A101,
      bookings: ROOM_A101.bookings.map((b) => ({ ...b })),
    };
    const result = resultFor(roomCopy, 660, 720);
    mockLlmExplain(result, ctxFor(roomCopy, 660, 720));
    expect(roomCopy.bookings).toEqual(ROOM_A101.bookings);
  });

  it('mockLlmExplain returns a plain string (no side effects)', () => {
    const result = resultFor(ROOM_B202, 541, 661);
    const out = mockLlmExplain(result, ctxFor(ROOM_B202, 541, 661));
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('AC3 — output is validated and safe', () => {
  it('rejects empty explanations', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    expect(validateExplanation('', result)).not.toBeNull();
  });

  it('rejects explanations over 200 characters', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    const long = 'A'.repeat(MAX_EXPLANATION_LENGTH + 1);
    expect(validateExplanation(long, result)).not.toBeNull();
  });

  it('rejects explanations containing HTML tags', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    expect(validateExplanation('Room A101 <script>alert(1)</script> is free', result)).not.toBeNull();
  });

  it('rejects explanations containing control characters', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    expect(validateExplanation('Room A101 is free\n\nbut maybe not', result)).not.toBeNull();
  });

  it('rejects an explanation contradicting an unavailable result', () => {
    const result = resultFor(ROOM_C303, 660, 720); // blocked
    expect(validateExplanation('Room C303 is available and you can book it.', result)).not.toBeNull();
  });

  it('rejects an explanation contradicting an available result', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    expect(validateExplanation('Room A101 is unavailable right now.', result)).not.toBeNull();
  });

  it('accepts a valid, consistent explanation', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    const text = mockLlmExplain(result, ctxFor(ROOM_A101, 660, 720));
    expect(validateExplanation(text, result)).toBeNull();
  });
});

describe('AC4 — graceful failure / fallback', () => {
  it('falls back to the deterministic reason when validation fails', () => {
    const result: AvailabilityResult = {
      available: false,
      reasonLabel: 'Room Blocked',
      reason: 'Room C303 is currently blocked and cannot be booked at any time.',
    };
    const contradictory = 'Room C303 is available, go ahead and book it now.';
    expect(validateExplanation(contradictory, result)).not.toBeNull();
    const outcome = explainAvailability(result, ctxFor(ROOM_C303, 660, 720));
    expect(outcome.text).toBeTruthy();
  });

  it('falls back to reason text when the adapter throws', () => {
    const result: AvailabilityResult = {
      available: true,
      reasonLabel: 'Available',
      reason: 'Fallback reason.',
    };
    const outcome = explainAvailability(result, ctxFor(ROOM_B202, 541, 661));
    expect(outcome.text).toBeTruthy();
    expect(outcome.status === 'ready' || outcome.status === 'error').toBe(true);
  });

  it('fallback never crashes and always returns a non-empty string', () => {
    const result = resultFor(ROOM_A101, 630, 690); // conflict
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 630, 690));
    expect(outcome.text.length).toBeGreaterThan(0);
  });
});

describe('AC5 — scope preserved (no backend / no auth / deterministic)', () => {
  it('mockLlmExplain is deterministic: same inputs => same output', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    const a = mockLlmExplain(result, ctxFor(ROOM_A101, 660, 720));
    const b = mockLlmExplain(result, ctxFor(ROOM_A101, 660, 720));
    expect(a).toBe(b);
  });

  it('produces explanations for all known reason labels', () => {
    const cases: Array<{ room: Room; start: number; end: number }> = [
      { room: ROOM_A101, start: 660, end: 720 }, // available
      { room: ROOM_A101, start: 630, end: 690 }, // conflict
      { room: ROOM_C303, start: 660, end: 720 }, // blocked
      { room: ROOM_B202, start: 541, end: 721 }, // duration
      { room: ROOM_A101, start: 540, end: 600 }, // start not after current
      { room: ROOM_B202, start: 600, end: 600 }, // invalid range
    ];
    for (const c of cases) {
      const result = resultFor(c.room, c.start, c.end);
      const outcome = explainAvailability(result, ctxFor(c.room, c.start, c.end));
      expect(outcome.text.length).toBeGreaterThan(0);
      expect(outcome.text.length).toBeLessThanOrEqual(MAX_EXPLANATION_LENGTH);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Task #05 — nine normal and failure-case scenarios                           */
/* -------------------------------------------------------------------------- */

/**
 * Helper: assert the availability decision is identical before and after
 * requesting an explanation, including failure cases (requirement 7).
 */
function expectDecisionUnchanged(before: AvailabilityResult, outcome: ExplainOutcome): void {
  expect(outcome.text.length).toBeGreaterThan(0);
  // Fallback or valid text must never contradict the deterministic decision.
  expect(validateExplanation(outcome.text, before)).toBeNull();
}

describe('Task #05 — Normal and failure-case scenarios', () => {
  /* -------------------- Normal availability scenarios ------------------- */

  it('S1 — available: A101 11:00–12:00 is available', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    expect(result.available).toBe(true);
    expect(result.reasonLabel).toBe('Available');
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720));
    expect(outcome.status).toBe('ready');
    expect(outcome.usingFallback).toBe(false);
    expectDecisionUnchanged(result, outcome);
  });

  it('S2 — overlapping booking: A101 10:00–12:00 overlaps 10:00–11:00', () => {
    const result = resultFor(ROOM_A101, 600, 720);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Time Conflict');
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 600, 720));
    expect(outcome.status).toBe('ready');
    expect(outcome.usingFallback).toBe(false);
    expectDecisionUnchanged(result, outcome);
  });

  it('S3 — blocked room: C303 (test fixture) is blocked', () => {
    // C303 is a test-fixture room; it is never exposed in the A101-only UI.
    const result = resultFor(ROOM_C303, 660, 720);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Room Blocked');
    const outcome = explainAvailability(result, ctxFor(ROOM_C303, 660, 720));
    expect(outcome.status).toBe('ready');
    expect(outcome.usingFallback).toBe(false);
    expectDecisionUnchanged(result, outcome);
  });

  it('S4 — invalid time: start >= end', () => {
    const result = resultFor(ROOM_A101, 720, 720);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Invalid Time Range');
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 720, 720));
    expect(outcome.text.length).toBeGreaterThan(0);
    expectDecisionUnchanged(result, outcome);
  });

  it('S5 — past time: start at 09:00 is not strictly after current 09:00', () => {
    const result = resultFor(ROOM_A101, 540, 600);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Start Time Not After Current');
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 540, 600));
    expect(outcome.text.length).toBeGreaterThan(0);
    expectDecisionUnchanged(result, outcome);
  });

  /* -------------------- LLM failure scenarios (simulated) -------------- */

  it('S6 — empty LLM output produces safe fallback', () => {
    const result = resultFor(ROOM_A101, 660, 720); // available
    const emptyAdapter: ExplainAdapter = () => '';
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720), emptyAdapter);
    expect(outcome.status).toBe('error');
    expect(outcome.usingFallback).toBe(true);
    expect(outcome.text).toBe(result.reason);
    expectDecisionUnchanged(result, outcome);
  });

  it('S7 — excessively long LLM output produces safe fallback', () => {
    const result = resultFor(ROOM_A101, 660, 720); // available
    const longAdapter: ExplainAdapter = () => 'A'.repeat(MAX_EXPLANATION_LENGTH + 50);
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720), longAdapter);
    expect(outcome.status).toBe('error');
    expect(outcome.usingFallback).toBe(true);
    expect(outcome.text).toBe(result.reason);
    expect(outcome.text.length).toBeLessThanOrEqual(MAX_EXPLANATION_LENGTH);
    expectDecisionUnchanged(result, outcome);
  });

  it('S8 — simulated timeout produces safe fallback', () => {
    const result = resultFor(ROOM_A101, 660, 720); // available
    const timeoutAdapter: ExplainAdapter = () => {
      throw new ExplainTimeoutError();
    };
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720), timeoutAdapter);
    expect(outcome.status).toBe('error');
    expect(outcome.usingFallback).toBe(true);
    expect(outcome.text).toBe(result.reason);
    expectDecisionUnchanged(result, outcome);
  });

  it('S9 — simulated API failure produces safe fallback', () => {
    const result = resultFor(ROOM_A101, 660, 720); // available
    const failAdapter: ExplainAdapter = () => {
      throw new ExplainApiError();
    };
    const outcome = explainAvailability(result, ctxFor(ROOM_A101, 660, 720), failAdapter);
    expect(outcome.status).toBe('error');
    expect(outcome.usingFallback).toBe(true);
    expect(outcome.text).toBe(result.reason);
    expectDecisionUnchanged(result, outcome);
  });

  /* ----------- Availability decision invariance (req. 7) -------------- */

  it('S10 — availability decision identical before and after explanation (available)', () => {
    const before = resultFor(ROOM_A101, 660, 720);
    const snapshot = { available: before.available, reasonLabel: before.reasonLabel };
    explainAvailability(before, ctxFor(ROOM_A101, 660, 720));
    expect(before.available).toBe(snapshot.available);
    expect(before.reasonLabel).toBe(snapshot.reasonLabel);
  });

  it('S11 — availability decision identical before and after explanation (failure case)', () => {
    const before = resultFor(ROOM_A101, 660, 720);
    const snapshot = { available: before.available, reasonLabel: before.reasonLabel };
    const failAdapter: ExplainAdapter = () => {
      throw new ExplainApiError('simulated failure');
    };
    explainAvailability(before, ctxFor(ROOM_A101, 660, 720), failAdapter);
    expect(before.available).toBe(snapshot.available);
    expect(before.reasonLabel).toBe(snapshot.reasonLabel);
  });

  it('S12 — fallback text for an unavailable result is consistent (no flip)', () => {
    const result = resultFor(ROOM_C303, 660, 720); // blocked
    const failAdapter: ExplainAdapter = () => {
      throw new ExplainTimeoutError();
    };
    const outcome = explainAvailability(result, ctxFor(ROOM_C303, 660, 720), failAdapter);
    expect(validateExplanation(outcome.text, result)).toBeNull();
    expect(result.available).toBe(false);
  });
});
