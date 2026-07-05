'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';
import InviteFriends from '@/components/InviteFriends';

type Person = { user_name: string; color?: string | null; avatar?: string | null; streak?: number };
const RECENT_KEY = 'fightcal_recent_profiles';

/** Eine Personen-Zeile (Avatar + Name), optional mit Streak. */
function PersonRow({ u, showStreak, me, onClick, delay }: { u: Person; showStreak?: boolean; me?: boolean; onClick?: () => void; delay?: number }) {
  const c = colorFor(u.user_name, u.color);
  return (
    <a href={`/profil/${encodeURIComponent(u.user_name)}`} onClick={onClick}
      className="card anim-up flex items-center gap-3 px-3.5 py-3 active:scale-[0.99] transition-transform"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}>
      {u.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.avatar} alt={u.user_name} className="w-11 h-11 rounded-full object-cover shrink-0" style={{ border: `1.5px solid ${c}` }} />
      ) : (
        <span className="w-11 h-11 rounded-full grid place-items-center font-display text-xl shrink-0"
          style={{ background: `${c}22`, color: c, border: `1.5px solid ${c}` }}>{initials(u.user_name)}</span>
      )}
      <span className="font-semibold flex-1 min-w-0 truncate">{u.user_name}</span>
      {showStreak && (
        <span className="text-xs font-semibold tnum shrink-0" title="Aktuelle Streak"
          style={{ color: (u.streak ?? 0) > 0 ? 'var(--accent)' : 'var(--faint)' }}>🔥 {u.streak ?? 0}</span>
      )}
      {me && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Du</span>}
      <span className="text-[var(--faint)]">›</span>
    </a>
  );
}

export default function MitgliederPage() {
  const { userName } = useUser();
  const [tab, setTab] = useState<'group' | 'public'>('group');

  // Gruppe
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Öffentlich (Suche)
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Person[]>([]);

  useEffect(() => {
    fetch('/api/users?avatars=1').then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (Array.isArray(r)) setRecent(r); } catch { /* egal */ }
  }, []);

  // Debounced Suche über öffentliche Profile.
  useEffect(() => {
    const query = q.trim();
    if (!query) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query)}`).then((r) => r.json())
        .then((d) => setResults(Array.isArray(d) ? d : [])).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function remember(p: Person) {
    const entry: Person = { user_name: p.user_name, color: p.color ?? null, avatar: p.avatar ?? null };
    const next = [entry, ...recent.filter((r) => r.user_name !== p.user_name)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* egal */ }
  }
  function clearRecent() { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* egal */ } }

  const query = q.trim();

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between anim-in">
        <a href="/start" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-2xl tracking-wide flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/more-members.png" alt="" className="w-7 h-7 object-contain" />
          Mitglieder
        </h1>
        <span className="w-11" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        {/* Tab-Umschalter */}
        <div className="flex gap-2 mb-4 anim-in">
          {([['group', 'Gruppe'], ['public', 'Alle']] as const).map(([key, label]) => {
            const on = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={on
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(255,59,48,0.35)' }
                  : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border-soft)' }}>
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'group' ? (
          <>
            <div className="anim-up mb-4"><InviteFriends /></div>
            {loading ? (
              <div className="py-24 text-center text-[var(--faint)] text-sm">Laden…</div>
            ) : (
              <div className="space-y-2">
                {users.map((u, i) => (
                  <PersonRow key={u.user_name} u={u} showStreak me={u.user_name === userName} delay={i * 40} />
                ))}
                {users.length === 0 && <div className="py-16 text-center text-[var(--faint)] text-sm">Noch keine Mitglieder.</div>}
              </div>
            )}
          </>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
              placeholder="Öffentliche Profile suchen…"
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] mb-4" />

            {query ? (
              searching && results.length === 0 ? (
                <div className="py-16 text-center text-[var(--faint)] text-sm">Suche…</div>
              ) : results.length === 0 ? (
                <div className="py-16 text-center text-[var(--faint)] text-sm">Niemand Öffentliches gefunden.</div>
              ) : (
                <div className="space-y-2">
                  {results.map((u, i) => (
                    <PersonRow key={u.user_name} u={u} me={u.user_name === userName} onClick={() => remember(u)} delay={i * 30} />
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="section-label">Zuletzt gesucht</div>
                  {recent.length > 0 && (
                    <button onClick={clearRecent} className="text-xs text-[var(--faint)] hover:text-white transition-colors">Leeren</button>
                  )}
                </div>
                {recent.length === 0 ? (
                  <div className="py-14 text-center text-[var(--faint)] text-sm">Such nach jemandem, der öffentlich ist.</div>
                ) : (
                  <div className="space-y-2">
                    {recent.map((u, i) => (
                      <PersonRow key={u.user_name} u={u} me={u.user_name === userName} onClick={() => remember(u)} delay={i * 30} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
