export interface Holiday { date: string; name: string; }

// Deutsche Bundesländer (ISO-Kürzel). Default überall: NW (Nordrhein-Westfalen).
export const BUNDESLAENDER: { code: string; label: string }[] = [
  { code: 'BW', label: 'Baden-Württemberg' },
  { code: 'BY', label: 'Bayern' },
  { code: 'BE', label: 'Berlin' },
  { code: 'BB', label: 'Brandenburg' },
  { code: 'HB', label: 'Bremen' },
  { code: 'HH', label: 'Hamburg' },
  { code: 'HE', label: 'Hessen' },
  { code: 'MV', label: 'Mecklenburg-Vorpommern' },
  { code: 'NI', label: 'Niedersachsen' },
  { code: 'NW', label: 'Nordrhein-Westfalen' },
  { code: 'RP', label: 'Rheinland-Pfalz' },
  { code: 'SL', label: 'Saarland' },
  { code: 'SN', label: 'Sachsen' },
  { code: 'ST', label: 'Sachsen-Anhalt' },
  { code: 'SH', label: 'Schleswig-Holstein' },
  { code: 'TH', label: 'Thüringen' },
];

const CODES = new Set(BUNDESLAENDER.map((b) => b.code));
export function normalizeBundesland(bl: string | null | undefined): string {
  return bl && CODES.has(bl) ? bl : 'NW';
}

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

// Buß- und Bettag: Mittwoch vor dem 23. November (nur Sachsen).
function bussUndBettag(year: number): string {
  const d = new Date(Date.UTC(year, 10, 22));
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() - 1);
  return fmt(d);
}

/**
 * Gesetzliche Feiertage eines Jahres für ein Bundesland.
 * Basis = 9 bundesweite Feiertage, dazu die landesspezifischen.
 * Für 'NW' identisch zur früheren getNRWHolidays-Liste (inkl. Heilige Drei
 * Könige, das dort historisch mitlief) → keine Änderung bestehender Wertungen.
 */
export function getHolidays(year: number, bundesland: string = 'NW'): Holiday[] {
  const bl = normalizeBundesland(bundesland);
  const e = easterSunday(year);
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: fmt(addDays(e, -2)), name: 'Karfreitag' },
    { date: fmt(addDays(e, 1)),  name: 'Ostermontag' },
    { date: `${year}-05-01`,     name: 'Tag der Arbeit' },
    { date: fmt(addDays(e, 39)), name: 'Christi Himmelfahrt' },
    { date: fmt(addDays(e, 50)), name: 'Pfingstmontag' },
    { date: `${year}-10-03`,     name: 'Tag der Deutschen Einheit' },
    { date: `${year}-12-25`,     name: '1. Weihnachtstag' },
    { date: `${year}-12-26`,     name: '2. Weihnachtstag' },
  ];
  const add = (states: string[], date: string, name: string) => {
    if (states.includes(bl)) list.push({ date, name });
  };
  add(['BW', 'BY', 'ST', 'NW'], `${year}-01-06`, 'Heilige Drei Könige'); // NW: aus Kompatibilität beibehalten
  add(['BE', 'MV'], `${year}-03-08`, 'Internationaler Frauentag');
  add(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'], fmt(addDays(e, 60)), 'Fronleichnam');
  add(['SL'], `${year}-08-15`, 'Mariä Himmelfahrt');
  add(['TH'], `${year}-09-20`, 'Weltkindertag');
  add(['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'], `${year}-10-31`, 'Reformationstag');
  add(['BW', 'BY', 'NW', 'RP', 'SL'], `${year}-11-01`, 'Allerheiligen');
  add(['SN'], bussUndBettag(year), 'Buß- und Bettag');
  return list;
}

export function isHolidayIn(dateStr: string, bundesland: string = 'NW'): Holiday | null {
  const year = parseInt(dateStr.slice(0, 4));
  return getHolidays(year, bundesland).find((h) => h.date === dateStr) ?? null;
}

export function holidayMapFor(dates: string[], bundesland: string = 'NW'): Map<string, string> {
  const years = new Set(dates.map((d) => parseInt(d.slice(0, 4))));
  const map = new Map<string, string>();
  for (const y of years) getHolidays(y, bundesland).forEach((h) => map.set(h.date, h.name));
  return map;
}

// Rückwärtskompatible Namen (Standard = NRW) — für Aufrufer ohne Bundesland-Kontext.
export function getNRWHolidays(year: number): Holiday[] { return getHolidays(year, 'NW'); }
export function holidayMap(dates: string[]): Map<string, string> { return holidayMapFor(dates, 'NW'); }
export function isHoliday(dateStr: string): Holiday | null { return isHolidayIn(dateStr, 'NW'); }
