'use client';

import type { ReactNode } from 'react';
import NavMenu from './NavMenu';

/** Einheitlicher iPhone-first Seitenkopf: Zurück · Titel · (Aktion) · Menü. */
export default function PageHeader({ title, back = '/', action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between gap-2 anim-in">
      <a href={back} aria-label="Zurück"
        className="w-11 h-11 shrink-0 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
      <h1 className="font-display text-xl tracking-wide truncate flex-1 text-center">{title}</h1>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        <NavMenu />
      </div>
    </header>
  );
}
