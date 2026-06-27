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

  // Kommentare, Skilltree-Anfechtungen, Lob/Gigalob
  const [comments, setComments] = useState<{ id: number; author_name: string; body: string; created_at: string }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [challenges, setChallenges] = useState<{ id: number; challenger_name: string; proposal: Record<string, number>; note: string; created_at: string }[]>([]);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [proposal, setProposal] = useState<Record<string, number>>({});
  const [challengeNote, setChallengeNote] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [praises, setPraises] = useState<{ id: number; kind: string; from_user: string; reason: string; show_comment: boolean; created_at: string }[]>([]);
  const [praiseStatus, setPraiseStatus] = useState<{ lob: boolean; gigalob: boolean }>({ lob: false, gigalob: false });
  const [praiseKind, setPraiseKind] = useState<'lob' | 'gigalob' | null>(null);
  const [praiseReason, setPraiseReason] = useState('');
  const [givingPraise, setGivingPraise] = useState(false);
  const [praiseMsg, setPraiseMsg] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

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
    fetch(`/api/comments?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setComments(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/challenges?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setChallenges(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/praise?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setPraises(Array.isArray(d) ? d : [])).catch(() => {});
  }, [name]);

  // Lob/Gigalob-Verfügbarkeit des Betrachters (für die Buttons auf fremden Profilen)
  useEffect(() => {
    if (!userName || userName === name) return;
    fetch('/api/praise/status').then((r) => r.json()).then((d) => setPraiseStatus({ lob: !!d.lob, gigalob: !!d.gigalob })).catch(() => {});
  }, [userName, name]);

  // Admin-Zugang nur auf dem EIGENEN Profil eines Admins (sonst nirgends sichtbar).
  useEffect(() => {
    if (!isSelf) return;
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const groups = (d.groups ?? []) as { role: string }[];
      setIsAdmin(groups.some((g) => g.role === 'admin'));
    }).catch(() => {});
  }, [isSelf]);

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

  // --- Kommentare ---
  async function postComment() {
    const text = newComment.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: name, body: text }),
      });
      if (res.ok) { const cm = await res.json(); setComments((prev) => [...prev, cm]); setNewComment(''); }
    } finally { setPostingComment(false); }
  }
  async function deleteComment(id: number) {
    await fetch('/api/comments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    setComments((prev) => prev.filter((cm) => cm.id !== id));
  }

  // --- Skilltree anfechten ---
  function openChallenge() {
    const init: Record<string, number> = {};
    for (const s of SKILLS) init[s.key] = Math.round(Number(skills[s.key] ?? 0) / 20);
    setProposal(init); setChallengeNote(''); setChallengeOpen(true);
  }
  async function submitChallenge() {
    if (submittingChallenge) return;
    const changed: Record<string, number> = {};
    for (const s of SKILLS) {
      const cur = Math.round(Number(skills[s.key] ?? 0) / 20);
      if (proposal[s.key] !== cur) changed[s.key] = proposal[s.key];
    }
    if (Object.keys(changed).length === 0) { setChallengeOpen(false); return; }
    setSubmittingChallenge(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: name, proposal: changed, note: challengeNote }),
      });
      if (res.ok) setChallengeOpen(false);
    } finally { setSubmittingChallenge(false); }
  }
  async function resolveChallenge(id: number, action: 'accept' | 'reject') {
    const res = await fetch(`/api/challenges/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setChallenges((prev) => prev.filter((ch) => ch.id !== id));
      if (action === 'accept') {
        fetch(`/api/profile-info?user=${encodeURIComponent(name)}`).then((r) => r.json())
          .then((d) => { if (d && !d.error && d.skills) setSkills(d.skills); }).catch(() => {});
      }
    }
  }

  // --- Lob / Gigalob vergeben ---
  async function givePraise() {
    if (!praiseKind || givingPraise) return;
    setGivingPraise(true); setPraiseMsg('');
    try {
      const res = await fetch('/api/praise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: name, kind: praiseKind, reason: praiseReason }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPraiseStatus((s) => (praiseKind === 'gigalob' ? { ...s, gigalob: false } : { ...s, lob: false }));
        setPraiseKind(null); setPraiseReason(''); setPraiseMsg('Gesendet!');
      } else {
        setPraiseMsg(d.error ?? 'Fehler');
      }
    } finally { setGivingPraise(false); }
  }

  const canInteract = !priv && !!userName;

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

        {/* Skilltree anfechten (fremdes Profil) */}
        {!isSelf && canInteract && (
          <div className="card px-4 py-4 anim-up" style={{ animationDelay: '55ms' }}>
            {!challengeOpen ? (
              <button onClick={openChallenge}
                className="w-full text-sm font-semibold py-2.5 rounded-xl border transition-colors active:scale-[0.99]"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                Skilltree anfechten
              </button>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Dein Vorschlag (Level 0–5)</div>
                <div className="space-y-2.5">
                  {SKILLS.map((s) => {
                    const lvl = proposal[s.key] ?? 0;
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-28 shrink-0">{s.label}</span>
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3, 4, 5].map((seg) => (
                            <button key={seg}
                              onClick={() => setProposal((p) => ({ ...p, [s.key]: (p[s.key] ?? 0) === seg ? seg - 1 : seg }))}
                              className="h-3 flex-1 rounded-sm transition-all"
                              style={{ background: lvl >= seg ? c : 'var(--surface-2)', border: '1px solid var(--border-soft)' }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <textarea value={challengeNote} onChange={(e) => setChallengeNote(e.target.value)} rows={2} maxLength={300}
                  placeholder="Begründung (z. B. beim Striking eher 2, Wrestling 2 statt 3)"
                  className="mt-3 w-full bg-[var(--surface-2)] border border-[var(--border-soft)] rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] resize-none" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setChallengeOpen(false)} className="flex-1 text-xs font-semibold py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)]">Abbrechen</button>
                  <button onClick={submitChallenge} disabled={submittingChallenge}
                    className="flex-1 text-xs font-bold py-2.5 rounded-xl text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                    {submittingChallenge ? '…' : 'Anfechtung senden'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Offene Anfechtungen (eigenes Profil) — Übernehmen/Ablehnen */}
        {isSelf && challenges.length > 0 && (
          <div className="card px-4 py-4 anim-up" style={{ animationDelay: '55ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Anfechtungen ({challenges.length})</div>
            <div className="space-y-3">
              {challenges.map((ch) => (
                <div key={ch.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-sm font-semibold mb-1.5">{ch.challenger_name} schlägt vor:</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(ch.proposal).map(([k, v]) => {
                      const cur = Math.round(Number(skills[k as keyof Skills] ?? 0) / 20);
                      const label = SKILLS.find((s) => s.key === k)?.label ?? k;
                      return (
                        <span key={k} className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)]">
                          {label}: <span className="text-[var(--faint)]">{cur}</span> → <strong style={{ color: c }}>{v}</strong>
                        </span>
                      );
                    })}
                  </div>
                  {ch.note && <p className="text-xs text-[var(--muted)] italic mb-2">„{ch.note}“</p>}
                  <div className="flex gap-2">
                    <button onClick={() => resolveChallenge(ch.id, 'accept')} className="flex-1 text-xs font-bold py-2 rounded-lg text-black" style={{ background: 'var(--good)' }}>Übernehmen</button>
                    <button onClick={() => resolveChallenge(ch.id, 'reject')} className="flex-1 text-xs font-bold py-2 rounded-lg border border-[var(--border)] text-[var(--muted)]">Ablehnen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lob / Gigalob vergeben (fremdes Profil) */}
        {!isSelf && canInteract && (
          <div className="card px-4 py-4 anim-up" style={{ animationDelay: '60ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Würdigung</div>
            {praiseKind === null ? (
              <div className="flex gap-2">
                <button onClick={() => setPraiseKind('lob')} disabled={!praiseStatus.lob}
                  className="flex-1 text-sm font-bold py-2.5 rounded-xl border disabled:opacity-40"
                  style={{ background: 'rgba(255,194,75,0.12)', borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                  Lob
                </button>
                <button onClick={() => setPraiseKind('gigalob')} disabled={!praiseStatus.gigalob}
                  className="flex-1 text-sm font-bold py-2.5 rounded-xl border disabled:opacity-40"
                  style={{ background: 'rgba(255,59,48,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  Gigalob
                </button>
              </div>
            ) : (
              <>
                <div className="text-sm font-semibold mb-2">{praiseKind === 'gigalob' ? 'Gigalob' : 'Lob'} an {name}</div>
                <textarea value={praiseReason} onChange={(e) => setPraiseReason(e.target.value)} rows={2} maxLength={300}
                  placeholder="Warum hat die Person es verdient?"
                  className="w-full bg-[var(--surface-2)] border border-[var(--border-soft)] rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] resize-none" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setPraiseKind(null); setPraiseReason(''); }} className="flex-1 text-xs font-semibold py-2.5 rounded-xl border border-[var(--border)] text-[var(--muted)]">Abbrechen</button>
                  <button onClick={givePraise} disabled={givingPraise}
                    className="flex-1 text-xs font-bold py-2.5 rounded-xl text-black disabled:opacity-40" style={{ background: praiseKind === 'gigalob' ? 'var(--accent)' : 'var(--gold)' }}>
                    {givingPraise ? '…' : 'Senden'}
                  </button>
                </div>
              </>
            )}
            {praiseMsg && <p className="text-xs mt-2 text-[var(--muted)]">{praiseMsg}</p>}
            <p className="text-[10px] text-[var(--faint)] mt-2">
              Lob: 1×/Woche {praiseStatus.lob ? '· frei' : '· diese Woche vergeben'} &nbsp;·&nbsp; Gigalob: 1×/Monat {praiseStatus.gigalob ? '· frei' : '· diesen Monat vergeben'}
            </p>
          </div>
        )}

        {/* Ausgestellte Würdigungen (Showcase) */}
        {praises.length > 0 && (
          <div className="card px-4 py-4 anim-up" style={{ animationDelay: '65ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Ausgestellte Würdigungen</div>
            <div className="space-y-2">
              {praises.map((p) => (
                <div key={p.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-sm font-semibold">
                    {p.kind === 'gigalob' ? 'Gigalob' : 'Lob'} <span className="text-[var(--muted)] font-normal">von {p.from_user}</span>
                  </div>
                  {p.show_comment && p.reason && <p className="text-xs text-[var(--muted)] italic mt-1">„{p.reason}“</p>}
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Admin-Zugang — nur auf dem eigenen Profil eines Admins */}
        {isSelf && isAdmin && (
          <a href="/admin"
            className="card px-4 py-3 anim-up flex items-center gap-2.5 text-sm font-semibold active:scale-[0.99]"
            style={{ animationDelay: '90ms', color: 'var(--muted)' }}>
            Admin-Bereich
          </a>
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

        {/* Kommentare */}
        <div className="card px-4 py-4 anim-up" style={{ animationDelay: '140ms' }}>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-3">Kommentare ({comments.length})</div>
          {comments.length === 0 ? (
            <div className="text-sm text-[var(--faint)] mb-3">Noch keine Kommentare.</div>
          ) : (
            <div className="space-y-2.5 mb-3">
              {comments.map((cm) => (
                <div key={cm.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <a href={`/profil/${encodeURIComponent(cm.author_name)}`} className="text-xs font-semibold" style={{ color: c }}>{cm.author_name}</a>
                    {(cm.author_name === userName || isSelf) && (
                      <button onClick={() => deleteComment(cm.id)} className="text-[var(--faint)] hover:text-[var(--accent)] text-xs px-1">✕</button>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text)] mt-1 whitespace-pre-wrap break-words">{cm.body}</p>
                </div>
              ))}
            </div>
          )}
          {canInteract && (
            <div className="flex gap-2">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} maxLength={500}
                onKeyDown={(e) => e.key === 'Enter' && postComment()}
                placeholder="Kommentar schreiben…"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-soft)] rounded-xl px-3 py-2 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]" />
              <button onClick={postComment} disabled={postingComment || !newComment.trim()}
                className="text-xs font-bold px-4 rounded-xl text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                {postingComment ? '…' : 'Senden'}
              </button>
            </div>
          )}
        </div>
          </>
        )}

      </main>
    </div>
  );
}
