import type { CatalogRoom, Equipment } from '@/data/rooms';

export interface RoomFilters {
  attendees: number;
  equipment: Equipment[];
}

/** F1: capacity >= attendees. F2: room has ALL selected equipment. */
export function filterRooms(rooms: CatalogRoom[], filters: RoomFilters): CatalogRoom[] {
  return rooms.filter(
    (room) =>
      room.capacity >= filters.attendees &&
      filters.equipment.every((item) => room.equipment.includes(item))
  );
}