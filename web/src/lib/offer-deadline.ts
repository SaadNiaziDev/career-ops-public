// Offer deadlines written in tracker notes, e.g. "offer deadline: 2026-12-01".

/** Date-only ordering deliberately ignores timezone-less times. Unknown dates sort last. */
function knownDay(raw?: string | null): string | null {
  const match = raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

export function offerDeadlineFromNotes(notes: string): string | undefined {
  const date = notes.match(/\b(?:decision|offer)\s+deadline\s*[:=-]\s*(\d{4}-\d{2}-\d{2})\b/i)?.[1];
  return knownDay(date) ?? undefined;
}

