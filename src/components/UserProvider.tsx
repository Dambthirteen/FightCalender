'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { identify } from '@/lib/analytics';

interface UserCtx {
  userName: string;
  loading: boolean;
  onboardingCompleted: boolean;
  refresh: () => void;
}

const UserContext = createContext<UserCtx>({ userName: '', loading: true, onboardingCompleted: true, refresh: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const pathname = usePathname();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserName(data.userName ?? '');
        setOnboardingCompleted(data.onboardingCompleted !== false);
        if (data.userName) identify(data.userName);
      } else {
        setUserName('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Neue Nutzer erst durch den Onboarding-Assistenten leiten (Loop-Schutz: nicht auf
  // /onboarding oder /login umleiten).
  useEffect(() => {
    if (loading || !userName || onboardingCompleted) return;
    if (pathname === '/onboarding' || pathname === '/login') return;
    window.location.href = '/onboarding';
  }, [loading, userName, onboardingCompleted, pathname]);

  return (
    <UserContext.Provider value={{ userName, loading, onboardingCompleted, refresh: load }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
