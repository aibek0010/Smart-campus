import { describe, it, expect } from 'vitest';
import { ROOMS, ROOM_B202 } from '@/data/rooms';
import { filterRooms } from '@/lib/filter';
import { evaluateSelection } from '@/lib/selection';

const ids = (rooms: { id: string }[]) => rooms.map((r) => r.id);
const NOW = 9 * 60;
const base = {
  rooms: ROOMS,
  filters: { attendees: 0, equipment: [] },
  selectedRoomId: null as string | null,
  startTime: '10:00',
  endTime: '10:30',
  currentMinutes: NOW,
};

describe('room catalog', () => {
  it('has at least four rooms with all required fields', () => {
    expect(ROOMS.length).toBeGreaterThanOrEqual(4);
    for (const r of ROOMS) {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.capacity).toBeGreaterThan(0);
      expect(r.equipment.length).toBeGreaterThan(0);
      expect(typeof r.blocked).toBe('boolean');
      expect(Array.isArray(r.bookings)).toBe(true);
    }
  });
});

describe('filterRooms', () => {
  it('F1: exact capacity is included, insufficient capacity is excluded', () => {
    expect(ids(filterRooms(ROOMS, { attendees: 4, equipment: [] }))).toContain(ROOM_B202.id);
    expect(ids(filterRooms(ROOMS, { attendees: 5, equipment: [] }))).not.toContain(ROOM_B202.id);
  });
  it('F1: 12 attendees leaves only rooms with capacity >= 12', () => {
    expect(ids(filterRooms(ROOMS, { attendees: 12, equipment: [] }))).toEqual(['c303', 'd404', 'e505']);
  });
  it('F2: room must contain ALL selected equipment', () => {
    expect(ids(filterRooms(ROOMS, { attendees: 0, equipment: ['projector', 'microphones'] }))).toEqual(['c303', 'e505']);
  });
  it('F1+F2 combined', () => {
    expect(ids(filterRooms(ROOMS, { attendees: 10, equipment: ['whiteboard'] }))).toEqual(['d404', 'e505']);
  });
  it('F4: returns an empty list when nothing matches', () => {
    expect(filterRooms(ROOMS, { attendees: 100, equipment: [] })).toEqual([]);
  });
  it('does not mutate the catalog', () => {
    const before = JSON.stringify(ROOMS);
    filterRooms(ROOMS, { attendees: 10, equipment: ['projector'] });
    expect(JSON.stringify(ROOMS)).toBe(before);
  });
});

describe('evaluateSelection (integration)', () => {
  it('F4: reports the empty state when no room matches', () => {
    const view = evaluateSelection({ ...base, filters: { attendees: 100, equipment: [] } });
    expect(view.isEmpty).toBe(true);
    expect(view.result).toBeNull();
  });
  it('F5: switching rooms refreshes the result using that room\'s own bookings', () => {
    const at = (id: string) => evaluateSelection({ ...base, selectedRoomId: id }).result;
    expect(at('a101')?.reasonLabel).toBe('Time Conflict');
    expect(at('b202')?.available).toBe(true);
    expect(at('c303')?.reasonLabel).toBe('Room Blocked');
  });
  it('F3: a blocked room is unavailable even when its bookings do not overlap', () => {
    const r = evaluateSelection({ ...base, selectedRoomId: 'c303', startTime: '12:00', endTime: '13:00' }).result;
    expect(r?.available).toBe(false);
    expect(r?.reasonLabel).toBe('Room Blocked');
  });
  it('a filter that hides the selected room clears the selection and result', () => {
    const view = evaluateSelection({
      ...base,
      selectedRoomId: 'b202',
      filters: { attendees: 10, equipment: [] },
    });
    expect(view.selectedRoom).toBeNull();
    expect(view.result).toBeNull();
  });
  it('invalid time text gives an Invalid Input result', () => {
    const r = evaluateSelection({ ...base, selectedRoomId: 'b202', startTime: '' }).result;
    expect(r?.reasonLabel).toBe('Invalid Input');
  });
});