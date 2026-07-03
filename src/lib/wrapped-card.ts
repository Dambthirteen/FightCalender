// Rendert den Monats-Rückblick als teilbares Story-Bild (1080×1920 PNG) — reines Canvas,
// keine Abhängigkeit. Client-only (nutzt document/canvas).

export interface WrappedForCard {
  month: string;      // 'YYYY-MM'
  groupName: string;
  me: { trainings: number; skips: number; lobe: number; bitch: number };
  macher: { user: string; count: number } | null;
  bitch: { user: string; count: number } | null;
  streak?: { days: number; weeks: number } | null;
  praiseComment?: { from: string; reason: string; kind: string } | null;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last + '…').width > maxWidth) lines[maxLines - 1] = last.replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}

export async function renderWrappedCard(d: WrappedForCard): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cx = W / 2;
  const ACCENT = '#ff3b30';
  const font = (spec: string) => { ctx.font = `${spec} system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; };

  // Hintergrund + Glow
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, 40, 0, cx, 40, H * 0.7);
  glow.addColorStop(0, 'rgba(255,59,48,0.20)');
  glow.addColorStop(1, 'rgba(8,8,10,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // --- Kopf ---
  ctx.fillStyle = '#ffffff';
  font('700 44px');
  ctx.fillText('T A P   I N', cx, 180);
  ctx.fillStyle = '#ececf0';
  font('800 96px');
  ctx.fillText(monthLabel(d.month), cx, 312);
  ctx.fillStyle = '#8a8a92';
  font('400 38px');
  ctx.fillText(`${d.groupName} · Rückblick`, cx, 372);

  // --- Hero: So oft trainiert ---
  ctx.fillStyle = '#8a8a92';
  font('600 42px');
  ctx.fillText('SO OFT TRAINIERT', cx, 560);
  ctx.fillStyle = ACCENT;
  font('800 232px');
  ctx.fillText(String(d.me.trainings), cx, 792);
  ctx.fillStyle = '#c9c9d0';
  font('500 44px');
  ctx.fillText(d.me.trainings === 1 ? 'Training' : 'Trainings', cx, 866);

  // --- Stack darunter, vertikal zentriert zwischen Hero und Footer ---
  const GAP = 46;
  type Item = { h: number; draw: (top: number) => void };
  const items: Item[] = [];

  const streakTxt = d.streak && d.streak.weeks >= 1
    ? `🔥 ${d.streak.weeks} ${d.streak.weeks === 1 ? 'Woche' : 'Wochen'} Streak`
    : d.streak && d.streak.days >= 1
      ? `🔥 ${d.streak.days} ${d.streak.days === 1 ? 'Tag' : 'Tage'} am Stück`
      : '';
  if (streakTxt) {
    items.push({
      h: 100,
      draw: (top) => {
        font('700 46px');
        const w = ctx.measureText(streakTxt).width + 88;
        const h = 100;
        ctx.fillStyle = 'rgba(255,59,48,0.14)';
        roundRect(ctx, cx - w / 2, top, w, h, h / 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,59,48,0.5)'; ctx.lineWidth = 2;
        roundRect(ctx, cx - w / 2, top, w, h, h / 2); ctx.stroke();
        ctx.fillStyle = '#ff7a70';
        ctx.textBaseline = 'middle';
        ctx.fillText(streakTxt, cx, top + h / 2 + 3);
        ctx.textBaseline = 'alphabetic';
      },
    });
  }

  const badge = (emoji: string, label: string, name: string, color: string): Item => ({
    h: 64,
    draw: (top) => { ctx.fillStyle = color; font('700 50px'); ctx.fillText(`${emoji} ${label}: ${name}`, cx, top + 52); },
  });
  if (d.macher) items.push(badge('🏆', 'Macher des Monats', d.macher.user, '#ffc24b'));
  if (d.bitch) items.push(badge('🐔', 'Bitch des Monats', d.bitch.user, '#ec4899'));

  if (d.praiseComment && d.praiseComment.reason) {
    const pad = 46;
    const boxW = W - 150;
    const boxX = (W - boxW) / 2;
    font('500 48px');
    const reason = d.praiseComment.reason.length > 160 ? d.praiseComment.reason.slice(0, 160) : d.praiseComment.reason;
    const lines = wrapText(ctx, `„${reason}"`, boxW - pad * 2, 4);
    const lineH = 62;
    const capH = 40, gapAfterCap = 30, gapBeforeBy = 26, byH = 46;
    const boxH = pad + capH + gapAfterCap + lines.length * lineH + gapBeforeBy + byH + pad;
    const kind = d.praiseComment.kind, from = d.praiseComment.from;
    items.push({
      h: boxH,
      draw: (top) => {
        ctx.fillStyle = 'rgba(61,220,132,0.10)';
        roundRect(ctx, boxX, top, boxW, boxH, 30); ctx.fill();
        ctx.strokeStyle = 'rgba(61,220,132,0.35)'; ctx.lineWidth = 2;
        roundRect(ctx, boxX, top, boxW, boxH, 30); ctx.stroke();
        let ty = top + pad + 32;
        ctx.fillStyle = '#3ddc84'; font('600 32px');
        ctx.fillText(kind === 'gigalob' ? 'GIGALOB ERHALTEN' : 'LOB ERHALTEN', cx, ty);
        ty += gapAfterCap + lineH;
        ctx.fillStyle = '#eaeaee'; font('500 48px');
        for (const ln of lines) { ctx.fillText(ln, cx, ty); ty += lineH; }
        ty += gapBeforeBy;
        ctx.fillStyle = '#8a8a92'; font('500 40px');
        ctx.fillText(`— ${from}`, cx, ty);
      },
    });
  }

  const stackH = items.reduce((s, it) => s + it.h, 0) + GAP * Math.max(0, items.length - 1);
  const regionTop = 940, regionBottom = 1770;
  let y = regionTop + Math.max(0, (regionBottom - regionTop - stackH) / 2);
  for (const it of items) { it.draw(y); y += it.h + GAP; }

  // --- Footer ---
  ctx.fillStyle = '#6b6b74';
  font('500 38px');
  ctx.fillText('Wer kommt diese Woche?', cx, H - 96);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
