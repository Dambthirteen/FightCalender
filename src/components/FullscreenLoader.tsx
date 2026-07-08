/** Kleiner Ladebildschirm, bis eine Seite vollständig geladen ist. */
export default function FullscreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center text-[var(--text)]">
      <div className="flex flex-col items-center gap-4 anim-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-chicken.png" alt="Submit" className="w-16 h-16 object-contain" />
        <div className="w-6 h-6 rounded-full animate-spin"
          style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    </div>
  );
}
