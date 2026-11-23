import type { Room } from '@/lib/availability';

export type Equipment = 'projector' | 'whiteboard' | 'video-conf' | 'microphones';

export interface CatalogRoom extends Room {
  capacity: number;
  equipment: Equipment[];
}

export const ALL_EQUIPMENT: Equipment[] = ['projector', 'whiteboard', 'video-conf', 'microphones'];

export const ROOM_A101: CatalogRoom = {
  id: 'a101',
  name: 'Room A101',
  blocked: false,
  capacity: 6,
  equipment: ['projector', 'whiteboard'],
  bookings: [{ start: 600, end: 660 }], // 10:00–11:00
};

export const ROOM_B202: CatalogRoom = {
  id: 'b202',
  name: 'Room B202',
  blocked: false,
  capacity: 4,
  equipment: ['whiteboard'],
  bookings: [],
};

export const ROOM_C303: CatalogRoom = {
  id: 'c303',
  name: 'Room C303',
  blocked: true,
  capacity: 30,
  equipment: ['projector', 'microphones', 'video-conf'],
  bookings: [{ start: 600, end: 660 }],
};

export const ROOM_D404: CatalogRoom = {
  id: 'd404',
  name: 'Room D404',
  blocked: false,
  capacity: 12,
  equipment: ['projector', 'whiteboard', 'video-conf'],
  bookings: [{ start: 570, end: 630 }], // 09:30–10:30
};

export const ROOM_E505: CatalogRoom = {
  id: 'e505',
  name: 'Room E505',
  blocked: false,
  capacity: 20,
  equipment: ['projector', 'whiteboard', 'microphones'],
  bookings: [
    { start: 660, end: 720 }, // 11:00–12:00
    { start: 900, end: 960 }, // 15:00–16:00
  ],
};

export const ROOMS: CatalogRoom[] = [ROOM_A101, ROOM_B202, ROOM_C303, ROOM_D404, ROOM_E505];