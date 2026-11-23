import { CheckCircle2, XCircle } from 'lucide-react';
import type { AvailabilityResult } from '@/lib/availability';

export default function ResultCard({ result }: { result: AvailabilityResult }) {
  const ok = result.available;
  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-2xl border p-5 sm:p-6 ${
        ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-lg font-bold ${ok ? 'text-emerald-800' : 'text-red-800'}`}>
              {ok ? 'Available' : 'Unavailable'}
            </p>
            {!ok && (
              <span className="inline-flex items-center text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                {result.reasonLabel}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{result.reason}</p>
        </div>
      </div>
    </section>
  );
}