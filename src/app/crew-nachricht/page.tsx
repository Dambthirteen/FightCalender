'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import GroupBroadcast from '@/components/GroupBroadcast';

/** Coach-Bereich: Push an alle aus der aktuell gewählten Gruppe. */
export default function CrewNachrichtPage() {
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string; clan_tag?: string | null }) => g.id === d.current);
      if (cur) setGroupName(cur.clan_tag ? `[${cur.clan_tag}] ${cur.name}` : cur.name);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="Crew-Nachricht" />
      <main className="max-w-md mx-auto px-4 pb-24 space-y-4">
        <section className="card p-5 anim-up">
          <p className="text-sm text-[var(--muted)] mb-4">
            Schick eine Push an alle aus <strong className="text-[var(--text)]">{groupName || 'deiner Gruppe'}</strong> —
            z.B. „Heute Sparring", „Kurs fällt aus" oder „Bringt Mundschutz mit".
          </p>
          <GroupBroadcast heading="Push an die Gruppe" hint="Geht an jedes aktive Mitglied der aktuell gewählten Gruppe." />
        </section>
        <p className="text-[11px] text-[var(--faint)] text-center">Andere Gruppe wählen: Startseite → oben auf die Gruppe tippen.</p>
      </main>
    </div>
  );
}
