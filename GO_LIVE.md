# GO_LIVE — Tap In

Drei Phasen: **privat testen → Mail/Domain → offiziell + Geld**. Alle Monetarisierungs-Pipelines
sind im Code schon verdrahtet, aber **schlafen** hinter Flags. „Offiziell machen" = Flags umlegen
+ Stripe verkabeln. Details der Bezahl-Tickets: `MONETIZATION_SPRINT.md`.

---

## Phase 1 — Privater Web-Test (jetzt, auf `*.vercel.app`)
App halb-ready privat streuen. Verkauf/Caps aus.

**Vercel Env (Prod + Preview):**
- `JWT_SECRET` — langer Zufallswert (Pflicht)
- `DATABASE_URL` — Neon Prod, **EU-Region wählen** (DSGVO) (Pflicht)
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — oder Analytics vorerst weglassen
- `MONETIZATION_ACTIVE` — **nicht setzen** (= aus) → keine Paywall/Caps
- `PROMO_REFERRAL_ACTIVE` — **nicht setzen** (= aus)
- `RESEND_API_KEY` — optional; ohne funktioniert nur kein Mailversand

**Deploy:**
1. Branch `sprint-1-store-legal` deployen (merge → `master` oder Preview-Deploy).
2. Nach Deploy **einmal `POST /api/setup`** aufrufen (Schema + neue Tabellen inkl. `user_entitlements`).
3. Smoke-Test: register → onboarding → Gruppe erstellen/beitreten → eintragen → Profil → `/account` (Export/Löschen).
4. Link privat streuen.

**Realität ohne Domain:** E-Mail-Verifizierung + Passwort-Reset gehen erst mit Domain+Resend (Phase 2).
Bis dahin unkritisch im Freundeskreis (Passwort notfalls per DB/Admin zurücksetzen).

**DSGVO-Minimum auch im Privattest:** `/datenschutz` + `/impressum` ausfüllen (Platzhalter ersetzen).
Löschung + Datenexport sind bereits gebaut (`/account`).

---

## Phase 2 — Mail + Domain (wenn der Test gut ankommt)
1. Domain kaufen (am einfachsten Vercel Domains, ~10–15 €/J).
2. Resend: Domain hinzufügen → SPF/DKIM/MX-DNS setzen → verifizieren.
3. Env: `RESEND_API_KEY` + `RESEND_FROM="Tap In <no-reply@deinedomain>"`.
4. Redeploy → Verifizierungs-/Reset-Mails live.
5. Domain in Vercel aufs Projekt legen; PostHog mit Consent aktivieren.

---

## Phase 3 — Offiziell + Monetarisierung
1. Stripe-Account + Produkt/Preis „Tap In Plus" 3,99 €; Env `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PLUS` / `NEXT_PUBLIC_APP_URL`.
2. **M3** verkabeln (`/api/billing/checkout` + `/api/billing/webhook`) — M0/M1/M2/M4 stehen schon.
3. Flags an:
   - `PROMO_REFERRAL_ACTIVE=1` → Werbephase „2 Freunde → Plus gratis" (kann auch schon **vor** Stripe an).
   - `MONETIZATION_ACTIVE=1` → Premium-Cosmetics + Multi-Crew-Cap + Checkout scharf.
4. App Store / Play Store: eigenes Ticket (auf iOS **Apple-IAP** statt Stripe).

---

## Flag-Matrix
| Env | aus (Default) | an (`'1'`) |
|-----|----------------|-----------|
| `MONETIZATION_ACTIVE` | alles frei, exakt wie heute | Premium-Cosmetics + Crew-Cap + Checkout aktiv |
| `PROMO_REFERRAL_ACTIVE` | keine Referral-Gutschrift | 2 verifizierte Freunde → Plus gratis |

Beide Flags aus = die App verhält sich für Nutzer identisch zu heute — die Pipelines sind da, aber unsichtbar.
