export interface Holiday { date: string; name: string; }

function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

export function getNRWHolidays(year: number): Holiday[] {
  const e = easterSunday(year);
  return [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige' },
    { date: fmt(addDays(e, -2)), name: 'Karfreitag' },
    { date: fmt(addDays(e, 1)),  name: 'Ostermontag' },
    { date: `${year}-05-01`,     name: 'Tag der Arbeit' },
    { date: fmt(addDays(e, 39)), name: 'Christi Himmelfahrt' },
    { date: fmt(addDays(e, 50)), name: 'Pfingstmontag' },
    { date: fmt(addDays(e, 60)), name: 'Fronleichnam' },
    { date: `${year}-10-03`,     name: 'Tag der deutschen Einheit' },
    { date: `${year}-11-01`,     name: 'Allerheiligen' },
    { date: `${year}-12-25`,     name: '1. Weihnachtstag' },
    { date: `${year}-12-26`,     name: '2. Weihnachtstag' },
  ];
}

export function holidayMap(dates: string[]): Map<string, string> {
  const years = new Set(dates.map(d => parseInt(d.slice(0, 4))));
  const map = new Map<string, string>();
  for (const y of years) getNRWHolidays(y).forEach(h => map.set(h.date, h.name));
  return map;
}

export function isHoliday(dateStr: string): Holiday | null {
  const year = parseInt(dateStr.slice(0, 4));
  return getNRWHolidays(year).find(h => h.date === dateStr) ?? null;
}
