'use client';

import PageHeader from '@/components/PageHeader';
import NotificationsToggle from '@/components/NotificationsToggle';
import ProfileVisibility from '@/components/ProfileVisibility';

export default function SettingsPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="⚙️ Einstellungen" />
      <main className="max-w-md mx-auto px-4 pb-28 space-y-5">
        <div className="anim-up"><ProfileVisibility /></div>
        <div className="anim-up" style={{ animationDelay: '60ms' }}><NotificationsToggle /></div>
      </main>
    </div>
  );
}
