'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import type { GymClass } from '@/lib/db';

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const COLORS = ['red', 'blue', 'green', 'orange', 'purple'];
const COLOR_HEX: Record<string, string> = {
  red: '#ff3b30', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', purple: '#a855f7',
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [classes, setClasses] = useState<GymClass[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  interface UserRow { user_name: string; created_at: string | null; has_account: boolean; attend_count: number; skip_count: number; schedule_count: number; is_supporter: boolean; }
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    dayOfWeek: 1,
    startTime: '18:00',
    endTime: '19:30',
    color: 'red',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Push-Test
  const [pushTarget, setPushTarget] = useState('');
  const [pushBusy, setPushBusy] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState('');
  const [pushOk, setPushOk] = useState(false);

  async function login() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        sessionStorage.setItem('fightcal_admin_pw', password);
      } else {
        setAuthError('Falsches Passwort.');
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadClasses() {
    setDataLoading(true);
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem('fightcal_admin_pw');
    if (stored) {
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: stored }),
      }).then(r => {
        if (r.ok) { setPassword(stored); setAuthenticated(true); }
      });
    }
  }, []);

  useEffect(() => {
    if (authenticated) { loadClasses(); loadUsers(); }
  }, [authenticated]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-admin-password': password } });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setUsersLoading(false);
    }
  }

  // Supporter-Status pro Nutzer vergeben/entziehen (optimistisch, mit Rollback).
  async function toggleSupporter(userName: string, next: boolean) {
    setUsers(prev => prev.map(u => u.user_name === userName ? { ...u, is_supporter: next } : u));
    try {
      const res = await fetch('/api/admin/entitlements', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ userName, action: next ? 'grant' : 'revoke' }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUsers(prev => prev.map(u => u.user_name === userName ? { ...u, is_supporter: !next } : u));
    }
  }

  async function deleteUser(userName: string) {
    if (!confirm(`Nutzer "${userName}" wirklich löschen? ALLE Daten (Anwesenheiten, Ausreden, Votes, Wettkämpfe, Gruppen-Mitgliedschaft …) werden unwiderruflich entfernt.`)) return;
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: password, userName }),
    });
    setUsers(prev => prev.filter(u => u.user_name !== userName));
  }

  async function addClass() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, adminPassword: password }),
      });
      if (res.ok) {
        const newClass = await res.json();
        setClasses(prev => [...prev, newClass].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
        setForm({ name: '', dayOfWeek: 1, startTime: '18:00', endTime: '19:30', color: 'red' });
      } else {
        const err = await res.json();
        setSaveError(err.error ?? 'Fehler beim Speichern');
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(id: number) {
    if (!confirm('Kurs wirklich löschen?')) return;
    const res = await fetch(`/api/classes/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: password }),
    });
    if (res.ok) {
      setClasses(prev => prev.filter(c => c.id !== id));
    }
  }

  async function initDb() {
    const res = await fetch('/api/setup', { method: 'POST', headers: { 'x-admin-password': password } });
    const data = await res.json();
    alert(data.message ?? data.error);
  }

  async function seedSchedule() {
    if (!confirm('Aktuellen Stundenplan löschen und NFT Köln Stundenplan laden?')) return;
    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: password }),
    });
    const data = await res.json();
    if (data.ok) {
      alert(`${data.inserted} Kurse geladen!`);
      loadClasses();
    } else {
      alert(data.error);
    }
  }

  async function testPush(kind: string) {
    setPushBusy(kind);
    setPushStatus('');
    try {
      const res = await fetch('/api/admin/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ kind, target: pushTarget.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setPushOk(true);
        setPushStatus(`✓ Gesendet an ${data.recipient} (${data.sent} Gerät${data.sent === 1 ? '' : 'e'})`);
      } else {
        setPushOk(false);
        setPushStatus(`✗ ${data.error ?? 'Fehler'}`);
      }
    } catch {
      setPushOk(false);
      setPushStatus('✗ Netzwerkfehler');
    } finally {
      setPushBusy(null);
    }
  }

  const PUSH_TYPES: { kind: string; label: string }[] = [
    { kind: 'class_reminder', label: '🥊 Kurs-Erinnerung' },
    { kind: 'court_open', label: '🗳️ Gericht offen' },
    { kind: 'court_result', label: '⚖️ Gericht-Ergebnis' },
    { kind: 'bitch_reminder', label: '🐔 Nicht eingetragen' },
    { kind: 'comment', label: '💬 Kommentar' },
    { kind: 'challenge', label: '⚔️ Skilltree angefochten' },
    { kind: 'challenge_result', label: '⚖️ Anfechtung-Ergebnis' },
    { kind: 'praise', label: '⭐ Lob / Gigalob' },
    { kind: 'badge', label: '🏅 Abzeichen' },
    { kind: 'skilltree', label: '🌳 Skilltree-Update (Gruppe)' },
    { kind: 'praise_feed', label: '👏 Lob erhalten (Gruppe)' },
    { kind: 'competition', label: '🥊 Wettkampf heute (Gruppe)' },
    { kind: 'bitch', label: '🐔 Geschwänzt (Gruppe)' },
    { kind: 'badge_feed', label: '🏅 Trophäe (Gruppe)' },
  ];

  const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';
  const labelCls = 'text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5 block';

  // --- LOGIN GATE ---
  if (!authenticated) {
    return (
      <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
        <div className="card p-7 w-full max-w-sm shadow-2xl shadow-black/40 anim-up">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="font-display text-3xl tracking-wide mb-1">Admin-Bereich</h2>
          <p className="text-[var(--muted)] text-sm mb-6">Nur für den Gym-Admin.</p>
          <input
            type="password"
            className={`${inputCls} mb-2`}
            placeholder="Passwort…"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            autoFocus
          />
          {authError && <p className="text-[var(--accent)] text-xs mb-3">{authError}</p>}
          <button
            onClick={login}
            disabled={authLoading || !password}
            className="w-full text-white font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {authLoading ? 'Prüfe…' : 'Einloggen'}
          </button>
          <a href="/" className="block text-center text-xs text-[var(--faint)] hover:text-white mt-4 transition-colors">← Zurück</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="⚙️ Admin" />

      <main className="max-w-md mx-auto px-4 pb-16 space-y-6">
        {/* Tools */}
        <div className="flex gap-2 anim-up">
          <button onClick={seedSchedule}
            className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-colors"
            style={{ background: 'var(--accent-soft)', borderColor: 'rgba(255,59,48,0.3)', color: 'var(--accent)' }}>
            📋 NFT-Stundenplan laden
          </button>
          <button onClick={initDb}
            className="text-xs font-medium px-3 py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors">
            DB Init
          </button>
        </div>

        {/* Push-Benachrichtigungen testen */}
        <section className="card p-5 anim-up" style={{ animationDelay: '20ms' }}>
          <h2 className="font-display text-xl tracking-wide mb-1">Push testen</h2>
          <p className="text-[var(--muted)] text-xs mb-4">
            Schickt eine Beispiel-Push an dich selbst (oder an einen Namen). Auf dem Zielgerät müssen
            Benachrichtigungen aktiviert sein.
          </p>
          <div className="mb-3">
            <label className={labelCls}>Empfänger (leer = ich)</label>
            <input
              className={inputCls}
              placeholder="Nutzername…"
              value={pushTarget}
              onChange={e => setPushTarget(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PUSH_TYPES.map(t => (
              <button
                key={t.kind}
                onClick={() => testPush(t.kind)}
                disabled={!!pushBusy}
                className="text-xs font-semibold px-3 py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--accent)] transition-colors text-left disabled:opacity-40"
              >
                {pushBusy === t.kind ? 'Senden…' : t.label}
              </button>
            ))}
          </div>
          {pushStatus && (
            <p className="text-xs mt-3" style={{ color: pushOk ? 'var(--good)' : 'var(--accent)' }}>{pushStatus}</p>
          )}
        </section>

        {/* Add Class Form */}
        <section className="card p-5 anim-up" style={{ animationDelay: '40ms' }}>
          <h2 className="font-display text-xl tracking-wide mb-4">Kurs hinzufügen</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Kursname</label>
              <input
                className={inputCls}
                placeholder="z.B. BJJ, Kickboxen, MMA…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Wochentag</label>
              <select
                className={inputCls}
                value={form.dayOfWeek}
                onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}
              >
                {DAY_NAMES.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Farbe</label>
              <div className="flex gap-2.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-transform active:scale-90"
                    style={{ background: COLOR_HEX[c], outline: form.color === c ? '2px solid #fff' : 'none', outlineOffset: '2px' }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Von</label>
                <input type="time" className={inputCls} value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Bis</label>
                <input type="time" className={inputCls} value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
          </div>
          {saveError && <p className="text-[var(--accent)] text-xs mt-3">{saveError}</p>}
          <button
            onClick={addClass}
            disabled={saving || !form.name.trim()}
            className="mt-5 w-full text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Speichern…' : '+ Kurs hinzufügen'}
          </button>
        </section>

        {/* Class List */}
        <section className="anim-up" style={{ animationDelay: '80ms' }}>
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)] mb-3">Alle Kurse ({classes.length})</h2>
          {dataLoading ? (
            <div className="text-[var(--faint)] text-sm py-8 text-center">Laden…</div>
          ) : classes.length === 0 ? (
            <div className="text-[var(--faint)] text-sm py-8 text-center">Noch keine Kurse.</div>
          ) : (
            <div className="space-y-2">
              {classes.map(cls => (
                <div key={cls.id} className="card px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLOR_HEX[cls.color] ?? COLOR_HEX.red }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{cls.name}</div>
                      <div className="text-xs text-[var(--muted)] tnum">{DAY_NAMES[cls.day_of_week - 1]} · {cls.start_time} – {cls.end_time}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteClass(cls.id)}
                    className="text-[var(--faint)] hover:text-[var(--accent)] transition-colors text-xs px-2 py-1 rounded shrink-0">
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Users */}
        <section className="anim-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">Nutzer ({users.length})</h2>
            <button onClick={loadUsers} className="text-xs text-[var(--faint)] hover:text-white px-2 py-1 rounded-lg border border-[var(--border)] transition-colors">
              ↻
            </button>
          </div>
          {usersLoading ? (
            <div className="text-[var(--faint)] text-sm py-8 text-center">Laden…</div>
          ) : users.length === 0 ? (
            <div className="text-[var(--faint)] text-sm py-8 text-center">Noch keine Nutzer.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.user_name} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-2">
                      {u.user_name}
                      {!u.has_account && (
                        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                          title="Datenreste ohne Login — z.B. nach einer früheren Löschung">
                          verwaist
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--faint)] tnum">
                      {u.created_at
                        ? `${new Date(u.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })} · `
                        : 'Kein Login · '}
                      {u.schedule_count} Kurse
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tnum">
                    <span className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>💪 {u.attend_count}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--bitch)' }}>🐔 {u.skip_count}</span>
                    <button onClick={() => toggleSupporter(u.user_name, !u.is_supporter)}
                      title={u.is_supporter ? 'Supporter entziehen' : 'Supporter geben'}
                      className="text-sm px-1 transition-opacity" style={{ opacity: u.is_supporter ? 1 : 0.3 }}>
                      ⭐
                    </button>
                    <button onClick={() => deleteUser(u.user_name)}
                      className="text-[var(--faint)] hover:text-[var(--accent)] transition-colors text-sm px-1">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
