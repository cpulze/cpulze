export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, property } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Store lead in Supabase
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/report_leads`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      property:     property?.trim() || null,
      requested_at: new Date().toISOString(),
      fulfilled:    false,
    }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('Supabase insert failed:', err);
    return res.status(500).json({ error: 'Failed to store request' });
  }

  // Notify Ovais via Brevo
  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (BREVO_KEY) {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key':      BREVO_KEY,
      },
      body: JSON.stringify({
        sender:  { name: 'cpulze reports', email: 'ovais@cpulze.com' },
        to:      [{ email: 'ovais@cpulze.com' }],
        subject: `Report request — ${name} (${property || 'no property'})`,
        htmlContent: `
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Property:</strong> ${property || '—'}</p>
          <p style="margin-top:16px;color:#888;">Send the PDF manually until fulfilment is automated.</p>
        `,
      }),
    }).catch(e => console.error('Brevo notify failed:', e));
  }

  return res.status(200).json({ ok: true });
}
