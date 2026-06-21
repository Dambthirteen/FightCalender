'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';

const OPTIONS = [
  { key: 'public', icon: '🌍', label: 'Öffentlich', desc: 'Jeder eingeloggte Nutzer kann dein Profil sehen.' },
  { key: 'group', icon: '👥', label: 'Nur Gruppe', desc: 'Nur Mitglieder einer ausgewählten Gruppe.' },
  { key: 'private', icon: '🔒', label: 'Privat', desc: 'Nur du siehst dein Profil.' },
];

export default function ProfileVisibility() {
  const { userName } = useUser();
  const [vis, setVis] = useState('public');
  const [grp, setGrp] = useState<number | null>(null);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!userName) return;
    fetch(`/api/profile-info?user=${encodeURIComponent(userName)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) { setVis(d.profile_visibility ?? 'public'); setGrp(d.profile_visibility_group ?? null); }
    }).catch(() => {});
    fetch('/api/groups').then((r) => r.json()).then((d) => setGroups(Array.isArray(d.groups) ? d.groups : [])).catch(() => {});
  }, [userName]);

  async function save(v: string, g: number | null) {
    setVis(v); setGrp(g);
    await fetch('/api/profile-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_visibility: v, profile_visibility_group: g }),
    }).catch(() => {});
  }

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide mb-1">🔒 Profil-Sichtbarkeit</h2>
      <p className="text-sm text-[var(--muted)] mb-4">Wer darf dein Profil sehen (Bild, Bio, Gürtel, Skilltree, Statistik)?</p>
      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const active = vis === o.key;
          return (
            <button key={o.key} onClick={() => save(o.key, o.key === 'group' ? (grp ?? groups[0]?.id ?? null) : null)}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.99]"
              style={{ borderColor: active ? 'var(--accent)' : 'var(--border-soft)', background: active ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
              <span className="text-lg">{o.icon}</span>
              <span>
                <span className="text-sm font-semibold block">{o.label}</span>
                <span className="text-xs text-[var(--muted)]">{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {vis === 'group' && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5">Welche Gruppe?</div>
          <select value={grp ?? ''} onChange={(e) => save('group', e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]">
            {groups.length === 0 && <option value="">Keine Gruppe</option>}
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}
    </section>
  );
}
