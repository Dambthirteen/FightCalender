'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { ARTS, SKILLS, artBelts } from '@/lib/fighter';
import { GENDERS, competitorLabel } from '@/lib/gender';
import { PALETTE, initials, colorFor } from '@/lib/avatar';
import { track } from '@/lib/analytics';

// Bild im Browser auf 256×256 (cover) verkleinern → JPEG-Data-URL (wie im Profil).
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
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

type Step = 'profile' | 'group' | 'invite' | 'referral';

export default function OnboardingPage() {
  const { userName, loading, onboardingCompleted } = useUser();
  const [step, setStep] = useState<Step>('profile');

  // Profil
  const [avatar, setAvatar] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [role, setRole] = useState<'fighter' | 'coach' | 'both'>('fighter');
  const [athlete, setAthlete] = useState<'hobby' | 'competitor'>('competitor');
  const [gender, setGender] = useState<'m' | 'f' | 'd' | ''>('');
  const [trainingSince, setTrainingSince] = useState('');
  const [coachingSince, setCoachingSince] = useState('');
  const [coachingArts, setCoachingArts] = useState<string[]>([]);
  const [arts, setArts] = useState<Record<string, string | null>>({}); // artKey -> Gürtel|null
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Gruppe
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Nach dem Crew-Erstellen: direkt einladen.
  const [createdCode, setCreatedCode] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  // Werber-Frage (letzter Schritt)
  const [refYes, setRefYes] = useState<boolean | null>(null);
  const [refEmail, setRefEmail] = useState('');
  const [refSaving, setRefSaving] = useState(false);

  // Wer schon fertig ist, hat hier nichts zu suchen.
  useEffect(() => {
    if (!loading && onboardingCompleted) window.location.href = '/';
  }, [loading, onboardingCompleted]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { setAvatar(await resizeImage(file)); }
    catch { /* ignorieren */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  function toggleArt(key: string) {
    setArts(prev => {
      const next = { ...prev };
      if (key in next) delete next[key]; else next[key] = null;
      return next;
    });
  }

  const isCoachRole = role === 'coach' || role === 'both';
  function toggleCoachingArt(key: string) {
    setCoachingArts(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);
  }

  async function saveProfileAndNext() {
    setSavingProfile(true);
    try {
      const martial_arts = Object.entries(arts).map(([art, belt]) => ({ art, belt }));
      const fighter_info = {
        role,
        athlete,
        ...(gender ? { gender } : {}),
        ...(trainingSince ? { trainingSince } : {}),
        ...(isCoachRole && coachingSince ? { coachingSince } : {}),
        ...(isCoachRole && coachingArts.length ? { coachingArts } : {}),
      };
      await fetch('/api/profile-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar, color, martial_arts, skills, fighter_info }),
      });
    } catch { /* nicht blockieren — Profil kann man später ergänzen */ }
    finally { setSavingProfile(false); setStep('group'); }
  }

  // Abschluss-Trigger führen jetzt zuerst zur Werber-Frage (letzter Wizard-Schritt).
  function finish() { setStep('referral'); }

  async function completeOnboarding() {
    if (refSaving) return;
    setRefSaving(true);
    track('onboarding_completed');
    const referrerEmail = refYes && refEmail.trim() ? refEmail.trim() : undefined;
    try {
      await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerEmail }),
      });
    } catch { /* egal */ }
    window.location.href = '/';
  }

  async function createGroup() {
    if (!name.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { track('group_created', { via: 'onboarding' }); setCreatedCode(d.invite_code ?? ''); setStep('invite'); return; }
      setMsg(d.error ?? 'Konnte Gruppe nicht erstellen.');
    } finally { setBusy(false); }
  }

  function inviteUrl() { return `${window.location.origin}/join?code=${createdCode}`; }
  async function shareInvite() {
    setInviteMsg('');
    track('invite_shared', { method: 'share', via: 'onboarding' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Tap In', text: 'Komm in unsere Crew!', url: inviteUrl() }); } catch { /* abgebrochen */ }
    } else {
      try { await navigator.clipboard.writeText(inviteUrl()); setInviteMsg('Link kopiert.'); } catch {}
    }
  }
  async function copyInvite() {
    track('invite_shared', { method: 'copy', via: 'onboarding' });
    try { await navigator.clipboard.writeText(inviteUrl()); setInviteMsg('Link kopiert.'); } catch {}
  }
  async function toggleQr() {
    if (showQr) { setShowQr(false); return; }
    track('invite_shared', { method: 'qr', via: 'onboarding' });
    try {
      const QRCode = (await import('qrcode')).default;
      setQrUrl(await QRCode.toDataURL(inviteUrl(), { width: 240, margin: 1, color: { dark: '#0a0a0c', light: '#ffffff' } }));
      setShowQr(true);
    } catch { /* egal */ }
  }

  async function joinGroup() {
    if (!code.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'active') { track('group_joined', { via: 'onboarding', status: 'active' }); await finish(); return; }
      if (res.ok) { track('group_joined', { via: 'onboarding', status: 'pending' }); setMsg(`Anfrage an „${d.group}" gesendet — ein Admin muss dich annehmen. Du kannst schon fortfahren.`); return; }
      setMsg(d.error ?? 'Code ungültig.');
    } finally { setBusy(false); }
  }

  const displayColor = colorFor(userName || '?', color);
  const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Fortschritt */}
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--accent)' }} />
          <div className="h-1 flex-1 rounded-full" style={{ background: step !== 'profile' ? 'var(--accent)' : 'var(--surface-2)' }} />
        </div>

        {step === 'profile' ? (
          <>
            <div>
              <h1 className="font-display text-3xl tracking-wide">Willkommen{userName ? `, ${userName}` : ''}!</h1>
              <p className="text-[var(--muted)] text-sm mt-1">Richte kurz dein Profil ein — alles später änderbar.</p>
            </div>

            {/* Avatar + Farbe */}
            <section className="card p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full grid place-items-center overflow-hidden shrink-0 font-display text-3xl"
                  style={{ background: avatar ? 'transparent' : `${displayColor}22`, color: displayColor, border: `2px solid ${displayColor}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : initials(userName || '?')}
                </div>
                <div className="min-w-0">
                  <label className="inline-block text-sm font-semibold px-3 py-2 rounded-xl border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                    {uploading ? 'Lädt…' : avatar ? 'Bild ändern' : 'Profilbild wählen'}
                    <input type="file" accept="image/*" hidden onChange={onPickImage} />
                  </label>
                  {avatar && <button onClick={() => setAvatar(null)} className="ml-2 text-xs text-[var(--faint)] hover:text-[var(--accent)]">entfernen</button>}
                </div>
              </div>
              <div>
                <div className="section-label mb-2">Deine Farbe</div>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setColor(c === color ? null : c)} aria-label={`Farbe ${c}`}
                      className="w-8 h-8 rounded-full active:scale-90 transition-transform"
                      style={{ background: c, outline: color === c ? '2px solid #fff' : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
              </div>
            </section>

            {/* Rolle & Erfahrung */}
            <section className="card p-5 space-y-4">
              <div>
                <div className="section-label mb-2">Ich bin…</div>
                <div className="flex gap-2">
                  {([['fighter', '🥊 Fighter'], ['coach', '🎓 Coach'], ['both', 'Beides']] as const).map(([key, label]) => {
                    const on = role === key;
                    return (
                      <button key={key} onClick={() => setRole(key)}
                        className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                        style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="section-label mb-2">Typ</div>
                <div className="flex gap-2">
                  {([['hobby', 'Hobby'], ['competitor', competitorLabel(gender || undefined)]] as const).map(([key, label]) => {
                    const on = athlete === key;
                    return (
                      <button key={key} onClick={() => setAthlete(key)}
                        className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                        style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="section-label mb-2">Geschlecht</div>
                <div className="flex gap-2">
                  {GENDERS.map(g => {
                    const on = gender === g.key;
                    return (
                      <button key={g.key} onClick={() => setGender(g.key)}
                        className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                        style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                        {g.short} {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="section-label mb-2">Trainiert seit (optional)</div>
                <input type="month" value={trainingSince} max={new Date().toISOString().slice(0, 7)} onChange={e => setTrainingSince(e.target.value)} className={inputCls} />
              </div>
              {isCoachRole && (
                <>
                  <div>
                    <div className="section-label mb-2">Trainer seit (optional)</div>
                    <input type="month" value={coachingSince} max={new Date().toISOString().slice(0, 7)} onChange={e => setCoachingSince(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <div className="section-label mb-2">Trainer-Fächer</div>
                    <div className="flex flex-wrap gap-2">
                      {ARTS.map(a => {
                        const on = coachingArts.includes(a.key);
                        return (
                          <button key={a.key} onClick={() => toggleCoachingArt(a.key)}
                            className="text-sm px-3 py-1.5 rounded-full border transition-colors"
                            style={on ? { borderColor: 'var(--teal)', background: 'rgba(45,212,191,0.14)', color: 'var(--teal)' } : { borderColor: 'var(--border)', background: 'transparent', color: 'var(--muted)' }}>
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Kampfsportarten */}
            <section className="card p-5">
              <div className="section-label mb-3">Kampfsportarten</div>
              <div className="flex flex-wrap gap-2">
                {ARTS.map(a => {
                  const on = a.key in arts;
                  return (
                    <button key={a.key} onClick={() => toggleArt(a.key)}
                      className="text-sm px-3 py-1.5 rounded-full border transition-colors"
                      style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)' }}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
              {/* Gürtel für gewählte Arten mit Gürtelsystem */}
              {Object.keys(arts).some(k => artBelts(k)) && (
                <div className="mt-4 space-y-2">
                  {Object.keys(arts).filter(k => artBelts(k)).map(k => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{ARTS.find(a => a.key === k)?.label}</span>
                      <select value={arts[k] ?? ''} onChange={e => setArts(prev => ({ ...prev, [k]: e.target.value || null }))}
                        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]">
                        <option value="">Gürtel…</option>
                        {(artBelts(k) ?? []).map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Skills */}
            <section className="card p-5">
              <div className="section-label mb-3">Skills (optional)</div>
              <div className="space-y-3">
                {SKILLS.map(s => (
                  <div key={s.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{s.label}</span>
                      <span className="text-[var(--faint)] tnum">{Math.round((skills[s.key] ?? 0) / 20)}/5</span>
                    </div>
                    <input type="range" min={0} max={100} step={20} value={skills[s.key] ?? 0}
                      onChange={e => setSkills(prev => ({ ...prev, [s.key]: Number(e.target.value) }))}
                      className="w-full" style={{ accentColor: 'var(--accent)' }} />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-2">
              <button onClick={saveProfileAndNext} disabled={savingProfile}
                className="flex-1 text-white font-bold py-3 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                {savingProfile ? 'Speichern…' : 'Weiter'}
              </button>
              <button onClick={() => setStep('group')} className="px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm">Überspringen</button>
            </div>
          </>
        ) : step === 'group' ? (
          <>
            <div>
              <button onClick={() => { setStep('profile'); setMsg(''); }} className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Zurück</button>
              <h1 className="font-display text-3xl tracking-wide mt-2">Deine Crew</h1>
              <p className="text-[var(--muted)] text-sm mt-1">Erstelle eine Gruppe oder tritt einer bei. Geht auch später.</p>
            </div>

            <section className="card p-5">
              <div className="section-label mb-2">Neue Gruppe erstellen</div>
              <div className="flex gap-2">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (z.B. deine Crew)…" className={inputCls} />
                <button onClick={createGroup} disabled={busy || !name.trim()} className="text-white font-bold px-4 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>Erstellen</button>
              </div>
            </section>

            <section className="card p-5">
              <div className="section-label mb-2">Mit Einladungscode beitreten</div>
              <div className="flex gap-2">
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={12} className={`${inputCls} tracking-widest font-mono`} />
                <button onClick={joinGroup} disabled={busy || !code.trim()} className="font-semibold px-4 rounded-xl border border-[var(--border)] text-[var(--text)] disabled:opacity-40">Beitreten</button>
              </div>
            </section>

            {msg && <p className="text-sm text-center" style={{ color: 'var(--teal)' }}>{msg}</p>}

            <button onClick={finish} disabled={busy} className="w-full text-center text-sm text-[var(--muted)] hover:text-white transition-colors py-2">
              Erstmal ohne Gruppe fortfahren →
            </button>
          </>
        ) : step === 'invite' ? (
          <>
            <div>
              <h1 className="font-display text-3xl tracking-wide">Crew steht!</h1>
              <p className="text-[var(--muted)] text-sm mt-1">Lad deine Leute ein — mit einem Tap sind sie dabei.</p>
            </div>
            <section className="card p-5">
              <div className="flex gap-2">
                <button onClick={shareInvite} className="flex-1 text-white font-bold py-2.5 rounded-xl" style={{ background: 'var(--accent)' }}>Einladung teilen</button>
                <button onClick={copyInvite} className="px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm">Link kopieren</button>
              </div>
              <div className="text-center text-[11px] text-[var(--faint)] mt-3 font-mono tracking-widest">Code: {createdCode}</div>
              <button onClick={toggleQr} className="w-full mt-2 text-xs text-[var(--muted)] hover:text-white transition-colors">
                {showQr ? 'QR-Code ausblenden' : 'QR-Code zum Scannen'}
              </button>
              {showQr && qrUrl && (
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="Einladungs-QR-Code" width={200} height={200} className="rounded-xl" style={{ background: '#fff', padding: 10 }} />
                </div>
              )}
              {inviteMsg && <p className="text-xs mt-2 text-center" style={{ color: 'var(--teal)' }}>{inviteMsg}</p>}
            </section>
            <button onClick={finish} className="w-full text-white font-bold py-3 rounded-xl" style={{ background: 'var(--accent)' }}>Los geht’s</button>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl tracking-wide">Fast fertig!</h1>
              <p className="text-[var(--muted)] text-sm mt-1">Wurdest du von jemandem geworben?</p>
            </div>
            <section className="card p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setRefYes(true)}
                  className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-colors"
                  style={{ borderColor: refYes === true ? 'var(--accent)' : 'var(--border)', background: refYes === true ? 'var(--accent-soft)' : 'transparent', color: refYes === true ? 'var(--text)' : 'var(--muted)' }}>
                  Ja
                </button>
                <button onClick={() => { setRefYes(false); setRefEmail(''); }}
                  className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-colors"
                  style={{ borderColor: refYes === false ? 'var(--accent)' : 'var(--border)', background: refYes === false ? 'var(--accent-soft)' : 'transparent', color: refYes === false ? 'var(--text)' : 'var(--muted)' }}>
                  Nein
                </button>
              </div>
              {refYes && (
                <div>
                  <div className="section-label mb-2">E-Mail der Person, die dich geworben hat</div>
                  <input type="email" value={refEmail} onChange={e => setRefEmail(e.target.value)}
                    placeholder="freund@example.com" className={inputCls} />
                </div>
              )}
            </section>
            <button onClick={completeOnboarding} disabled={refSaving || (refYes === true && !refEmail.trim())}
              className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>
              {refSaving ? 'Speichern…' : 'Los geht’s'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
