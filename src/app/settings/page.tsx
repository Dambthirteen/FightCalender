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
        <div className="anim-up" style={{ animationDelay: '120ms' }}>
          <div className="card p-5">
            <h2 className="section-label mb-3">Rechtliches &amp; Daten</h2>
            <div className="space-y-1.5 text-sm">
              <a href="/account" className="block text-[var(--muted)] hover:text-white transition-colors">Meine Daten (Export / Konto löschen) ›</a>
              <a href="/datenschutz" className="block text-[var(--muted)] hover:text-white transition-colors">Datenschutzerklärung ›</a>
              <a href="/impressum" className="block text-[var(--muted)] hover:text-white transition-colors">Impressum ›</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
