'use client';

import { useEffect, useState } from 'react';
import { getDaysInMonth } from 'date-fns';

function isVotingWindow() {
  const n = new Date();
  return n.getDate() >= getDaysInMonth(n) - 2;
}

export default function StartPage() {
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string }) => g.id === d.current);
      if (cur) setGroupName(cur.name);
    }).catch(() => {});
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const items = [
    { icon: '📊', label: 'Statistiken', href: '/statistik' },
    { icon: '🗳️', label: 'Ausreden-Gericht', href: '/vote', badge: isVotingWindow() },
    { icon: '👥', label: 'Mitglieder', href: '/mitglieder' },
    { icon: '🏆', label: 'Wettkämpfe', href: '/competitions' },
    { icon: '🏥', label: 'Mein Status', href: '/account' },
    { icon: '📋', label: 'Stundenplan ändern', href: '/?plan=1' },
    { icon: '⚙️', label: 'Einstellungen', href: '/settings' },
    { icon: '🛠️', label: 'Admin', href: '/admin' },
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

      <main className="max-w-md mx-auto px-4 pb-28">
        <div className="grid grid-cols-2 gap-3">
          {items.map((it, i) => (
            <a key={it.label} href={it.href}
              className="card anim-up flex flex-col items-start gap-2 p-4 active:scale-[0.98] transition-transform"
              style={{ animationDelay: `${i * 40}ms` }}>
              <span className="text-2xl">{it.icon}</span>
              <span className="text-sm font-semibold flex items-center gap-1.5">
                {it.label}
                {it.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.16)', color: 'var(--bitch)' }}>offen</span>}
              </span>
            </a>
          ))}
        </div>
        <button onClick={logout}
          className="mt-3 w-full card p-4 flex items-center gap-3 text-sm font-semibold active:scale-[0.99]" style={{ color: 'var(--faint)' }}>
          🚪 Ausloggen
        </button>
      </main>
    </div>
  );
}
