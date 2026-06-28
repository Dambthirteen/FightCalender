'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { nextStreakBadge, flameTier } from '@/lib/badges';

export default function StartPage() {
  const { userName } = useUser();
  const [groupName, setGroupName] = useState('');
  const [pendingVotes, setPendingVotes] = useState(0);
  const [unread, setUnread] = useState(0);
  const [streak, setStreak] = useState({ days: 0, weeks: 0 });

  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string }) => g.id === d.current);
      if (cur) setGroupName(cur.name);
    }).catch(() => {});
  }, []);

  // Offene Gericht-Stimmen (Glühen), ungelesene Benachrichtigungen, Streak.
  useEffect(() => {
    if (!userName) return;
    fetch('/api/vote/pending').then((r) => r.json()).then((d) => setPendingVotes(d.pending ?? 0)).catch(() => {});
    fetch('/api/notifications').then((r) => r.json()).then((d) => setUnread(d.unread ?? 0)).catch(() => {});
    fetch('/api/streak').then((r) => r.json()).then((d) => setStreak({ days: d.days ?? 0, weeks: d.weeks ?? 0 })).catch(() => {});
  }, [userName]);

  const nextBadge = nextStreakBadge(streak.weeks);
  const flames = '🔥'.repeat(Math.max(1, flameTier(streak.weeks)));
  const streakHint = streak.days === 0
    ? 'Trainiere deinen Plan, um zu starten.'
    : nextBadge
      ? `${streak.weeks} ${streak.weeks === 1 ? 'Woche' : 'Wochen'} · noch ${nextBadge.threshold - streak.weeks} bis „${nextBadge.label}"`
      : `${streak.weeks} Wochen · Maximalstufe`;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const courtAlert = pendingVotes > 0; // es gibt Ausreden zu richten → glühen

  const iconBtn = 'relative w-10 h-10 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all text-lg';
  const moreRows = [
    { icon: '👥', label: 'Mitglieder', href: '/mitglieder' },
    { icon: '🏥', label: 'Mein Status', href: '/account' },
    { icon: '📋', label: 'Stundenplan ändern', href: '/?plan=1' },
  ];

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-6 pb-3 flex items-start justify-between gap-3 anim-in">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide">Startseite</h1>
          <button onClick={() => (window.location.href = '/gruppen')}
            className="mt-1 flex items-center gap-1.5 text-sm truncate" style={{ color: 'var(--teal)' }}>
            {groupName || 'Gruppe'} <span style={{ color: 'var(--faint)' }}>· wechseln ›</span>
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/benachrichtigungen" aria-label="Benachrichtigungen" className={iconBtn}>
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.05rem] h-[1.05rem] px-1 grid place-items-center rounded-full text-[9px] font-bold text-white tnum" style={{ background: 'var(--accent)' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </a>
          <a href="/settings" aria-label="Einstellungen" className={iconBtn}>⚙</a>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-28 space-y-3">
        {/* Streak — immer sichtbar */}
        <a href={`/profil/${encodeURIComponent(userName ?? '')}`}
          className="card px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform anim-up"
          style={streak.days > 0 ? { borderColor: 'var(--accent-2)' } : undefined}>
          <span className="text-2xl leading-none" style={streak.days === 0 ? { filter: 'grayscale(1)', opacity: 0.6 } : undefined}>{flames}</span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl tracking-wide leading-none tnum">
              {streak.days} <span className="text-base">{streak.days === 1 ? 'Tag' : 'Tage'} Streak</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-1">{streakHint}</div>
          </div>
        </a>

        {/* Feature: Statistiken */}
        <a href="/statistik"
          className="card tape-accent pl-6 pr-5 py-5 flex items-center gap-4 active:scale-[0.99] transition-transform anim-up">
          <span className="text-3xl">📊</span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl tracking-wide leading-none">Statistiken</div>
            <div className="text-xs text-[var(--muted)] mt-1.5">Macher · Bitch · Jahr</div>
          </div>
          <span className="text-[var(--faint)] text-lg">›</span>
        </a>

        {/* Zwei mittlere Tiles */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/vote"
            className={`card p-4 flex flex-col gap-2 active:scale-[0.98] transition-transform anim-up ${courtAlert ? 'court-alert' : ''}`}
            style={{ animationDelay: '40ms' }}>
            <span className="text-2xl">🗳️</span>
            <span className="text-sm font-semibold">Ausreden-Gericht</span>
            <span className="text-[11px] font-semibold" style={{ color: pendingVotes > 0 ? 'var(--bitch)' : 'var(--faint)' }}>
              {pendingVotes > 0 ? `● ${pendingVotes} offen` : 'Ausreden bewerten'}
            </span>
          </a>
          <a href="/competitions"
            className="card p-4 flex flex-col gap-2 active:scale-[0.98] transition-transform anim-up" style={{ animationDelay: '60ms' }}>
            <span className="text-2xl">🏆</span>
            <span className="text-sm font-semibold">Wettkämpfe</span>
            <span className="text-[11px] text-[var(--faint)]">Termine & Countdown</span>
          </a>
        </div>

        {/* Trenner */}
        <div className="flex items-center gap-3 pt-3 pb-1">
          <div className="flex-1 h-px" style={{ background: 'var(--border-soft)' }} />
          <span className="section-label">Mehr</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-soft)' }} />
        </div>

        {/* Liste */}
        <div className="card overflow-hidden anim-up" style={{ animationDelay: '80ms' }}>
          {moreRows.map((row, i) => (
            <a key={row.label} href={row.href}
              className={`flex items-center gap-3 px-4 py-3.5 active:bg-[var(--surface-2)] transition-colors ${i < moreRows.length - 1 ? 'border-b border-[var(--border-soft)]' : ''}`}>
              <span className="text-xl w-6 text-center">{row.icon}</span>
              <span className="flex-1 text-sm font-semibold">{row.label}</span>
              <span className="text-[var(--faint)]">›</span>
            </a>
          ))}
        </div>

        <button onClick={logout} className="w-full text-center text-sm py-3 mt-1 text-[var(--faint)] hover:text-[var(--accent)] transition-colors">
          Ausloggen
        </button>
      </main>
    </div>
  );
}
