const TIMEZONE = 'Europe/Moscow';

function zonedYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { y: Number(map.year), m: Number(map.month), d: Number(map.day) };
}

function utcFromZoned(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const asZoned = zonedYmd(new Date(guess));
  const asUtc = Date.UTC(asZoned.y, asZoned.m - 1, asZoned.d);
  return new Date(guess - (asUtc - guess));
}

export type PeriodPreset = 'day' | 'week' | 'month' | 'year';

export function periodToQuery(preset: PeriodPreset, date = new Date()): { period: PeriodPreset; startDate: string; endDate: string } {
  const { y, m, d } = zonedYmd(date);
  let start: Date;
  let end: Date;
  if (preset === 'day') {
    start = utcFromZoned(y, m, d);
    end = utcFromZoned(y, m, d + 1);
  } else if (preset === 'week') {
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const iso = wd === 0 ? 7 : wd;
    start = utcFromZoned(y, m, d - (iso - 1));
    end = utcFromZoned(y, m, d - (iso - 1) + 7);
  } else if (preset === 'year') {
    start = utcFromZoned(y, 1, 1);
    end = utcFromZoned(y + 1, 1, 1);
  } else {
    start = utcFromZoned(y, m, 1);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    end = utcFromZoned(ny, nm, 1);
  }
  return { period: preset, startDate: start.toISOString(), endDate: end.toISOString() };
}
