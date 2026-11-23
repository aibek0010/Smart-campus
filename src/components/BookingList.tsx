import { CalendarRange, Clock } from 'lucide-react';
import { formatTime } from '@/lib/availability';
import type { CatalogRoom } from '@/data/rooms';

export default function BookingList({ room }: { room: CatalogRoom }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-400" />
        Existing Bookings — {room.name}
      </h2>
      {room.bookings.length === 0 ? (
        <p className="text-sm text-slate-500">No existing bookings for this room.</p>
      ) : (
        <ul className="space-y-2">
          {room.bookings.map((b, i) => (
            <li
              key={`${b.start}-${b.end}-${i}`}
              className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2"
            >
              <CalendarRange className="w-4 h-4 text-slate-400" />
              {formatTime(b.start)} – {formatTime(b.end)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}