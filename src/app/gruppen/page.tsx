'use client';

import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { colorFor, initials } from '@/lib/avatar';

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const COLORS = ['red', 'blue', 'green', 'orange', 'purple'];
const COLOR_HEX: Record<string, string> = { red: '#ff3b30', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', purple: '#a855f7' };

interface MyGroup { id: number; name: string; invite_code: string; role: string }
interface Member { user_name: string; role: string; status: string }
interface Cls { id: number; name: string; day_of_week: number; start_time: string; end_time: string; color: string }

export default function GroupsPage() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [classes, setClasses] = useState<Cls[]>([]);

  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', dayOfWeek: 1, startTime: '18:00', endTime: '19:30', color: 'red' });

  const load = useCallback(async () => {
    const [g, m, c] = await Promise.all([
      fetch('/api/groups').then((r) => r.json()).catch(() => ({})),
      fetch('/api/groups/members').then((r) => r.json()).catch(() => ({})),
      fetch('/api/classes').then((r) => r.json()).catch(() => []),
    ]);
    setGroups(Array.isArray(g.groups) ? g.groups : []);
    setCurrent(g.current ?? null);
    setMembers(Array.isArray(m.members) ? m.members : []);
    setMyRole(m.myRole ?? null);
    setInviteCode(m.inviteCode ?? null);
    setGroupName(m.group?.name ?? '');
    setClasses(Array.isArray(c) ? c : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    if (!newName.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      if (res.ok) { setNewName(''); window.location.href = '/gruppen'; }
      else { const d = await res.json().catch(() => ({})); setMsg(d.error ?? 'Konnte Gruppe nicht erstellen — schon deployt & /api/setup gelaufen?'); }
    } finally { setBusy(false); }
  }
  async function joinGroup() {
    if (!joinCode.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: joinCode }) });
      const d = await res.json();
      if (res.ok) { setMsg(d.status === 'active' ? `Du bist in „${d.group}".` : `Anfrage an „${d.group}" gesendet — ein Admin muss sie annehmen.`); setJoinCode(''); }
      else setMsg(d.error ?? 'Fehler');
    } finally { setBusy(false); }
  }
  async function switchGroup(id: number) {
    await fetch('/api/groups/current', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: id }) });
    window.location.href = '/';
  }
  async function memberAction(action: string, user_name?: string) {
    if (action === 'leave' && !confirm('Gruppe wirklich verlassen?')) return;
    if (action === 'remove' && !confirm(`„${user_name}" entfernen?`)) return;
    await fetch('/api/groups/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, user_name }) });
    if (action === 'leave') window.location.href = '/';
    else load();
  }
  async function addClass() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: '', dayOfWeek: 1, startTime: '18:00', endTime: '19:30', color: 'red' }); load(); }
    } finally { setBusy(false); }
  }
  async function delClass(id: number) {
    if (!confirm('Kurs löschen?')) return;
    await fetch(`/api/classes/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    load();
  }

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const isAdmin = myRole === 'admin';

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="👥 Gruppen" />
      <main className="max-w-md mx-auto px-4 pb-16 space-y-5">
        {/* Meine Gruppen / Umschalter */}
        <section className="card p-4 anim-up">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Meine Gruppen</div>
          <div className="space-y-2">
            {groups.map((g) => (
              <button key={g.id} onClick={() => g.id !== current && switchGroup(g.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.99]"
                style={{ borderColor: g.id === current ? 'var(--accent)' : 'var(--border-soft)', background: g.id === current ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                <span className="font-semibold text-sm">{g.name}</span>
                <span className="flex items-center gap-2">
                  {g.role === 'admin' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--muted)' }}>Admin</span>}
                  {g.id === current ? <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>AKTIV</span> : <span className="text-[var(--faint)] text-xs">wechseln ›</span>}
                </span>
              </button>
            ))}
            {groups.length === 0 && <div className="text-[var(--faint)] text-sm py-2">Noch in keiner Gruppe.</div>}
          </div>
        </section>

        {/* Erstellen / Beitreten */}
        <section className="card p-4 anim-up space-y-4" style={{ animationDelay: '40ms' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2">Neue Gruppe erstellen</div>
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (z.B. dein Gym)…"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]" />
              <button onClick={createGroup} disabled={busy || !newName.trim()} className="text-white font-bold px-4 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>Erstellen</button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2">Per Code beitreten</div>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="EINLADUNGSCODE" maxLength={12}
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] tracking-widest font-mono" />
              <button onClick={joinGroup} disabled={busy || !joinCode.trim()} className="font-semibold px-4 rounded-xl border border-[var(--border)] text-[var(--text)] disabled:opacity-40">Anfragen</button>
            </div>
            {msg && <p className="text-xs mt-2" style={{ color: 'var(--teal)' }}>{msg}</p>}
          </div>
        </section>

        {/* Aktuelle Gruppe: Mitglieder */}
        {current && (
          <section className="card p-4 anim-up" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{groupName} · Mitglieder</div>
              {isAdmin && inviteCode && (
                <span className="text-[11px] font-mono tracking-widest px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--teal)' }}>Code: {inviteCode}</span>
              )}
            </div>

            {isAdmin && pending.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-[var(--bitch)] uppercase tracking-wider mb-1.5">Offene Anfragen</div>
                {pending.map((m) => (
                  <div key={m.user_name} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm flex-1">{m.user_name}</span>
                    <button onClick={() => memberAction('approve', m.user_name)} className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: 'var(--good)' }}>Annehmen</button>
                    <button onClick={() => memberAction('reject', m.user_name)} className="text-xs px-2.5 py-1 rounded-lg text-[var(--faint)] border border-[var(--border)]">Ablehnen</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {active.map((m) => {
                const col = colorFor(m.user_name);
                return (
                  <div key={m.user_name} className="flex items-center gap-2.5 py-1">
                    <span className="w-8 h-8 rounded-full grid place-items-center font-display text-sm shrink-0" style={{ background: `${col}22`, color: col, border: `1.5px solid ${col}` }}>{initials(m.user_name)}</span>
                    <span className="text-sm flex-1 truncate">{m.user_name}</span>
                    {m.role === 'admin' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Admin</span>}
                    {isAdmin && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        {m.role === 'admin'
                          ? <button onClick={() => memberAction('demote', m.user_name)} className="text-[10px] text-[var(--faint)]">↓ Member</button>
                          : <button onClick={() => memberAction('promote', m.user_name)} className="text-[10px]" style={{ color: 'var(--teal)' }}>↑ Admin</button>}
                        <button onClick={() => memberAction('remove', m.user_name)} className="text-[var(--faint)] hover:text-[var(--accent)] text-sm">✕</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => memberAction('leave')} className="mt-3 text-xs text-[var(--faint)] hover:text-[var(--accent)]">Gruppe verlassen</button>
          </section>
        )}

        {/* Stundenplan (nur Admins) */}
        {current && isAdmin && (
          <section className="card p-4 anim-up" style={{ animationDelay: '120ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-3">Stundenplan ({classes.length})</div>
            <div className="space-y-2 mb-4">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_HEX[cls.color] ?? COLOR_HEX.red }} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cls.name}</div>
                      <div className="text-[11px] text-[var(--muted)] tnum">{DAY_NAMES[cls.day_of_week - 1]} · {cls.start_time}–{cls.end_time}</div>
                    </div>
                  </div>
                  <button onClick={() => delClass(cls.id)} className="text-[var(--faint)] hover:text-[var(--accent)] text-xs shrink-0">Löschen</button>
                </div>
              ))}
              {classes.length === 0 && <div className="text-[var(--faint)] text-sm">Noch keine Kurse — füge unten welche hinzu.</div>}
            </div>
            <div className="space-y-2.5 pt-1 border-t border-[var(--border-soft)]">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kursname (z.B. MMA)…"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] mt-3" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]">
                  {DAY_NAMES.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                </select>
                <div className="flex gap-1.5 items-center justify-center">
                  {COLORS.map((cl) => (
                    <button key={cl} onClick={() => setForm((f) => ({ ...f, color: cl }))} className="w-7 h-7 rounded-full active:scale-90"
                      style={{ background: COLOR_HEX[cl], outline: form.color === cl ? '2px solid #fff' : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
                <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
                <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <button onClick={addClass} disabled={busy || !form.name.trim()} className="w-full text-white font-bold py-2.5 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>+ Kurs hinzufügen</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
