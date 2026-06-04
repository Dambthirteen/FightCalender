'use client';

import { useEffect, useState } from 'react';
import type { GymClass } from '@/lib/db';

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const COLORS = ['red', 'blue', 'green', 'orange', 'purple'];
const COLOR_PREVIEWS: Record<string, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [classes, setClasses] = useState<GymClass[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    dayOfWeek: 1,
    startTime: '18:00',
    endTime: '19:30',
    color: 'red',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    if (authenticated) loadClasses();
  }, [authenticated]);

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
    const res = await fetch('/api/setup', { method: 'POST' });
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

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-3xl mb-1">🔒</div>
          <h2 className="text-xl font-bold mb-1">Admin-Bereich</h2>
          <p className="text-gray-400 text-sm mb-6">Nur für den Gym-Admin.</p>
          <input
            type="password"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 mb-2"
            placeholder="Passwort..."
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            autoFocus
          />
          {authError && <p className="text-red-500 text-xs mb-3">{authError}</p>}
          <button
            onClick={login}
            disabled={authLoading || !password}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {authLoading ? 'Prüfe...' : 'Einloggen'}
          </button>
          <a href="/" className="block text-center text-xs text-gray-600 hover:text-gray-400 mt-4 transition-colors">← Zurück</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <h1 className="font-bold text-lg">Admin</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={seedSchedule} className="text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-red-900/50 hover:border-red-600 bg-red-600/10 transition-colors">
            📋 NFT Stundenplan laden
          </button>
          <button onClick={initDb} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg border border-[#222] hover:border-[#333] transition-colors">
            DB Init
          </button>
          <a href="/" className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg border border-[#222] hover:border-[#333] transition-colors">
            ← Kalender
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Add Class Form */}
        <section className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6">
          <h2 className="font-semibold text-base mb-5">Kurs hinzufügen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1.5 block">Kursname</label>
              <input
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-600"
                placeholder="z.B. BJJ, Kickboxen, MMA..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Wochentag</label>
              <select
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-600"
                value={form.dayOfWeek}
                onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}
              >
                {DAY_NAMES.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Farbe</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full ${COLOR_PREVIEWS[c]} transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Von</label>
              <input
                type="time"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-600"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Bis</label>
              <input
                type="time"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-600"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          {saveError && <p className="text-red-500 text-xs mt-3">{saveError}</p>}
          <button
            onClick={addClass}
            disabled={saving || !form.name.trim()}
            className="mt-5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Speichern...' : '+ Kurs hinzufügen'}
          </button>
        </section>

        {/* Class List */}
        <section>
          <h2 className="font-semibold text-base mb-4">Alle Kurse ({classes.length})</h2>
          {dataLoading ? (
            <div className="text-gray-600 text-sm py-8 text-center">Laden...</div>
          ) : classes.length === 0 ? (
            <div className="text-gray-600 text-sm py-8 text-center">Noch keine Kurse.</div>
          ) : (
            <div className="space-y-2">
              {classes.map(cls => (
                <div key={cls.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_PREVIEWS[cls.color] ?? 'bg-red-600'}`} />
                    <div>
                      <div className="font-medium text-sm">{cls.name}</div>
                      <div className="text-xs text-gray-500">{DAY_NAMES[cls.day_of_week - 1]} · {cls.start_time} – {cls.end_time}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteClass(cls.id)}
                    className="text-gray-600 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded hover:bg-red-500/10"
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
