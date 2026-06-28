'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials, PALETTE } from '@/lib/avatar';
import { ARTS, SKILLS, BELT_COLORS, artLabel, artBelts, overallRating, type MartialArtEntry, type Skills } from '@/lib/fighter';
import { nextStreakBadge, STREAK_BADGES, COMPETITION_BADGES, JUDGE_BADGES, SPECIAL_BADGES, SECRET_BADGES } from '@/lib/badges';

interface BadgeInfo { id: string; label: string; emoji: string; kind: string; hint: string }
interface BadgeData { streakDays: number; streakWeeks: number; longest: number; competitions: number; earned: BadgeInfo[]; displayed: string[]; clanTag?: string | null; points?: number; adAvailable?: boolean }

// Championship-Belt: Clantag mittig (schwarz), 4 ausgestellte Badges auf den Achtecken.
// Gemessene Achteck-Zentren (% der Breite). Füll-Reihenfolge von INNEN nach außen,
// damit 1 Badge neben dem Clantag sitzt und 2 symmetrisch sind:
// inner-links · inner-rechts · outer-links · outer-rechts.
const BELT_SLOTS = [32, 67.9, 21.4, 78.6];
function Belt({ clanTag, badges, onBadge }: { clanTag: string | null; badges: BadgeInfo[]; onBadge?: (b: BadgeInfo) => void }) {
  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1400 / 319', containerType: 'inline-size' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/belt.png" alt="Championship Belt" className="w-full h-full object-contain pointer-events-none" />
      {clanTag && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: '49.8%', top: '48%' }}>
          <span className="font-display tracking-wide" style={{ color: '#1a1a1a', fontSize: '6.5cqw', lineHeight: 1 }}>{clanTag}</span>
        </div>
      )}
      {BELT_SLOTS.map((x, i) => badges[i] ? (
        <button key={i} type="button" onClick={() => onBadge?.(badges[i])} aria-label={badges[i].label}
          className="absolute -translate-x-1/2 -translate-y-1/2 active:scale-90 transition-transform"
          style={{ left: `${x}%`, top: '48%' }}>
          <span style={{ fontSize: '5.5cqw', lineHeight: 1, display: 'block' }}>{badges[i].emoji}</span>
        </button>
      ) : null)}
    </div>
  );
}

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

const TABS = [['fighter', 'Fighter'], ['ehrungen', 'Ehrungen'], ['pinnwand', 'Pinnwand']] as const;
type Tab = (typeof TABS)[number][0];

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
  const [tab, setTab] = useState<Tab>('fighter');
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [claimingAd, setClaimingAd] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [beltBadge, setBeltBadge] = useState<BadgeInfo | null>(null);
  const [editMode, setEditMode] = useState(false);

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
    fetch(`/api/badges?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => { if (d && !d.error && !d.private) setBadgeData(d); }).catch(() => {});
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

  // Werbung-Platzhalter: 1 Streak-Punkt (max. 1×/Woche).
  async function claimAdPoint() {
    if (!badgeData || claimingAd) return;
    setClaimingAd(true);
    try {
      const res = await fetch('/api/streak/ad-point', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setBadgeData({ ...badgeData, points: d.granted ? d.points : badgeData.points, adAvailable: false });
    } finally { setClaimingAd(false); }
  }

  // Bis zu 4 Abzeichen am Profil-Kopf ausstellen (nur eigenes Profil).
  async function toggleBadge(id: string) {
    if (!badgeData) return;
    const cur = badgeData.displayed;
    let next: string[];
    if (cur.includes(id)) next = cur.filter((x) => x !== id);
    else { if (cur.length >= 4) return; next = [...cur, id]; }
    setBadgeData({ ...badgeData, displayed: next });
    await fetch('/api/badges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badges: next }) }).catch(() => {});
  }

  const canInteract = !priv && !!userName;
  const displayedBadges = badgeData
    ? badgeData.displayed.map((id) => badgeData.earned.find((b) => b.id === id)).filter((b): b is BadgeInfo => !!b)
    : [];
  const nextBadge = badgeData ? nextStreakBadge(badgeData.streakWeeks) : null;
  const earnedSet = new Set(badgeData?.earned.map((b) => b.id) ?? []);
  const editing = isSelf && editMode; // Bearbeitungsmodus (Standard = Außenansicht)

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-2 flex items-center justify-between anim-in">
        <a href="/start" aria-label="Zurück" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-xl tracking-wide">{isSelf ? 'Mein Profil' : 'Profil'}</h1>
        {isSelf ? (
          <button onClick={() => setEditMode((v) => !v)}
            className="h-11 px-3 grid place-items-center rounded-xl border bg-[var(--surface)] text-xs font-semibold transition-all active:scale-95"
            style={editMode ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : { color: 'var(--muted)', borderColor: 'var(--border-soft)' }}>
            {editMode ? 'Fertig' : 'Bearbeiten'}
          </button>
        ) : <span className="w-11" />}
      </header>

      <main className="max-w-md mx-auto px-4 pb-24">
        {/* Identität */}
        <div className="flex flex-col items-center text-center anim-up pt-1">
          <button
            onClick={() => editing && fileRef.current?.click()}
            disabled={!editing || uploading}
            className="relative w-24 h-24 rounded-full mb-3 overflow-hidden grid place-items-center"
            style={{ background: avatar ? 'transparent' : `${c}22`, border: `2px solid ${c}`, boxShadow: `0 0 40px ${c}33` }}>
            {avatar
              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
              : <span className="font-display text-5xl" style={{ color: c }}>{initials(name)}</span>}
            {editing && (
              <span className="absolute bottom-0 inset-x-0 py-1 text-[10px] font-semibold text-white" style={{ background: 'rgba(0,0,0,0.55)' }}>
                {uploading ? '…' : '📷 Ändern'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <div className="font-display text-3xl tracking-wide">{name}</div>

          {/* Flamme */}
          {badgeData && badgeData.streakDays > 0 && (
            <div className="mt-2">
              <span className="chip" style={{ borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }}>
                🔥 {badgeData.streakDays} {badgeData.streakDays === 1 ? 'Tag' : 'Tage'}
              </span>
            </div>
          )}

          {/* Championship-Belt: Clantag + ausgestellte Badges */}
          <div className="w-full mt-3">
            <Belt clanTag={badgeData?.clanTag ?? null} badges={displayedBadges} onBadge={setBeltBadge} />
          </div>

          {/* Bio */}
          {editing ? (
            <div className="w-full max-w-xs mt-2">
              <textarea
                value={bioEdit} onChange={(e) => setBioEdit(e.target.value)} maxLength={300} rows={2}
                placeholder="Kurze Beschreibung über dich…"
                className="field resize-none text-center" />
              {bioEdit !== bio && (
                <button onClick={saveBio} disabled={savingBio} className="btn btn-primary mt-2 text-xs px-4 py-1.5">
                  {savingBio ? 'Speichern…' : 'Bio speichern'}
                </button>
              )}
            </div>
          ) : (
            bio && <p className="text-sm text-[var(--muted)] mt-2 max-w-xs">{bio}</p>
          )}
        </div>

        {priv ? (
          <div className="card p-7 text-center anim-up mt-6">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-display text-xl tracking-wide">Privates Profil</div>
            <p className="text-sm text-[var(--muted)] mt-1">Diese Person teilt ihr Profil nicht mit dir.</p>
          </div>
        ) : (
          <>
            {/* Kompakte Stats */}
            <div className="card mt-5 anim-up">
              <div className="grid grid-cols-3 divide-x divide-[var(--border-soft)]">
                {([
                  ['Macher d.M.', stats?.macherTitles, 'var(--gold)'],
                  ['Bitch d.M.', stats?.bitchTitles, 'var(--bitch)'],
                  ['Tage weg', stats?.daysOut, 'var(--teal)'],
                ] as const).map(([label, val, col]) => (
                  <div key={label} className="px-2 py-3 text-center">
                    <div className="font-display text-2xl tnum" style={{ color: col }}>{val ?? '–'}</div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-soft)] mt-5 mb-4">
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors"
                  style={{ color: tab === key ? 'var(--text)' : 'var(--faint)', borderColor: tab === key ? 'var(--accent)' : 'transparent' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* --- Tab: Fighter --- */}
            {tab === 'fighter' && (
              <div className="space-y-4 anim-in">
                {/* Abzeichen */}
                <div className="card px-4 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="section-label">Abzeichen</div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--accent-2)' }}>🔥 {badgeData?.streakDays ?? 0} {(badgeData?.streakDays ?? 0) === 1 ? 'Tag' : 'Tage'}</span>
                  </div>
                  <div className="text-[11px] text-[var(--faint)] mb-3">
                    {badgeData?.streakWeeks ?? 0} {(badgeData?.streakWeeks ?? 0) === 1 ? 'Woche' : 'Wochen'} am Stück · Rekord: {badgeData?.longest ?? 0} Tage
                  </div>
                  {isSelf && nextBadge && (
                    <div className="text-xs text-[var(--muted)] mb-3">
                      Noch {nextBadge.threshold - (badgeData?.streakWeeks ?? 0)} Wo. bis <strong>{nextBadge.emoji} {nextBadge.label}</strong>
                    </div>
                  )}
                  {isSelf && (
                    <div className="text-xs text-[var(--muted)] mb-3">
                      Streak-Punkte: <strong style={{ color: 'var(--text)' }}>{badgeData?.points ?? 0}</strong>
                      {badgeData?.adAvailable && (
                        <button onClick={claimAdPoint} disabled={claimingAd}
                          className="ml-2 text-[11px] font-semibold px-2 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40"
                          style={{ color: 'var(--accent-2)' }}>
                          {claimingAd ? '…' : 'Werbung'}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Volles Raster nur im Bearbeiten-Modus — sonst überlädt das Profil.
                      Ausgestellte Badges erscheinen ohnehin als Chips unter dem Namen. */}
                  {editing && (
                    badgeData && badgeData.earned.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {badgeData.earned.map((b) => {
                            const on = badgeData.displayed.includes(b.id);
                            const cls = 'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all active:scale-95';
                            const style = on
                              ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-2)' }
                              : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)' };
                            return (
                              <button key={b.id} onClick={() => toggleBadge(b.id)} className={cls} style={style}>
                                <span className="text-2xl leading-none">{b.emoji}</span>
                                <span className="text-[10px] font-semibold leading-tight">{b.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-[var(--faint)] mt-2">Tippe an, um bis zu 4 auszustellen</p>
                      </>
                    ) : (
                      <div className="text-sm text-[var(--faint)]">Noch keine Abzeichen — bleib dran.</div>
                    )
                  )}
                  {isSelf && (
                    <button onClick={() => setShowAllBadges(true)} className="mt-3 text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                      Alle Achievements anzeigen ›
                    </button>
                  )}
                </div>

                {/* Jahres-Punkte */}
                <div className="flex gap-2.5">
                  <Stat value={macherYear ?? '–'} label="Macher-Punkte (Jahr)" color="var(--gold)" />
                  <Stat value={bitchYear ?? '–'} label="Bitch-Punkte (Jahr)" color="var(--bitch)" />
                </div>

                {/* Kampfsport */}
                <div className="card px-4 py-4">
                  <div className="section-label mb-2.5">Kampfsport</div>
                  {editing ? (
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

                {/* Skilltree */}
                {(() => {
                  const rating = overallRating(skills);
                  return (
                    <div className="card px-4 py-4">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="section-label">Skills</div>
                        <div className="flex items-center gap-2">
                          {!isSelf && canInteract && !challengeOpen && (
                            <button onClick={openChallenge} className="text-[11px] font-semibold" style={{ color: 'var(--accent-2)' }}>⚔ anfechten</button>
                          )}
                          <span className="font-display text-base tracking-wide px-2.5 py-0.5 rounded-full"
                            style={{ color: rating.color, border: `1px solid ${rating.color}`, background: `${rating.color}1a` }}>
                            {rating.label}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {SKILLS.map((s) => {
                          const level = Math.round(Number(skills[s.key] ?? 0) / 20);
                          return (
                            <div key={s.key} className="flex items-center gap-3">
                              <span className="text-xs font-medium w-28 shrink-0">{s.label}</span>
                              <div className="flex gap-1 flex-1">
                                {[1, 2, 3, 4, 5].map((seg) => (
                                  <button key={seg} onClick={() => editing && setSkill(s.key, seg)} disabled={!editing}
                                    className="h-3 flex-1 rounded-sm transition-all"
                                    style={{ background: level >= seg ? c : 'var(--surface-2)', border: '1px solid var(--border-soft)', cursor: editing ? 'pointer' : 'default' }} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {editing && <p className="text-[10px] text-[var(--faint)] mt-3">Tippe die Balken (0–5).</p>}

                      {/* Anfechtung direkt am Skilltree */}
                      {!isSelf && challengeOpen && (
                        <div className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                          <div className="section-label mb-2.5">Dein Vorschlag (Level 0–5)</div>
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
                            placeholder="Begründung (optional)" className="field resize-none mt-3" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setChallengeOpen(false)} className="btn btn-ghost flex-1">Abbrechen</button>
                            <button onClick={submitChallenge} disabled={submittingChallenge} className="btn btn-primary flex-1">
                              {submittingChallenge ? '…' : 'Anfechtung senden'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Offene Anfechtungen (eigenes Profil) */}
                {isSelf && challenges.length > 0 && (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Anfechtungen ({challenges.length})</div>
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
              </div>
            )}

            {/* --- Tab: Ehrungen --- */}
            {tab === 'ehrungen' && (
              <div className="space-y-4 anim-in">
                {!isSelf && canInteract && (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Würdigung geben</div>
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
                          placeholder="Warum hat die Person es verdient?" className="field resize-none" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setPraiseKind(null); setPraiseReason(''); }} className="btn btn-ghost flex-1">Abbrechen</button>
                          <button onClick={givePraise} disabled={givingPraise}
                            className="flex-1 text-xs font-bold py-2.5 rounded-xl text-black disabled:opacity-40" style={{ background: praiseKind === 'gigalob' ? 'var(--accent)' : 'var(--gold)' }}>
                            {givingPraise ? '…' : 'Senden'}
                          </button>
                        </div>
                      </>
                    )}
                    {praiseMsg && <p className="text-xs mt-2 text-[var(--muted)]">{praiseMsg}</p>}
                    <p className="text-[10px] text-[var(--faint)] mt-2">Lob 1×/Woche · Gigalob 1×/Monat</p>
                  </div>
                )}

                {praises.length > 0 ? (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Ausgestellte Würdigungen</div>
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
                ) : (
                  <div className="card p-8 text-center text-sm text-[var(--faint)]">Noch keine ausgestellten Würdigungen.</div>
                )}
              </div>
            )}

            {/* --- Tab: Pinnwand (Kommentare) --- */}
            {tab === 'pinnwand' && (
              <div className="card px-4 py-4 anim-in">
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
                      placeholder="Kommentar schreiben…" className="field flex-1" />
                    <button onClick={postComment} disabled={postingComment || !newComment.trim()} className="btn btn-primary">
                      {postingComment ? '…' : 'Senden'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Eigene Einstellungen — nur im Bearbeiten-Modus */}
            {editing && (
              <div className="mt-7 space-y-3">
                <div className="card px-4 py-3">
                  <div className="section-label mb-2.5">Profilfarbe (im Kalender)</div>
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
                {isAdmin && (
                  <a href="/admin" className="card px-4 py-3 flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                    Admin-Bereich
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Badge-Detail (Klick auf ein Belt-Abzeichen) */}
      {beltBadge && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setBeltBadge(null); }}>
          <div className="card w-full max-w-xs p-6 text-center anim-pop">
            <div className="text-5xl mb-2">{beltBadge.emoji}</div>
            <div className="font-display text-2xl tracking-wide">{beltBadge.label}</div>
            <div className="text-sm text-[var(--muted)] mt-1">{beltBadge.hint}</div>
            <button onClick={() => setBeltBadge(null)} className="btn btn-ghost w-full mt-4">Schließen</button>
          </div>
        </div>
      )}

      {/* Alle Achievements — Übersicht (erreicht + gesperrt mit Bedingung) */}
      {showAllBadges && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6 anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAllBadges(false); }}>
          <div className="card w-full max-w-md max-h-[82vh] overflow-y-auto p-5 anim-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl tracking-wide">Alle Achievements</h2>
              <button onClick={() => setShowAllBadges(false)} className="text-[var(--faint)] hover:text-white text-lg px-1">✕</button>
            </div>
            {([['Streak', STREAK_BADGES], ['Wettkampf', COMPETITION_BADGES], ['Gericht', JUDGE_BADGES], ['Spezial', SPECIAL_BADGES], ['Geheim', SECRET_BADGES]] as const).map(([title, list]) => {
              const visible = list.filter((b) => !b.secret || earnedSet.has(b.id)); // geheime erst nach Freischalten
              if (visible.length === 0) return null;
              return (
              <div key={title} className="mb-4 last:mb-0">
                <div className="section-label mb-2">{title}</div>
                <div className="space-y-2">
                  {visible.map((b) => {
                    const got = earnedSet.has(b.id);
                    return (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border p-2.5"
                        style={got ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-2)' } : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}>
                        <span className="text-2xl leading-none" style={got ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }}>{b.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{b.label}</div>
                          <div className="text-[11px] text-[var(--muted)]">{b.hint}</div>
                        </div>
                        {got && <span className="text-sm font-bold" style={{ color: 'var(--good)' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
