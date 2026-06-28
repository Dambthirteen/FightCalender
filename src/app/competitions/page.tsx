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

function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function mapsUrl(address: string, provider: 'apple' | 'google'): string {
  const q = encodeURIComponent(address.trim());
  return provider === 'apple'
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function openMap(address: string, provider: 'apple' | 'google') {
  if (!address.trim()) return;
  window.open(mapsUrl(address, provider), '_blank', 'noopener,noreferrer');
}

export default function CompetitionsPage() {
  const { userName } = useUser();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mapsFor, setMapsFor] = useState<string | null>(null); // Adresse für die Karten-Auswahl (iOS)
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

  function resetForm() {
    setForm({ name: '', competitionDate: '', location: '', weightClass: '', notes: '' });
    setEditingId(null); setError('');
  }

  function startEdit(c: Competition) {
    setForm({
      name: c.name, competitionDate: c.competition_date.slice(0, 10),
      location: c.location ?? '', weightClass: c.weight_class ?? '', notes: c.notes ?? '',
    });
    setEditingId(c.id); setError(''); setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!form.name.trim() || !form.competitionDate) { setError('Name und Datum erforderlich'); return; }
    // Nur beim NEU-Eintragen muss das Datum in der Zukunft liegen; Bearbeiten geht jederzeit.
    if (!editingId && form.competitionDate <= today()) { setError('Datum muss in der Zukunft liegen'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(editingId ? `/api/competitions/${editingId}` : '/api/competitions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      // Re-fetch to get user_classes populated
      const all = await fetch('/api/competitions').then(r => r.json());
      setCompetitions(Array.isArray(all) ? all : []);
      resetForm();
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
      <div className={`card p-5 ${isPast ? 'opacity-60' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="font-display text-xl tracking-wide truncate">{c.name}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="chip">{c.user_name}</span>
              {c.location && (
                <button onClick={() => { if (isIOS()) setMapsFor(c.location); else openMap(c.location, 'google'); }}
                  className="chip active:scale-95" style={{ color: 'var(--teal)', borderColor: 'var(--teal)' }}>
                  📍 {c.location}
                </button>
              )}
              {c.weight_class && <span className="chip">{c.weight_class}</span>}
            </div>
            <div className="text-xs text-[var(--faint)] mt-2">
              {format(compDate, 'EEEE, d. MMMM yyyy', { locale: de })}
            </div>
          </div>
          {isOwn && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(c)} className="text-[var(--faint)] hover:text-white transition-colors text-xs px-1">Bearbeiten</button>
              <button onClick={() => remove(c.id)} className="text-[var(--faint)] hover:text-[var(--accent)] transition-colors text-sm px-1">✕</button>
            </div>
          )}
        </div>

        {/* Countdown */}
        {!isPast && (
          <div className="flex items-center gap-4 mb-4 py-3 px-4 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="text-center">
              <div className="font-display text-4xl leading-none tnum"
                style={{ color: days <= 14 ? 'var(--accent)' : days <= 30 ? 'var(--accent-2)' : 'var(--text)' }}>
                {days}
              </div>
              <div className="text-[11px] text-[var(--faint)] mt-1">Tage noch</div>
            </div>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <div className="text-right text-xs text-[var(--muted)] tnum">
              <div>{format(compDate, 'd. MMM', { locale: de })}</div>
              <div className="text-[var(--faint)]">{format(compDate, 'yyyy')}</div>
            </div>
          </div>
        )}

        {isPast && (
          <div className="text-xs text-[var(--faint)] py-2">
            Stattgefunden am {format(compDate, 'd. MMMM yyyy', { locale: de })}
          </div>
        )}

        {/* Class countdown */}
        {grouped.length > 0 && (
          <div>
            <div className="section-label mb-2">Vorbereitungskurse bis dahin</div>
            <div className="flex flex-wrap gap-2">
              {grouped.map(g => (
                <div key={g.name} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                  <span className="font-display text-lg leading-none tnum"
                    style={{ color: g.total <= 3 ? 'var(--accent)' : g.total <= 6 ? 'var(--accent-2)' : 'var(--good)' }}>
                    {g.total}×
                  </span>
                  <div>
                    <div className="text-xs font-medium leading-tight">{g.name}</div>
                    <div className="text-[10px] text-[var(--faint)]">
                      {g.days.map(d => `${DAY_SHORT[d.day]} (${d.count}×)`).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPast && grouped.length === 0 && c.user_classes.length === 0 && (
          <div className="text-xs text-[var(--faint)] mt-2">
            {c.user_name === userName
              ? '→ Lege deinen Stundenplan fest um die verbleibenden Kurse zu sehen.'
              : `${c.user_name} hat noch keinen Plan hinterlegt.`}
          </div>
        )}

        {c.notes && (
          <div className="mt-3 text-xs text-[var(--muted)] italic border-t border-[var(--border-soft)] pt-3">
            &ldquo;{c.notes}&rdquo;
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🏆 Wettkämpfe" action={
        <button onClick={() => { setShowForm((f) => !f); resetForm(); }}
          className="w-11 h-11 grid place-items-center text-white rounded-xl transition-all font-bold text-xl active:scale-95"
          style={{ background: 'var(--accent)' }}>
          +
        </button>
      } />

      <main className="max-w-md mx-auto px-4 pb-24 space-y-6">
        {/* Add form */}
        {showForm && (
          <div className="card p-5 anim-up">
            <h2 className="font-display text-xl tracking-wide mb-4">{editingId ? 'Wettkampf bearbeiten' : 'Meinen Wettkampf eintragen'}</h2>
            <div className="space-y-3">
              <div>
                <label className="section-label mb-1.5 block">Wettkampf / Veranstaltung *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="field" placeholder="z.B. WAKO Kickboxen NRW Meisterschaft" />
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <label className="section-label mb-1.5 block">Datum *</label>
                  <input type="date" min={editingId ? undefined : today()} value={form.competitionDate}
                    onChange={e => setForm(f => ({ ...f, competitionDate: e.target.value }))} className="field" />
                </div>
                <div className="w-28 shrink-0">
                  <label className="section-label mb-1.5 block">Gewicht</label>
                  <input value={form.weightClass} onChange={e => setForm(f => ({ ...f, weightClass: e.target.value }))}
                    className="field" placeholder="-67 kg" />
                </div>
              </div>
              <div>
                <label className="section-label mb-1.5 block">Adresse</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="field" placeholder="Straße, PLZ Ort" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">Notiz</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="field" placeholder="z.B. Erster Wettkampf, Punkte-Turnier…" />
              </div>
            </div>
            {error && <p className="text-[var(--accent)] text-xs mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Speichern…' : editingId ? 'Speichern' : 'Wettkampf eintragen'}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="btn btn-ghost">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-[var(--faint)] py-16">Lädt…</div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <div className="card p-10 text-center anim-up">
            <div className="text-5xl mb-3">🥊</div>
            <div className="text-[var(--muted)] text-sm">Noch keine Wettkämpfe eingetragen.</div>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-3 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
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
                <h3 className="section-label mb-3">Vergangene Wettkämpfe</h3>
                <div className="space-y-3">
                  {[...past].reverse().map(c => <CompCard key={c.id} c={c} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Karten-Auswahl (iOS) */}
      {mapsFor && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setMapsFor(null); }}>
          <div className="card w-full max-w-sm p-4 anim-up">
            <div className="section-label mb-3 px-1">In Karten öffnen</div>
            <div className="space-y-2">
              <button onClick={() => { openMap(mapsFor, 'apple'); setMapsFor(null); }} className="btn btn-ghost w-full">Apple Maps</button>
              <button onClick={() => { openMap(mapsFor, 'google'); setMapsFor(null); }} className="btn btn-ghost w-full">Google Maps</button>
              <button onClick={() => setMapsFor(null)} className="btn w-full text-[var(--muted)]">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
