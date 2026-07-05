// Streak-Flamme mit der Zahl IM Kreis der Flamme.
// Level nach Tagen: 1 (ab Tag 1) · 2 (ab Tag 7) · 3 (ab Tag 14) · 4 (ab Tag 30).
// Geometrie je Bild (aspect + Kreis-Mittelpunkt cx/cy + Kreis-Durchmesser d) wurde
// aus den Freistellern gemessen.
const LEVELS = [
  { src: '/streak-1.png', aspect: 0.609, cx: 0.50, cy: 0.80, d: 0.59 },
  { src: '/streak-2.png', aspect: 0.771, cx: 0.51, cy: 0.84, d: 0.36 },
  { src: '/streak-3.png', aspect: 0.543, cx: 0.49, cy: 0.86, d: 0.52 },
  { src: '/streak-4.png', aspect: 0.561, cx: 0.49, cy: 0.87, d: 0.46 },
];

export function streakLevelIndex(days: number): number {
  if (days >= 30) return 3;
  if (days >= 14) return 2;
  if (days >= 7) return 1;
  return 0; // Tag 1+ (und 0) = Level 1
}

export default function StreakFlame({ days, height = 120, dim }: { days: number; height?: number; dim?: boolean }) {
  const lv = LEVELS[streakLevelIndex(days)];
  const width = height * lv.aspect;
  const circleDia = lv.d * width;
  const digits = String(Math.max(0, days)).length;
  const fontPx = circleDia * (digits >= 3 ? 0.42 : digits === 2 ? 0.56 : 0.64);
  const off = dim ?? days === 0;
  return (
    <div style={{ position: 'relative', width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lv.src} alt="" style={{ width, height, display: 'block', filter: off ? 'grayscale(1)' : undefined, opacity: off ? 0.5 : 1 }} />
      <span style={{
        position: 'absolute', left: `${lv.cx * 100}%`, top: `${lv.cy * 100}%`, transform: 'translate(-50%, -50%)',
        fontWeight: 800, fontSize: `${fontPx}px`, lineHeight: 1, color: '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.5)',
        fontVariantNumeric: 'tabular-nums',
      }}>{days}</span>
    </div>
  );
}
