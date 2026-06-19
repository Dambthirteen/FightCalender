'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import NavMenu from '@/components/NavMenu';
import NotificationsToggle from '@/components/NotificationsToggle';
import { userColor, initials } from '@/lib/avatar';

interface YearRow { user_name: string; total: number }

function Stat({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="card flex-1 px-3 py-4 text-center">
      <div className="font-display text-4xl tnum" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const name = decodeURIComponent((params.name as string) ?? '');
  const { userName } = useUser();
  const isSelf = userName === name;
  const c = userColor(name);

  const [macher, setMacher] = useState<number | null>(null);
  const [bitch, setBitch] = useState<number | null>(null);

  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`/api/year?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        const m = (d.macher as YearRow[] | undefined)?.find((x) => x.user_name === name);
        const b = (d.bitch as YearRow[] | undefined)?.find((x) => x.user_name === name);
        setMacher(m?.total ?? 0);
        setBitch(b?.total ?? 0);
      })
      .catch(() => { setMacher(0); setBitch(0); });
  }, [name]);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between anim-in">
        <a href="/mitglieder" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-2xl tracking-wide">{isSelf ? 'Mein Profil' : 'Profil'}</h1>
        <NavMenu />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16 space-y-5">
        {/* Identity */}
        <div className="flex flex-col items-center text-center anim-up pt-2">
          <span className="w-24 h-24 rounded-full grid place-items-center font-display text-5xl mb-3"
            style={{ background: `${c}22`, color: c, border: `2px solid ${c}`, boxShadow: `0 0 40px ${c}33` }}>
            {initials(name)}
          </span>
          <div className="font-display text-3xl tracking-wide">{name}</div>
          {isSelf && <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent)] mt-1">Das bist du</div>}
        </div>

        {/* Stats */}
        <div className="flex gap-3 anim-up" style={{ animationDelay: '60ms' }}>
          <Stat value={macher ?? '–'} label="Macher (Jahr)" color="var(--gold)" />
          <Stat value={bitch ?? '–'} label="Bitch (Jahr)" color="var(--bitch)" />
        </div>

        {/* Notification settings (self only) */}
        {isSelf && (
          <div className="anim-up" style={{ animationDelay: '120ms' }}>
            <NotificationsToggle />
          </div>
        )}

        {/* Coming soon */}
        <div className="card px-4 py-3 text-[12px] text-[var(--muted)] anim-up" style={{ animationDelay: '160ms' }}>
          🔧 In Kürze: Profilbild, Beschreibung, eigene Profilfarbe, sowie „X× Macher/Bitch des Monats" &amp; ausgefallene Tage.
        </div>
      </main>
    </div>
  );
}
