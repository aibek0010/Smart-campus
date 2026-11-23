import { describe, it, expect } from 'vitest';
import {
  checkAvailability,
  formatTime,
  timeStringToMinutes,
  REASON_LABELS,
  type Room,
} from '@/lib/availability';
import {
  ROOM_A101 as roomA101,
  ROOM_B202 as roomB202,
  ROOM_C303 as roomC303,
} from '@/data/rooms';

const CURRENT_09 = 540; // 09:00

describe('formatTime', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(540)).toBe('09:00');
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(1440)).toBe('24:00');
  });
});

describe('timeStringToMinutes', () => {
  it('parses valid HH:MM strings', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('09:00')).toBe(540);
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });

  it('returns null for invalid strings', () => {
    expect(timeStringToMinutes('9:00')).toBe(null);
    expect(timeStringToMinutes('25:00')).toBe(null);
    expect(timeStringToMinutes('abc')).toBe(null);
    expect(timeStringToMinutes('12:99')).toBe(null);
  });

  // F-02 regression: 24:00 boundary is consistent with checkAvailability
  it('parses "24:00" as 1440 (end of day), matching checkAvailability', () => {
    expect(timeStringToMinutes('24:00')).toBe(1440);
  });

  it('rejects "24:01" and other invalid hour-24 values', () => {
    expect(timeStringToMinutes('24:01')).toBe(null);
    expect(timeStringToMinutes('24:30')).toBe(null);
    expect(timeStringToMinutes('24:59')).toBe(null);
  });
});

describe('checkAvailability', () => {
  // Test case 1: touching endpoints → Available
  it('allows a booking that touches an existing booking endpoint', () => {
    const result = checkAvailability(roomA101, 660, 720, CURRENT_09); // 11:00–12:00
    expect(result.available).toBe(true);
  });

  // Test case 2: overlap → Unavailable
  it('rejects a booking overlapping an existing booking', () => {
    const result = checkAvailability(roomA101, 630, 690, CURRENT_09); // 10:30–11:30
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Time Conflict');
  });

  // Test case 3: blocked room → Unavailable
  it('rejects a booking for a blocked room', () => {
    const result = checkAvailability(roomC303, 660, 720, CURRENT_09); // 11:00–12:00
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Room Blocked');
  });

  // Test case 4: exactly 2 hours → Available (if other criteria pass)
  it('allows a booking of exactly 120 minutes', () => {
    const result = checkAvailability(roomB202, 541, 661, CURRENT_09); // 09:01–11:01 = 120 min
    expect(result.available).toBe(true);
  });

  // Test case 5: over 2 hours → Unavailable
  it('rejects a booking longer than 120 minutes', () => {
    const result = checkAvailability(roomB202, 541, 721, CURRENT_09); // 09:01–12:01 = 180 min
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Duration Exceeds Limit');
  });

  // Test case 6: start equals current time → Unavailable
  it('rejects a booking where start equals current time', () => {
    const result = checkAvailability(roomA101, 540, 600, CURRENT_09); // 09:00–10:00
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Start Time Not After Current');
  });

  // AC1: start >= end → invalid
  it('rejects when start is not earlier than end', () => {
    const result = checkAvailability(roomB202, 600, 600, CURRENT_09);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Invalid Time Range');
  });

  // AC1: end > 1440 → invalid
  it('rejects when end exceeds 1440', () => {
    const result = checkAvailability(roomB202, 1430, 1441, CURRENT_09);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Invalid Time Range');
  });

  // AC5: availability check must not mutate room data
  it('does not mutate room bookings during check', () => {
    const roomCopy: Room = {
      ...roomA101,
      bookings: roomA101.bookings.map((b) => ({ ...b })),
    };
    checkAvailability(roomCopy, 660, 720, CURRENT_09);
    expect(roomCopy.bookings).toEqual(roomA101.bookings);
  });
   // AC1: start before midnight → invalid
  it('rejects a start time before midnight', () => {
    const result = checkAvailability(roomB202, -1, 60, CURRENT_09);

    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Invalid Time Range');
  });
    it('allows a booking ending exactly when an existing booking starts', () => {
    const result = checkAvailability(roomA101, 570, 600, CURRENT_09);
    expect(result.available).toBe(true);
  });

  it('rejects a booking that contains an existing booking', () => {
    const result = checkAvailability(roomA101, 570, 690, CURRENT_09);
    expect(result.available).toBe(false);
  });

  it('rejects a booking fully inside an existing booking', () => {
    const result = checkAvailability(roomA101, 615, 645, CURRENT_09);
    expect(result.available).toBe(false);
  });

  it('rejects a booking identical to an existing booking', () => {
    const result = checkAvailability(roomA101, 600, 660, CURRENT_09);
    expect(result.available).toBe(false);
  });

  it('allows a time that overlaps another room booking but not this room', () => {
    const result = checkAvailability(roomB202, 600, 660, CURRENT_09);
    expect(result.available).toBe(true);
  });

  it('rejects a booking lasting exactly 121 minutes', () => {
    const result = checkAvailability(roomB202, 540, 661, CURRENT_09);
    expect(result.available).toBe(false);
  });

  // F-02 regression: 24:00 boundary — parser and checker agree
  it('allows a booking ending exactly at 24:00 (end = 1440)', () => {
    const result = checkAvailability(roomB202, 1380, 1440, CURRENT_09); // 23:00–24:00
    expect(result.available).toBe(true);
    expect(result.reasonLabel).toBe('Available');
  });

  it('rejects a booking ending after 24:00 (end = 1441)', () => {
    const result = checkAvailability(roomB202, 1380, 1441, CURRENT_09);
    expect(result.available).toBe(false);
    expect(result.reasonLabel).toBe('Invalid Time Range');
  });

  it('parser and checker agree at the 24:00 boundary', () => {
    // The string "24:00" now parses to 1440, which checkAvailability accepts as end.
    const end = timeStringToMinutes('24:00');
    expect(end).toBe(1440);
    const result = checkAvailability(roomB202, 1380, end!, CURRENT_09);
    expect(result.available).toBe(true);
  });
});

// Task #03 regression: reason labels come from a single source of truth.
// checkAvailability must emit exactly the REASON_LABELS values that
// explain.ts and selection.ts branch on — no drift.
describe('REASON_LABELS single source of truth', () => {
  it('checkAvailability uses REASON_LABELS for every unavailability reason', () => {
    expect(checkAvailability(roomB202, 600, 600, CURRENT_09).reasonLabel).toBe(REASON_LABELS.invalidTimeRange);
    expect(checkAvailability(roomB202, -1, 60, CURRENT_09).reasonLabel).toBe(REASON_LABELS.invalidTimeRange);
    expect(checkAvailability(roomA101, 540, 600, CURRENT_09).reasonLabel).toBe(REASON_LABELS.startNotAfterCurrent);
    expect(checkAvailability(roomB202, 541, 721, CURRENT_09).reasonLabel).toBe(REASON_LABELS.durationExceedsLimit);
    expect(checkAvailability(roomC303, 660, 720, CURRENT_09).reasonLabel).toBe(REASON_LABELS.roomBlocked);
    expect(checkAvailability(roomA101, 630, 690, CURRENT_09).reasonLabel).toBe(REASON_LABELS.timeConflict);
  });

  it('checkAvailability uses REASON_LABELS for the available case', () => {
    expect(checkAvailability(roomA101, 660, 720, CURRENT_09).reasonLabel).toBe(REASON_LABELS.available);
  });

  it('REASON_LABELS contains exactly the labels the rest of the app depends on', () => {
    expect(Object.values(REASON_LABELS).sort()).toEqual(
      [
        'Available',
        'Duration Exceeds Limit',
        'Invalid Input',
        'Invalid Time Range',
        'Room Blocked',
        'Start Time Not After Current',
        'Time Conflict',
      ].sort()
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Task 04 — Risk Reproduction                                                */
/* Evidence-gathering tests for risks R01 and R02 identified in the Task 04   */
/* read-only risk review. These tests call the REAL imported checkAvailability*/
/* function against the UNMODIFIED production code. They are expected to FAIL */
/* and that failure is the evidence that the risks exist.                     */
/* -------------------------------------------------------------------------- */

describe('Task 04 — Risk Reproduction', () => {
  // R01: checkAvailability must not return available: true for non-finite
  // numeric inputs. NaN and Infinity are valid `number` values in TypeScript
  // but are not valid time values. Every comparison with NaN yields false,
  // so all guards are silently bypassed and the function falls through to
  // the Available return.
  describe('R01 — non-finite numeric inputs must not be available', () => {
    const openRoom: Room = {
      id: 'r01-room',
      name: 'R01 Room',
      blocked: false,
      bookings: [],
    };
    const NOW = 540; // 09:00

    it('NaN as start must not produce available: true', () => {
      const result = checkAvailability(openRoom, NaN, 720, NOW);
      expect(result.available).not.toBe(true);
    });

    it('NaN as end must not produce available: true', () => {
      const result = checkAvailability(openRoom, 660, NaN, NOW);
      expect(result.available).not.toBe(true);
    });

    it('Infinity as start must not produce available: true', () => {
      const result = checkAvailability(openRoom, Infinity, 720, NOW);
      expect(result.available).not.toBe(true);
    });

    it('Infinity as end must not produce available: true', () => {
      const result = checkAvailability(openRoom, 660, Infinity, NOW);
      expect(result.available).not.toBe(true);
    });

    it('NaN as currentTime must not produce available: true', () => {
      const result = checkAvailability(openRoom, 660, 720, NaN);
      expect(result.available).not.toBe(true);
    });
  });

  // R02: checkAvailability must not silently report a room as available when
  // its booking data is malformed (start >= end, or non-finite times). The
  // overlap check `start < booking.end && end > booking.start` silently fails
  // on malformed bookings, so a request that should conflict is reported as
  // available. This tests missing data-integrity validation, not a reversed
  // booking interpreted as a valid occupied interval.
  describe('R02 — malformed booking fixtures must not silently allow availability', () => {
    const NOW = 540; // 09:00

    it('a booking with start >= end must not be silently ignored', () => {
      // Malformed booking: start 660, end 600 (start >= end).
      // Request 620–680 overlaps the intended 600–660 interval but the
      // overlap check sees booking.end=600 and fails: 620 < 600 is false.
      const malformedRoom: Room = {
        id: 'r02-reversed',
        name: 'R02 Reversed Booking',
        blocked: false,
        bookings: [{ start: 660, end: 600 }],
      };
      const result = checkAvailability(malformedRoom, 620, 680, NOW);
      expect(result.available).not.toBe(true);
    });

    it('a booking with non-finite times must not be silently ignored', () => {
      // Malformed booking: NaN start and end.
      // The overlap check `start < NaN && end > NaN` is always false, so
      // any request is reported as available — the conflict is missed.
      const nanRoom: Room = {
        id: 'r02-nan',
        name: 'R02 NaN Booking',
        blocked: false,
        bookings: [{ start: NaN, end: NaN }],
      };
      const result = checkAvailability(nanRoom, 660, 720, NOW);
      expect(result.available).not.toBe(true);
    });
  });
});

