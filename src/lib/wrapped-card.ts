// Rendert den Monats-Rückblick als teilbares Story-Bild (1080×1920 PNG) — reines Canvas,
// keine Abhängigkeit. Client-only (nutzt document/canvas).

export interface WrappedForCard {
  month: string;      // 'YYYY-MM'
  groupName: string;
  me: { trainings: number; skips: number; lobe: number; bitch: number };
  macher: { user: string; count: number } | null;
  bitch: { user: string; count: number } | null;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

export async function renderWrappedCard(d: WrappedForCard): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cx = W / 2;
  const font = (spec: string) => { ctx.font = `${spec} system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; };

  // Hintergrund + Glow
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, 60, 0, cx, 60, H * 0.6);
  glow.addColorStop(0, 'rgba(255,59,48,0.22)');
  glow.addColorStop(1, 'rgba(8,8,10,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Wortmarke
  ctx.fillStyle = '#ffffff';
  font('700 48px');
  ctx.fillText('T A P   I N', cx, 170);

  // Monat + Gruppe
  ctx.fillStyle = '#ececf0';
  font('800 104px');
  ctx.fillText(monthLabel(d.month), cx, 320);
  ctx.fillStyle = '#8a8a92';
  font('400 40px');
  ctx.fillText(`${d.groupName} · Rückblick`, cx, 384);

  // 2×2 Statistik-Raster (persönliche Zahlen)
  const stats = [
    { n: d.me.trainings, l: 'Trainings', c: '#ff3b30' },
    { n: d.me.skips, l: 'Fehltage', c: '#f59e0b' },
    { n: d.me.bitch, l: 'Bitch-Punkte', c: '#ec4899' },
    { n: d.me.lobe, l: 'Würdigungen', c: '#3ddc84' },
  ];
  const colX = [W * 0.3, W * 0.7];
  const rowY = [700, 1060];
  let k = 0;
  for (const y of rowY) {
    for (const x of colX) {
      const s = stats[k++];
      ctx.fillStyle = s.c;
      font('800 140px');
      ctx.fillText(String(s.n), x, y);
      ctx.fillStyle = '#8a8a92';
      font('500 36px');
      ctx.fillText(s.l, x, y + 62);
    }
  }

  // Gruppen-Highlights
  let hy = 1420;
  font('600 46px');
  if (d.macher) { ctx.fillStyle = '#ffc24b'; ctx.fillText(`🏆 Macher: ${d.macher.user}`, cx, hy); hy += 84; }
  if (d.bitch) { ctx.fillStyle = '#ec4899'; ctx.fillText(`🐔 Bitch: ${d.bitch.user}`, cx, hy); hy += 84; }

  // Footer
  ctx.fillStyle = '#6b6b74';
  font('500 38px');
  ctx.fillText('Wer kommt diese Woche?', cx, H - 130);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
