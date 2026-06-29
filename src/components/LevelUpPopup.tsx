'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from './UserProvider';

interface LevelUp { level: number; from?: number; rank: { name: string; color: string } }

/**
 * Erscheint, wenn der Nutzer seit dem letzten Besuch ein Level aufgestiegen ist.
 * Spiegelt das Muster von AwardPopup (laden → anzeigen → quittieren).
 * Test: ?xppreview=1 an die URL hängen → Beispiel-Popup ohne zu speichern.
 */
export default function LevelUpPopup() {
  const { userName, loading } = useUser();
  const [up, setUp] = useState<LevelUp | null>(null);
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef('');

  useEffect(() => {
    if (loading) return;

    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('xppreview') === '1';
    if (preview) {
      if (loadedFor.current === '__preview__') return;
      loadedFor.current = '__preview__';
      setUp({ level: 10, from: 9, rank: { name: 'Silber', color: '#c0c7d0' } });
      return;
    }

    if (!userName || loadedFor.current === userName) return;
    loadedFor.current = userName;
    fetch('/api/xp/levelup')
      .then((r) => r.json())
      .then((d) => { if (d.leveledUp) setUp({ level: d.level, from: d.from, rank: d.rank }); })
      .catch(() => {});
  }, [userName, loading]);

  async function dismiss() {
    if (!up || busy) return;
    setBusy(true);
    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('xppreview') === '1';
    if (!preview) {
      try { await fetch('/api/xp/levelup', { method: 'POST' }); } catch { /* später erneut */ }
    }
    setBusy(false);
    setUp(null);
  }

  if (!up) return null;
  const col = up.rank.color;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 anim-in"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className="card award-pop w-full max-w-sm p-7 text-center relative overflow-hidden" style={{ borderColor: col }}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">Level aufgestiegen</div>
        <div className="award-bounce mt-3 mb-1 font-display tracking-wide" style={{ fontSize: 64, lineHeight: 1, color: col }}>
          {up.level}
        </div>
        <h2 className="font-display text-2xl tracking-wide">Level {up.level}</h2>
        <p className="text-lg mt-1">Rang: <strong style={{ color: col }}>{up.rank.name}</strong></p>
        <p className="text-[var(--muted)] text-sm mt-2">Weiter so — jedes Training bringt dich höher. 🥊</p>
        <button onClick={dismiss} disabled={busy}
          className="mt-6 w-full text-black font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
          style={{ background: col }}>
          {busy ? '…' : 'Stark!'}
        </button>
      </div>
    </div>
  );
}
