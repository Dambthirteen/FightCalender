'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUser } from './UserProvider';

type Kind = 'macher' | 'bitch';
interface VoteItem { groupId: number; groupName: string; month: string; kind: Kind; candidates: string[]; }
interface CongratItem { groupId: number; groupName: string; month: string; kind: Kind; }

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Letzter abgeschlossener Monat als 'YYYY-MM' (nur für die Vorschau). */
function previewMonth(): string {
  const d = new Date();
  const m = d.getMonth(); // 0-basiert: aktueller Monat → Vormonat ist m (1-basiert)
  const pm = m === 0 ? 12 : m;
  const py = m === 0 ? d.getFullYear() - 1 : d.getFullYear();
  return `${py}-${String(pm).padStart(2, '0')}`;
}

const META: Record<Kind, { emoji: string; label: string; color: string; soft: string; voteQ: string }> = {
  macher: { emoji: '🏆', label: 'Macher des Monats', color: 'var(--gold)', soft: 'rgba(255,194,75,0.13)', voteQ: 'Wer war am fleißigsten?' },
  bitch: { emoji: '🐔', label: 'Chicken des Monats', color: 'var(--bitch)', soft: 'rgba(245,197,24,0.13)', voteQ: 'Wer hat am meisten geschwänzt?' },
};

/**
 * Erscheint beim ersten Login nach Monatswechsel:
 *  - Pflicht-Voting bei Gleichstand (erst nach Auswahl schließbar)
 *  - animierte Verleihung für die Sieger (genau einmal)
 * Alles gruppenbasiert; mehrere Auszeichnungen werden nacheinander gezeigt.
 */
export default function AwardPopup() {
  const { userName, loading } = useUser();
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [congrats, setCongrats] = useState<CongratItem[]>([]);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef('');

  useEffect(() => {
    if (loading) return;

    // Vorschau-Modus zum Testen: ?awardpreview=1 an die URL hängen → zeigt beide
    // Popup-Arten mit Beispiel-Daten, OHNE etwas zu speichern (groupId === -1).
    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('awardpreview') === '1';
    if (preview) {
      if (loadedFor.current === '__preview__') return;
      loadedFor.current = '__preview__';
      const month = previewMonth();
      setVotes([
        { groupId: -1, groupName: 'Test-Gym', month, kind: 'macher', candidates: ['Angelo', 'Max', 'Tim'] },
        { groupId: -1, groupName: 'Test-Gym', month, kind: 'bitch', candidates: ['Niklas', 'Tom'] },
      ]);
      setCongrats([
        { groupId: -1, groupName: 'Test-Gym', month, kind: 'macher' },
        { groupId: -1, groupName: 'Test-Gym', month, kind: 'bitch' },
      ]);
      return;
    }

    if (!userName || loadedFor.current === userName) return;
    loadedFor.current = userName;
    fetch('/api/awards')
      .then((r) => r.json())
      .then((d) => {
        setVotes(Array.isArray(d.votes) ? d.votes : []);
        setCongrats(Array.isArray(d.congrats) ? d.congrats : []);
      })
      .catch(() => {});
  }, [userName, loading]);

  const vote = votes[0];
  const congrat = !vote ? congrats[0] : undefined;

  async function submitVote() {
    if (!vote || !choice || busy) return;
    setBusy(true);
    if (vote.groupId !== -1) { // -1 = Vorschau: nichts speichern
      try {
        await fetch('/api/awards/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: vote.groupId, month: vote.month, kind: vote.kind, choice }),
        });
      } catch { /* offline → Popup einfach schließen, Stimme geht verloren */ }
    }
    setBusy(false);
    setChoice('');
    setVotes((v) => v.slice(1));
  }

  async function dismissCongrat() {
    if (!congrat || busy) return;
    setBusy(true);
    if (congrat.groupId !== -1) { // -1 = Vorschau: nichts speichern
      try {
        await fetch('/api/awards/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: congrat.groupId, month: congrat.month, kind: congrat.kind }),
        });
      } catch { /* offline → später erneut */ }
    }
    setBusy(false);
    setCongrats((c) => c.slice(1));
  }

  // --- Pflicht-Voting bei Gleichstand ---
  if (vote) {
    const m = META[vote.kind];
    return (
      <Overlay>
        <div className="card award-pop w-full max-w-sm p-6 text-center" style={{ borderColor: m.color }}>
          <div className="text-5xl mb-2">🤝</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">{vote.groupName} · {monthLabel(vote.month)}</div>
          <h2 className="font-display text-3xl tracking-wide mt-1" style={{ color: m.color }}>Gleichstand!</h2>
          <p className="text-[var(--muted)] text-sm mt-2">
            {m.emoji} <strong className="text-white">{m.label}</strong> — die Gruppe entscheidet. {m.voteQ}
          </p>
          <div className="mt-5 space-y-2 text-left">
            {vote.candidates.map((c) => (
              <button key={c} onClick={() => setChoice(c)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors"
                style={{
                  background: choice === c ? m.soft : 'var(--surface-2)',
                  borderColor: choice === c ? m.color : 'var(--border)',
                }}>
                <span className="font-semibold">{c}</span>
                <span className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: choice === c ? m.color : 'var(--faint)', background: choice === c ? m.color : 'transparent' }} />
              </button>
            ))}
          </div>
          <button onClick={submitVote} disabled={!choice || busy}
            className="mt-5 w-full text-black font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: m.color }}>
            {busy ? '…' : 'Stimme abgeben'}
          </button>
          <p className="text-[11px] text-[var(--faint)] mt-3">Du musst abstimmen, um fortzufahren.</p>
        </div>
      </Overlay>
    );
  }

  // --- Verleihung (animiert) ---
  if (congrat) {
    const m = META[congrat.kind];
    const isMacher = congrat.kind === 'macher';
    return (
      <Overlay onClose={dismissCongrat}>
        <div className="card award-pop w-full max-w-sm p-7 text-center relative overflow-hidden" style={{ borderColor: m.color }}>
          {isMacher && <Confetti />}
          <div className="text-7xl mb-3 award-bounce">{m.emoji}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">{congrat.groupName} · {monthLabel(congrat.month)}</div>
          <h2 className="font-display text-2xl tracking-wide mt-2">{isMacher ? 'Glückwunsch!' : 'Autsch.'}</h2>
          <p className="text-lg mt-1">Du bist <strong style={{ color: m.color }}>{m.label}</strong></p>
          <p className="text-[var(--muted)] text-sm mt-2">
            {isMacher ? 'Stark — niemand war öfter da. 🥊' : 'Diesen Monat hast du am meisten gefehlt. 💩'}
          </p>
          <button onClick={dismissCongrat} disabled={busy}
            className="mt-6 w-full text-black font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: m.color }}>
            {isMacher ? 'Stark!' : 'Na toll…'}
          </button>
        </div>
      </Overlay>
    );
  }

  return null;
}

function Overlay({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 anim-in"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}>
      {children}
    </div>
  );
}

function Confetti() {
  const colors = ['var(--gold)', 'var(--accent)', 'var(--teal)', 'var(--good)', '#fff'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} className="confetti-piece absolute top-0"
          style={{
            left: `${i * 6.25 + 2}%`,
            width: 7,
            height: 11,
            background: colors[i % colors.length],
            animationDelay: `${(i % 8) * 0.18}s`,
            borderRadius: 2,
          }} />
      ))}
    </div>
  );
}
