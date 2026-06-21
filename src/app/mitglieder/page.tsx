'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';

export default function MitgliederPage() {
  const { userName } = useUser();
  const [users, setUsers] = useState<{ user_name: string; color?: string | null; avatar?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users?avatars=1')
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between anim-in">
        <a href="/start" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-2xl tracking-wide">👥 Mitglieder</h1>
        <span className="w-11" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        {loading ? (
          <div className="py-24 text-center text-[var(--faint)] text-sm">Laden…</div>
        ) : (
          <div className="space-y-2">
            {users.map((u, i) => {
              const c = colorFor(u.user_name, u.color);
              const me = u.user_name === userName;
              return (
                <a key={u.user_name} href={`/profil/${encodeURIComponent(u.user_name)}`}
                  className="card anim-up flex items-center gap-3 px-3.5 py-3 active:scale-[0.99] transition-transform"
                  style={{ animationDelay: `${i * 40}ms` }}>
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.user_name} className="w-11 h-11 rounded-full object-cover shrink-0"
                      style={{ border: `1.5px solid ${c}` }} />
                  ) : (
                    <span className="w-11 h-11 rounded-full grid place-items-center font-display text-xl shrink-0"
                      style={{ background: `${c}22`, color: c, border: `1.5px solid ${c}` }}>
                      {initials(u.user_name)}
                    </span>
                  )}
                  <span className="font-semibold flex-1 min-w-0 truncate">{u.user_name}</span>
                  {me && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Du</span>}
                  <span className="text-[var(--faint)]">›</span>
                </a>
              );
            })}
            {users.length === 0 && <div className="py-16 text-center text-[var(--faint)] text-sm">Noch keine Mitglieder.</div>}
          </div>
        )}
      </main>
    </div>
  );
}
