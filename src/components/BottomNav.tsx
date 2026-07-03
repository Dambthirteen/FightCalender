'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserProvider';

// Instagram-Style Tab-Leiste: Kalender · Startseite · Profil.
export default function BottomNav() {
  const pathname = usePathname();
  const { userName } = useUser();
  if (pathname === '/login') return null;

  const profileHref = `/profil/${encodeURIComponent(userName ?? '')}`;
  const tabs = [
    { href: '/', label: 'Kalender', icon: '/nav-calendar.png', active: pathname === '/' },
    { href: '/start', label: 'Startseite', icon: '/nav-home.png', active: pathname.startsWith('/start') },
    { href: profileHref, label: 'Profil', icon: '/nav-profile.png', active: pathname.startsWith('/profil') },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[900]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(10,10,12,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--border-soft)',
      }}>
      <div className="max-w-md mx-auto flex items-stretch pt-2.5 pb-1.5">
        {tabs.map((t) => (
          <a key={t.label} href={t.href}
            className="flex-1 flex flex-col items-center justify-end gap-1">
            {/* Aktiver Tab: leicht angehoben + leicht rund + Akzent-Glow */}
            <span className="grid place-items-center rounded-2xl transition-all duration-200"
              style={{
                width: 46, height: 40,
                transform: t.active ? 'translateY(-9px)' : 'none',
                background: t.active ? 'var(--accent-soft)' : 'transparent',
                border: t.active ? '1px solid rgba(255,59,48,0.35)' : '1px solid transparent',
                boxShadow: t.active ? '0 6px 16px rgba(255,59,48,0.28)' : 'none',
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.icon} alt="" className="w-7 h-7 object-contain" style={{ opacity: t.active ? 1 : 0.5 }} />
            </span>
            <span className="text-[10px] font-semibold tracking-wide"
              style={{ color: t.active ? 'var(--accent)' : 'var(--faint)', marginTop: t.active ? -6 : 0 }}>{t.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
