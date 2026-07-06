'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { resetAnalytics } from '@/lib/analytics';
import { nextStreakBadge, STREAK_BADGES } from '@/lib/badges';
import StreakFlame from '@/components/StreakFlame';
import FullscreenLoader from '@/components/FullscreenLoader';
import { XP } from '@/lib/xp';

export default function StartPage() {
  const { userName, loading: userLoading } = useUser();
  const [groupName, setGroupName] = useState('');
  const [hardMode, setHardMode] = useState(false);
  const [pendingVotes, setPendingVotes] = useState(0);
  const [unread, setUnread] = useState(0);
  const [streak, setStreak] = useState({ days: 0, weeks: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [isHobby, setIsHobby] = useState(false);
  const [ready, setReady] = useState(false);

  // Alles laden, dann erst die Seite zeigen (kein sichtbarer Aufbau).
  useEffect(() => {
    if (userLoading) return;
    if (!userName) { setReady(true); return; }
    Promise.all([
      fetch('/api/groups').then((r) => r.json()).then((d) => {
        const cur = (d.groups ?? []).find((g: { id: number; name: string; clan_tag?: string | null; hard_mode?: boolean }) => g.id === d.current);
        if (cur) { setGroupName(cur.clan_tag ? `[${cur.clan_tag}] ${cur.name}` : cur.name); setHardMode(!!cur.hard_mode); }
      }).catch(() => {}),
      fetch('/api/vote/pending').then((r) => r.json()).then((d) => setPendingVotes(d.pending ?? 0)).catch(() => {}),
      fetch('/api/notifications').then((r) => r.json()).then((d) => setUnread(d.unread ?? 0)).catch(() => {}),
      fetch('/api/streak').then((r) => r.json()).then((d) => setStreak({ days: d.days ?? 0, weeks: d.weeks ?? 0 })).catch(() => {}),
      // Accountart: Hobby → Wettkämpfe wandert von der großen Karte in die Liste.
      fetch(`/api/profile-info?user=${encodeURIComponent(userName)}`).then((r) => r.json()).then((d) => setIsHobby(d?.fighter_info?.athlete === 'hobby')).catch(() => {}),
    ]).finally(() => setReady(true));
  }, [userLoading, userName]);

  const nextBadge = nextStreakBadge(streak.weeks);

  async function logout() {
    resetAnalytics();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const iconBtn = 'relative w-10 h-10 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all text-lg';
  type Row = { icon: string; label: string; href: string; badge?: number };
  // „Allgemein" = gruppenweite Features, „Du" = persönlich. Wettkämpfer: Statistiken + Wettkämpfe
  // als große Karten. Hobby: keine Wettkampf-Karte — stattdessen als Zeile in der Liste.
  const allgemeinRows: Row[] = [
    ...(isHobby ? [{ icon: '/tile-competition.png', label: 'Wettkämpfe', href: '/competitions' }] : []),
    // Ausreden-Gericht nur im harten Modus zeigen.
    ...(hardMode ? [{ icon: '/more-court.png', label: 'Ausreden-Gericht', href: '/vote', badge: pendingVotes }] : []),
    { icon: '/more-members.png', label: 'Mitglieder', href: '/mitglieder' },
  ];
  const duRows: Row[] = [
    { icon: '/more-status.png', label: 'Mein Status', href: '/account' },
    { icon: '/more-timetable.png', label: 'Stundenplan ändern', href: '/?plan=1' },
  ];
  const listCard = (rows: Row[], delay: number) => (
    <div className="card overflow-hidden anim-up" style={{ animationDelay: `${delay}ms` }}>
      {rows.map((row, i) => (
        <a key={row.label} href={row.href}
          className={`flex items-center gap-3 px-4 py-3.5 active:bg-[var(--surface-2)] transition-colors ${i < rows.length - 1 ? 'border-b border-[var(--border-soft)]' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.icon} alt="" className="w-6 h-6 object-contain shrink-0" style={{ opacity: 0.9 }} />
          <span className="flex-1 text-sm font-semibold">{row.label}</span>
          {!!row.badge && row.badge > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--bitch)' }}>● {row.badge} offen</span>
          )}
          <span className="text-[var(--faint)]">›</span>
        </a>
      ))}
    </div>
  );
  const divider = (label: string) => (
    <div className="flex items-center gap-3 pt-3 pb-1">
      <div className="flex-1 h-px" style={{ background: 'var(--border-soft)' }} />
      <span className="section-label">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-soft)' }} />
    </div>
  );

  if (userLoading || !ready) return <FullscreenLoader />;

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-6 pb-3 flex items-start justify-between gap-3 anim-in">
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide">Startseite</h1>
          <button onClick={() => (window.location.href = '/gruppen')}
            className="mt-1 flex items-center gap-1.5 text-sm truncate" style={{ color: 'var(--teal)' }}>
            {groupName || 'Gruppe'} <span style={{ color: 'var(--faint)' }}>· anpassen ›</span>
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
        {/* Streak — zentriert; Klick öffnet Details */}
        <button onClick={() => setStreakOpen(true)}
          className="w-full flex flex-col items-center pt-2 pb-3 active:scale-[0.99] transition-transform anim-up">
          <StreakFlame days={streak.days} height={128} />
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mt-1">{streak.days === 1 ? 'Tag' : 'Tage'} Streak</div>
        </button>

        {/* ── Allgemein ── */}
        {divider('Allgemein')}

        {/* Feature: Statistiken */}
        <a href="/statistik"
          className="card px-5 py-4 flex items-center gap-4 active:scale-[0.99] transition-transform anim-up">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tile-statistics.png" alt="" className="w-11 h-11 object-contain shrink-0" />
          <div className="flex-1 min-w-0 font-display text-2xl tracking-wide leading-none">Statistiken</div>
          <span className="text-[var(--faint)] text-lg">›</span>
        </a>

        {/* Feature: Wettkämpfe — nur für Wettkämpfer als große Karte (Hobby: Zeile in der Liste). */}
        {!isHobby && (
          <a href="/competitions"
            className="card px-5 py-4 flex items-center gap-4 active:scale-[0.99] transition-transform anim-up" style={{ animationDelay: '40ms' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tile-competition.png" alt="" className="w-11 h-11 object-contain shrink-0" />
            <div className="flex-1 min-w-0 font-display text-2xl tracking-wide leading-none">Wettkämpfe</div>
            <span className="text-[var(--faint)] text-lg">›</span>
          </a>
        )}

        {allgemeinRows.length > 0 && listCard(allgemeinRows, 80)}

        {/* ── Du ── */}
        {divider('Du')}
        {listCard(duRows, 100)}

        <button onClick={() => window.location.assign('/start?wrapped=1')}
          className="w-full text-center text-sm py-2 mt-1 text-[var(--muted)] hover:text-white transition-colors">
          Monats-Wrapped ansehen
        </button>
        <button onClick={logout} className="w-full text-center text-sm py-3 text-[var(--faint)] hover:text-[var(--accent)] transition-colors">
          Ausloggen
        </button>

        {/* Dezenter Hilfe-Button ganz unten */}
        <button onClick={() => setHelpOpen(true)}
          className="w-full text-center text-xs py-2 text-[var(--faint)] hover:text-[var(--muted)] transition-colors">
          ⓘ Wie bekomme ich XP & Level?
        </button>
      </main>

      {/* Streak-Details */}
      {streakOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setStreakOpen(false); }}>
          <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto p-5 anim-up rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl tracking-wide">Deine Streak</h2>
              <button onClick={() => setStreakOpen(false)} className="text-[var(--faint)] hover:text-white text-lg px-1">✕</button>
            </div>

            {/* Aktuelle Werte */}
            <div className="flex flex-col items-center pb-4">
              <StreakFlame days={streak.days} height={110} />
              <div className="text-xs text-[var(--muted)] mt-2 text-center px-2">
                {streak.weeks} {streak.weeks === 1 ? 'Woche' : 'Wochen'} ohne Skip
                {nextBadge ? ` · noch ${nextBadge.threshold - streak.weeks} bis „${nextBadge.label}"` : ' · Maximalstufe erreicht'}
              </div>
            </div>

            <div className="section-label mb-2">Trophäen</div>
            <div className="space-y-1.5">
              {STREAK_BADGES.map((b) => {
                const got = streak.weeks >= b.threshold;
                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: got ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                    <span className="text-xl" style={got ? undefined : { filter: 'grayscale(1)', opacity: 0.6 }}>{b.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{b.label}</div>
                      <div className="text-[11px] text-[var(--muted)]">{b.hint}</div>
                    </div>
                    <span className="text-[11px] font-bold tnum shrink-0" style={{ color: got ? 'var(--accent-2)' : 'var(--faint)' }}>
                      {got ? '✓ erreicht' : `${b.threshold} Wo`}
                    </span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setStreakOpen(false)} className="btn btn-primary w-full mt-5">Schließen</button>
          </div>
        </div>
      )}

      {/* Hilfe / Erklärung */}
      {helpOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
          <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto p-5 anim-up rounded-b-none sm:rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl tracking-wide">So funktioniert&apos;s</h2>
              <button onClick={() => setHelpOpen(false)} className="text-[var(--faint)] hover:text-white text-lg px-1">✕</button>
            </div>

            <div className="space-y-5 text-sm">
              <section>
                <div className="section-label mb-2">XP &amp; Level</div>
                <p className="text-[var(--muted)] mb-3">
                  Du sammelst XP fürs Mitmachen. Genug XP → nächstes Level → höherer Rang.
                  Chicken-Punkte ziehen <strong className="text-[var(--text)]">nichts</strong> ab.
                </p>
                <div className="space-y-1.5">
                  {([
                    ['Training besucht', XP.attend],
                    ['Wettkampf bestritten', XP.comp],
                    ['Wettkampf gewonnen', XP.win],
                    ['Lob erhalten', XP.lob],
                    ['Gigalob erhalten', XP.gigalob],
                    ['Ausrede gerichtet (Vote)', XP.vote],
                  ] as const).map(([label, amount]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">{label}</span>
                      <span className="font-semibold tnum" style={{ color: 'var(--teal)' }}>+{amount} XP</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="section-label mb-2">Ränge</div>
                <p className="text-[var(--muted)]">
                  Mit dem Level steigt dein Rang: <strong className="text-[var(--text)]">Bronze → Silber → Gold → Platin → Diamant → Elite</strong>.
                  Der Rang färbt deine XP-Leiste.
                </p>
              </section>

              <section>
                <div className="section-label mb-2">Streak</div>
                <p className="text-[var(--muted)]">
                  Trainiere regelmäßig deinen Plan → deine Streak (🔥) wächst und schaltet Abzeichen frei.
                  Streak-Punkte schützen dich, wenn du mal einen geplanten Tag verpasst.
                </p>
              </section>

              <section>
                <div className="section-label mb-2">Spind</div>
                <p className="text-[var(--muted)] mb-3">
                  Höhere Level schalten Anpassungen frei: Namens-Stil, Avatar-Rahmen, Flammen-Farbe und Gürtel-Skins.
                </p>
                <a href={`/profil/${encodeURIComponent(userName ?? '')}`}
                  className="btn btn-ghost w-full">Zum Profil &amp; Spind</a>
              </section>
            </div>

            <button onClick={() => setHelpOpen(false)} className="btn btn-primary w-full mt-5">Verstanden</button>
          </div>
        </div>
      )}
    </div>
  );
}
