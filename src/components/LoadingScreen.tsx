// Gebrandeter Ladebildschirm: pulsierendes App-Logo + „Fight in…".
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      <img src="/icon-192.png" alt="Fight Calendar"
        className="w-24 h-24 rounded-[24px] ring-1 ring-white/10 shadow-2xl shadow-black/50"
        style={{ animation: 'logoPulse 1.4s ease-in-out infinite' }} />
      <span className="font-display text-2xl tracking-[0.22em] text-[var(--muted)]">
        Fight in<span className="loading-dots" />
      </span>
    </div>
  );
}
