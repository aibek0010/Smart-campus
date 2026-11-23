export interface Booking {
  start: number; // minutes from midnight (0–1440)
  end: number;
}

export interface Room {
  id: string;
  name: string;
  blocked: boolean;
  bookings: Booking[];
}

export interface AvailabilityResult {
  available: boolean;
  reasonLabel: string;
  reason: string;
}

export const MAX_DURATION_MINUTES = 120;
export const MINUTES_PER_DAY = 1440;

// Single source of truth for availability reason labels. Every module that
// branches on a reasonLabel (selection.ts, explain.ts) references these
// constants instead of duplicating the string literal, so a label can only
// drift in one place.
export const REASON_LABELS = {
  invalidTimeRange: 'Invalid Time Range',
  startNotAfterCurrent: 'Start Time Not After Current',
  durationExceedsLimit: 'Duration Exceeds Limit',
  roomBlocked: 'Room Blocked',
  timeConflict: 'Time Conflict',
  available: 'Available',
  invalidInput: 'Invalid Input',
} as const;

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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

/**
 * Core availability validation implementing all acceptance criteria.
 * Does NOT mutate room or booking data — pure read-only check.
 */
export function checkAvailability(
  room: Room,
  start: number,
  end: number,
  currentTime: number
): AvailabilityResult {
  // R01 mitigation — reject non-finite numeric inputs before any comparison.
  // NaN bypasses all relational guards because every NaN comparison is false.
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(currentTime)) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.invalidTimeRange,
      reason: 'Times must be finite numeric values between 00:00 and 24:00.',
    };
  }

  // AC1 — Valid time interval: 0 <= start < end <= 1440
  if (start < 0 || end > MINUTES_PER_DAY) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.invalidTimeRange,
      reason: 'Times must be between 00:00 and 24:00.',
    };
  }
  if (start >= end) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.invalidTimeRange,
      reason: 'Start time must be earlier than end time.',
    };
  }

  // AC1 — Start must be strictly after the current time
  if (start <= currentTime) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.startNotAfterCurrent,
      reason: `The requested start time (${formatTime(start)}) must be after the current time (${formatTime(currentTime)}).`,
    };
  }

  // AC2 — Maximum duration of 120 minutes
  const duration = end - start;
  if (duration > MAX_DURATION_MINUTES) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.durationExceedsLimit,
      reason: `The requested booking is ${duration} minutes long. The maximum allowed is ${MAX_DURATION_MINUTES} minutes (2 hours).`,
    };
  }

  // AC3 — Blocked room
  if (room.blocked) {
    return {
      available: false,
      reasonLabel: REASON_LABELS.roomBlocked,
      reason: `${room.name} is currently blocked and cannot be booked at any time.`,
    };
  }

  // AC4 — No overlap (touching endpoints allowed)
  // R02 mitigation — validate booking data integrity before overlap detection.
  // A malformed booking (non-finite times or start >= end) must not be silently
  // ignored, which would cause a missed conflict and a false "Available".
  for (const booking of room.bookings) {
    if (
      !Number.isFinite(booking.start) ||
      !Number.isFinite(booking.end) ||
      booking.start < 0 ||
      booking.end > MINUTES_PER_DAY ||
      booking.start >= booking.end
    ) {
      return {
        available: false,
        reasonLabel: REASON_LABELS.invalidTimeRange,
        reason: `${room.name} has malformed booking data and cannot be evaluated safely.`,
      };
    }
    const overlaps = start < booking.end && end > booking.start;
    if (overlaps) {
      return {
        available: false,
        reasonLabel: REASON_LABELS.timeConflict,
        reason: `The requested time (${formatTime(start)}–${formatTime(end)}) overlaps an existing booking (${formatTime(booking.start)}–${formatTime(booking.end)}).`,
      };
    }
  }

  // AC5 — Available
  return {
    available: true,
    reasonLabel: REASON_LABELS.available,
    reason: `${room.name} is available from ${formatTime(start)} to ${formatTime(end)} (${duration} minutes). No conflicts with existing bookings.`,
  };
}
