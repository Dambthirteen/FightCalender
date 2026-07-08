'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserProvider';

// Instagram-Style Tab-Leiste: Kalender · Startseite · Profil.
export default function BottomNav() {
  const pathname = usePathname();
  const { userName, onboardingCompleted } = useUser();
  if (pathname === '/login' || pathname.startsWith('/chat')) return null; // Chat = Vollbild mit eigenem Footer
  // Im Onboarding KEINE Tab-Leiste: sonst springt „Startseite" o.ä. sofort wieder auf /onboarding
  // zurück (Guard) und der Wizard startet bei Schritt 1 → Endlos-Loop. Wizard-Buttons führen selbst weiter.
  if (pathname === '/onboarding' || !onboardingCompleted) return null;

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
      <div className="max-w-md mx-auto flex items-stretch pt-2 pb-1">
        {tabs.map((t) => (
          <a key={t.label} href={t.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full py-1 active:opacity-80">
            {/* Freisteller direkt; aktiver Tab bekommt unten einen Akzent-Glow. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.icon} alt="" className="object-contain transition-all duration-200"
              style={{
                width: 26, height: 26,
                opacity: t.active ? 1 : 0.5,
                filter: t.active
                  ? 'drop-shadow(0 5px 6px rgba(255,59,48,0.85)) drop-shadow(0 2px 11px rgba(255,59,48,0.55))'
                  : 'none',
              }} />
            <span className="text-[10px] font-semibold tracking-wide"
              style={{ color: t.active ? 'var(--accent)' : 'var(--faint)' }}>{t.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
