import { describe, it, expect } from 'vitest';
import { checkAvailability } from '@/lib/availability';
import { ROOM_A101, ROOM_C303 } from '@/data/rooms';
import {
  PROMPT_A_BASIC,
  PROMPT_B_GROUNDED,
  PROMPT_C_STRICT,
  PROMPTS,
  buildStructuredContext,
  mockModelGenerate,
  evaluatePrompt,
  scorePrompt,
  evaluateScenario,
  evaluateAllScenarios,
  SCENARIOS,
  FIXED_CURRENT_MINUTES,
  type PromptVersion,
} from '@/lib/prompt-engineering';
import { MAX_EXPLANATION_LENGTH } from '@/lib/explain';

const NOW = FIXED_CURRENT_MINUTES;

function resultFor(room: typeof ROOM_A101, start: number, end: number) {
  return checkAvailability(room, start, end, NOW);
}

describe('prompt versions', () => {
  it('exposes three distinct prompt versions A, B, C', () => {
    expect(PROMPTS.A.prompt).toBe(PROMPT_A_BASIC);
    expect(PROMPTS.B.systemInstruction).toBe(PROMPT_B_GROUNDED);
    expect(PROMPTS.C.systemInstruction).toBe(PROMPT_C_STRICT);
    const texts = [PROMPT_A_BASIC, PROMPT_B_GROUNDED, PROMPT_C_STRICT];
    expect(new Set(texts).size).toBe(3);
  });

  it('Prompt B requires using only supplied facts', () => {
    expect(PROMPT_B_GROUNDED.toLowerCase()).toContain('only the facts supplied');
  });

  it('Prompt C prohibits inventing bookings and changing the decision', () => {
    const p = PROMPT_C_STRICT.toLowerCase();
    expect(p).toContain('do not reference any booking not listed');
    expect(p).toContain('never change the deterministic availability decision');
    expect(p).toContain('do not make unsupported claims');
    expect(p).toContain('unrelated recommendations');
  });
});

describe('structured context', () => {
  it('includes all required fields', () => {
    const result = resultFor(ROOM_A101, 660, 720); // available 11:00–12:00
    const ctx = buildStructuredContext(result, ROOM_A101, 660, 720);
    expect(ctx).toEqual({
      roomId: 'a101',
      startTime: '11:00',
      endTime: '12:00',
      available: true,
      reasonCode: 'Available',
      existingBookings: [{ start: '10:00', end: '11:00' }],
      durationMinutes: 60,
    });
  });

  it('surfaces the overlapping booking for a Time Conflict', () => {
    const result = resultFor(ROOM_A101, 600, 720); // 10:00–12:00 overlaps 10:00–11:00
    const ctx = buildStructuredContext(result, ROOM_A101, 600, 720);
    expect(ctx.available).toBe(false);
    expect(ctx.reasonCode).toBe('Time Conflict');
    expect(ctx.existingBookings).toEqual([{ start: '10:00', end: '11:00' }]);
  });

  it('surfaces no bookings for a blocked room', () => {
    const result = resultFor(ROOM_C303, 660, 720);
    const ctx = buildStructuredContext(result, ROOM_C303, 660, 720);
    expect(ctx.reasonCode).toBe('Room Blocked');
    expect(ctx.existingBookings).toEqual([]);
  });

  it('includes durationMinutes for a duration-exceeding scenario', () => {
    const result = resultFor(ROOM_A101, 600, 780); // 180 min
    const ctx = buildStructuredContext(result, ROOM_A101, 600, 780);
    expect(ctx.reasonCode).toBe('Duration Exceeds Limit');
    expect(ctx.durationMinutes).toBe(180);
  });
});

describe('mock model is deterministic and simulated', () => {
  it('same inputs produce identical outputs (deterministic)', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    const ctx = buildStructuredContext(result, ROOM_A101, 660, 720);
    const a1 = mockModelGenerate('A', result, ctx);
    const a2 = mockModelGenerate('A', result, ctx);
    const c1 = mockModelGenerate('C', result, ctx);
    const c2 = mockModelGenerate('C', result, ctx);
    expect(a1).toBe(a2);
    expect(c1).toBe(c2);
  });

  it('all outputs are under the 200-character limit', () => {
    const cases: Array<{ room: typeof ROOM_A101; start: number; end: number }> = [
      { room: ROOM_A101, start: 660, end: 720 },
      { room: ROOM_A101, start: 600, end: 720 },
      { room: ROOM_C303, start: 660, end: 720 },
      { room: ROOM_A101, start: 600, end: 780 },
    ];
    for (const c of cases) {
      const result = resultFor(c.room, c.start, c.end);
      const ctx = buildStructuredContext(result, c.room, c.start, c.end);
      for (const v of ['A', 'B', 'C'] as PromptVersion[]) {
        const out = mockModelGenerate(v, result, ctx);
        expect(out.length).toBeLessThanOrEqual(MAX_EXPLANATION_LENGTH);
      }
    }
  });
});

describe('test scenarios', () => {
  it('defines exactly the four required scenarios', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(['available', 'conflict', 'blocked', 'duration']);
  });

  it('blocked scenario uses a test-fixture room (C303), not the UI room', () => {
    const blocked = SCENARIOS.find((s) => s.id === 'blocked');
    expect(blocked).toBeDefined();
    expect(blocked!.input.room.id).toBe('c303');
  });

  it('available scenario targets A101 at 11:00–12:00', () => {
    const avail = SCENARIOS.find((s) => s.id === 'available');
    expect(avail!.input.room.id).toBe('a101');
    expect(avail!.input.start).toBe(660);
    expect(avail!.input.end).toBe(720);
  });

  it('duration scenario exceeds 120 minutes', () => {
    const dur = SCENARIOS.find((s) => s.id === 'duration');
    expect(dur!.input.end - dur!.input.start).toBeGreaterThan(120);
  });
});

describe('evaluation and scoring', () => {
  it('evaluateScenario returns simulated results for all three versions', () => {
    const ev = evaluateScenario(SCENARIOS[0]);
    expect(ev.simulated).toBe(true);
    expect(ev.results).toHaveLength(3);
    expect(ev.results.map((r) => r.version)).toEqual(['A', 'B', 'C']);
    expect(ev.scores.A).toBeDefined();
    expect(ev.scores.B).toBeDefined();
    expect(ev.scores.C).toBeDefined();
  });

  it('Prompt C scores at least as high as Prompt A on factual agreement across all scenarios', () => {
    const report = evaluateAllScenarios();
    expect(report.simulated).toBe(true);
    expect(report.averages.C.factualAgreement).toBeGreaterThanOrEqual(report.averages.A.factualAgreement);
  });

  it('Prompt C is valid (passes validation) on every scenario', () => {
    const report = evaluateAllScenarios();
    for (const s of report.scenarios) {
      const c = s.results.find((r) => r.version === 'C')!;
      expect(c.valid, `${s.scenarioId}: C output "${c.output}"`).toBe(true);
    }
  });

  it('averages are within 0–10 and labelled', () => {
    const report = evaluateAllScenarios();
    for (const v of ['A', 'B', 'C'] as PromptVersion[]) {
      const a = report.averages[v];
      expect(a.label).toBeTruthy();
      expect(a.clarity).toBeGreaterThanOrEqual(0);
      expect(a.clarity).toBeLessThanOrEqual(10);
      expect(a.consistency).toBeGreaterThanOrEqual(0);
      expect(a.consistency).toBeLessThanOrEqual(10);
      expect(a.factualAgreement).toBeGreaterThanOrEqual(0);
      expect(a.factualAgreement).toBeLessThanOrEqual(10);
    }
  });

  it('Prompt A produces an invalid result on the blocked scenario (invented booking detail)', () => {
    const blocked = SCENARIOS.find((s) => s.id === 'blocked')!;
    const ev = evaluateScenario(blocked);
    const a = ev.results.find((r) => r.version === 'A')!;
    expect(a.valid).toBe(false);
  });
});

describe('system instruction prohibitions', () => {
  it('every system instruction that has one forbids unsupported recommendations', () => {
    expect(PROMPT_B_GROUNDED.toLowerCase()).toContain('do not invent');
    expect(PROMPT_C_STRICT.toLowerCase()).toContain('unrelated recommendations');
  });
});

describe('evaluatePrompt ties prompt + system instruction to the output', () => {
  it('returns the prompt and system instruction used', () => {
    const result = resultFor(ROOM_A101, 660, 720);
    const ctx = buildStructuredContext(result, ROOM_A101, 660, 720);
    const pr = evaluatePrompt('C', result, ctx);
    expect(pr.prompt).toBe(PROMPT_C_STRICT);
    expect(pr.systemInstruction).toBe(PROMPT_C_STRICT);
    expect(pr.output.length).toBeGreaterThan(0);
  });
});

describe('scorePrompt rubric', () => {
  it('rewards factual agreement when only supplied bookings are cited', () => {
    const result = resultFor(ROOM_A101, 600, 720); // conflict
    const ctx = buildStructuredContext(result, ROOM_A101, 600, 720);
    const c = evaluatePrompt('C', result, ctx);
    const score = scorePrompt(c, ctx);
    expect(score.factualAgreement).toBeGreaterThan(0);
  });
});
