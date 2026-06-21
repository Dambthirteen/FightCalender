'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { getDaysInMonth } from 'date-fns';
import { useUser } from '@/components/UserProvider';

function isVotingWindow() {
  const now = new Date();
  return now.getDate() >= getDaysInMonth(now) - 2;
}

interface Item { icon: string; label: string; href: string; muted?: boolean; badge?: boolean }
interface Group { cat?: string; items: Item[] }

export default function NavMenu() {
  const { userName } = useUser();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [groupName, setGroupName] = useState('');
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string }) => g.id === d.current);
      if (cur) setGroupName(cur.name);
    }).catch(() => {});
  }, []);
  // Menü bei Routenwechsel schließen
  useEffect(() => setOpen(false), [pathname]);
  // Body-Scroll sperren, solange offen
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const me = encodeURIComponent(userName ?? '');
  const groups: Group[] = [
    { items: [
      { icon: '🏠', label: 'Gruppen', href: '/gruppen' },
      { icon: '👥', label: 'Mitglieder', href: '/mitglieder' },
    ] },
    {
      cat: 'Profil', items: [
        { icon: '👤', label: 'Mein Profil', href: `/profil/${me}` },
        { icon: '📋', label: 'Stundenplan ändern', href: '/?plan=1' },
        { icon: '🏥', label: 'Mein Status', href: '/account' },
        { icon: '🏆', label: 'Wettkämpfe', href: '/competitions' },
      ],
    },
    { cat: 'Statistiken', items: [{ icon: '📊', label: 'Statistiken', href: '/statistik' }] },
    { cat: 'Ausreden-Gericht', items: [{ icon: '🗳️', label: 'Ausreden-Gericht', href: '/vote', badge: true }] },
    { items: [{ icon: '⚙️', label: 'Admin', href: '/admin', muted: true }] },
  ];

  const panel = (
    <div className="fixed inset-0 z-[999] anim-in" style={{ transform: 'translateZ(0)' }} onClick={() => setOpen(false)}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div onClick={(e) => e.stopPropagation()}
        className="absolute right-3 w-[272px] max-h-[80vh] overflow-y-auto anim-pop"
        style={{
          top: 'calc(env(safe-area-inset-top) + 4.5rem)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--faint)' }}>Eingeloggt als</div>
          <div className="font-display text-xl tracking-wide">{userName}</div>
          {groupName && (
            <a href="/gruppen" className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--teal)' }}>
              <span>🏠</span> {groupName} <span style={{ color: 'var(--faint)' }}>· wechseln ›</span>
            </a>
          )}
        </div>

        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? 'border-t' : ''} style={{ borderColor: 'var(--border-soft)' }}>
            {g.cat && (
              <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--faint)' }}>{g.cat}</div>
            )}
            {g.items.map((it) => {
              const active = !it.href.includes('?') && pathname === it.href;
              const voting = it.badge && isVotingWindow();
              return (
                <a key={it.label} href={it.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                  style={{
                    color: voting ? 'var(--bitch)' : active ? 'var(--accent)' : it.muted ? 'var(--faint)' : 'var(--text)',
                    fontWeight: active ? 600 : 400,
                  }}>
                  <span>{it.icon}</span> {it.label}
                  {voting && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.16)', color: 'var(--bitch)' }}>offen</span>}
                  {active && !voting && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                </a>
              );
            })}
          </div>
        ))}

        <button onClick={logout}
          className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm border-t transition-colors hover:bg-[var(--accent-soft)]"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--faint)' }}>
          <span>🚪</span> Ausloggen
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menü"
        className="flex items-center justify-center w-11 h-11 rounded-xl border active:scale-95 transition-all"
        style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)', color: 'var(--muted)' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect y="2" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="14" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>
      {open && mounted && createPortal(panel, document.body)}
    </>
  );
}
