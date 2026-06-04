'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (tab === 'register' && password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      // Hard redirect so the browser sends the new session cookie fresh
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥊</div>
          <h1 className="text-2xl font-bold">Fight Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">NFT Köln</p>
        </div>

        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-[#1a1a1a]">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-white border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Name</label>
              <input
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors"
                placeholder="Dein Name..."
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Passwort</label>
              <input
                type="password"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors"
                placeholder="Passwort..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            {tab === 'register' && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Passwort wiederholen</label>
                <input
                  type="password"
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-600 transition-colors"
                  placeholder="Passwort wiederholen..."
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-600/10 border border-red-600/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading || !userName.trim() || !password}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? '...' : tab === 'login' ? 'Anmelden' : 'Account erstellen'}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-700 mt-4">
          {tab === 'login' ? 'Noch kein Account?' : 'Schon registriert?'}{' '}
          <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }} className="text-gray-500 hover:text-white transition-colors underline">
            {tab === 'login' ? 'Registrieren' : 'Anmelden'}
          </button>
        </p>
      </div>
    </div>
  );
}
