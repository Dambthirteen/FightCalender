'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useUser } from '@/components/UserProvider';
import { nameplateStyle, avatarFrame, flameFilter, beltSkin, xpBarColor } from '@/lib/cosmetics';

interface Notif {
  id: number;
  type: string;
  actor: string;
  body: string;
  link: string;
  ref_id: number | null;
  read: boolean;
  created_at: string;
  event_id?: number | null;
  reactable?: boolean | null;
  reaction_count?: number | null;
  reacted_by_me?: boolean | null;
  praise_displayed?: boolean | null;
  praise_show_comment?: boolean | null;
  praise_kind?: string | null;
  praise_reason?: string | null;
  meta?: { category?: string; itemId?: string; label?: string; minLevel?: number } | null;
}

const ICON: Record<string, string> = {
  comment: '💬', challenge: '⚔️', challenge_result: '⚖️', praise: '🏅', badge: '🎖️', cosmetic: '✨',
  skilltree: '🌳', praise_feed: '👏', competition: '🥊', bitch: '🐔', badge_feed: '🏅', coach: '🎓',
};

/** Mini-Vorschau eines Cosmetics (wie im Spind) für die Benachrichtigung. */
function CosmeticThumb({ category, itemId }: { category: string; itemId: string }) {
  if (category === 'nameplate') return <span className="font-display text-base tracking-wide" style={nameplateStyle(itemId)}>Aa</span>;
  if (category === 'avatarFrame') {
    const f = avatarFrame(itemId, '#ff3b30');
    return <span className={`inline-grid place-items-center w-8 h-8 rounded-full ${f.className ?? ''}`} style={{ background: 'rgba(255,59,48,0.14)', ...f.style }}><span className="text-[10px] font-display" style={{ color: '#ff3b30' }}>Aa</span></span>;
  }
  if (category === 'belt') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={beltSkin(itemId).src} alt="" className="w-full" style={{ maxHeight: 34, objectFit: 'contain' }} />;
  }
  if (category === 'xpbar') {
    const col = xpBarColor(itemId);
    return <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}><div className="h-full rounded-full" style={{ width: '70%', background: col ?? 'linear-gradient(90deg, var(--gold), var(--accent))' }} /></div>;
  }
  return <span className="text-2xl" style={{ filter: flameFilter(itemId), display: 'inline-block' }}>🔥</span>; // flame
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.round(h / 24);
  return `vor ${d} d`;
}

export default function NotificationsPage() {
  const { userName, loading } = useUser();
  const [items, setItems] = useState<Notif[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !userName) return;
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
    // beim Öffnen alle als gelesen markieren
    fetch('/api/notifications', { method: 'POST' }).catch(() => {});
  }, [userName, loading]);

  async function toggleReaction(n: Notif) {
    if (!n.event_id || !n.reactable) return;
    // optimistisch
    setItems((prev) => prev.map((it) => it.id === n.id
      ? { ...it, reacted_by_me: !it.reacted_by_me, reaction_count: (it.reaction_count ?? 0) + (it.reacted_by_me ? -1 : 1) }
      : it));
    try {
      const res = await fetch('/api/feed/react', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: n.event_id }),
      });
      const d = await res.json();
      if (res.ok) setItems((prev) => prev.map((it) => it.id === n.id ? { ...it, reacted_by_me: d.reacted, reaction_count: d.count } : it));
    } catch { /* Fehler → optimistische Anzeige bleibt grob korrekt */ }
  }

  async function setPraiseDisplay(n: Notif, displayed: boolean, showComment: boolean) {
    if (!n.ref_id) return;
    setBusy(n.id);
    try {
      await fetch(`/api/praise/${n.ref_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayed, show_comment: showComment }),
      });
      setItems((prev) => prev.map((it) => it.id === n.id ? { ...it, praise_displayed: displayed, praise_show_comment: showComment } : it));
    } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🔔 Benachrichtigungen" />
      <main className="max-w-md mx-auto px-4 pb-24 pt-2 space-y-2.5">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-2">📭</div>
            <div className="text-sm text-[var(--faint)]">Keine Benachrichtigungen.</div>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="card px-4 py-3 anim-up" style={{ borderColor: n.read ? undefined : 'var(--accent)' }}>
              <div className="flex items-start gap-3">
                {n.type === 'cosmetic' && n.meta?.category ? (
                  <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0 overflow-hidden mt-0.5"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: n.meta.category === 'belt' ? 4 : 0 }}>
                    <CosmeticThumb category={n.meta.category} itemId={n.meta.itemId ?? ''} />
                  </span>
                ) : (
                  <span className="text-xl leading-none mt-0.5">{ICON[n.type] ?? '🔔'}</span>
                )}
                <div className="min-w-0 flex-1">
                  {n.type === 'cosmetic' ? (
                    <>
                      <p className="text-sm font-semibold">Neues Design freigeschaltet ✨</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{n.body}</p>
                      <a href={n.link || '/spind'} className="text-xs font-semibold mt-1 inline-block" style={{ color: 'var(--teal)' }}>Im Spind ausrüsten ›</a>
                    </>
                  ) : (
                    <p className="text-sm">{n.body}</p>
                  )}
                  <div className="text-[11px] text-[var(--faint)] mt-0.5">{timeAgo(n.created_at)}</div>

                  {/* Lob/Gigalob: im Profil ausstellen */}
                  {n.type === 'praise' && n.ref_id && (
                    <div className="mt-2 rounded-xl border border-[var(--border-soft)] p-2.5" style={{ background: 'var(--surface-2)' }}>
                      {n.praise_reason && <p className="text-xs text-[var(--muted)] italic mb-2">„{n.praise_reason}“</p>}
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input type="checkbox" checked={!!n.praise_displayed} disabled={busy === n.id}
                          onChange={(e) => setPraiseDisplay(n, e.target.checked, !!n.praise_show_comment)} />
                        Im Profil ausstellen
                      </label>
                      <label className={`flex items-center gap-2 text-xs mt-1.5 cursor-pointer ${n.praise_displayed ? '' : 'opacity-40'}`}>
                        <input type="checkbox" checked={!!n.praise_show_comment} disabled={busy === n.id || !n.praise_displayed}
                          onChange={(e) => setPraiseDisplay(n, true, e.target.checked)} />
                        Mit Kommentar vom Nutzer
                      </label>
                    </div>
                  )}

                  {/* Daumen hoch bei guten Ereignissen */}
                  {n.reactable && n.event_id && (
                    <button onClick={() => toggleReaction(n)}
                      className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all active:scale-95"
                      style={n.reacted_by_me
                        ? { borderColor: 'var(--accent-2)', background: 'var(--accent-soft)', color: 'var(--accent-2)' }
                        : { borderColor: 'var(--border-soft)', color: 'var(--muted)' }}>
                      👍 {n.reaction_count ? n.reaction_count : ''}
                    </button>
                  )}

                  {/* Link zu Profil/Gericht etc. */}
                  {n.link && n.type !== 'praise' && (
                    <a href={n.link} className="inline-block text-xs font-semibold mt-1.5 ml-3" style={{ color: 'var(--teal)' }}>
                      Ansehen ›
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
