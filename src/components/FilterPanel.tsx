import { ALL_EQUIPMENT, type Equipment } from '@/data/rooms';

interface Props {
  attendees: string;
  equipment: Equipment[];
  onAttendeesChange: (value: string) => void;
  onEquipmentToggle: (item: Equipment) => void;
}

export default function FilterPanel({ attendees, equipment, onAttendeesChange, onEquipmentToggle }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="attendees" className="block text-sm font-medium text-slate-700 mb-1.5">
            Attendees
          </label>
          <input
            id="attendees"
            type="number"
            min={0}
            value={attendees}
            onChange={(e) => onAttendeesChange(e.target.value)}
            placeholder="e.g. 8"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 mb-1.5">Required equipment</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {ALL_EQUIPMENT.map((item) => (
              <label key={item} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={equipment.includes(item)}
                  onChange={() => onEquipmentToggle(item)}
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}