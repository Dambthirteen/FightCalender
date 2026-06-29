// Gebrandeter Ladebildschirm: pulsierendes App-Logo + „Tap in…".
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      <img src="/icon-192.png" alt="Tap In"
        className="w-24 h-24 rounded-[24px] ring-1 ring-white/10 shadow-2xl shadow-black/50"
        style={{ animation: 'logoPulse 1.4s ease-in-out infinite' }} />
      <span className="font-display text-2xl tracking-[0.22em] text-[var(--muted)]">
        Tap in<span className="loading-dots" />
      </span>
    </div>
  );
}
