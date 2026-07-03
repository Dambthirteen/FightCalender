# Sprint-Paket: „Supporter" (Monetarisierung)

> **STATUS 2026-07-03:** Paket „Plus" → **„Supporter"** umbenannt. **Gebaut & committed (flag-gated, schlafend):** M0 Entitlements, M1 Cosmetics-Gate, M2 Crew-Cap, M4 Referral (jetzt **E-Mail-Abfrage am Wizard-Ende**), Supporter-Backfill aller Bestandsnutzer, Admin-⭐-Toggle, Profil-Stern, Streak in der Mitgliederliste. **Offen für „offiziell":** Stripe M3 (Checkout+Webhook), Spind-Premium-UI + Upsell-Modal, Promo-Karte (0/2). Flags `MONETIZATION_ACTIVE` / `PROMO_REFERRAL_ACTIVE` default aus.

Geschlossenes Paket, das **am Ende** (nach Domain + Stripe-Setup) dazugeschaltet wird.
Ziel: rein optionale Optik + Komfort verkaufen, **keine Grundfunktion sperren, kein Pay-to-win**.
Strategie-Hintergrund: `memory/monetization-strategy.md`.

## Produkt
- **„Tap In Plus" — 3,99 € Einmalkauf** (kein Abo). Ein Lifetime-Unlock pro Account.
- Schaltet frei: Premium-Namens-Stile, Gürtel-Skins, Avatar-Rahmen, Profilfarben-Packs **+ unbegrenzt eigene Crews**.
- **Launch-Werbephase:** „Lade 2 Freunde ein (müssen sich anmelden) → Plus gratis".

## Eiserne Prinzipien (Review-Gate für jedes Ticket)
1. **Bestehende Gratis-Cosmetics bleiben gratis.** Premium sind ausschließlich **neue** SKUs — nie ein vorhandenes Level-Item nachträglich sperren.
2. **Multi-Crew: Bestandsschutz.** Cap blockt nur das *nächste* Erstellen; wer heute schon 2+ eigene Crews hat, behält alles.
3. **Nur Erstellen cappen, Beitreten immer frei** (schützt den Einladungs-Loop).
4. **Nie paywallen:** Streak-Punkte, XP/Level/Titel/Badges, alle Kernfunktionen.
5. **Alles hinter Feature-Flag** — mergebar, ohne dass sich für Nutzer etwas ändert, bis wir launchen.
6. **Web/Stripe zuerst.** iOS-Store-Build braucht später Apple-IAP (eigenes Ticket, hier NICHT über Stripe verkaufen).

---

## Voraussetzungen (extern, macht der Nutzer — vor M3)
- [ ] Eigene Domain (für Stripe-Webhook-Endpoint + Branding) — siehe `pre-release-todos`.
- [ ] Stripe-Account; Produkt/Preis „Tap In Plus" 3,99 € anlegen (Test + Live).
- [ ] Env-Vars (Vercel Prod+Preview):
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PLUS` (Price-ID)
  - `NEXT_PUBLIC_APP_URL` (Basis für success/cancel-URLs)
  - `MONETIZATION_ACTIVE` (`'1'` = Verkauf/Caps scharf)
  - `PROMO_REFERRAL_ACTIVE` (`'1'` = Werbephase-Referral aktiv)

---

## M0 — Datenmodell + Entitlement-Kern  _(keine externe Abhängigkeit, sofort baubar)_
**Dateien:** `src/app/api/setup/route.ts`, neu `src/lib/entitlements.ts`

Setup-Route (idempotent, wie bestehende `IF NOT EXISTS`-Migrationen):
```sql
CREATE TABLE IF NOT EXISTS user_entitlements (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  sku       TEXT NOT NULL,              -- 'plus'
  source    TEXT NOT NULL,              -- 'purchase' | 'referral' | 'gift' | 'admin'
  meta      JSONB DEFAULT '{}',         -- { stripe_session, stripe_event, ... }
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_name, sku)
);
-- Referral-Attribution:
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;                 -- Werber (user_name), einmalig bei Signup
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_credited BOOLEAN DEFAULT false; -- schon dem Werber gutgeschrieben?
```

`src/lib/entitlements.ts`:
```ts
getEntitlements(sql, user): Promise<Set<string>>   // alle SKUs des Nutzers
hasPlus(sql, user): Promise<boolean>
grantEntitlement(sql, user, sku, source, meta?)     // idempotent (ON CONFLICT (user_name,sku) DO NOTHING)
isMonetizationActive(): boolean                     // env MONETIZATION_ACTIVE === '1'
isReferralPromoActive(): boolean                    // env PROMO_REFERRAL_ACTIVE === '1'
```
**Akzeptanz:** Tabelle/Spalten nach `POST /api/setup` da; `grantEntitlement` doppelt aufgerufen → nur 1 Zeile.

---

## M1 — Cosmetics-Gate (Level ODER Besitz)  _(Abh.: M0)_
**Dateien:** `src/lib/cosmetics.ts`, `src/app/api/cosmetics/route.ts`, `src/app/spind/page.tsx`

- In `COSMETICS`/`BELT_SKINS` neue **Premium**-Einträge mit optionalem `sku` (z. B. `sku: 'plus'`) + hohem/keinem Level-Pfad. Verfügbarkeit:
  `available = (level >= minLevel) || (item.sku && owned.has(item.sku))`
- Premium-Startset: 3–4 Namens-Stile (animiert/Verlauf/Holo), 3–4 Gürtel-Skins (nur PNGs ergänzen), 2–3 Avatar-Rahmen, 1 Farb-Pack (`PALETTE` in `src/lib/avatar.ts` erweitern).
- `GET /api/cosmetics`: pro Item `{ available, premium, sku, minLevel }` liefern → Spind rendert Schloss + „Mit Plus freischalten"-CTA.
- `POST /api/cosmetics` (Ausrüsten): Gate ergänzen — nicht verfügbar → `402 { error, upsell:'plus' }` (statt bisher nur Level-403).
- Spind-UI: Premium-Sektion mit Lock-Badge + CTA → startet Checkout (M3) bzw. zeigt Referral-Fortschritt (M4).

**Akzeptanz:** Gratis-Level-Items unverändert; Premium-Item ohne Plus nicht ausrüstbar; mit Plus ausrüstbar.

---

## M2 — Multi-Crew-Cap  _(Abh.: M0)_
**Dateien:** `src/app/api/groups/route.ts` (Erstellen, ~Z. 35), `src/app/gruppen/page.tsx`

- Vor `INSERT INTO groups`:
```
FREE_CREATE_LIMIT = 1
ownAdmin = SELECT count(*) FROM group_members
           WHERE user_name = me AND role='admin' AND status='active'
if (isMonetizationActive() && !hasPlus && ownAdmin >= FREE_CREATE_LIMIT)
   return 402 { error, upsell:'plus', reason:'multi_crew' }
```
- `POST /api/groups/join` bleibt frei (optional Anti-Abuse-Cap ~10).
- `gruppen`-UI: bei `402` Upsell-Modal → Checkout.
- **Bestandsschutz** ergibt sich automatisch: wir blocken nur das nächste Erstellen, vorhandene Crews bleiben.

**Akzeptanz:** Non-Plus mit 1 eigener Crew → 2. Erstellen geblockt + Upsell; Beitreten unbegrenzt; Plus → unbegrenzt erstellen.

---

## M3 — Stripe Checkout + Webhook  _(Abh.: M0 + Domain + Stripe-Account)_
**Dateien:** neu `src/lib/stripe.ts`, `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/webhook/route.ts`. `npm i stripe`.

- `POST /api/billing/checkout` (nodejs): Session `mode:'payment'`, `line_items:[{price:STRIPE_PRICE_PLUS,quantity:1}]`, `client_reference_id: me`, `metadata:{user_name:me,sku:'plus'}`, success `${APP_URL}/spind?checkout=success`, cancel `…?checkout=cancel`. Return `{ url }` → Client redirect.
- `POST /api/billing/webhook` (nodejs, **raw body via `await req.text()`**): `stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET)`; bei `checkout.session.completed` → `grantEntitlement(user, 'plus', 'purchase', {session, event})`. Idempotent über `UNIQUE(user_name,sku)` + Event-ID.
- `/spind` liest `?checkout=success` → Entitlements neu laden, Erfolgs-Toast.

**Akzeptanz:** Testkarte `4242…` → Webhook → `user_entitlements`-Zeile `source='purchase'`; Premium-Items sofort freigeschaltet; doppeltes Event → keine Dublette.

---

## M4 — Referral-Werbephase (2 Freunde → Plus gratis)  _(Abh.: M0)_
**Dateien:** `src/app/api/auth/register/route.ts`, `src/app/api/auth/verify/route.ts`, `src/app/gruppen/page.tsx` (`inviteUrl()`), neue Promo-Karte.

- **Personal-Referral-Link:** bestehenden Invite-Link um `&ref=<me>` erweitern (bzw. eigener Share). `/join`/Register nehmen `ref` mit.
- **Register:** bei gültigem `ref` (existierender User, ≠ self) → `users.referred_by = ref` (einmalig).
- **Gutschrift bei E-Mail-Verifizierung** (verify-Route): geworbener Account verifiziert + `referral_credited=false` →
  `referral_credited=true`, dann Werber-Zählung:
  `credited = count(*) FROM users WHERE referred_by = werber AND email_verified AND referral_credited`
  `if (credited >= 2 && isReferralPromoActive()) grantEntitlement(werber,'plus','referral')`.
- **Anti-Abuse:** nur `email_verified` + distinct Accounts zählen.
- **UI:** Promo-Karte „Lade 2 Freunde ein → Plus gratis (0/2)" mit Share-Link — nur wenn `isReferralPromoActive()`.
- **Nach der Phase:** keine neuen Referral-Grants; vergebene bleiben.

**Akzeptanz:** 2 verifizierte Geworbene → Werber bekommt `source='referral'`-Plus; unverifizierte zählen nicht; Flag aus → keine Gutschrift, alte bleiben.

---

## M5 — Surfacing + Analytics  _(Abh.: M1–M4)_
- `hasPlus` → dezenter „Plus"-Chip auf dem Profil.
- PostHog (`track()`): `plus_checkout_started`, `plus_purchased`, `plus_referral_progress`, `plus_referral_completed`.
- Admin: manuelles `grantEntitlement(..,'admin')` für Support/Kulanz.

---

## Reihenfolge & Flags
```
M0 → { M1, M2, M4 }  (parallel, alle hinter MONETIZATION_ACTIVE=off mergebar)
   → M3 (Domain+Stripe)  → M5  → Flags an
```
- **MONETIZATION_ACTIVE=off** = App verhält sich exakt wie heute (alles gratis). Sicher zu mergen.
- **Werbephase-Option:** M4 kann **vor** M3 live gehen (Plus per Referral, bevor Kauf existiert) — das ist die „anfängliche Werbephase". `PROMO_REFERRAL_ACTIVE=1`, `MONETIZATION_ACTIVE` noch aus.

## Tests
- Unit: `grantEntitlement` idempotent; Verfügbarkeits-Funktion (Level vs. Besitz); Crew-Zählung + Bestandsschutz.
- Manuell: Stripe Test-Mode + `stripe listen --forward-to` für Webhook.
- Regression: Gratis-Cosmetics bleiben frei; bestehende Multi-Crew-Owner nicht gesperrt.

## iOS-Hinweis
Dieses Paket ist **web/Stripe**. Sobald die iOS-App im App Store ist, müssen digitale Güter über **Apple-IAP** (15 % SBP) — separates Ticket. Im gewrappten Store-Build **keinen** Stripe-Checkout anzeigen.
