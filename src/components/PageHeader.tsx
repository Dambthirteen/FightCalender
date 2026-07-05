'use client';

import type { ReactNode } from 'react';

/** iPhone-first Seitenkopf: Zurück (→ Startseite) · Titel (+ optionales Icon) · (Aktion). */
export default function PageHeader({ title, back = '/start', action, icon }: { title: string; back?: string; action?: ReactNode; icon?: string }) {
  return (
    <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between gap-2 anim-in">
      <a href={back} aria-label="Zurück"
        className="w-11 h-11 shrink-0 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
      <h1 className="font-display text-xl tracking-wide flex-1 text-center flex items-center justify-center gap-2 min-w-0">
        {icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="w-6 h-6 object-contain shrink-0" />
        )}
        <span className="truncate">{title}</span>
      </h1>
      <div className="flex items-center gap-2 shrink-0">{action ?? <span className="w-11" />}</div>
    </header>
  );
}
