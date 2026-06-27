import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get('adminPassword');
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  // Alle Namen, die irgendwo Daten haben — auch „verwaiste" Nutzer ohne users-Zeile
  // (z. B. nach einer früheren, unvollständigen Löschung). has_account zeigt, ob es
  // dafür noch einen echten Login (users-Eintrag) gibt.
  const rows = await sql`
    WITH all_names AS (
      SELECT user_name FROM users
      UNION SELECT user_name FROM attendance
      UNION SELECT user_name FROM skipping
      UNION SELECT voter_name FROM excuse_votes
      UNION SELECT user_name FROM competitions
      UNION SELECT user_name FROM user_status
      UNION SELECT user_name FROM user_schedule
      UNION SELECT user_name FROM push_subscriptions
      UNION SELECT user_name FROM notification_prefs
      UNION SELECT user_name FROM user_notif_log
      UNION SELECT user_name FROM group_members
    )
    SELECT n.user_name,
      u.created_at,
      (u.user_name IS NOT NULL) AS has_account,
      (SELECT COUNT(*)::int FROM attendance a WHERE a.user_name = n.user_name) AS attend_count,
      (SELECT COUNT(*)::int FROM skipping s WHERE s.user_name = n.user_name) AS skip_count,
      (SELECT COUNT(*)::int FROM user_schedule us WHERE us.user_name = n.user_name) AS schedule_count
    FROM all_names n
    LEFT JOIN users u ON u.user_name = n.user_name
    ORDER BY (u.user_name IS NOT NULL) DESC, u.created_at DESC NULLS LAST, n.user_name
  `;
  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const { adminPassword, userName } = await req.json();
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  // Vollständige Löschung: alle nutzerbezogenen Daten entfernen, nicht nur den Login.
  // (Früher wurde nur aus `users` gelöscht → verwaiste Daten blieben in Statistik etc.)
  await sql`DELETE FROM excuse_votes WHERE voter_name = ${userName}`; // Votes, die der Nutzer abgegeben hat
  await sql`DELETE FROM skipping WHERE user_name = ${userName}`;       // eigene Ausreden (cascadet Votes darauf)
  await sql`DELETE FROM attendance WHERE user_name = ${userName}`;
  await sql`DELETE FROM competitions WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_status WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_schedule WHERE user_name = ${userName}`;
  await sql`DELETE FROM push_subscriptions WHERE user_name = ${userName}`;
  await sql`DELETE FROM notification_prefs WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_notif_log WHERE user_name = ${userName}`;
  await sql`DELETE FROM group_members WHERE user_name = ${userName}`;
  // Gruppen NICHT löschen (gehören evtl. anderen Mitgliedern) — nur die Urheber-Spur entfernen.
  await sql`UPDATE groups SET created_by = NULL WHERE created_by = ${userName}`;
  await sql`DELETE FROM users WHERE user_name = ${userName}`;
  return NextResponse.json({ ok: true });
}
