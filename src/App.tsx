import { useState } from 'react';
import { CalendarRange, CheckCircle2, Info, Building2, SearchX, Sparkles, AlertCircle } from 'lucide-react';
import { MAX_DURATION_MINUTES, timeStringToMinutes } from '@/lib/availability';
import { evaluateSelection } from '@/lib/selection';
import { explainAvailability, type ExplainOutcome } from '@/lib/explain';
import { ROOM_A101, type Equipment } from '@/data/rooms';
import RoomCard from '@/components/RoomCard';
import BookingList from '@/components/BookingList';
import ResultCard from '@/components/ResultCard';
import FilterPanel from '@/components/FilterPanel';

const FIXED_CURRENT_TIME = '09:00';
const FIXED_CURRENT_MINUTES = 9 * 60;

export default function App() {
  const [attendees, setAttendees] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('12:00');
  const [checked, setChecked] = useState(false);
  const [explanation, setExplanation] = useState<ExplainOutcome | null>(null);
  const [explaining, setExplaining] = useState(false);

  const view = evaluateSelection({
    rooms: [ROOM_A101],
    filters: { attendees: Number(attendees) || 0, equipment },
    selectedRoomId,
    startTime,
    endTime,
    currentMinutes: FIXED_CURRENT_MINUTES,
  });

  const toggleEquipment = (item: Equipment) =>
    setEquipment((prev) => (prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]));

  const handleReset = () => {
    setAttendees('');
    setEquipment([]);
    setSelectedRoomId(null);
    setStartTime('11:00');
    setEndTime('12:00');
    setChecked(false);
    setExplanation(null);
    setExplaining(false);
  };

  const handleExplain = () => {
    if (!view.result || !view.selectedRoom) return;
    const start = timeStringToMinutes(startTime);
    const end = timeStringToMinutes(endTime);
    if (start === null || end === null) return;
    setExplaining(true);
    const outcome = explainAvailability(view.result, {
      room: view.selectedRoom,
      start,
      end,
      currentTime: FIXED_CURRENT_MINUTES,
    });
    setExplanation(outcome);
    setExplaining(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-600 text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 leading-tight">
              Smart Campus Room Availability Checker
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Find a room that fits your group, then check it for your time.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Requirements</h2>
          <FilterPanel
            attendees={attendees}
            equipment={equipment}
            onAttendeesChange={setAttendees}
            onEquipmentToggle={toggleEquipment}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            Rooms ({view.visibleRooms.length})
          </h2>
          {view.isEmpty ? (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500"
            >
              <SearchX className="w-5 h-5 flex-shrink-0 text-slate-400" />
              No rooms match your requirements. Lower the number of attendees or remove some equipment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {view.visibleRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  selected={room.id === view.selectedRoom?.id}
                  onSelect={setSelectedRoomId}
                />
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-teal-600" />
            Check Availability
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-slate-700 mb-1.5">
                Start Time
              </label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-slate-700 mb-1.5">
                End Time
              </label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="current-time" className="block text-sm font-medium text-slate-700 mb-1.5">
                Current Time <span className="text-xs font-normal text-slate-400">(now)</span>
              </label>
              <input
                id="current-time"
                type="time"
                value={FIXED_CURRENT_TIME}
                readOnly
                aria-readonly="true"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
            <span>
              Rules: maximum {MAX_DURATION_MINUTES} minutes per booking. Start must be after the current time.
              Touching endpoints are allowed.
            </span>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setChecked(true);
                setExplanation(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Check Availability
            </button>
            <button
              onClick={handleExplain}
              disabled={!checked || !view.result || explaining}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-5 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" />
              Explain
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </section>

        {checked && view.result && <ResultCard result={view.result} />}
        {checked && view.result && explanation && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-2xl border p-5 sm:p-6 ${
              explanation.usingFallback
                ? 'border-amber-200 bg-amber-50'
                : 'border-sky-200 bg-sky-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {explanation.usingFallback ? (
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    explanation.usingFallback ? 'text-amber-700' : 'text-sky-700'
                  }`}
                >
                  {explanation.usingFallback ? 'Explanation unavailable — showing reason' : 'Explanation'}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    explanation.usingFallback ? 'text-amber-800' : 'text-sky-800'
                  }`}
                >
                  {explanation.text}
                </p>
              </div>
            </div>
          </div>
        )}
        {checked && !view.selectedRoom && !view.isEmpty && (
          <p role="status" className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">
            Select a room first.
          </p>
        )}

        {view.selectedRoom && <BookingList room={view.selectedRoom} />}
      </main>

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-400">
        Prototype only — fictional sample data, no bookings are saved.
      </footer>
    </div>
  );
}