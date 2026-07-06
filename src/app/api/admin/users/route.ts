import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getSql, deleteAllUserData } from '@/lib/account';

export async function GET(req: NextRequest) {
  // Passwort über Header, nicht als Query-Param (landet sonst in Logs/History).
  const pw = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('adminPassword');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
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
      (EXISTS (SELECT 1 FROM user_entitlements e WHERE e.user_name = n.user_name AND e.sku = 'supporter')) AS is_supporter,
      COALESCE(u.is_test, false) AS is_test,
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
  // Vollständige Löschung über den gemeinsamen DSGVO-Helfer (deckt ALLE Tabellen ab).
  await deleteAllUserData(getSql(), userName);
  return NextResponse.json({ ok: true });
}
