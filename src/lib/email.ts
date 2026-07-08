// E-Mail-Versand über Resend (per REST, keine zusätzliche Abhängigkeit).
// Ohne RESEND_API_KEY: kompletter No-op (gibt false zurück) — nichts crasht.

const FROM = process.env.RESEND_FROM || 'Submit <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // nicht konfiguriert → still no-op
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- schlichte HTML-Vorlagen (dark, minimal) ---
function shell(title: string, body: string, cta: { href: string; label: string }): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0c;color:#e8e8ea;padding:32px">
    <div style="max-width:440px;margin:0 auto">
      <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
      <p style="color:#a9a9b2;line-height:1.5;margin:0 0 24px">${body}</p>
      <a href="${cta.href}" style="display:inline-block;background:#ff3b30;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${cta.label}</a>
      <p style="color:#6b6b74;font-size:12px;margin-top:28px">Falls der Button nicht geht, kopiere diesen Link:<br>${cta.href}</p>
    </div>
  </div>`;
}

export function verifyEmailHtml(baseUrl: string, token: string): { subject: string; html: string } {
  const href = `${baseUrl}/verify?token=${token}`;
  return {
    subject: 'Bestätige deine E-Mail für Submit',
    html: shell('E-Mail bestätigen', 'Tippe auf den Button, um deine E-Mail-Adresse zu bestätigen. Der Link gilt 24 Stunden.', { href, label: 'E-Mail bestätigen' }),
  };
}

export function resetPasswordHtml(baseUrl: string, token: string): { subject: string; html: string } {
  const href = `${baseUrl}/reset?token=${token}`;
  return {
    subject: 'Passwort zurücksetzen – Submit',
    html: shell('Passwort zurücksetzen', 'Du (oder jemand) hat einen Reset angefragt. Über den Button setzt du ein neues Passwort. Der Link gilt 1 Stunde. Ignorier die Mail, falls du das nicht warst.', { href, label: 'Neues Passwort setzen' }),
  };
}
