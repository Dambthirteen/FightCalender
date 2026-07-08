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
import WeekPlanEditor from '@/components/WeekPlanEditor';
import CoachPlanEditor from '@/components/CoachPlanEditor';
import { isCoach, isFighter } from '@/lib/fighter';
import type { GymClass, AttendanceRecord } from '@/lib/db';

// Kursfarbe → Hex (für Dots, Badges, Ränder)
const COLOR_HEX: Record<string, string> = {
  red: '#ff8a80', blue: '#93b7f7', green: '#8fe0b0', orange: '#ffbf80', purple: '#c9a3f5',
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
  const [scheduleTab, setScheduleTab] = useState<'fixed' | 'week' | 'coach'>('fixed');
  const [role, setRole] = useState<string | null>(null);
  const [allClasses, setAllClasses] = useState<GymClass[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleLockUntil, setScheduleLockUntil] = useState<string | null>(null);
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [confirmSchedule, setConfirmSchedule] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
  const [weekPlan, setWeekPlan] = useState<Set<number>>(new Set());
  const [weekPlanOverride, setWeekPlanOverride] = useState(false);
  const [weekPlanLoaded, setWeekPlanLoaded] = useState(false);
  const [coachByClass, setCoachByClass] = useState<Record<number, string[]>>({});
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
        const [classData, profileData, usersData, streakData, groupsData, profileInfo] = await Promise.all([
          fetch('/api/classes').then(r => r.json()).catch(() => []),
          fetch(`/api/profile?user=${encodeURIComponent(userName)}`).then(r => r.json()).catch(() => []),
          fetch('/api/users').then(r => r.json()).catch(() => []),
          fetch('/api/streak').then(r => r.json()).catch(() => ({ points: 0 })),
          fetch('/api/groups').then(r => r.json()).catch(() => ({})),
          fetch(`/api/profile-info?user=${encodeURIComponent(userName)}`).then(r => r.json()).catch(() => ({})),
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
        const myRole: string | null = profileInfo?.fighter_info?.role ?? null;
        setRole(myRole);
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const planEdit = params?.get('plan') === '1';
        const tabParam = params?.get('tab');
        // Standard-Tab je nach Rolle: Nur-Coach startet direkt im Trainingsplan.
        if (tabParam === 'week') setScheduleTab('week');
        else if (tabParam === 'coach') setScheduleTab('coach');
        else if (isCoach(myRole) && !isFighter(myRole)) setScheduleTab('coach');
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

  // Lock-Status des festen Plans laden (nur alle 7 Tage änderbar).
  useEffect(() => {
    if (step !== 'schedule') return;
    fetch('/api/schedule-lock').then((r) => r.json()).then((d) => setScheduleLockUntil(d.lockedUntil ?? null)).catch(() => {});
  }, [step]);

  // 3-Sekunden-Cooldown für den „Ich bin mir sicher"-Button.
  useEffect(() => {
    if (!confirmSchedule) { setCooldown(0); return; }
    setCooldown(3);
    const id = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [confirmSchedule]);

  // Wochenplan der angezeigten KW laden (Abweichung oder fester Plan) — bestimmt im Kalender,
  // welche Tage geplant sind (und damit Chicken-/No-Show-Eintrag). Read-only; Bearbeiten läuft
  // über den Wochenplan-Tab im Stundenplan.
  useEffect(() => {
    if (step !== 'done' || !userName) return;
    setWeekPlanLoaded(false);
    fetch(`/api/weekly-schedule?week=${weekStart}`).then(r => r.json()).then(d => {
      setWeekPlan(new Set(Array.isArray(d.classIds) ? d.classIds : []));
      setWeekPlanOverride(!!d.isOverride);
      setWeekPlanLoaded(true);
    }).catch(() => setWeekPlanLoaded(true));
  }, [weekStart, step, userName]);

  // Welche Coaches geben diese KW welchen Kurs → Name vorne im Kalender.
  useEffect(() => {
    if (step !== 'done' || !userName) return;
    fetch(`/api/coach-schedule?week=${weekStart}&all=1`).then(r => r.json()).then(d => {
      setCoachByClass(d?.coaches && typeof d.coaches === 'object' ? d.coaches : {});
    }).catch(() => {});
  }, [weekStart, step, userName]);

  async function saveSchedule() {
    setConfirmSchedule(false);
    setSavingSchedule(true); setScheduleMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, classIds: Array.from(selectedIds) }),
      });
      if (res.ok) { setStep('done'); return; }
      const d = await res.json().catch(() => ({}));
      if (res.status === 403 && d.lockedUntil) setScheduleLockUntil(d.lockedUntil);
      else setScheduleMsg(d.error ?? 'Konnte nicht speichern.');
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
    // Tabs je nach Rolle: Fighter → Normaler Plan + Wochenplan, Coach → Trainingsplan, Beides → alle.
    const tabs: [typeof scheduleTab, string][] = [];
    if (isFighter(role)) tabs.push(['fixed', 'Normaler Plan'], ['week', 'Wochenplan']);
    if (isCoach(role)) tabs.push(['coach', 'Trainingsplan']);
    if (tabs.length === 0) tabs.push(['fixed', 'Normaler Plan']);
    const activeTab = tabs.some(t => t[0] === scheduleTab) ? scheduleTab : tabs[0][0];
    return (
      <div className="min-h-screen text-[var(--text)]">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="flex items-center mb-4">
            <button onClick={() => setStep('done')} className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Kalender</button>
          </div>
          {/* Rollenabhängige Tabs: Stundenplan (fest/Woche) und/oder Coach-Trainingsplan */}
          {tabs.length > 1 && (
            <div className="flex gap-1 p-1 rounded-2xl mb-6 anim-up" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
              {tabs.map(([key, label]) => (
                <button key={key} onClick={() => setScheduleTab(key)}
                  className="flex-1 text-sm font-semibold py-2 rounded-xl transition-colors"
                  style={activeTab === key ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--muted)' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'coach' ? (
            <CoachPlanEditor classes={allClasses} />
          ) : activeTab === 'week' ? (
            <WeekPlanEditor classes={allClasses} />
          ) : (
          <>
          <div className="mb-7 anim-up">
            <div className="text-3xl mb-2">📋</div>
            <h2 className="font-display text-3xl tracking-wide mb-1">Dein Stundenplan</h2>
            <p className="text-[var(--muted)] text-sm">Welche Kurse besuchst du normalerweise? Nur diese zählen für die Wertung.</p>
          </div>
          {(() => {
            const locked = scheduleLockUntil && new Date(scheduleLockUntil).getTime() > Date.now();
            if (!locked) return null;
            const until = new Date(scheduleLockUntil!).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
            return (
              <div className="rounded-xl px-4 py-3 mb-5 text-xs anim-up" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                <div className="font-semibold text-[var(--text)] mb-0.5">🔒 Fester Plan gesperrt</div>
                <p className="text-[var(--muted)]">
                  Der feste Plan lässt sich nur alle 7 Tage ändern (damit die Wertung fair bleibt) — wieder frei ab <strong className="text-[var(--text)]">{until}</strong>.
                  Für einzelne Wochen nutz den Tab <strong className="text-[var(--text)]">Wochenplan</strong> oben.
                </p>
              </div>
            );
          })()}
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
          {scheduleMsg && <p className="text-[var(--accent)] text-xs mb-2">{scheduleMsg}</p>}
          <div className="flex gap-3 anim-up" style={{ animationDelay: '120ms' }}>
            {(() => {
              const locked = !!scheduleLockUntil && new Date(scheduleLockUntil).getTime() > Date.now();
              return (
                <button onClick={() => setConfirmSchedule(true)} disabled={savingSchedule || locked}
                  className="flex-1 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}>
                  {locked ? '🔒 Gesperrt' : savingSchedule ? 'Speichern…' : `${selectedIds.size} Kurse speichern`}
                </button>
              );
            })()}
            <button onClick={() => setStep('done')}
              className="px-4 py-3.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white text-sm transition-colors">
              {scheduleLockUntil && new Date(scheduleLockUntil).getTime() > Date.now() ? 'Schließen' : 'Überspringen'}
            </button>
          </div>
          </>
          )}
        </div>

        {/* Bestätigung: fester Plan nur alle 7 Tage änderbar */}
        {confirmSchedule && (
          <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm anim-in"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmSchedule(false); }}>
            <div className="card w-full max-w-sm p-5 anim-up rounded-b-none sm:rounded-2xl">
              <h2 className="font-display text-xl tracking-wide mb-1">Plan wirklich ändern?</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                Der feste Plan lässt sich danach <strong className="text-[var(--text)]">nur alle 7 Tage</strong> wieder anpassen. Bist du dir sicher?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSchedule(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white text-sm font-semibold transition-colors">
                  Bearbeiten
                </button>
                <button onClick={saveSchedule} disabled={cooldown > 0 || savingSchedule}
                  className="flex-1 text-white font-bold py-2.5 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                  {cooldown > 0 ? `Ich bin mir sicher (${cooldown}s)` : savingSchedule ? 'Speichern…' : 'Ich bin mir sicher'}
                </button>
              </div>
            </div>
          </div>
        )}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-chicken.png" alt="" className="w-9 h-9 mb-1 object-contain" />
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

      {/* Chicken-Pop: das Logo wächst und ploppt weg */}
      {bitchAnim && (
        <div className="fixed inset-0 z-[1000] grid place-items-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-chicken.png" alt="" className="chicken-pop"
            style={{ width: '190px', height: '190px', objectFit: 'contain', filter: 'drop-shadow(0 12px 34px rgba(0,0,0,0.65))' }} />
        </div>
      )}

      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center justify-between max-w-md mx-auto anim-in">
        <div className="flex items-center gap-3">
          <img src="/logo-chicken.png" alt="Submit" className="w-11 h-11 object-contain shrink-0" />
          <div>
            <h1 className="font-display text-2xl leading-none tracking-wide">Submit</h1>
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
              // Geplant = Wochenplan der angezeigten KW (Abweichung oder fester Plan). Bis der
              // Wochenplan geladen ist, gilt der feste Plan (kein Aufblitzen leerer Tage).
              const plannedToday = dayClasses.filter(c => (weekPlanLoaded ? weekPlan : selectedIds).has(c.id));
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
                          {(() => {
                            // Coach(es) dieser KW zuerst und hervorgehoben, dann die restlichen Angemeldeten.
                            const coaches = coachByClass[cls.id] ?? [];
                            const coachSet = new Set(coaches);
                            const others = classAttendance.filter(a => !coachSet.has(a.user_name));
                            if (coaches.length === 0 && others.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {coaches.map(name => (
                                  <span key={`coach-${name}`} className="text-[10px] font-bold px-1.5 py-px rounded-[3px] inline-flex items-center gap-1"
                                    style={{ background: 'var(--gold)', color: '#3a2a00', boxShadow: '0 0 0 1.5px rgba(255,194,75,0.55)' }}>
                                    🎓 {name}
                                  </span>
                                ))}
                                {others.map(a => {
                                  const uc = colorFor(a.user_name, userColors[a.user_name]);
                                  const mine = a.user_name === userName;
                                  return (
                                    <span key={a.user_name} className="text-[10px] font-semibold px-1.5 py-px rounded-[3px]"
                                      style={{ background: uc, color: '#15151b', boxShadow: mine ? '0 0 0 1.5px rgba(255,255,255,0.6)' : 'none' }}>
                                      {a.user_name}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
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
                              : '🐔 Ich bin ein Chicken — Ausrede vorab eintragen'}
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
                            <span key={s.user_name} title={s.excuse} className="text-[10px] px-1.5 py-px rounded-[3px] cursor-help"
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

            {/* Wochenplan wird jetzt im Stundenplan (Tab „Wochenplan") bearbeitet. */}
            <div className="pt-2 text-center">
              <button onClick={() => { setScheduleTab('week'); setStep('schedule'); }}
                className="text-xs text-[var(--muted)] hover:text-white transition-colors py-2">
                ⚙︎ Wochenplan anpassen{weekPlanOverride ? ' · diese KW angepasst' : ''}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
