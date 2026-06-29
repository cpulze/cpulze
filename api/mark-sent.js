export default async function handler(req, res) {
  const { scan_id, token } = req.query || {};
  if (!scan_id || !token) return res.status(400).send('Missing parameters.');

  const adminToken = process.env.APPROVAL_SECRET;
  if (!adminToken || token !== adminToken) return res.status(401).send('Invalid link.');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  await fetch(`${SUPABASE_URL}/rest/v1/scans?scan_id=eq.${encodeURIComponent(scan_id)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ status: 'sent', email_sent_at: new Date().toISOString() })
  });

  return res.status(200).send(`<!DOCTYPE html><html>
  <head><title>cpulze</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 400px; margin: 80px auto; padding: 24px; color: #1a1a1a; }
    .badge { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6366f1; margin-bottom: 16px; }
    h2 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #555; line-height: 1.7; }
  </style>
  </head>
  <body>
    <div class="badge">cpulze</div>
    <h2>Marked as sent ✓</h2>
    <p>Scan status updated. You're done.</p>
  </body></html>`);
}
