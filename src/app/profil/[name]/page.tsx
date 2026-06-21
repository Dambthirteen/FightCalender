'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials, PALETTE } from '@/lib/avatar';
import { ARTS, SKILLS, BELT_COLORS, artLabel, artBelts, overallRating, type MartialArtEntry, type Skills } from '@/lib/fighter';

interface YearRow { user_name: string; total: number }

// Bild im Browser auf 256×256 (cover) verkleinern → JPEG-Data-URL.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Stat({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="card flex-1 min-w-0 px-2 py-3.5 text-center">
      <div className="font-display text-3xl tnum" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mt-1 leading-tight">{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const name = decodeURIComponent((params.name as string) ?? '');
  const { userName } = useUser();
  const isSelf = userName === name;

  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [bioEdit, setBioEdit] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [macherYear, setMacherYear] = useState<number | null>(null);
  const [bitchYear, setBitchYear] = useState<number | null>(null);
  const [stats, setStats] = useState<{ macherTitles: number; bitchTitles: number; daysOut: number } | null>(null);
  const [arts, setArts] = useState<MartialArtEntry[]>([]);
  const [skills, setSkills] = useState<Skills>({});
  const [priv, setPriv] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const c = colorFor(name, color);

  useEffect(() => {
    fetch(`/api/profile-info?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) {
        setPriv(d.private === true);
        setAvatar(d.avatar ?? null); setColor(d.color ?? null);
        if (!d.private) {
          setBio(d.bio ?? ''); setBioEdit(d.bio ?? '');
          setArts(Array.isArray(d.martial_arts) ? d.martial_arts : []);
          setSkills(d.skills && typeof d.skills === 'object' ? d.skills : {});
        }
      }
    }).catch(() => {});
    fetch(`/api/profile-stats?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) setStats(d);
    }).catch(() => {});
    fetch(`/api/year?year=${new Date().getFullYear()}`).then((r) => r.json()).then((d) => {
      setMacherYear((d.macher as YearRow[] | undefined)?.find((x) => x.user_name === name)?.total ?? 0);
      setBitchYear((d.bitch as YearRow[] | undefined)?.find((x) => x.user_name === name)?.total ?? 0);
    }).catch(() => {});
  }, [name]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch('/api/profile-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      if (res.ok) setAvatar(dataUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveBio() {
    setSavingBio(true);
    try {
      await fetch('/api/profile-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioEdit }),
      });
      setBio(bioEdit);
    } finally {
      setSavingBio(false);
    }
  }

  async function pickColor(col: string | null) {
    setColor(col);
    await fetch('/api/profile-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: col }),
    });
  }

  async function saveArts(next: MartialArtEntry[]) {
    setArts(next);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ martial_arts: next }) }).catch(() => {});
  }
  function toggleArt(key: string) {
    const exists = arts.some((m) => m.art === key);
    saveArts(exists ? arts.filter((m) => m.art !== key) : [...arts, { art: key, belt: null }]);
  }
  function setBelt(key: string, belt: string | null) {
    saveArts(arts.map((m) => (m.art === key ? { ...m, belt } : m)));
  }
  async function saveSkills(next: Skills) {
    setSkills(next);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: next }) }).catch(() => {});
  }
  function setSkill(key: string, level: number) {
    const cur = Number(skills[key as keyof Skills] ?? 0);
    const val = cur === level * 20 ? (level - 1) * 20 : level * 20; // gleichen Balken nochmal tippen → einen runter
    saveSkills({ ...skills, [key]: val });
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between anim-in">
        <a href="/start" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-2xl tracking-wide">{isSelf ? 'Mein Profil' : 'Profil'}</h1>
        <span className="w-11" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16 space-y-5">
        {/* Identity */}
        <div className="flex flex-col items-center text-center anim-up pt-2">
          <button
            onClick={() => isSelf && fileRef.current?.click()}
            disabled={!isSelf || uploading}
            className="relative w-28 h-28 rounded-full mb-3 overflow-hidden grid place-items-center"
            style={{ background: avatar ? 'transparent' : `${c}22`, border: `2px solid ${c}`, boxShadow: `0 0 44px ${c}33` }}>
            {avatar
              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
              : <span className="font-display text-6xl" style={{ color: c }}>{initials(name)}</span>}
            {isSelf && (
              <span className="absolute bottom-0 inset-x-0 py-1 text-[10px] font-semibold text-white" style={{ background: 'rgba(0,0,0,0.55)' }}>
                {uploading ? '…' : '📷 Ändern'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <div className="font-display text-3xl tracking-wide">{name}</div>

          {/* Bio */}
          {isSelf ? (
            <div className="w-full mt-3">
              <textarea
                value={bioEdit} onChange={(e) => setBioEdit(e.target.value)} maxLength={300} rows={2}
                placeholder="Kurze Beschreibung über dich…"
                className="w-full bg-[var(--surface-2)] border border-[var(--border-soft)] rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] resize-none text-center" />
              {bioEdit !== bio && (
                <button onClick={saveBio} disabled={savingBio}
                  className="mt-2 text-xs font-semibold px-4 py-1.5 rounded-lg text-white" style={{ background: 'var(--accent)' }}>
                  {savingBio ? 'Speichern…' : 'Bio speichern'}
                </button>
              )}
            </div>
          ) : (
            bio && <p className="text-sm text-[var(--muted)] mt-2 max-w-xs">{bio}</p>
          )}
        </div>

        {priv ? (
          <div className="card p-7 text-center anim-up">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-display text-xl tracking-wide">Privates Profil</div>
            <p className="text-sm text-[var(--muted)] mt-1">Diese Person teilt ihr Profil nicht mit dir.</p>
          </div>
        ) : (
          <>
        {/* Kampfsport */}
        {(
          <div className="card px-4 py-4 anim-up" style={{ animationDelay: '30ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Kampfsport</div>
            {isSelf ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {ARTS.map((a) => {
                    const active = arts.some((m) => m.art === a.key);
                    return (
                      <button key={a.key} onClick={() => toggleArt(a.key)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95"
                        style={active
                          ? { background: `${c}1f`, borderColor: c, color: '#fff' }
                          : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--muted)' }}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                {arts.filter((m) => artBelts(m.art)).map((m) => (
                  <div key={m.art} className="mt-3">
                    <div className="text-[11px] text-[var(--muted)] mb-1.5">{artLabel(m.art)} — Gürtel</div>
                    <div className="flex flex-wrap gap-1.5">
                      {artBelts(m.art)!.map((b) => (
                        <button key={b} onClick={() => setBelt(m.art, m.belt === b ? null : b)}
                          className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border transition-all"
                          style={{ borderColor: m.belt === b ? (BELT_COLORS[b] ?? c) : 'var(--border-soft)', background: m.belt === b ? `${BELT_COLORS[b] ?? c}22` : 'transparent', color: 'var(--text)' }}>
                          <span className="w-3 h-3 rounded-full" style={{ background: BELT_COLORS[b] ?? '#888', border: '1px solid rgba(255,255,255,0.2)' }} />
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : arts.length === 0 ? (
              <div className="text-sm text-[var(--faint)]">Noch keine Kampfsportart angegeben.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {arts.map((m) => (
                  <span key={m.art} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: `${c}1f`, border: `1px solid ${c}` }}>
                    {artLabel(m.art)}
                    {m.belt && <span className="flex items-center gap-1 opacity-90"><span className="w-2.5 h-2.5 rounded-full" style={{ background: BELT_COLORS[m.belt] ?? '#888' }} />{m.belt}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skilltree */}
        {(() => {
          const rating = overallRating(skills);
          return (
            <div className="card px-4 py-4 anim-up" style={{ animationDelay: '50ms' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Skills</div>
                <span className="font-display text-base tracking-wide px-2.5 py-0.5 rounded-full"
                  style={{ color: rating.color, border: `1px solid ${rating.color}`, background: `${rating.color}1a` }}>
                  {rating.label}
                </span>
              </div>
              <div className="space-y-2.5">
                {SKILLS.map((s) => {
                  const level = Math.round(Number(skills[s.key] ?? 0) / 20);
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 shrink-0">{s.label}</span>
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map((seg) => (
                          <button key={seg} onClick={() => isSelf && setSkill(s.key, seg)} disabled={!isSelf}
                            className="h-3 flex-1 rounded-sm transition-all"
                            style={{ background: level >= seg ? c : 'var(--surface-2)', border: '1px solid var(--border-soft)', cursor: isSelf ? 'pointer' : 'default' }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isSelf && <p className="text-[10px] text-[var(--faint)] mt-3">Tippe die Balken (0–5). Daraus ergibt sich dein Gesamtwert: Single Discipline → Allrounder.</p>}
            </div>
          );
        })()}

        {/* Color picker (self) */}
        {isSelf && (
          <div className="card px-4 py-3 anim-up" style={{ animationDelay: '40ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Deine Profilfarbe (im Kalender)</div>
            <div className="flex flex-wrap gap-2.5">
              {PALETTE.map((col) => (
                <button key={col} onClick={() => pickColor(col)}
                  className="w-8 h-8 rounded-full transition-transform active:scale-90"
                  style={{ background: col, outline: color === col ? '2px solid #fff' : 'none', outlineOffset: '2px' }} />
              ))}
              <button onClick={() => pickColor(null)} title="Automatisch"
                className="w-8 h-8 rounded-full grid place-items-center text-[10px] border border-[var(--border)] text-[var(--muted)]"
                style={{ outline: !color ? '2px solid #fff' : 'none', outlineOffset: '2px' }}>auto</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-2.5 anim-up" style={{ animationDelay: '80ms' }}>
          <Stat value={stats?.macherTitles ?? '–'} label="Macher d. Monats" color="var(--gold)" />
          <Stat value={stats?.bitchTitles ?? '–'} label="Bitch d. Monats" color="var(--bitch)" />
          <Stat value={stats?.daysOut ?? '–'} label="Tage ausgefallen" color="var(--teal)" />
        </div>
        <div className="flex gap-2.5 anim-up" style={{ animationDelay: '120ms' }}>
          <Stat value={macherYear ?? '–'} label="Macher-Punkte (Jahr)" color="var(--gold)" />
          <Stat value={bitchYear ?? '–'} label="Bitch-Punkte (Jahr)" color="var(--bitch)" />
        </div>
          </>
        )}

      </main>
    </div>
  );
}
