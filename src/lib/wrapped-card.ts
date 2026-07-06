// Rendert den Monats-Rückblick als teilbares Story-Bild (1080×1920 PNG) — reines Canvas,
// keine Abhängigkeit. Client-only (nutzt document/canvas).
import { macherMonth } from './gender';

export interface WrappedForCard {
  month: string;      // 'YYYY-MM'
  groupName: string;
  trainingDays: number;
  streak?: { days: number; weeks: number } | null;
  youMacher?: boolean;
  macherGender?: string | null; // eigenes Geschlecht (bei youMacher) → gegenderter Titel
  topClass?: { name: string; count: number } | null;
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Item = { h: number; draw: (top: number) => void };

export async function renderWrappedCard(d: WrappedForCard): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cx = W / 2;
  const ACCENT = '#ff3b30';
  const MUTED = '#8a8a92';
  const font = (spec: string) => { ctx.font = `${spec} system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; };
  const setLS = (px: number) => { try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; } catch { /* nicht unterstützt */ } };

  // Display-Schrift (Bebas Neue, von next/font geladen) fürs Poster-Feeling.
  let displayFam = 'system-ui, -apple-system, sans-serif';
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
    if (v) {
      displayFam = `${v}, system-ui, sans-serif`;
      const primary = v.split(',')[0].trim().replace(/['"]/g, '');
      if (primary) await document.fonts.load(`400 120px "${primary}"`);
    }
  } catch { /* Fallback bleibt System-Schrift */ }
  const display = (sizePx: number) => { ctx.font = `400 ${sizePx}px ${displayFam}`; };

  // Hintergrund + Glow
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, 40, 0, cx, 40, H * 0.7);
  glow.addColorStop(0, 'rgba(255,59,48,0.20)');
  glow.addColorStop(1, 'rgba(8,8,10,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // --- Kopf: Logo + Name + Untertitel ---
  const logo = await loadImage('/icon-192.png');
  const lsz = 132, lx = cx - lsz / 2, ly = 118;
  if (logo) {
    ctx.save();
    roundRect(ctx, lx, ly, lsz, lsz, 30); ctx.clip();
    ctx.drawImage(logo, lx, ly, lsz, lsz);
    ctx.restore();
  }
  ctx.fillStyle = '#ffffff';
  setLS(6); display(66);
  ctx.fillText('TAP IN', cx + 3, 338);
  setLS(0);
  ctx.fillStyle = MUTED;
  font('400 40px');
  ctx.fillText(`${monthLabel(d.month)} · ${d.groupName}`, cx, 404);

  // --- Trennstrich ---
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 230, 466); ctx.lineTo(cx + 230, 466); ctx.stroke();

  // --- zentrierte Statistik-Blöcke, jeder mit eigenem Raum ---
  const items: Item[] = [];
  const stat = (value: string, label: string, valueColor: string, valuePx: number): Item => {
    const vBase = valuePx * 0.74;
    return {
      h: vBase + 62,
      draw: (top) => {
        ctx.fillStyle = valueColor; display(valuePx);
        ctx.fillText(value, cx, top + vBase);
        ctx.fillStyle = MUTED; setLS(5); font('600 38px');
        ctx.fillText(label, cx + 2, top + vBase + 60); setLS(0);
      },
    };
  };

  items.push(stat(String(d.trainingDays), 'TRAININGSTAGE', ACCENT, 200));

  if (d.streak && (d.streak.weeks >= 1 || d.streak.days >= 1)) {
    const useWeeks = d.streak.weeks >= 1;
    items.push(stat(String(useWeeks ? d.streak.weeks : d.streak.days), useWeeks ? '🔥 WOCHEN STREAK' : '🔥 TAGE AM STÜCK', '#ff7a70', 122));
  }

  if (d.youMacher) {
    items.push({
      h: 96,
      draw: (top) => {
        const txt = `🏆 ${macherMonth(d.macherGender).toUpperCase()}`;
        font('700 44px');
        const w = ctx.measureText(txt).width + 84;
        const h = 88, y = top + 4;
        ctx.fillStyle = 'rgba(255,194,75,0.14)';
        roundRect(ctx, cx - w / 2, y, w, h, h / 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,194,75,0.55)'; ctx.lineWidth = 2;
        roundRect(ctx, cx - w / 2, y, w, h, h / 2); ctx.stroke();
        ctx.fillStyle = '#ffc24b';
        ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, y + h / 2 + 2); ctx.textBaseline = 'alphabetic';
      },
    });
  }

  if (d.topClass) {
    let px = 122; display(px);
    while (ctx.measureText(d.topClass.name).width > W - 170 && px > 56) { px -= 6; display(px); }
    items.push(stat(d.topClass.name, 'MEIST TRAINIERT', '#ececf0', px));
  }

  const GAP = 82;
  const stackH = items.reduce((s, it) => s + it.h, 0) + GAP * Math.max(0, items.length - 1);
  const regionTop = 560, regionBottom = 1850;
  let y = regionTop + Math.max(0, (regionBottom - regionTop - stackH) / 2);
  for (const it of items) { it.draw(y); y += it.h + GAP; }

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
