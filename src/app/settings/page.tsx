'use client';

import PageHeader from '@/components/PageHeader';
import NotificationsToggle from '@/components/NotificationsToggle';

export default function SettingsPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="⚙️ Einstellungen" />
      <main className="max-w-md mx-auto px-4 pb-28 anim-up">
        <NotificationsToggle />
      </main>
    </div>
  );
}
