'use client';
import PageHeader from '@/components/PageHeader';

import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';

interface ClassInfo { name: string; day_of_week: number; }
interface Competition {
  id: number;
  user_name: string;
  name: string;
  competition_date: string;
  location: string;
  weight_class: string;
  notes: string;
  user_classes: ClassInfo[];
}

const DAY_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function countClassSessions(dayOfWeek: number, today: Date, compDate: Date): number {
  // Count how many times this day-of-week occurs from tomorrow up to (not including) comp date
  const from = new Date(today);
  from.setDate(from.getDate() + 1);
  const to = new Date(compDate);
  to.setDate(to.getDate() - 1);
  if (from > to) return 0;
  const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (cur.getDay() === jsDay) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

interface GroupedClass { name: string; days: { day: number; count: number }[]; total: number; }

function groupClasses(classes: ClassInfo[], today: Date, compDate: Date): GroupedClass[] {
  const map = new Map<string, GroupedClass>();
  for (const cls of classes) {
    const count = countClassSessions(cls.day_of_week, today, compDate);
    if (count === 0) continue;
    if (!map.has(cls.name)) map.set(cls.name, { name: cls.name, days: [], total: 0 });
    const entry = map.get(cls.name)!;
    entry.days.push({ day: cls.day_of_week, count });
    entry.total += count;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function today() { return new Date().toISOString().slice(0, 10); }

export default function CompetitionsPage() {
  const { userName } = useUser();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', competitionDate: '', location: '', weightClass: '', notes: '',
  });

  useEffect(() => {
    fetch('/api/competitions')
      .then(r => r.json())
      .then(d => setCompetitions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form.name.trim() || !form.competitionDate) { setError('Name und Datum erforderlich'); return; }
    if (form.competitionDate <= today()) { setError('Datum muss in der Zukunft liegen'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      const comp = await res.json();
      // Re-fetch to get user_classes populated
      const all = await fetch('/api/competitions').then(r => r.json());
      setCompetitions(Array.isArray(all) ? all : []);
      setForm({ name: '', competitionDate: '', location: '', weightClass: '', notes: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Wettkampf löschen?')) return;
    await fetch(`/api/competitions/${id}`, { method: 'DELETE' });
    setCompetitions(prev => prev.filter(c => c.id !== id));
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = competitions.filter(c => new Date(c.competition_date.slice(0, 10) + 'T12:00') >= now);
  const past = competitions.filter(c => new Date(c.competition_date.slice(0, 10) + 'T12:00') < now);

  function CompCard({ c }: { c: Competition }) {
    const compDate = new Date(c.competition_date.slice(0, 10) + 'T12:00');
    const days = differenceInDays(compDate, now);
    const isPast = days < 0;
    const grouped = isPast ? [] : groupClasses(c.user_classes, now, compDate);
    const isOwn = c.user_name === userName;

    return (
      <div className={`bg-[#111] border rounded-2xl p-5 ${isPast ? 'border-[#1a1a1a] opacity-60' : 'border-[#222]'}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏆</span>
              <h3 className="font-bold text-base">{c.name}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="font-medium text-gray-400">{c.user_name}</span>
              {c.location && <span>📍 {c.location}</span>}
              {c.weight_class && <span>⚖️ {c.weight_class}</span>}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {format(compDate, 'EEEE, d. MMMM yyyy', { locale: de })}
            </div>
          </div>
          {isOwn && !isPast && (
            <button onClick={() => remove(c.id)} className="text-gray-700 hover:text-red-500 transition-colors text-xs px-2 py-1 rounded hover:bg-red-500/10 flex-shrink-0">✕</button>
          )}
        </div>

        {/* Countdown */}
        {!isPast && (
          <div className="flex items-center gap-4 mb-4 py-3 px-4 bg-[#1a1a1a] rounded-xl">
            <div className="text-center">
              <div className={`text-4xl font-bold leading-none ${days <= 14 ? 'text-red-500' : days <= 30 ? 'text-orange-400' : 'text-white'}`}>
                {days}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Tage noch</div>
            </div>
            <div className="flex-1 h-px bg-[#333]" />
            <div className="text-right text-xs text-gray-500">
              <div>{format(compDate, 'd. MMM', { locale: de })}</div>
              <div className="text-gray-700">{format(compDate, 'yyyy')}</div>
            </div>
          </div>
        )}

        {isPast && (
          <div className="text-xs text-gray-600 py-2">
            Stattgefunden am {format(compDate, 'd. MMMM yyyy', { locale: de })}
          </div>
        )}

        {/* Class countdown */}
        {grouped.length > 0 && (
          <div>
            <div className="text-[11px] text-gray-600 uppercase tracking-widest mb-2">Vorbereitungskurse bis dahin</div>
            <div className="flex flex-wrap gap-2">
              {grouped.map(g => (
                <div key={g.name} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
                  <span className={`text-lg font-bold leading-none ${g.total <= 3 ? 'text-red-500' : g.total <= 6 ? 'text-orange-400' : 'text-green-500'}`}>
                    {g.total}×
                  </span>
                  <div>
                    <div className="text-xs font-medium text-white leading-tight">{g.name}</div>
                    <div className="text-[10px] text-gray-600">
                      {g.days.map(d => `${DAY_SHORT[d.day]} (${d.count}×)`).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPast && grouped.length === 0 && c.user_classes.length === 0 && (
          <div className="text-xs text-gray-700 mt-2">
            {c.user_name === userName
              ? '→ Lege deinen Stundenplan fest um die verbleibenden Kurse zu sehen.'
              : `${c.user_name} hat noch keinen Plan hinterlegt.`}
          </div>
        )}

        {c.notes && (
          <div className="mt-3 text-xs text-gray-600 italic border-t border-[#1a1a1a] pt-3">
            &ldquo;{c.notes}&rdquo;
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PageHeader title="🏆 Wettkämpfe" action={
        <button onClick={() => setShowForm(f => !f)}
          className="w-11 h-11 grid place-items-center text-white rounded-xl transition-all font-bold text-xl active:scale-95"
          style={{ background: 'var(--accent)' }}>
          +
        </button>
      } />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Add form */}
        {showForm && (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <h2 className="font-semibold text-base mb-4">Meinen Wettkampf eintragen</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Wettkampf / Veranstaltung *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
                  placeholder="z.B. WAKO Kickboxen NRW Meisterschaft" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Datum *</label>
                  <input type="date" min={today()} value={form.competitionDate}
                    onChange={e => setForm(f => ({ ...f, competitionDate: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-red-600" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Gewichtsklasse</label>
                  <input value={form.weightClass} onChange={e => setForm(f => ({ ...f, weightClass: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
                    placeholder="z.B. -67 kg" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Ort</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
                  placeholder="z.B. Dortmund" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Notiz</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
                  placeholder="z.B. Erster Wettkampf, Punkte-Turnier..." />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {saving ? 'Speichern...' : 'Wettkampf eintragen'}
              </button>
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2.5 rounded-lg border border-[#333] text-gray-400 hover:text-white text-sm transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 py-16">Laden...</div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🥊</div>
            <div className="text-gray-500 text-sm">Noch keine Wettkämpfe eingetragen.</div>
            <button onClick={() => setShowForm(true)} className="mt-3 text-red-600 hover:underline text-sm">
              Ersten eintragen →
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-4">
                {upcoming.map(c => <CompCard key={c.id} c={c} />)}
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-600 uppercase tracking-widest mb-3">Vergangene Wettkämpfe</h3>
                <div className="space-y-3">
                  {[...past].reverse().map(c => <CompCard key={c.id} c={c} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
