import posthog from 'posthog-js';

// Zentrale, DSGVO-bewusste Analytics-Hülle. Ohne NEXT_PUBLIC_POSTHOG_KEY: komplett no-op.
const enabled = () => typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Produkt-Event senden (z.B. 'signup', 'attendance_toggled'). */
export function track(event: string, props?: Record<string, unknown>) {
  if (!enabled()) return;
  try { posthog.capture(event, props); } catch { /* egal */ }
}

/** Eingeloggten Nutzer identifizieren (distinct_id = user_name; Einwilligung liegt vor). */
export function identify(distinctId: string) {
  if (!enabled() || !distinctId) return;
  try { posthog.identify(distinctId); } catch { /* egal */ }
}

/** Beim Logout die Identität zurücksetzen. */
export function resetAnalytics() {
  if (!enabled()) return;
  try { posthog.reset(); } catch { /* egal */ }
}
