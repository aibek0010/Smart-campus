import { checkAvailability, timeStringToMinutes, REASON_LABELS, type AvailabilityResult } from '@/lib/availability';
import { filterRooms, type RoomFilters } from '@/lib/filter';
import type { CatalogRoom } from '@/data/rooms';

export interface SelectionInput {
  rooms: CatalogRoom[];
  filters: RoomFilters;
  selectedRoomId: string | null;
  startTime: string;
  endTime: string;
  currentMinutes: number;
}

export interface SelectionView {
  visibleRooms: CatalogRoom[];
  isEmpty: boolean;
  selectedRoom: CatalogRoom | null;
  result: AvailabilityResult | null;
}

export function evaluateSelection(input: SelectionInput): SelectionView {
  const visibleRooms = filterRooms(input.rooms, input.filters);
  const selectedRoom = visibleRooms.find((r) => r.id === input.selectedRoomId) ?? null;

  let result: AvailabilityResult | null = null;
  if (selectedRoom) {
    const start = timeStringToMinutes(input.startTime);
    const end = timeStringToMinutes(input.endTime);
    result =
      start === null || end === null
        ? {
            available: false,
            reasonLabel: REASON_LABELS.invalidInput,
            reason: 'Please enter valid start and end times in HH:MM format.',
          }
        : checkAvailability(selectedRoom, start, end, input.currentMinutes);
  }

  return { visibleRooms, isEmpty: visibleRooms.length === 0, selectedRoom, result };
}