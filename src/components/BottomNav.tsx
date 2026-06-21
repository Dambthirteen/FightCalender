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
    { href: '/', label: 'Kalender', emoji: '🗓️', active: pathname === '/' },
    { href: '/start', label: 'Startseite', emoji: '🏠', active: pathname.startsWith('/start') },
    { href: profileHref, label: 'Profil', emoji: '👤', active: pathname.startsWith('/profil') },
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
      <div className="max-w-md mx-auto flex items-stretch">
        {tabs.map((t) => (
          <a key={t.label} href={t.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: t.active ? 'var(--accent)' : 'var(--faint)' }}>
            <span className="text-xl leading-none" style={{ filter: t.active ? 'none' : 'grayscale(0.5)', opacity: t.active ? 1 : 0.75 }}>{t.emoji}</span>
            <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
