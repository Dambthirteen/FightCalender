'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials, PALETTE } from '@/lib/avatar';
import { COSMETICS, nameplateStyle, avatarFrame, flameFilter, beltSkin, xpBarColor, type CosmeticCategory } from '@/lib/cosmetics';

export default function SpindPage() {
  const { userName } = useUser();
  const [level, setLevel] = useState(1);
  const [cos, setCos] = useState<Record<string, string>>({});
  const [owned, setOwned] = useState<string[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/cosmetics').then((r) => r.json()).then((d) => {
      if (d && !d.error) { setLevel(d.level ?? 1); setCos(d.cosmetics ?? {}); setOwned(Array.isArray(d.owned) ? d.owned : []); setColor(d.color ?? null); }
    }).catch(() => {});
  }, []);

  async function pickColor(col: string | null) {
    setColor(col);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: col }) }).catch(() => {});
  }

  async function equip(category: CosmeticCategory, itemId: string, locked: boolean) {
    if (locked || busy) return;
    setBusy(category + itemId); setMsg('');
    const prev = cos;
    setCos({ ...cos, [category]: itemId }); // optimistisch
    try {
      const res = await fetch('/api/cosmetics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, itemId }),
      });
      const d = await res.json();
      if (!res.ok) { setCos(prev); setMsg(d.error ?? 'Fehler'); }
      else setCos(d.cosmetics ?? cos);
    } catch { setCos(prev); setMsg('Netzwerkfehler'); }
    finally { setBusy(''); }
  }

  const name = userName ?? 'Du';
  const c = colorFor(name, color);
  const frame = avatarFrame(cos.avatarFrame, c);

  // Mini-Vorschau je Kategorie auf der Item-Kachel.
  function sample(category: CosmeticCategory, id: string) {
    if (category === 'nameplate') {
      return <span className="font-display text-xl tracking-wide" style={nameplateStyle(id)}>{name}</span>;
    }
    if (category === 'avatarFrame') {
      const f = avatarFrame(id, c);
      return (
        <span className={`inline-grid place-items-center w-9 h-9 rounded-full ${f.className ?? ''}`}
          style={{ background: `${c}22`, ...f.style }}>
          <span className="font-display text-sm" style={{ color: c }}>{initials(name)}</span>
        </span>
      );
    }
    if (category === 'belt') {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={beltSkin(id).src} alt="" className="w-full" style={{ maxHeight: 40, objectFit: 'contain' }} />;
    }
    if (category === 'xpbar') {
      const col = xpBarColor(id);
      return (
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="h-full rounded-full" style={{ width: '72%', background: col ?? 'linear-gradient(90deg, var(--gold), var(--accent))' }} />
        </div>
      );
    }
    return <span className="text-2xl" style={{ filter: flameFilter(id), display: 'inline-block' }}>🔥</span>;
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="Spind" />
      <main className="max-w-md mx-auto px-4 pb-24 space-y-6">
        {/* Vorschau */}
        <div className="card p-6 flex flex-col items-center text-center anim-up">
          <div className={`w-24 h-24 rounded-full overflow-hidden grid place-items-center mb-3 ${frame.className ?? ''}`}
            style={{ background: `${c}22`, ...frame.style }}>
            <span className="font-display text-5xl" style={{ color: c }}>{initials(name)}</span>
          </div>
          <div className="font-display text-3xl tracking-wide" style={nameplateStyle(cos.nameplate)}>{name}</div>
          <div className="mt-2">
            <span className="chip" style={{ borderColor: 'var(--accent-2)', color: 'var(--accent-2)' }}>
              <span style={{ filter: flameFilter(cos.flame), display: 'inline-block' }}>🔥</span> 12 Tage
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beltSkin(cos.belt).src} alt="Gürtel" className="w-full mt-4" style={{ aspectRatio: '1400 / 319', objectFit: 'contain' }} />
          <div className="w-full mt-4 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: '72%', background: xpBarColor(cos.xpbar) ?? 'linear-gradient(90deg, var(--gold), var(--accent))' }} />
          </div>
          <div className="text-[11px] text-[var(--faint)] mt-3">Dein Level: <strong style={{ color: 'var(--text)' }}>{level}</strong></div>
        </div>

        {msg && <p className="text-xs text-[var(--accent)] text-center">{msg}</p>}

        {/* Profilfarbe (Avatar & Kalender) */}
        <section className="anim-up">
          <div className="section-label mb-2.5">Profilfarbe</div>
          <div className="flex flex-wrap gap-2.5">
            {PALETTE.map((col) => (
              <button key={col} onClick={() => pickColor(col)}
                className="w-9 h-9 rounded-full transition-transform active:scale-90"
                style={{ background: col, outline: color === col ? '2px solid #fff' : 'none', outlineOffset: '2px' }} />
            ))}
            <button onClick={() => pickColor(null)} title="Automatisch"
              className="w-9 h-9 rounded-full grid place-items-center text-[10px] border border-[var(--border)] text-[var(--muted)]"
              style={{ outline: !color ? '2px solid #fff' : 'none', outlineOffset: '2px' }}>auto</button>
          </div>
        </section>

        {(Object.keys(COSMETICS) as CosmeticCategory[]).map((catKey) => {
          const cat = COSMETICS[catKey];
          const equipped = cos[catKey] ?? 'default';
          return (
            <section key={catKey} className="anim-up">
              <div className="section-label mb-2.5">{cat.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {cat.items.map((item) => {
                  // Premium-Item (sku): freigeschaltet nur mit Entitlement (Supporter).
                  // Sonst per Level. Bei Premium zeigt der Lock „⭐ Supporter" statt eines Levels.
                  const premium = !!item.sku;
                  const locked = premium ? !owned.includes(item.sku!) : level < item.minLevel;
                  const on = equipped === item.id;
                  return (
                    <button key={item.id} onClick={() => equip(catKey, item.id, locked)} disabled={locked || busy === catKey + item.id}
                      className="rounded-xl border p-3 text-left transition-all active:scale-95 disabled:opacity-50"
                      style={on
                        ? { borderColor: 'var(--accent-2)', background: 'var(--accent-soft)' }
                        : { borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-semibold truncate">{item.label}</span>
                        {locked
                          ? <span className="text-[10px] text-[var(--faint)] shrink-0">{premium ? '⭐ Supporter' : `🔒 Lvl ${item.minLevel}`}</span>
                          : on ? <span className="text-xs shrink-0" style={{ color: 'var(--good)' }}>✓ aktiv</span> : null}
                      </div>
                      <div className="h-10 flex items-center" style={locked ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined}>
                        {sample(catKey, item.id)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className="text-[11px] text-[var(--faint)] text-center">Mehr wird mit steigendem Level freigeschaltet.</p>
      </main>
    </div>
  );
}
