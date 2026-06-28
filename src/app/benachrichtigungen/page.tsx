'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { useUser } from '@/components/UserProvider';

interface Notif {
  id: number;
  type: 'comment' | 'challenge' | 'challenge_result' | 'praise' | 'badge';
  actor: string;
  body: string;
  link: string;
  ref_id: number | null;
  read: boolean;
  created_at: string;
  praise_displayed?: boolean | null;
  praise_show_comment?: boolean | null;
  praise_kind?: string | null;
  praise_reason?: string | null;
}

const ICON: Record<string, string> = {
  comment: '💬', challenge: '⚔️', challenge_result: '⚖️', praise: '🏅', badge: '🎖️',
};

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
                <span className="text-xl leading-none mt-0.5">{ICON[n.type] ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.body}</p>
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

                  {/* Link zu Profil/Gericht etc. */}
                  {n.link && n.type !== 'praise' && (
                    <a href={n.link} className="inline-block text-xs font-semibold mt-1.5" style={{ color: 'var(--teal)' }}>
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
