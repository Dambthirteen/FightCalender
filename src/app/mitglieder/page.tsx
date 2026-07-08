'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';
import { isCoach } from '@/lib/fighter';
import InviteFriends from '@/components/InviteFriends';

type Person = { user_name: string; color?: string | null; avatar?: string | null; streak?: number; role?: string | null; group_role?: string | null };
type FriendState = 'none' | 'outgoing' | 'incoming' | 'friends' | 'self';
type FriendAction = 'request' | 'accept' | 'reject' | 'remove';
const RECENT_KEY = 'fightcal_recent_profiles';

/** Freund-Aktion in einer Personen-Zeile (verschluckt den Klick, damit der Profil-Link nicht auslöst). */
function FriendButton({ state, onAction }: { state: FriendState; onAction?: (a: FriendAction) => void }) {
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  if (state === 'self') return null;
  if (state === 'friends') return (
    <button onClick={(e) => { stop(e); onAction?.('remove'); }} title="Freund entfernen"
      className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ color: 'var(--teal)', border: '1px solid rgba(45,212,191,0.4)' }}>✓ Freund</button>
  );
  if (state === 'outgoing') return (
    <button onClick={(e) => { stop(e); onAction?.('remove'); }} title="Anfrage zurückziehen"
      className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ color: 'var(--faint)', border: '1px solid var(--border-soft)' }}>Angefragt</button>
  );
  if (state === 'incoming') return (
    <button onClick={(e) => { stop(e); onAction?.('accept'); }}
      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>Annehmen</button>
  );
  return (
    <button onClick={(e) => { stop(e); onAction?.('request'); }}
      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid rgba(255,59,48,0.4)' }}>+ Freund</button>
  );
}

/** Eine Personen-Zeile (Avatar + Name), optional mit Streak + Freund-Aktion. */
function PersonRow({ u, showStreak, me, onClick, delay, friendState, onFriend }: { u: Person; showStreak?: boolean; me?: boolean; onClick?: () => void; delay?: number; friendState?: FriendState; onFriend?: (a: FriendAction) => void }) {
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
      <span className="flex-1 min-w-0 truncate">
        <span className="font-semibold">{u.user_name}</span>
        {u.group_role === 'admin' && <span className="text-[11px] font-medium align-middle" style={{ color: 'var(--accent)' }}> · Admin</span>}
        {u.group_role === 'moderator' && <span className="text-[11px] font-medium align-middle" style={{ color: 'var(--accent-2)' }}> · Mod</span>}
        {isCoach(u.role) && <span className="text-[11px] font-medium align-middle" style={{ color: 'var(--teal)' }}> · Coach</span>}
      </span>
      {showStreak && (
        <span className="text-xs font-semibold tnum shrink-0" title="Aktuelle Streak"
          style={{ color: (u.streak ?? 0) > 0 ? 'var(--accent)' : 'var(--faint)' }}>🔥 {u.streak ?? 0}</span>
      )}
      {friendState && friendState !== 'self' && <FriendButton state={friendState} onAction={onFriend} />}
      {me && <span className="text-[10px] uppercase tracking-wider px-1.5 py-px rounded-[3px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Du</span>}
      <span className="text-[var(--faint)]">›</span>
    </a>
  );
}

export default function MitgliederPage() {
  const { userName } = useUser();
  const [tab, setTab] = useState<'group' | 'public' | 'friends'>('group');

  // Gruppe
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | 'fighter' | 'coach'>('all');
  const [groupInfo, setGroupInfo] = useState<{ name: string; clan_tag: string | null; avatar: string | null; description: string } | null>(null);

  // Öffentlich (Suche)
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Person[]>([]);

  // Freunde
  const [friendsList, setFriendsList] = useState<Person[]>([]);
  const [incomingList, setIncomingList] = useState<Person[]>([]);
  const [friendSet, setFriendSet] = useState<Set<string>>(new Set());
  const [incomingSet, setIncomingSet] = useState<Set<string>>(new Set());
  const [outgoingSet, setOutgoingSet] = useState<Set<string>>(new Set());

  function loadFriends() {
    fetch('/api/friends').then((r) => r.json()).then((d) => {
      const fr: Person[] = Array.isArray(d.friends) ? d.friends : [];
      const inc: Person[] = Array.isArray(d.incoming) ? d.incoming : [];
      setFriendsList(fr); setIncomingList(inc);
      setFriendSet(new Set(fr.map((p) => p.user_name)));
      setIncomingSet(new Set(inc.map((p) => p.user_name)));
      setOutgoingSet(new Set(Array.isArray(d.outgoing) ? d.outgoing : []));
    }).catch(() => {});
  }

  function friendStateFor(name: string): FriendState {
    if (name === userName) return 'self';
    if (friendSet.has(name)) return 'friends';
    if (incomingSet.has(name)) return 'incoming';
    if (outgoingSet.has(name)) return 'outgoing';
    return 'none';
  }

  async function friendAction(name: string, action: FriendAction) {
    // Optimistisch die Sets anpassen, danach vom Server synchronisieren.
    setFriendSet((s) => { const n = new Set(s); if (action === 'accept') n.add(name); if (action === 'remove') n.delete(name); return n; });
    setOutgoingSet((s) => { const n = new Set(s); if (action === 'request') n.add(name); else n.delete(name); return n; });
    setIncomingSet((s) => { const n = new Set(s); if (action === 'accept' || action === 'reject') n.delete(name); return n; });
    try {
      await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, user: name }) });
    } catch { /* egal */ }
    loadFriends();
  }

  useEffect(() => {
    fetch('/api/users?avatars=1').then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number }) => g.id === d.current);
      if (cur) setGroupInfo({ name: cur.name, clan_tag: cur.clan_tag ?? null, avatar: cur.avatar ?? null, description: cur.description ?? '' });
    }).catch(() => {});
    loadFriends();
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (Array.isArray(r)) setRecent(r); } catch { /* egal */ }
    // Direktlink aus der Freundschaftsanfrage-Benachrichtigung.
    try { if (new URLSearchParams(window.location.search).get('tab') === 'friends') setTab('friends'); } catch { /* egal */ }
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
          {([['group', 'Gruppe'], ['public', 'Alle'], ['friends', 'Freunde']] as const).map(([key, label]) => {
            const on = tab === key;
            const badge = key === 'friends' && incomingList.length > 0 ? incomingList.length : 0;
            return (
              <button key={key} onClick={() => setTab(key)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors relative"
                style={on
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(255,59,48,0.35)' }
                  : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border-soft)' }}>
                {label}
                {badge > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[1.05rem] h-[1.05rem] px-1 grid place-items-center rounded-full text-[9px] font-bold text-white tnum" style={{ background: 'var(--accent)' }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {tab === 'group' ? (
          <>
            {/* Gruppenprofil */}
            {groupInfo && (
              <div className="card p-4 mb-4 anim-up flex items-center gap-3.5">
                {groupInfo.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={groupInfo.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" style={{ border: `1.5px solid ${colorFor(groupInfo.name)}` }} />
                ) : (
                  <span className="w-14 h-14 rounded-2xl grid place-items-center font-display text-xl shrink-0" style={{ background: `${colorFor(groupInfo.name)}22`, color: colorFor(groupInfo.name), border: `1.5px solid ${colorFor(groupInfo.name)}` }}>{initials(groupInfo.name)}</span>
                )}
                <div className="min-w-0">
                  <div className="font-display text-xl tracking-wide truncate">{groupInfo.clan_tag ? `[${groupInfo.clan_tag}] ` : ''}{groupInfo.name}</div>
                  {groupInfo.description
                    ? <p className="text-[12px] text-[var(--muted)] mt-0.5 line-clamp-3 whitespace-pre-line">{groupInfo.description}</p>
                    : <p className="text-[11px] text-[var(--faint)] mt-0.5">Noch keine Beschreibung.</p>}
                </div>
              </div>
            )}
            {/* Rollen-Filter */}
            <div className="flex gap-2 mb-3">
              {([['all', 'Alle'], ['fighter', 'Fighter'], ['coach', 'Coaches']] as const).map(([key, label]) => {
                const on = roleFilter === key;
                return (
                  <button key={key} onClick={() => setRoleFilter(key)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                    style={on
                      ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(255,59,48,0.35)' }
                      : { background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--border-soft)' }}>
                    {label}
                  </button>
                );
              })}
            </div>
            {loading ? (
              <div className="py-24 text-center text-[var(--faint)] text-sm">Laden…</div>
            ) : (() => {
              const shown = users.filter((u) => roleFilter === 'all' || (roleFilter === 'coach' ? isCoach(u.role) : !isCoach(u.role)));
              return (
                <div className="space-y-2">
                  {shown.map((u, i) => (
                    <PersonRow key={u.user_name} u={u} showStreak me={u.user_name === userName} delay={i * 40}
                      friendState={friendStateFor(u.user_name)} onFriend={(a) => friendAction(u.user_name, a)} />
                  ))}
                  {shown.length === 0 && <div className="py-16 text-center text-[var(--faint)] text-sm">{roleFilter === 'coach' ? 'Keine Coaches in dieser Crew.' : 'Niemand hier.'}</div>}
                </div>
              );
            })()}
            <div className="anim-up mt-6"><InviteFriends /></div>
          </>
        ) : tab === 'public' ? (
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
                    <PersonRow key={u.user_name} u={u} me={u.user_name === userName} onClick={() => remember(u)} delay={i * 30}
                      friendState={friendStateFor(u.user_name)} onFriend={(a) => friendAction(u.user_name, a)} />
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
                      <PersonRow key={u.user_name} u={u} me={u.user_name === userName} onClick={() => remember(u)} delay={i * 30}
                        friendState={friendStateFor(u.user_name)} onFriend={(a) => friendAction(u.user_name, a)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {incomingList.length > 0 && (
              <div className="mb-5">
                <div className="section-label mb-2">Anfragen ({incomingList.length})</div>
                <div className="space-y-2">
                  {incomingList.map((u, i) => (
                    <div key={u.user_name} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0"><PersonRow u={u} delay={i * 30} friendState="incoming" onFriend={(a) => friendAction(u.user_name, a)} /></div>
                      <button onClick={() => friendAction(u.user_name, 'reject')}
                        className="text-[11px] font-semibold px-2.5 py-2 rounded-xl border border-[var(--border-soft)] text-[var(--faint)] hover:text-white shrink-0 transition-colors">Ablehnen</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="section-label mb-2">Deine Freunde ({friendsList.length})</div>
            {friendsList.length === 0 ? (
              <div className="py-16 text-center text-[var(--faint)] text-sm">
                Noch keine Freunde. Tipp bei jemandem auf <span style={{ color: 'var(--accent)' }}>+ Freund</span> — nur befreundete Namen tauchen in deinen Trainings-Benachrichtigungen auf.
              </div>
            ) : (
              <div className="space-y-2">
                {friendsList.map((u, i) => (
                  <PersonRow key={u.user_name} u={u} delay={i * 30}
                    friendState="friends" onFriend={(a) => friendAction(u.user_name, a)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
