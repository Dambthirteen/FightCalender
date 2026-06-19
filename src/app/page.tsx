'use client';

import { useEffect, useState, useCallback } from 'react';
import { startOfWeek, addWeeks, subWeeks, format, addDays, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';
import { getNRWHolidays } from '@/lib/holidays';
import type { GymClass, AttendanceRecord } from '@/lib/db';

// Kursfarbe → Hex (für Dots, Badges, Ränder)
const COLOR_HEX: Record<string, string> = {
  red: '#ff3b30', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', purple: '#a855f7',
};
const hex = (c: string) => COLOR_HEX[c] ?? COLOR_HEX.red;

const DAY_NAMES_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY_NAMES_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getWeekStart(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}
function isVotingWindow() {
  const now = new Date();
  return now.getDate() >= getDaysInMonth(now) - 2;
}

type Step = 'loading' | 'schedule' | 'done';

export default function Home() {
  const { userName, loading: userLoading } = useUser();

  const [step, setStep] = useState<Step>('loading');
  const [allClasses, setAllClasses] = useState<GymClass[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [skipping, setSkipping] = useState<{ id: number; date: string; user_name: string; excuse: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  const [excuseDate, setExcuseDate] = useState<string | null>(null);
  const [excuseText, setExcuseText] = useState('');
  const [submittingExcuse, setSubmittingExcuse] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const weekStart = getWeekStart(currentWeek);

  const fetchCalendarData = useCallback(async (week: string) => {
    setLoading(true);
    try {
      const [classRes, attRes, skipRes] = await Promise.all([
        fetch('/api/classes'),
        fetch(`/api/attendance?week=${week}`),
        fetch(`/api/skip?week=${week}`),
      ]);
      const [classData, attData, skipData] = await Promise.all([
        classRes.json(), attRes.json(), skipRes.json(),
      ]);
      setClasses(Array.isArray(classData) ? classData : []);
      setAttendance(Array.isArray(attData) ? attData : []);
      setSkipping(Array.isArray(skipData) ? skipData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!userName) { window.location.href = '/login'; return; }

    async function init() {
      const [classRes, profileRes] = await Promise.all([
        fetch('/api/classes'),
        fetch(`/api/profile?user=${encodeURIComponent(userName)}`),
      ]);
      const [classData, profileData] = await Promise.all([classRes.json(), profileRes.json()]);
      setAllClasses(Array.isArray(classData) ? classData : []);
      if (Array.isArray(profileData) && profileData.length > 0) {
        setSelectedIds(new Set(profileData));
        setStep('done');
      } else {
        setStep('schedule');
      }
    }
    init();
  }, [userName, userLoading]);

  useEffect(() => {
    if (step === 'done' && userName) fetchCalendarData(weekStart);
  }, [weekStart, step, userName, fetchCalendarData]);

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, classIds: Array.from(selectedIds) }),
      });
      setStep('done');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function toggleAttendance(classId: number) {
    setToggling(classId);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, weekStart, userName }),
      });
      const data = await res.json();
      if (data.attending) {
        setAttendance(prev => [...prev, { id: Date.now(), class_id: classId, week_start: weekStart, user_name: userName }]);
      } else {
        setAttendance(prev => prev.filter(a => !(a.class_id === classId && a.user_name === userName)));
      }
    } finally {
      setToggling(null);
    }
  }

  function openExcuseModal(dateStr: string) {
    const already = skipping.some(s => s.date === dateStr && s.user_name === userName);
    if (already) { submitSkip(dateStr, ''); return; }
    setExcuseDate(dateStr); setExcuseText('');
  }

  async function submitSkip(dateStr: string, excuse: string) {
    setSubmittingExcuse(true);
    try {
      const res = await fetch('/api/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, userName, excuse }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.skipping) {
        setSkipping(prev => [...prev, { id: Date.now(), date: dateStr, user_name: userName, excuse }]);
      } else {
        setSkipping(prev => prev.filter(s => !(s.date === dateStr && s.user_name === userName)));
      }
      setExcuseDate(null);
    } finally {
      setSubmittingExcuse(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // --- LOADING ---
  if (userLoading || step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--faint)] text-sm anim-in">
        <span className="font-display text-2xl tracking-widest text-[var(--muted)]">LADEN…</span>
      </div>
    );
  }

  // --- SCHEDULE STEP ---
  if (step === 'schedule') {
    const byDay: Record<number, GymClass[]> = {};
    for (let d = 1; d <= 7; d++) byDay[d] = allClasses.filter(c => c.day_of_week === d);
    return (
      <div className="min-h-screen text-[var(--text)]">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="mb-7 anim-up">
            <div className="text-3xl mb-2">📋</div>
            <h2 className="font-display text-3xl tracking-wide mb-1">Dein Stundenplan</h2>
            <p className="text-[var(--muted)] text-sm">Welche Kurse besuchst du normalerweise? Nur diese zählen für die Wertung.</p>
          </div>
          {allClasses.length === 0 ? (
            <div className="text-[var(--faint)] text-sm py-8 text-center">Noch keine Kurse. <a href="/admin" className="text-[var(--accent)] hover:underline">Admin →</a></div>
          ) : (
            <div className="space-y-5 mb-8">
              {[1, 2, 3, 4, 5, 6, 7].map((day, di) => {
                const dayCls = byDay[day] ?? [];
                if (!dayCls.length) return null;
                return (
                  <div key={day} className="anim-up" style={{ animationDelay: `${di * 50}ms` }}>
                    <div className="text-[11px] text-[var(--faint)] uppercase tracking-[0.2em] font-semibold mb-2">{DAY_NAMES_FULL[day - 1]}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {dayCls.map(cls => {
                        const checked = selectedIds.has(cls.id);
                        const c = hex(cls.color);
                        return (
                          <button key={cls.id} onClick={() => setSelectedIds(prev => { const n = new Set(prev); checked ? n.delete(cls.id) : n.add(cls.id); return n; })}
                            className="text-left rounded-xl border p-3.5 transition-all active:scale-[0.99]"
                            style={{
                              borderColor: checked ? c : 'var(--border-soft)',
                              background: checked ? `${c}1a` : 'var(--surface)',
                              boxShadow: checked ? `inset 0 0 0 1px ${c}55` : 'none',
                            }}>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                              <span className="text-sm font-semibold">{cls.name}</span>
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-1 ml-5 tnum">{cls.start_time} – {cls.end_time}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-3 anim-up" style={{ animationDelay: '120ms' }}>
            <button onClick={saveSchedule} disabled={savingSchedule}
              className="flex-1 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {savingSchedule ? 'Speichern…' : `${selectedIds.size} Kurse speichern`}
            </button>
            <button onClick={() => { fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName, classIds: [] }) }); setStep('done'); }}
              className="px-4 py-3.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white text-sm transition-colors">
              Überspringen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN CALENDAR ---
  const weekMonday = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const classesByDay: Record<number, GymClass[]> = {};
  for (let d = 1; d <= 7; d++) classesByDay[d] = classes.filter(c => c.day_of_week === d);

  const weekYear = weekMonday.getFullYear();
  const allHolidays = getNRWHolidays(weekYear);
  if (addDays(weekMonday, 6).getFullYear() !== weekYear)
    allHolidays.push(...getNRWHolidays(weekYear + 1));
  const holidayMap = new Map(allHolidays.map(h => [h.date, h.name]));

  const activeDays = [1, 2, 3, 4, 5, 6, 7].filter(day => (classesByDay[day] ?? []).length > 0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="min-h-screen text-[var(--text)]">
      {/* Excuse Modal */}
      {excuseDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4 anim-in">
          <div className="card anim-pop p-6 w-full max-w-sm shadow-2xl">
            <div className="text-2xl mb-1">🐔</div>
            <h2 className="font-display text-2xl tracking-wide mb-1">Begründung</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Warum kommst du am <span className="text-white">{DAY_NAMES_FULL[new Date(excuseDate + 'T12:00').getDay() === 0 ? 6 : new Date(excuseDate + 'T12:00').getDay() - 1]}</span> nicht?
            </p>
            <textarea
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--bitch)] resize-none mb-4"
              placeholder="Deine Ausrede…"
              rows={3}
              value={excuseText}
              onChange={e => setExcuseText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setExcuseDate(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white text-sm transition-colors">Abbrechen</button>
              <button onClick={() => submitSkip(excuseDate, excuseText)} disabled={!excuseText.trim() || submittingExcuse}
                className="flex-1 text-black font-bold py-2.5 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40 text-sm"
                style={{ background: 'var(--bitch)' }}>
                {submittingExcuse ? '…' : 'Einreichen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between max-w-md mx-auto anim-in">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="Fight Calendar" className="w-11 h-11 rounded-[13px] ring-1 ring-white/10 shadow-lg shadow-black/40" />
          <div>
            <h1 className="font-display text-2xl leading-none tracking-wide">Fight Calendar</h1>
            <p className="text-[var(--muted)] text-[11px] mt-1 uppercase tracking-[0.18em]">Wer kommt diese Woche?</p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect y="2" width="18" height="2" rx="1" fill="currentColor" />
              <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
              <rect y="14" width="18" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && (
            <div className="fixed inset-0 z-50 anim-in" onClick={() => setMenuOpen(false)}>
              <div onClick={(e) => e.stopPropagation()}
                className="absolute right-4 w-[260px] max-h-[78vh] overflow-y-auto card anim-pop shadow-2xl shadow-black/60"
                style={{ top: 'calc(env(safe-area-inset-top) + 4.75rem)' }}>
                <div className="px-4 py-3 border-b border-[var(--border-soft)]">
                  <div className="text-[10px] text-[var(--faint)] uppercase tracking-[0.18em]">Eingeloggt als</div>
                  <div className="font-display text-lg tracking-wide">{userName}</div>
                </div>
                <button onClick={() => { setMenuOpen(false); setStep('schedule'); fetch('/api/classes').then(r => r.json()).then(d => setAllClasses(d)); fetch(`/api/profile?user=${encodeURIComponent(userName)}`).then(r => r.json()).then(d => setSelectedIds(new Set(d))); }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors">
                  <span>📋</span> Meinen Plan ändern
                </button>
                <div className="border-t border-[var(--border-soft)]" />
                <a href="/account" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors"><span>🏥</span> Mein Status</a>
                <a href="/competitions" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors"><span>🏆</span> Wettkämpfe</a>
                <div className="border-t border-[var(--border-soft)]" />
                <a href="/year" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors"><span>📊</span> Jahresauswertung</a>
                <a href="/macher" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors"><span>💪</span> Macher des Monats</a>
                <a href="/bitch" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--text)] hover:bg-white/5 transition-colors"><span>🐔</span> Bitch des Monats</a>
                <a href="/vote" className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5"
                  style={{ color: isVotingWindow() ? 'var(--bitch)' : 'var(--text)' }}>
                  <span>🗳️</span> Ausreden-Gericht {isVotingWindow() && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.16)', color: 'var(--bitch)' }}>offen</span>}
                </a>
                <div className="border-t border-[var(--border-soft)]" />
                <a href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--faint)] hover:bg-white/5 hover:text-white transition-colors"><span>⚙️</span> Admin</a>
                <button onClick={logout} className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-[var(--faint)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors border-t border-[var(--border-soft)]">
                  <span>🚪</span> Ausloggen
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Week Navigation */}
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between anim-in">
        <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="w-10 h-10 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{format(weekMonday, 'd. MMM', { locale: de })} – {format(addDays(weekMonday, 6), 'd. MMM', { locale: de })}</div>
          <div className="text-[11px] text-[var(--faint)] uppercase tracking-[0.16em]">KW {format(weekMonday, 'w')} · {format(weekMonday, 'yyyy')}</div>
        </div>
        <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="w-10 h-10 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">→</button>
      </div>

      {/* Day list (iPhone-first vertical) */}
      <main className="max-w-md mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[var(--faint)] text-sm">Laden…</div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--faint)] gap-2">
            <div className="text-4xl">📋</div>
            <div className="text-sm">Noch keine Kurse eingetragen.</div>
            <a href="/admin" className="text-[var(--accent)] text-sm hover:underline mt-1">Kurse hinzufügen →</a>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDays.map((day, idx) => {
              const dayClasses = classesByDay[day] ?? [];
              const dayDate = addDays(weekMonday, day - 1);
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isToday = dateStr === todayStr;
              const daySkippers = skipping.filter(s => s.date === dateStr);
              const iSkipping = daySkippers.some(s => s.user_name === userName);
              const holiday = holidayMap.get(dateStr) ?? null;
              return (
                <section key={day} className="card overflow-hidden anim-up" style={{ animationDelay: `${idx * 55}ms` }}>
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b"
                    style={{
                      borderColor: 'var(--border-soft)',
                      background: holiday ? 'rgba(168,85,247,0.12)' : isToday ? 'var(--accent-soft)' : 'transparent',
                    }}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-xl tracking-wide" style={{ color: holiday ? '#c084fc' : isToday ? 'var(--accent)' : 'var(--text)' }}>
                        {DAY_NAMES_FULL[day - 1]}
                      </span>
                      {isToday && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>Heute</span>}
                    </div>
                    <span className="text-xs text-[var(--faint)] tnum">{format(dayDate, 'd.M.')}</span>
                  </div>

                  {holiday && (
                    <div className="px-4 py-1.5 text-[11px] text-center" style={{ background: 'rgba(168,85,247,0.08)', color: '#c084fc' }}>
                      🎄 {holiday}
                    </div>
                  )}

                  {/* Classes */}
                  <div className="p-3 flex flex-col gap-2">
                    {dayClasses.map(cls => {
                      const classAttendance = attendance.filter(a => a.class_id === cls.id);
                      const isAttending = classAttendance.some(a => a.user_name === userName);
                      const isLoading = toggling === cls.id;
                      const c = hex(cls.color);
                      return (
                        <button key={cls.id} onClick={() => toggleAttendance(cls.id)} disabled={isLoading}
                          className={`w-full text-left rounded-xl border p-3 transition-all active:scale-[0.99] ${isLoading ? 'opacity-60' : ''}`}
                          style={{
                            borderColor: isAttending ? c : 'var(--border-soft)',
                            background: isAttending ? `${c}14` : 'var(--surface-2)',
                            boxShadow: isAttending ? `inset 0 0 0 1px ${c}55` : 'none',
                          }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                              <span className="text-sm font-bold truncate">{cls.name}</span>
                            </div>
                            <span className="text-[11px] text-[var(--muted)] tnum shrink-0">{cls.start_time}–{cls.end_time}</span>
                          </div>
                          {classAttendance.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {classAttendance.map(a => {
                                const mine = a.user_name === userName;
                                return (
                                  <span key={a.user_name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                                    style={{ background: mine ? c : 'rgba(255,255,255,0.09)', color: mine ? '#fff' : 'var(--muted)' }}>
                                    {a.user_name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bitch row */}
                  <div className="px-3 pb-3">
                    <button onClick={() => openExcuseModal(dateStr)}
                      className="w-full text-[11px] font-semibold py-2 px-3 rounded-xl border transition-all active:scale-[0.99]"
                      style={{
                        background: iSkipping ? 'rgba(245,197,24,0.14)' : 'var(--surface-2)',
                        borderColor: iSkipping ? 'rgba(245,197,24,0.4)' : 'var(--border-soft)',
                        color: iSkipping ? 'var(--bitch)' : 'var(--faint)',
                      }}>
                      🐔 Ich bin eine Bitch
                    </button>
                    {daySkippers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {daySkippers.map(s => (
                          <span key={s.user_name} title={s.excuse} className="text-[10px] px-2 py-0.5 rounded-full cursor-help"
                            style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--bitch)', border: '1px solid rgba(245,197,24,0.22)' }}>
                            {s.user_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
            <p className="text-center text-[11px] text-[var(--faint)] pt-2">Tippe auf einen Kurs, um dich ein- oder auszutragen.</p>
          </div>
        )}
      </main>
    </div>
  );
}
