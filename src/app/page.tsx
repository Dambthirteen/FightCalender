'use client';

import { useEffect, useState, useCallback } from 'react';
import { startOfWeek, addWeeks, subWeeks, format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import type { GymClass, AttendanceRecord } from '@/lib/db';

const CLASS_COLORS: Record<string, string> = {
  red: 'border-red-600 bg-red-600/10',
  blue: 'border-blue-500 bg-blue-500/10',
  green: 'border-green-500 bg-green-500/10',
  orange: 'border-orange-500 bg-orange-500/10',
  purple: 'border-purple-500 bg-purple-500/10',
};
const BADGE_COLORS: Record<string, string> = {
  red: 'bg-red-600',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

function getWeekStart(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

export default function Home() {
  const [userName, setUserName] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  const weekStart = getWeekStart(currentWeek);

  const fetchData = useCallback(async (week: string) => {
    setLoading(true);
    try {
      const [classRes, attRes] = await Promise.all([
        fetch('/api/classes'),
        fetch(`/api/attendance?week=${week}`),
      ]);
      const [classData, attData] = await Promise.all([classRes.json(), attRes.json()]);
      setClasses(Array.isArray(classData) ? classData : []);
      setAttendance(Array.isArray(attData) ? attData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('fightcal_name');
    if (stored) {
      setUserName(stored);
    } else {
      setShowNameModal(true);
    }
  }, []);

  useEffect(() => {
    fetchData(weekStart);
  }, [weekStart, fetchData]);

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem('fightcal_name', trimmed);
    setUserName(trimmed);
    setShowNameModal(false);
  }

  async function toggleAttendance(classId: number) {
    if (!userName) { setShowNameModal(true); return; }
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

  const classesByDay: Record<number, GymClass[]> = {};
  for (let d = 1; d <= 7; d++) {
    classesByDay[d] = classes.filter(c => c.day_of_week === d);
  }

  const weekMonday = startOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
            <div className="text-3xl mb-1">🥊</div>
            <h2 className="text-xl font-bold mb-1">Wer bist du?</h2>
            <p className="text-gray-400 text-sm mb-6">Gib deinen Namen ein um loszulegen.</p>
            <input
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-600 mb-4"
              placeholder="Dein Name..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              autoFocus
            />
            <button
              onClick={saveName}
              disabled={!nameInput.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Los geht&apos;s
            </button>
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
          {userName && (
            <button
              onClick={() => { setNameInput(userName); setShowNameModal(true); }}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a]"
            >
              👤 {userName}
            </button>
          )}
          <a href="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1">
            Admin
          </a>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentWeek(w => subWeeks(w, 1))}
          className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
        >
          ← Vorherige
        </button>
        <div className="text-center">
          <div className="font-semibold text-sm">
            {format(weekMonday, 'd. MMM', { locale: de })} – {format(addDays(weekMonday, 6), 'd. MMM yyyy', { locale: de })}
          </div>
          <div className="text-xs text-gray-500">KW {format(weekMonday, 'w')}</div>
        </div>
        <button
          onClick={() => setCurrentWeek(w => addWeeks(w, 1))}
          className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
        >
          Nächste →
        </button>
      </div>

      {/* Schedule Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-600">
            <div className="text-sm">Laden...</div>
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-2">
            <div className="text-4xl">📋</div>
            <div className="text-sm">Noch keine Kurse eingetragen.</div>
            <a href="/admin" className="text-red-600 text-sm hover:underline mt-1">Kurse hinzufügen →</a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map(day => {
              const dayClasses = classesByDay[day] ?? [];
              const dayDate = addDays(weekMonday, day - 1);
              const isToday = format(dayDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
              return (
                <div key={day} className={`rounded-xl border ${isToday ? 'border-red-900/50' : 'border-[#1a1a1a]'} overflow-hidden`}>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest flex justify-between items-center ${isToday ? 'bg-red-600/20 text-red-400' : 'bg-[#111] text-gray-500'}`}>
                    <span>{dayNames[day - 1]}</span>
                    <span className="text-[10px] font-normal">{format(dayDate, 'd.M.')}</span>
                  </div>
                  <div className="p-2 flex flex-col gap-2 min-h-[80px]">
                    {dayClasses.length === 0 ? (
                      <div className="text-[11px] text-gray-700 text-center py-3">–</div>
                    ) : (
                      dayClasses.map(cls => {
                        const classAttendance = attendance.filter(a => a.class_id === cls.id);
                        const isAttending = classAttendance.some(a => a.user_name === userName);
                        const isCurrentlyToggling = toggling === cls.id;
                        const colorBorder = CLASS_COLORS[cls.color] ?? CLASS_COLORS.red;
                        const badgeColor = BADGE_COLORS[cls.color] ?? BADGE_COLORS.red;
                        return (
                          <button
                            key={cls.id}
                            onClick={() => toggleAttendance(cls.id)}
                            disabled={isCurrentlyToggling}
                            className={`w-full text-left rounded-lg border p-2 transition-all ${isAttending ? `${colorBorder} ring-1 ring-current` : 'border-[#222] bg-[#111] hover:border-[#333]'} ${isCurrentlyToggling ? 'opacity-60' : ''}`}
                          >
                            <div className="text-[11px] font-bold text-white leading-tight">{cls.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{cls.start_time} – {cls.end_time}</div>
                            {classAttendance.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {classAttendance.map(a => (
                                  <span
                                    key={a.user_name}
                                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white ${a.user_name === userName ? badgeColor : 'bg-[#333]'}`}
                                  >
                                    {a.user_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {classes.length > 0 && (
          <div className="mt-6 text-center text-xs text-gray-600">
            Klicke auf einen Kurs um dich ein- oder auszutragen.
          </div>
        )}
      </main>
    </div>
  );
}
