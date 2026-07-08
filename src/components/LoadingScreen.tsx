// Gebrandeter Ladebildschirm: pulsierendes Chicken-Logo + „Tap in…".
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-chicken.png" alt="Submit"
        className="w-28 h-28 object-contain"
        style={{ animation: 'logoPulse 1.4s ease-in-out infinite', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))' }} />
      <span className="font-display text-2xl tracking-[0.22em] text-[var(--muted)]">
        Tap in<span className="loading-dots" />
      </span>
    </div>
  );
}
