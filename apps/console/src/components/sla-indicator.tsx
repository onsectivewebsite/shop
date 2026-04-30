/**
 * SLA breach indicator. Two stages:
 *
 * 1. Pre-first-response: based on time since createdAt.
 *    < 8h     → green dot (within target)
 *    8h-24h   → amber (warning)
 *    > 24h    → red (breach)
 *
 * 2. Post-first-response: if slaDueAt is set, check that.
 *    > 4h before due → green
 *    < 4h before due → amber
 *    past due        → red
 *
 * If neither signal is set the dot just renders gray.
 */

const HOUR = 60 * 60 * 1000;

type Tone = 'green' | 'amber' | 'red' | 'gray';

function tone({
  createdAt,
  firstResponseAt,
  slaDueAt,
  resolvedAt,
}: {
  createdAt: Date;
  firstResponseAt: Date | null;
  slaDueAt: Date | null;
  resolvedAt: Date | null;
}): { tone: Tone; label: string } {
  if (resolvedAt) return { tone: 'gray', label: 'Resolved' };
  const now = Date.now();

  if (!firstResponseAt) {
    const ageHours = (now - createdAt.getTime()) / HOUR;
    if (ageHours > 24) return { tone: 'red', label: `Breached · no response in ${Math.floor(ageHours)}h` };
    if (ageHours > 8) return { tone: 'amber', label: `Pending · ${Math.floor(ageHours)}h since open` };
    return { tone: 'green', label: `Within target · ${Math.floor(ageHours)}h since open` };
  }

  if (slaDueAt) {
    const remainingMs = slaDueAt.getTime() - now;
    if (remainingMs < 0) {
      const overdueHours = Math.abs(remainingMs) / HOUR;
      return { tone: 'red', label: `Past due by ${Math.floor(overdueHours)}h` };
    }
    if (remainingMs < 4 * HOUR) {
      return { tone: 'amber', label: `Due in ${Math.floor(remainingMs / HOUR)}h` };
    }
    return { tone: 'green', label: `Due in ${Math.floor(remainingMs / HOUR)}h` };
  }

  return { tone: 'gray', label: 'Responded · no SLA target set' };
}

export function SlaDot(props: {
  createdAt: Date;
  firstResponseAt: Date | null;
  slaDueAt: Date | null;
  resolvedAt: Date | null;
}) {
  const { tone: t, label } = tone(props);
  const cls =
    t === 'red'
      ? 'bg-error-500'
      : t === 'amber'
        ? 'bg-amber-400'
        : t === 'green'
          ? 'bg-success-500'
          : 'bg-slate-300';
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${cls}`}
      title={label}
      aria-label={label}
    />
  );
}

export function SlaPill(props: {
  createdAt: Date;
  firstResponseAt: Date | null;
  slaDueAt: Date | null;
  resolvedAt: Date | null;
}) {
  const { tone: t, label } = tone(props);
  const cls =
    t === 'red'
      ? 'bg-error-50 text-error-700 border-error-200'
      : t === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : t === 'green'
          ? 'bg-success-50 text-success-700 border-success-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          t === 'red'
            ? 'bg-error-500'
            : t === 'amber'
              ? 'bg-amber-400'
              : t === 'green'
                ? 'bg-success-500'
                : 'bg-slate-300'
        }`}
      />
      {label}
    </span>
  );
}
