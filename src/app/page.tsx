'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { startOfWeek, addWeeks, subWeeks, format, addDays, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';
import type { GymClass, AttendanceRecord } from '@/lib/db';

const CLASS_COLORS: Record<string, string> = {
  red: 'border-red-600 bg-red-600/10', blue: 'border-blue-500 bg-blue-500/10',
  green: 'border-green-500 bg-green-500/10', orange: 'border-orange-500 bg-orange-500/10',
  purple: 'border-purple-500 bg-purple-500/10',
};
const BADGE_COLORS: Record<string, string> = {
  red: 'bg-red-600', blue: 'bg-blue-500', green: 'bg-green-500',
  orange: 'bg-orange-500', purple: 'bg-purple-500',
};
const DOT_COLORS: Record<string, string> = {
  red: 'bg-red-600', blue: 'bg-blue-500', green: 'bg-green-500',
  orange: 'bg-orange-500', purple: 'bg-purple-500',
};
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
  const { userName, loading: userLoading, refresh } = useUser();
  const router = useRouter();

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

  // After user loads, determine step
  useEffect(() => {
    if (userLoading) return;
    if (!userName) { router.push('/login'); return; }

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
  }, [userName, userLoading, router]);

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
    refresh();
    router.push('/login');
  }

  // --- LOADING ---
  if (userLoading || step === 'loading') {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-600 text-sm">Laden...</div>;
  }

  // --- SCHEDULE STEP ---
  if (step === 'schedule') {
    const byDay: Record<number, GymClass[]> = {};
    for (let d = 1; d <= 7; d++) byDay[d] = allClasses.filter(c => c.day_of_week === d);
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="text-3xl mb-1">📋</div>
            <h2 className="text-xl font-bold mb-1">Dein normaler Stundenplan</h2>
            <p className="text-gray-400 text-sm">Welche Kurse besuchst du normalerweise? Nur diese zählen für die Bitch-Wertung.</p>
          </div>
          {allClasses.length === 0 ? (
            <div className="text-gray-600 text-sm py-8 text-center">Noch keine Kurse. <a href="/admin" className="text-red-600 hover:underline">Admin →</a></div>
          ) : (
            <div className="space-y-4 mb-8">
              {[1,2,3,4,5,6,7].map(day => {
                const dayCls = byDay[day] ?? [];
                if (!dayCls.length) return null;
                return (
                  <div key={day}>
                    <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">{DAY_NAMES_FULL[day-1]}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dayCls.map(cls => {
                        const checked = selectedIds.has(cls.id);
                        return (
                          <button key={cls.id} onClick={() => setSelectedIds(prev => { const n = new Set(prev); checked ? n.delete(cls.id) : n.add(cls.id); return n; })}
                            className={`text-left rounded-xl border p-3 transition-all ${checked ? `${CLASS_COLORS[cls.color]??CLASS_COLORS.red} ring-1 ring-current` : 'border-[#222] bg-[#111] hover:border-[#333]'}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${DOT_COLORS[cls.color]??DOT_COLORS.red}`} />
                              <span className="text-sm font-semibold">{cls.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 ml-4">{cls.start_time} – {cls.end_time}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={saveSchedule} disabled={savingSchedule}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors">
              {savingSchedule ? 'Speichern...' : `${selectedIds.size} Kurse speichern`}
            </button>
            <button onClick={() => { fetch('/api/profile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userName, classIds: []}) }); setStep('done'); }}
              className="px-4 py-3 rounded-lg border border-[#333] text-gray-500 hover:text-white text-sm transition-colors">
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Excuse Modal */}
      {excuseDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-2xl mb-1">🐔</div>
            <h2 className="text-lg font-bold mb-1">Begründung</h2>
            <p className="text-gray-400 text-sm mb-4">
              Warum kommst du am <span className="text-white">{DAY_NAMES_FULL[new Date(excuseDate + 'T12:00').getDay() === 0 ? 6 : new Date(excuseDate + 'T12:00').getDay() - 1]}</span> nicht?
            </p>
            <textarea
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600 resize-none mb-4"
              placeholder="Deine Ausrede..."
              rows={3}
              value={excuseText}
              onChange={e => setExcuseText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setExcuseDate(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-gray-400 hover:text-white text-sm transition-colors">Abbrechen</button>
              <button onClick={() => submitSkip(excuseDate, excuseText)} disabled={!excuseText.trim() || submittingExcuse}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {submittingExcuse ? '...' : 'Einreichen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥊</span>
          <div>
            <h1 className="font-bold text-lg leading-none">Fight Calendar</h1>
            <p className="text-gray-500 text-xs mt-0.5">Wer kommt diese Woche?</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors text-gray-400 hover:text-white">
              <span className="text-sm hidden sm:block">{userName}</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect y="2" width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="8" width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="14" width="18" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-40 bg-[#111] border border-[#222] rounded-xl shadow-2xl overflow-hidden min-w-[210px]">
                  <div className="px-4 py-3 border-b border-[#1a1a1a]">
                    <div className="text-xs text-gray-500">Eingeloggt als</div>
                    <div className="font-semibold text-sm">{userName}</div>
                  </div>
                  <button onClick={() => { setMenuOpen(false); setStep('schedule'); fetch('/api/classes').then(r => r.json()).then(d => setAllClasses(d)); fetch(`/api/profile?user=${encodeURIComponent(userName)}`).then(r=>r.json()).then(d=>setSelectedIds(new Set(d))); }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors">
                    <span>📋</span> Meinen Plan ändern
                  </button>
                  <div className="border-t border-[#1a1a1a]" />
                  <a href="/macher" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"><span>💪</span> Macher des Monats</a>
                  <a href="/bitch" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"><span>🐔</span> Bitch des Monats</a>
                  <a href="/vote" className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${isVotingWindow() ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-gray-300 hover:bg-[#1a1a1a] hover:text-white'}`}>
                    <span>🗳️</span> Ausreden-Gericht {isVotingWindow() && <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">offen</span>}
                  </a>
                  <div className="border-t border-[#1a1a1a]" />
                  <a href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-[#1a1a1a] hover:text-white transition-colors"><span>⚙️</span> Admin</a>
                  <button onClick={logout} className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-red-600/10 hover:text-red-400 transition-colors border-t border-[#1a1a1a]">
                    <span>🚪</span> Ausloggen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg text-gray-400 hover:text-white text-sm">← Vorherige</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{format(weekMonday, 'd. MMM', { locale: de })} – {format(addDays(weekMonday, 6), 'd. MMM yyyy', { locale: de })}</div>
          <div className="text-xs text-gray-500">KW {format(weekMonday, 'w')}</div>
        </div>
        <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg text-gray-400 hover:text-white text-sm">Nächste →</button>
      </div>

      {/* Schedule Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-600 text-sm">Laden...</div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-2">
            <div className="text-4xl">📋</div>
            <div className="text-sm">Noch keine Kurse eingetragen.</div>
            <a href="/admin" className="text-red-600 text-sm hover:underline mt-1">Kurse hinzufügen →</a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {[1,2,3,4,5,6,7].map(day => {
              const dayClasses = classesByDay[day] ?? [];
              const dayDate = addDays(weekMonday, day - 1);
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
              const daySkippers = skipping.filter(s => s.date === dateStr);
              const iSkipping = daySkippers.some(s => s.user_name === userName);
              return (
                <div key={day} className={`rounded-xl border ${isToday ? 'border-red-900/50' : 'border-[#1a1a1a]'} overflow-hidden flex flex-col`}>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest flex justify-between items-center ${isToday ? 'bg-red-600/20 text-red-400' : 'bg-[#111] text-gray-500'}`}>
                    <span>{DAY_NAMES_SHORT[day-1]}</span>
                    <span className="text-[10px] font-normal">{format(dayDate, 'd.M.')}</span>
                  </div>
                  <div className="p-2 flex flex-col gap-2 flex-1">
                    {dayClasses.length === 0 ? (
                      <div className="text-[11px] text-gray-700 text-center py-3">–</div>
                    ) : dayClasses.map(cls => {
                      const classAttendance = attendance.filter(a => a.class_id === cls.id);
                      const isAttending = classAttendance.some(a => a.user_name === userName);
                      const isLoading = toggling === cls.id;
                      return (
                        <button key={cls.id} onClick={() => toggleAttendance(cls.id)} disabled={isLoading}
                          className={`w-full text-left rounded-lg border p-2 transition-all ${isAttending ? `${CLASS_COLORS[cls.color]??CLASS_COLORS.red} ring-1 ring-current` : 'border-[#222] bg-[#111] hover:border-[#333]'} ${isLoading?'opacity-60':''}`}>
                          <div className="text-[11px] font-bold text-white leading-tight">{cls.name}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{cls.start_time} – {cls.end_time}</div>
                          {classAttendance.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {classAttendance.map(a => (
                                <span key={a.user_name} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white ${a.user_name===userName?(BADGE_COLORS[cls.color]??'bg-red-600'):'bg-[#333]'}`}>{a.user_name}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-2 pb-2 pt-1 border-t border-[#1a1a1a]">
                    <button onClick={() => openExcuseModal(dateStr)}
                      className={`w-full text-[10px] font-medium py-1.5 px-2 rounded-lg transition-all ${iSkipping ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-600/40' : 'bg-[#111] text-gray-600 border border-[#222] hover:text-gray-400 hover:border-[#333]'}`}>
                      🐔 Ich bin eine Bitch
                    </button>
                    {daySkippers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {daySkippers.map(s => (
                          <span key={s.user_name} title={s.excuse} className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-600/20 cursor-help">{s.user_name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {classes.length > 0 && <div className="mt-6 text-center text-xs text-gray-600">Klicke auf einen Kurs um dich ein- oder auszutragen.</div>}
      </main>
    </div>
  );
}
