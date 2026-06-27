'use client';

import { useEffect, useState } from 'react';
import { getDaysInMonth } from 'date-fns';
import { useUser } from '@/components/UserProvider';

function isVotingWindow() {
  const n = new Date();
  return n.getDate() >= getDaysInMonth(n) - 2;
}

export default function StartPage() {
  const { userName } = useUser();
  const [groupName, setGroupName] = useState('');
  const [pendingVotes, setPendingVotes] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string }) => g.id === d.current);
      if (cur) setGroupName(cur.name);
    }).catch(() => {});
  }, []);

  // Offene Gericht-Stimmen (Glühen) + ungelesene Benachrichtigungen.
  useEffect(() => {
    if (!userName) return;
    fetch('/api/vote/pending').then((r) => r.json()).then((d) => setPendingVotes(d.pending ?? 0)).catch(() => {});
    fetch('/api/notifications').then((r) => r.json()).then((d) => setUnread(d.unread ?? 0)).catch(() => {});
  }, [userName]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const courtOpen = isVotingWindow();
  const courtAlert = courtOpen && pendingVotes > 0; // offen UND noch nicht fertig abgestimmt

  type HubItem = { icon: string; label: string; href: string; badge?: boolean; alert?: boolean; count?: number };
  // In Kategorien gruppiert und nach Wichtigkeit sortiert.
  const categories: { title: string; items: HubItem[] }[] = [
    {
      title: 'Wettkampf & Wertung',
      items: [
        { icon: '📊', label: 'Statistiken', href: '/statistik' },
        { icon: '🗳️', label: 'Ausreden-Gericht', href: '/vote', badge: courtOpen, alert: courtAlert },
        { icon: '🏆', label: 'Wettkämpfe', href: '/competitions' },
      ],
    },
    {
      title: 'Community',
      items: [
        { icon: '👥', label: 'Mitglieder', href: '/mitglieder' },
        { icon: '🔔', label: 'Benachrichtigungen', href: '/benachrichtigungen', count: unread },
      ],
    },
    {
      title: 'Mein Bereich',
      items: [
        { icon: '🏥', label: 'Mein Status', href: '/account' },
        { icon: '📋', label: 'Stundenplan ändern', href: '/?plan=1' },
        { icon: '⚙️', label: 'Einstellungen', href: '/settings' },
      ],
    },
  ];

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-6 pb-3 anim-in">
        <h1 className="font-display text-3xl tracking-wide">Startseite</h1>
        <button onClick={() => (window.location.href = '/gruppen')}
          className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: 'var(--teal)' }}>
          🏠 {groupName || 'Gruppe'} <span style={{ color: 'var(--faint)' }}>· wechseln ›</span>
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pb-28 space-y-6">
        {categories.map((cat, ci) => (
          <section key={cat.title} className="anim-up" style={{ animationDelay: `${ci * 60}ms` }}>
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)] mb-2.5 px-0.5">{cat.title}</h2>
            <div className="grid grid-cols-2 gap-3">
              {cat.items.map((it) => (
                <a key={it.label} href={it.href}
                  className={`card flex flex-col items-start gap-2 p-4 active:scale-[0.98] transition-transform ${it.alert ? 'court-alert' : ''}`}>
                  <span className="text-2xl">{it.icon}</span>
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {it.label}
                    {it.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.16)', color: 'var(--bitch)' }}>offen</span>}
                    {!!it.count && it.count > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--accent)' }}>{it.count}</span>
                    )}
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <button onClick={logout}
          className="mt-3 w-full card p-4 flex items-center gap-3 text-sm font-semibold active:scale-[0.99]" style={{ color: 'var(--faint)' }}>
          🚪 Ausloggen
        </button>
      </main>
    </div>
  );
}
