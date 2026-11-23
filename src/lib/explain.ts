import type { AvailabilityResult, Booking, Room } from '@/lib/availability';
import { formatTime, REASON_LABELS } from '@/lib/availability';

export const MAX_EXPLANATION_LENGTH = 200;
const HTML_TAG_RE = /</;

function hasControlOrHtml(text: string): boolean {
  if (HTML_TAG_RE.test(text)) return true;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

export interface ExplainContext {
  room: Room;
  start: number;
  end: number;
  currentTime: number;
}

export type ExplainStatus = 'ready' | 'error';

export interface ExplainOutcome {
  text: string;
  status: ExplainStatus;
  usingFallback: boolean;
}

/**
 * Adapter contract for the explanation generator. Defaults to the local
 * deterministic `mockLlmExplain`. Tests inject custom adapters to simulate
 * empty output, over-length output, timeouts, and API failures — all locally,
 * with no real network calls.
 */
export type ExplainAdapter = (result: AvailabilityResult, ctx: ExplainContext) => string;

/** Simulated timeout from the mock adapter. */
export class ExplainTimeoutError extends Error {
  constructor(message = 'Simulated explanation timeout.') {
    super(message);
    this.name = 'ExplainTimeoutError';
  }
}

/** Simulated API failure from the mock adapter. */
export class ExplainApiError extends Error {
  constructor(message = 'Simulated explanation API failure.') {
    super(message);
    this.name = 'ExplainApiError';
  }
}

/**
 * Local deterministic mock "LLM" adapter.
 * No network, no API keys, no mutation of room/booking data.
 * Produces only an advisory explanation string derived from the
 * deterministic AvailabilityResult and read-only context.
 */
export function mockLlmExplain(result: AvailabilityResult, ctx: ExplainContext): string {
  const { room, start, end, currentTime } = ctx;
  const range = `${formatTime(start)}–${formatTime(end)}`;
  const duration = end - start;

  if (result.available) {
    const conflicts = conflictingBookings(room.bookings, start, end);
    const tail =
      conflicts.length === 0
        ? 'There are no overlapping bookings for this slot.'
        : conflicts
            .map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`)
            .join(', ') + ' would overlap, but this slot avoids them.';
    return `${room.name} is free ${range} (${duration} min). ${tail}`;
  }

  switch (result.reasonLabel) {
    case REASON_LABELS.timeConflict: {
      const conflicts = conflictingBookings(room.bookings, start, end);
      const listing =
        conflicts.length > 0
          ? conflicts.map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`).join(', ')
          : 'an existing booking';
      return `${room.name} is unavailable ${range}: it overlaps ${listing}. Try a different time.`;
    }
    case REASON_LABELS.roomBlocked:
      return `${room.name} is blocked and cannot be booked at any time.`;
    case REASON_LABELS.durationExceedsLimit:
      return `${room.name} ${range} is ${duration} min — over the 120 min limit. Shorten your booking.`;
    case REASON_LABELS.startNotAfterCurrent:
      return `Start ${formatTime(start)} must be after the current time ${formatTime(currentTime)}.`;
    case REASON_LABELS.invalidTimeRange:
      return `The requested times are invalid. Use times between 00:00 and 24:00 with start before end.`;
    case REASON_LABELS.invalidInput:
      return `Please enter valid start and end times in HH:MM format.`;
    default:
      return result.reason;
  }
}

function conflictingBookings(bookings: Booking[], start: number, end: number): Booking[] {
  return bookings.filter((b) => start < b.end && end > b.start);
}

/**
 * Validates a raw explanation string (AC3).
 * Returns null when valid, or a human-readable rejection reason when invalid.
 */
export function validateExplanation(text: string, result: AvailabilityResult): string | null {
  if (typeof text !== 'string' || text.length === 0) {
    return 'Explanation is empty.';
  }
  if (text.length > MAX_EXPLANATION_LENGTH) {
    return `Explanation exceeds ${MAX_EXPLANATION_LENGTH} characters.`;
  }
  if (hasControlOrHtml(text)) {
    return 'Explanation contains control characters or HTML tags.';
  }
  if (contradictsAvailability(text, result)) {
    return 'Explanation contradicts the availability result.';
  }
  return null;
}

/**
 * Consistency check: the explanation must not contradict the deterministic
 * availability decision. Catches an LLM saying "available" when the room is
 * not, or vice-versa.
 */
function contradictsAvailability(text: string, result: AvailabilityResult): boolean {
  const lower = text.toLowerCase();
  if (result.available) {
    // When available, an explanation asserting unavailability is a contradiction.
    return /\bunavailable\b|\bnot (free|available)\b|\bis blocked\b/.test(lower);
  }
  // When unavailable, an explanation asserting availability is a contradiction.
  return /\bavailable\b|\bis free\b|\byou can book\b|\bgo ahead\b/.test(lower) && !/\bunavailable\b/.test(lower);
}

/**
 * Orchestrates the explain flow (AC1-AC5):
 * 1. Calls the mock adapter (advisory only — never re-checks availability).
 * 2. Validates the output (AC3).
 * 3. Falls back to the deterministic reason text on any failure (AC4).
 * Never mutates room/booking data (AC2). Never changes availability (AC1).
 */
export function explainAvailability(
  result: AvailabilityResult,
  ctx: ExplainContext,
  adapter: ExplainAdapter = mockLlmExplain
): ExplainOutcome {
  try {
    const raw = adapter(result, ctx);
    const error = validateExplanation(raw, result);
    if (error) {
      return { text: result.reason, status: 'error', usingFallback: true };
    }
    return { text: raw, status: 'ready', usingFallback: false };
  } catch {
    return { text: result.reason, status: 'error', usingFallback: true };
  }
}
