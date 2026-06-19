/**
 * Zeit-Helfer in der Zeitzone Europe/Berlin.
 *
 * Wichtig: Auf Vercel läuft der Server in UTC, die App (und die in der DB
 * gespeicherten Wochen/Tage) rechnen aber in lokaler Kölner Zeit. Diese Helfer
 * rechnen daher explizit in Europe/Berlin, damit der Cron den richtigen Tag,
 * die richtige Woche und die richtige Uhrzeit trifft.
 */

const TZ = 'Europe/Berlin';

/** Aktuelles Datum (yyyy-MM-dd) und Minuten seit Mitternacht in Berlin. */
export function berlinNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // manche Engines liefern "24" um Mitternacht
  const minutes = hour * 60 + parseInt(get('minute'), 10);
  return { date, minutes };
}

/**
 * ISO-Wochentag (1=Mo … 7=So) für ein yyyy-MM-dd.
 * Anker auf 12:00 UTC, damit Datums-Arithmetik nicht über Mitternacht/DST kippt.
 */
export function isoDayOfWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** Montag (yyyy-MM-dd) der Woche, in der dateStr liegt — wie die App week_start speichert. */
export function weekStartOf(dateStr: string): string {
  const isoDow = isoDayOfWeek(dateStr);
  const d = new Date(`${dateStr}T12:00:00Z`);
  const monday = new Date(d.getTime() - (isoDow - 1) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/** "HH:MM" → Minuten seit Mitternacht. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
