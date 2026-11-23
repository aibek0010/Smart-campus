import { Ban, DoorClosed, Users } from 'lucide-react';
import type { CatalogRoom } from '@/data/rooms';

interface Props {
  room: CatalogRoom;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function RoomCard({ room, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(room.id)}
      className={`w-full text-left rounded-xl border p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
        selected
          ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-900">{room.name}</span>
        {room.blocked ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3" />
            Blocked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <DoorClosed className="w-3 h-3" />
            Open
          </span>
        )}
      </div>
      <p className="flex items-center gap-1 text-xs text-slate-500">
        <Users className="w-3 h-3" />
        {room.capacity} seats
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{room.equipment.join(', ')}</p>
    </button>
  );
}