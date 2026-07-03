'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { startOfWeek, addWeeks, subWeeks, format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';
import { getHolidays } from '@/lib/holidays';
import { track } from '@/lib/analytics';
import { CUTOVER } from '@/lib/bitch-scoring';
import { colorFor } from '@/lib/avatar';
import LoadingScreen from '@/components/LoadingScreen';
import type { GymClass, AttendanceRecord } from '@/lib/db';

// Kursfarbe → Hex (für Dots, Badges, Ränder)
const COLOR_HEX: Record<string, string> = {
  red: '#ff3b30', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', purple: '#a855f7',
};
const hex = (c: string) => COLOR_HEX[c] ?? COLOR_HEX.red;
const hhmmToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const DAY_NAMES_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getWeekStart(date: Date) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
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
  const [streakPoints, setStreakPoints] = useState(0);
  const [bundesland, setBundesland] = useState('NW');
  const [showWeekPlan, setShowWeekPlan] = useState(false);
  const [weekPlan, setWeekPlan] = useState<Set<number>>(new Set());
  const [weekPlanOverride, setWeekPlanOverride] = useState(false);
  const [useStreakPt, setUseStreakPt] = useState(false);
  const [userColors, setUserColors] = useState<Record<string, string | null>>({});
  const [bitchAnim, setBitchAnim] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

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
      try {
        // Jeder Aufruf für sich abgesichert — ein Fehler darf das Laden nie blockieren.
        const [classData, profileData, usersData, streakData, groupsData] = await Promise.all([
          fetch('/api/classes').then(r => r.json()).catch(() => []),
          fetch(`/api/profile?user=${encodeURIComponent(userName)}`).then(r => r.json()).catch(() => []),
          fetch('/api/users').then(r => r.json()).catch(() => []),
          fetch('/api/streak').then(r => r.json()).catch(() => ({ points: 0 })),
          fetch('/api/groups').then(r => r.json()).catch(() => ({})),
        ]);
        setAllClasses(Array.isArray(classData) ? classData : []);
        setStreakPoints(streakData?.points ?? 0);
        const curGroup = (groupsData?.groups ?? []).find((g: { id: number; bundesland?: string }) => g.id === groupsData?.current);
        if (curGroup?.bundesland) setBundesland(curGroup.bundesland);
        if (Array.isArray(usersData)) {
          const map: Record<string, string | null> = {};
          for (const u of usersData) map[u.user_name] = u.color ?? null;
          setUserColors(map);
        }
        const planEdit = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plan') === '1';
        if (Array.isArray(profileData) && profileData.length > 0) {
          setSelectedIds(new Set(profileData));
          setStep(planEdit ? 'schedule' : 'done');
        } else {
          setStep('schedule');
        }
      } catch {
        setStep('schedule'); // Fallback: nie im Ladebildschirm hängen bleiben
      }
    }
    init();
  }, [userName, userLoading]);

  useEffect(() => {
    if (step === 'done' && userName) fetchCalendarData(weekStart);
  }, [weekStart, step, userName, fetchCalendarData]);

  // Wochenplan dieser KW laden (Abweichung oder fester Plan).
  useEffect(() => {
    if (step !== 'done' || !userName) return;
    fetch(`/api/weekly-schedule?week=${weekStart}`).then(r => r.json()).then(d => {
      setWeekPlan(new Set(Array.isArray(d.classIds) ? d.classIds : []));
      setWeekPlanOverride(!!d.isOverride);
    }).catch(() => {});
  }, [weekStart, step, userName]);

  async function saveWeekPlan(ids: Set<number>) {
    setWeekPlan(new Set(ids));
    const res = await fetch('/api/weekly-schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week: weekStart, classIds: [...ids] }),
    }).then(r => r.json()).catch(() => null);
    if (res) setWeekPlanOverride(!!res.isOverride);
  }
  function toggleWeekClass(id: number) {
    const next = new Set(weekPlan);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveWeekPlan(next);
  }
  async function resetWeekPlan() {
    await fetch('/api/weekly-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: weekStart, reset: true }) }).catch(() => {});
    const d = await fetch(`/api/weekly-schedule?week=${weekStart}`).then(r => r.json()).catch(() => null);
    if (d) { setWeekPlan(new Set(Array.isArray(d.classIds) ? d.classIds : [])); setWeekPlanOverride(!!d.isOverride); }
  }

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
      track('attendance_toggled', { attending: !!data.attending });
      if (data.attending) {
        setAttendance(prev => [...prev, { id: Date.now(), class_id: classId, week_start: weekStart, user_name: userName }]);
        // Wer doch noch kommt, ist kein No-Show mehr → Ausrede/Bitch für den Tag entfernen.
        const cls = classes.find(c => c.id === classId);
        if (cls) {
          const d = format(addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), cls.day_of_week - 1), 'yyyy-MM-dd');
          setSkipping(prev => prev.filter(s => !(s.user_name === userName && s.date === d)));
        }
      } else {
        setAttendance(prev => prev.filter(a => !(a.class_id === classId && a.user_name === userName)));
      }
    } finally {
      setToggling(null);
    }
  }

  // Fallback-Sound (synthetisches „Gock gock"), falls die MP3 nicht spielt.
  function playSynth() {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      void ctx.resume?.();
      const cluck = (t0: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t0);
        osc.frequency.exponentialRampToValueAtTime(360, t0 + 0.07);
        osc.frequency.exponentialRampToValueAtTime(640, t0 + 0.12);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.17);
      };
      const now = ctx.currentTime;
      cluck(now);
      cluck(now + 0.2);
    } catch { /* egal */ }
  }

  function unlockAudio() {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      void audioRef.current?.resume?.();
      if (!audioElRef.current) {
        const el = new Audio('/chicken.mp3');
        el.preload = 'auto';
        audioElRef.current = el;
      }
      // iOS: stummes Play/Pause innerhalb der Tipp-Geste schaltet die Wiedergabe frei.
      const el = audioElRef.current;
      el.muted = true;
      el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
    } catch { /* egal */ }
  }

  function celebrateBitch() {
    const el = audioElRef.current;
    let usedMp3 = false;
    if (el) {
      try {
        el.muted = false;
        el.currentTime = 0;
        const p = el.play();
        usedMp3 = true;
        if (p && typeof p.catch === 'function') p.catch(() => playSynth());
      } catch { usedMp3 = false; }
    }
    if (!usedMp3) playSynth();
    setBitchAnim(true);
    setTimeout(() => setBitchAnim(false), 3100);
  }

  function openExcuseModal(dateStr: string) {
    const already = skipping.some(s => s.date === dateStr && s.user_name === userName);
    if (already) { submitSkip(dateStr, ''); return; }
    setExcuseDate(dateStr); setExcuseText(''); setUseStreakPt(false);
  }

  async function submitSkip(dateStr: string, excuse: string) {
    unlockAudio();
    setSubmittingExcuse(true);
    try {
      const res = await fetch('/api/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, userName, excuse, useStreakPoint: useStreakPt }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.skipping) {
        setSkipping(prev => [...prev, { id: Date.now(), date: dateStr, user_name: userName, excuse }]);
        celebrateBitch();
      } else {
        setSkipping(prev => prev.filter(s => !(s.date === dateStr && s.user_name === userName)));
      }
      // Streak-Punkte aktuell halten (Schutz abgezogen / bei Rücknahme erstattet).
      fetch('/api/streak').then(r => r.json()).then(d => setStreakPoints(d.points ?? 0)).catch(() => {});
      setUseStreakPt(false);
      setExcuseDate(null);
    } finally {
      setSubmittingExcuse(false);
    }
  }

  // --- LOADING ---
  if (userLoading || step === 'loading') {
    return <LoadingScreen />;
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
            <div className="text-[var(--faint)] text-sm py-8 text-center">Noch keine Kurse — tritt einer Crew bei oder leg selbst eine an. <a href="/gruppen" className="text-[var(--accent)] hover:underline">Zu den Gruppen →</a></div>
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
  const allHolidays = getHolidays(weekYear, bundesland);
  if (addDays(weekMonday, 6).getFullYear() !== weekYear)
    allHolidays.push(...getHolidays(weekYear + 1, bundesland));
  const holidayMap = new Map(allHolidays.map(h => [h.date, h.name]));

  const activeDays = [1, 2, 3, 4, 5, 6, 7].filter(day => (classesByDay[day] ?? []).length > 0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowMinutes = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();

  return (
    <div className="min-h-screen text-[var(--text)]">
      {/* Excuse Modal */}
      {excuseDate && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-md px-4 anim-in">
          <div className="card anim-pop p-6 w-full max-w-sm shadow-2xl">
            <div className="text-2xl mb-1">🐔</div>
            <h2 className="font-display text-2xl tracking-wide mb-1">Begründung</h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Warum {excuseDate < todayStr ? 'warst' : 'bist'} du am <span className="text-white">{DAY_NAMES_FULL[new Date(excuseDate + 'T12:00').getDay() === 0 ? 6 : new Date(excuseDate + 'T12:00').getDay() - 1]}</span> nicht da?
            </p>
            <textarea
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--bitch)] resize-none mb-4"
              placeholder="Deine Ausrede…"
              rows={3}
              value={excuseText}
              onChange={e => setExcuseText(e.target.value)}
              autoFocus
            />
            {streakPoints > 0 && (
              <label className="flex items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl cursor-pointer select-none"
                style={{ background: 'var(--surface-2)', border: `1px solid ${useStreakPt ? 'var(--accent-2)' : 'var(--border-soft)'}` }}>
                <input type="checkbox" checked={useStreakPt} onChange={e => setUseStreakPt(e.target.checked)} />
                <span className="flex-1 text-sm">
                  🔥 Streak schützen
                  <span className="block text-[11px] text-[var(--muted)]">{streakPoints} übrig</span>
                </span>
              </label>
            )}
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

      {/* 🐔 Bitch-Pop */}
      {bitchAnim && (
        <div className="fixed inset-0 z-[1000] grid place-items-center pointer-events-none">
          <span className="chicken-pop" style={{ fontSize: '150px', filter: 'drop-shadow(0 12px 34px rgba(0,0,0,0.65))' }}>🐔</span>
        </div>
      )}

      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between max-w-md mx-auto anim-in">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="Tap In" className="w-11 h-11 rounded-[13px] ring-1 ring-white/10 shadow-lg shadow-black/40" />
          <div>
            <h1 className="font-display text-2xl leading-none tracking-wide">Tap In</h1>
            <p className="text-[var(--muted)] text-[11px] mt-1 uppercase tracking-[0.18em]">Wer kommt diese Woche?</p>
          </div>
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
              const holiday = holidayMap.get(dateStr) ?? null;
              const plannedToday = dayClasses.filter(c => selectedIds.has(c.id));
              const isPlanned = plannedToday.length > 0;
              const attendedAny = dayClasses.some(c => attendance.some(a => a.class_id === c.id && a.user_name === userName));
              const lastPlannedEnd = plannedToday.reduce((mx, c) => Math.max(mx, hhmmToMin(c.end_time)), 0);
              // No-Show steht fest, sobald der Tag vorbei ist ODER heute deine letzte geplante Klasse vorbei ist.
              const dayOver = dateStr < todayStr || (isToday && isPlanned && nowMinutes >= lastPlannedEnd);
              const isNoShow = dayOver && isPlanned && !attendedAny && dateStr >= CUTOVER && !holiday;
              const myExcuse = skipping.find(s => s.date === dateStr && s.user_name === userName);
              const daysLeft = 3 - Math.round((Date.parse(todayStr) - Date.parse(dateStr)) / 86400000);
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
                                const uc = colorFor(a.user_name, userColors[a.user_name]);
                                const mine = a.user_name === userName;
                                return (
                                  <span key={a.user_name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: uc, color: '#fff', boxShadow: mine ? '0 0 0 1.5px rgba(255,255,255,0.6)' : 'none' }}>
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

                  {/* Bitch / Ausrede row — auf jedem geplanten Tag (wenn nicht anwesend) */}
                  {((isPlanned && !attendedAny) || daySkippers.length > 0) && (
                    <div className="px-3 pb-3">
                      {isPlanned && !attendedAny && (
                        myExcuse ? (
                          <button onClick={() => openExcuseModal(dateStr)}
                            className="w-full text-[11px] font-semibold py-2 px-3 rounded-xl border transition-all active:scale-[0.99]"
                            style={{ background: 'rgba(245,197,24,0.12)', borderColor: 'rgba(245,197,24,0.35)', color: 'var(--bitch)' }}>
                            🐔 Ausrede eingereicht ✓ · tippen zum Entfernen
                          </button>
                        ) : daysLeft >= 0 ? (
                          <button onClick={() => openExcuseModal(dateStr)}
                            className="w-full text-[11px] font-semibold py-2 px-3 rounded-xl border transition-all active:scale-[0.99]"
                            style={isNoShow
                              ? { background: 'rgba(245,197,24,0.12)', borderColor: 'rgba(245,197,24,0.4)', color: 'var(--bitch)' }
                              : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--faint)' }}>
                            {isNoShow
                              ? `🐔 Verpasst — Ausrede eintragen (${daysLeft === 0 ? 'heute letzte Chance' : `noch ${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}`})`
                              : '🐔 Ich bin eine Bitch — Ausrede vorab eintragen'}
                          </button>
                        ) : (
                          <div className="w-full text-[11px] font-medium py-2 px-3 rounded-xl border text-center"
                            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--faint)' }}>
                            🐔 Verpasst · 🔒 Frist abgelaufen
                          </div>
                        )
                      )}
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
                  )}
                </section>
              );
            })}
            <p className="text-center text-[11px] text-[var(--faint)] pt-2">Tippe auf einen Kurs, um dich ein- oder auszutragen.</p>

            {/* Wochenplan dieser KW anpassen */}
            <div className="pt-2">
              <button onClick={() => setShowWeekPlan(v => !v)} className="w-full text-center text-xs text-[var(--muted)] hover:text-white transition-colors py-2">
                {showWeekPlan ? 'Wochenplan schließen' : `⚙︎ Wochenplan diese Woche${weekPlanOverride ? ' · angepasst' : ''}`}
              </button>
              {showWeekPlan && (
                <div className="card p-4 anim-up">
                  <p className="text-[11px] text-[var(--faint)] mb-3 leading-relaxed">Nur für diese KW: welche Kurse für Streak &amp; Wertung zählen. Gut, wenn du mal tauschst (z.B. Di statt Mi) — dann bricht die Streak nicht.</p>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7].map(day => {
                      const dc = classesByDay[day] ?? [];
                      if (!dc.length) return null;
                      return (
                        <div key={day}>
                          <div className="text-[10px] text-[var(--faint)] uppercase tracking-[0.16em] font-semibold mb-1.5">{DAY_NAMES_FULL[day - 1]}</div>
                          <div className="flex flex-wrap gap-2">
                            {dc.map(cls => {
                              const on = weekPlan.has(cls.id);
                              const c = hex(cls.color);
                              return (
                                <button key={cls.id} onClick={() => toggleWeekClass(cls.id)}
                                  className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                                  style={{ borderColor: on ? c : 'var(--border)', background: on ? `${c}22` : 'transparent', color: on ? 'var(--text)' : 'var(--muted)' }}>
                                  {cls.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {weekPlanOverride && (
                    <button onClick={resetWeekPlan} className="mt-3 text-xs text-[var(--faint)] hover:text-[var(--accent)]">↺ Auf festen Plan zurücksetzen</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
