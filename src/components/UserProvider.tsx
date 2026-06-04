'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface UserCtx {
  userName: string;
  loading: boolean;
  refresh: () => void;
}

const UserContext = createContext<UserCtx>({ userName: '', loading: true, refresh: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserName(data.userName ?? '');
      } else {
        setUserName('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <UserContext.Provider value={{ userName, loading, refresh: load }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
