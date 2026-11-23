import type { AvailabilityResult, Booking, Room } from '@/lib/availability';
import { checkAvailability, formatTime, MAX_DURATION_MINUTES } from '@/lib/availability';
import { validateExplanation, MAX_EXPLANATION_LENGTH } from '@/lib/explain';
import { ROOM_A101, ROOM_C303 } from '@/data/rooms';

/**
 * Task #04 — Prompt Engineering experiment.
 *
 * This module is fully deterministic and uses a local mock "model" — no
 * external APIs, no API keys, no network calls. All results are SIMULATED,
 * not real LLM evaluations, and are labelled as such in the report and in
 * every returned score object.
 */

export type PromptVersion = 'A' | 'B' | 'C';

export interface StructuredContext {
  roomId: string;
  startTime: string;
  endTime: string;
  available: boolean;
  reasonCode: string;
  existingBookings: Array<{ start: string; end: string }>;
  durationMinutes: number;
}

export interface ScenarioInput {
  room: Room;
  start: number;
  end: number;
}

export interface Scenario {
  id: string;
  label: string;
  input: ScenarioInput;
}

export interface PromptResult {
  version: PromptVersion;
  prompt: string;
  systemInstruction: string;
  output: string;
  valid: boolean;
  validationError: string | null;
}

export interface MetricScore {
  clarity: number; // 0–10
  consistency: number; // 0–10
  factualAgreement: number; // 0–10
}

export interface ScenarioEvaluation {
  scenarioId: string;
  scenarioLabel: string;
  context: StructuredContext;
  availabilityResult: AvailabilityResult;
  results: PromptResult[];
  scores: Record<PromptVersion, MetricScore>;
  simulated: true;
}

export interface ComparisonReport {
  scenarios: ScenarioEvaluation[];
  averages: Record<PromptVersion, MetricScore & { label: string }>;
  simulated: true;
}

export const FIXED_CURRENT_MINUTES = 9 * 60; // 09:00

/* --------------------------------------------------------------------------
 * Prompt versions
 * ------------------------------------------------------------------------ */

export const PROMPT_A_BASIC = `Explain whether this room is available for booking. Give a short answer.`;

export const PROMPT_B_GROUNDED = `You are a room-availability assistant. Use ONLY the facts supplied in the
structured context. Do not invent bookings, room details, or recommendations.
If the context says the room is unavailable, say so plainly. Keep the answer
under 200 characters.`;

export const PROMPT_C_STRICT = `You are a room-availability assistant for a campus booking system.
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
   room is free for the requested slot and duration.`;

export const PROMPTS: Record<PromptVersion, { prompt: string; systemInstruction: string }> = {
  A: { prompt: PROMPT_A_BASIC, systemInstruction: '' },
  B: { prompt: PROMPT_B_GROUNDED, systemInstruction: PROMPT_B_GROUNDED },
  C: { prompt: PROMPT_C_STRICT, systemInstruction: PROMPT_C_STRICT },
};

/* --------------------------------------------------------------------------
 * Structured context builder
 * ------------------------------------------------------------------------ */

export function buildStructuredContext(
  result: AvailabilityResult,
  room: Room,
  start: number,
  end: number
): StructuredContext {
  const relevantBookings = pickBookings(result, room, start, end);
  return {
    roomId: room.id,
    startTime: formatTime(start),
    endTime: formatTime(end),
    available: result.available,
    reasonCode: result.reasonLabel,
    existingBookings: relevantBookings.map((b) => ({
      start: formatTime(b.start),
      end: formatTime(b.end),
    })),
    durationMinutes: end - start,
  };
}

function pickBookings(result: AvailabilityResult, room: Room, start: number, end: number): Booking[] {
  if (result.available) {
    // For available results, surface the room's bookings so the model can
    // confirm none overlap.
    return room.bookings.slice();
  }
  if (result.reasonLabel === 'Time Conflict') {
    return room.bookings.filter((b) => start < b.end && end > b.start);
  }
  // For other unavailability reasons, the room's bookings are not the cause;
  // surface nothing to avoid the model inventing a conflict narrative.
  return [];
}

/* --------------------------------------------------------------------------
 * Deterministic mock model (one per prompt version)
 * ------------------------------------------------------------------------ */

/**
 * A deterministic mock model that produces an explanation string conditioned
 * on the prompt version. This is NOT a real LLM — it is a hand-coded stand-in
 * used to compare prompt designs reproducibly. Every result is simulated.
 */
export function mockModelGenerate(
  version: PromptVersion,
  result: AvailabilityResult,
  ctx: StructuredContext
): string {
  const range = `${ctx.startTime}–${ctx.endTime}`;
  switch (version) {
    case 'A': {
      // Prompt A is vague. The mock mimics a loosely-instructed model that
      // sometimes drifts: it adds an unsupported recommendation and, on the
      // blocked scenario, speculates about booking details not supplied.
      if (ctx.available) {
        return `${ctx.roomId.toUpperCase()} looks open ${range}. You could also try Room B202 if you prefer.`;
      }
      if (ctx.reasonCode === 'Room Blocked') {
        return `${ctx.roomId.toUpperCase()} might be available if the block clears — maybe it was booked 09:00–10:00. Not sure.`;
      }
      if (ctx.reasonCode === 'Time Conflict') {
        return `${ctx.roomId.toUpperCase()} is busy ${range}. Maybe pick another time or a bigger room.`;
      }
      if (ctx.reasonCode === 'Duration Exceeds Limit') {
        return `That booking is too long. Try shortening it or splitting it across days.`;
      }
      return `${ctx.roomId.toUpperCase()} is unavailable ${range}.`;
    }
    case 'B': {
      // Prompt B is grounded: the mock sticks to supplied facts but is terse
      // and does not tailor the message to the reason code.
      if (ctx.available) {
        return `${ctx.roomId.toUpperCase()} is available ${range} for ${ctx.durationMinutes} minutes. No overlapping bookings.`;
      }
      if (ctx.reasonCode === 'Room Blocked') {
        return `${ctx.roomId.toUpperCase()} is unavailable. Reason: room blocked.`;
      }
      if (ctx.reasonCode === 'Time Conflict') {
        const booking = ctx.existingBookings[0];
        return booking
          ? `${ctx.roomId.toUpperCase()} is unavailable ${range} due to a booking ${booking.start}–${booking.end}.`
          : `${ctx.roomId.toUpperCase()} is unavailable ${range} due to a conflict.`;
      }
      if (ctx.reasonCode === 'Duration Exceeds Limit') {
        return `${ctx.roomId.toUpperCase()} is unavailable. Reason: duration exceeds limit.`;
      }
      return `${ctx.roomId.toUpperCase()} is unavailable ${range}. Reason: ${ctx.reasonCode}.`;
    }
    case 'C': {
      // Prompt C is strict and structured: the mock follows the reason-code
      // routing spelled out in the system instruction.
      if (ctx.available) {
        return `${ctx.roomId.toUpperCase()} is free ${range} (${ctx.durationMinutes} min). No conflicts with the listed bookings.`;
      }
      if (ctx.reasonCode === 'Room Blocked') {
        return `${ctx.roomId.toUpperCase()} is blocked and cannot be booked at any time.`;
      }
      if (ctx.reasonCode === 'Time Conflict') {
        const booking = ctx.existingBookings[0];
        return booking
          ? `${ctx.roomId.toUpperCase()} is unavailable ${range}: it overlaps a booking ${booking.start}–${booking.end}. Please choose a different time.`
          : `${ctx.roomId.toUpperCase()} is unavailable ${range}: it overlaps an existing booking. Please choose a different time.`;
      }
      if (ctx.reasonCode === 'Duration Exceeds Limit') {
        return `${ctx.roomId.toUpperCase()} ${range} is ${ctx.durationMinutes} min, which exceeds the ${MAX_DURATION_MINUTES}-minute limit. Please shorten the booking.`;
      }
      if (ctx.reasonCode === 'Start Time Not After Current') {
        return `The start time ${ctx.startTime} must be after the current time 09:00.`;
      }
      return `${ctx.roomId.toUpperCase()} is unavailable ${range}. Reason: ${ctx.reasonCode}.`;
    }
  }
}

/* --------------------------------------------------------------------------
 * Evaluation
 * ------------------------------------------------------------------------ */

export const SCENARIOS: Scenario[] = [
  { id: 'available', label: 'Available: 11:00–12:00', input: { room: ROOM_A101, start: 660, end: 720 } },
  { id: 'conflict', label: 'Time conflict: 10:00–12:00', input: { room: ROOM_A101, start: 600, end: 720 } },
  { id: 'blocked', label: 'Blocked room (test fixture only)', input: { room: ROOM_C303, start: 660, end: 720 } },
  {
    id: 'duration',
    label: 'Duration exceeding 120 minutes',
    input: { room: ROOM_A101, start: 600, end: 780 }, // 10:00–13:00 = 180 min
  },
];

export function evaluatePrompt(version: PromptVersion, result: AvailabilityResult, ctx: StructuredContext): PromptResult {
  const { prompt, systemInstruction } = PROMPTS[version];
  const output = mockModelGenerate(version, result, ctx);
  const validationError = validateExplanation(output, result);
  return {
    version,
    prompt,
    systemInstruction,
    output,
    valid: validationError === null,
    validationError,
  };
}

/**
 * Score a single prompt result on Clarity, Consistency, and Factual Agreement.
 * These are deterministic, rubric-based scores — SIMULATED, not human judged.
 */
export function scorePrompt(result: PromptResult, ctx: StructuredContext): MetricScore {
  const text = result.output;
  const lower = text.toLowerCase();

  // Clarity: mentions the room and the time range, and is readable.
  let clarity = 0;
  if (ctx.roomId.toUpperCase() && text.toUpperCase().includes(ctx.roomId.toUpperCase())) clarity += 3;
  if (text.includes(ctx.startTime) || text.includes(ctx.endTime)) clarity += 3;
  if (text.length > 0 && text.length <= MAX_EXPLANATION_LENGTH) clarity += 2;
  if (!/[?!]{2,}/.test(text)) clarity += 2; // penalize hedges like "Not sure??"
  clarity = clamp10(clarity);

  // Consistency: the explanation must agree with the deterministic decision
  // and not contradict itself.
  let consistency = 0;
  if (result.valid) consistency += 5; // validation includes the contradiction check
  if (ctx.available ? /\bfree\b|\bavailable\b/.test(lower) : /\bunavailable\b|\bbusy\b|\bblocked\b|\bexceeds\b|\boverlaps\b|\bafter\b/.test(lower)) {
    consistency += 3;
  }
  if (!/\bmight\b|\bnot sure\b|\bmaybe\b/i.test(text)) consistency += 2;
  consistency = clamp10(consistency);

  // Factual Agreement: only references bookings present in the context and
  // does not invent room info or recommendations.
  let factualAgreement = 0;
  if (result.valid) factualAgreement += 3;
  const referencedBooking = ctx.existingBookings.find(
    (b) => text.includes(b.start) && text.includes(b.end)
  );
  if (ctx.existingBookings.length > 0) {
    if (referencedBooking) factualAgreement += 3;
  } else {
    // No bookings to cite; reward not inventing any booking time.
    if (!/\b\d{2}:\d{2}–\d{2}:\d{2}\b/.test(text)) factualAgreement += 3;
  }
  if (/room b202|bigger room|split.*days|try.*room/i.test(text)) {
    // Unsupported recommendation / invented room reference.
    factualAgreement -= 3;
  }
  if (ctx.reasonCode === 'Room Blocked' && /\b09:00.10:00\b/.test(text)) {
    // Invented booking detail on a blocked room.
    factualAgreement -= 2;
  }
  factualAgreement = clamp10(factualAgreement);

  return { clarity, consistency, factualAgreement };
}

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, n));
}

export function evaluateScenario(scenario: Scenario): ScenarioEvaluation {
  const { room, start, end } = scenario.input;
  // Importing locally would create a cycle only if availability imported this
  // module — it does not. Keep the import at the top of the file instead.
  const result = checkAvailabilityLocal(room, start, end);
  const ctx = buildStructuredContext(result, room, start, end);

  const results: PromptResult[] = (['A', 'B', 'C'] as PromptVersion[]).map((v) =>
    evaluatePrompt(v, result, ctx)
  );
  const scores = {
    A: scorePrompt(results[0], ctx),
    B: scorePrompt(results[1], ctx),
    C: scorePrompt(results[2], ctx),
  };

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    context: ctx,
    availabilityResult: result,
    results,
    scores,
    simulated: true,
  };
}

export function evaluateAllScenarios(scenarios: Scenario[] = SCENARIOS): ComparisonReport {
  const evaluated = scenarios.map(evaluateScenario);
  const versions: PromptVersion[] = ['A', 'B', 'C'];
  const averages = {} as Record<PromptVersion, MetricScore & { label: string }>;
  for (const v of versions) {
    const sums = evaluated.reduce(
      (acc, s) => ({
        clarity: acc.clarity + s.scores[v].clarity,
        consistency: acc.consistency + s.scores[v].consistency,
        factualAgreement: acc.factualAgreement + s.scores[v].factualAgreement,
      }),
      { clarity: 0, consistency: 0, factualAgreement: 0 }
    );
    const n = evaluated.length || 1;
    averages[v] = {
      clarity: round1(sums.clarity / n),
      consistency: round1(sums.consistency / n),
      factualAgreement: round1(sums.factualAgreement / n),
      label: v === 'A' ? 'Basic' : v === 'B' ? 'Grounded' : 'Strict Structured',
    };
  }
  return { scenarios: evaluated, averages, simulated: true };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Local wrapper to keep the 09:00 fixed current time in one place.
function checkAvailabilityLocal(room: Room, start: number, end: number): AvailabilityResult {
  return checkAvailability(room, start, end, FIXED_CURRENT_MINUTES);
}
