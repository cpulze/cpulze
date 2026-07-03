import { createHmac } from 'crypto';

export default async function handler(req, res) {
  const { scan_id, token } = req.query || {};

  if (!scan_id || !token) {
    return res.status(400).send('Missing parameters.');
  }

  // Verify HMAC token
  const expected = createHmac('sha256', process.env.APPROVAL_SECRET || 'fallback-secret')
    .update(scan_id)
    .digest('hex');

  if (token !== expected) {
    return res.status(401).send('Invalid or expired approval link.');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  // Fetch scan record
  const scanRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scans?scan_id=eq.${encodeURIComponent(scan_id)}&select=*&limit=1`,
    { headers: sbHeaders }
  );
  const scans = await scanRes.json();
  const scan  = scans?.[0];

  if (!scan) {
    return res.status(404).send('Scan not found.');
  }

  if (scan.status !== 'pending_review') {
    return res.status(200).send(html(scan.hotel_name, 'already_started'));
  }

  // Update status to approved
  await fetch(
    `${SUPABASE_URL}/rest/v1/scans?scan_id=eq.${encodeURIComponent(scan_id)}`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'approved' })
    }
  );

  // Trigger n8n webhook
  const webhookUrl = process.env.N8N_WEBHOOK_URL_AUTH || process.env.N8N_WEBHOOK_URL;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      },
      body: JSON.stringify({
        scan_id:          scan.scan_id,
        email:            scan.email,
        hotel_name:       scan.hotel_name,
        location:         scan.location,
        tier:             scan.tier || 'free',
        user_id:          scan.user_id,
        is_new_user:      scan.is_new_user ?? false,
        mark_sent_token:  scan.mark_sent_token || ''
      })
    });
  } catch (err) {
    console.error('n8n trigger error:', err);
    return res.status(500).send('Scan approved but failed to start. Check n8n.');
  }

  // Also kick off the freeform variant — same hotel, its own scan_id, no separate approval needed
  try {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const now2  = new Date();
    const dt2   = now2.getFullYear() +
      String(now2.getMonth() + 1).padStart(2, '0') +
      String(now2.getDate()).padStart(2, '0') +
      String(now2.getHours()).padStart(2, '0') +
      String(now2.getMinutes()).padStart(2, '0') +
      String(now2.getSeconds()).padStart(2, '0') +
      String(now2.getMilliseconds()).padStart(3, '0');
    const rand2 = (set, n) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
    const scanIdFreeform = alpha[Math.floor(Math.random() * alpha.length)] + dt2 + alpha[Math.floor(Math.random() * alpha.length)] + rand2(alnum, 3);

    const markSentTokenFreeform = createHmac('sha256', process.env.APPROVAL_SECRET || 'fallback-secret')
      .update(`sent:${scanIdFreeform}`)
      .digest('hex');

    await fetch(`${SUPABASE_URL}/rest/v1/scans`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        scan_id:         scanIdFreeform,
        email:           scan.email,
        hotel_name:      scan.hotel_name,
        location:        scan.location,
        tier:            scan.tier || 'free',
        model:           scan.model || 'perplexity',
        status:          'approved',
        user_id:         scan.user_id,
        is_new_user:     scan.is_new_user ?? false,
        mark_sent_token: markSentTokenFreeform,
        themes_found:    0,
        themes_shown:    0,
        themes_gated:    0,
        gate_teaser:     ''
      })
    });

    const freeformWebhookUrl = process.env.N8N_WEBHOOK_URL_FREEFORM;
    if (freeformWebhookUrl) {
      await fetch(freeformWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET
        },
        body: JSON.stringify({
          scan_id:         scanIdFreeform,
          email:           scan.email,
          hotel_name:      scan.hotel_name,
          location:        scan.location,
          tier:            scan.tier || 'free',
          user_id:         scan.user_id,
          is_new_user:     scan.is_new_user ?? false,
          mark_sent_token: markSentTokenFreeform
        })
      });
    }
  } catch (err) {
    console.error('freeform scan trigger error:', err);
    // don't fail the primary approval if the freeform run doesn't start
  }

  return res.status(200).send(html(scan.hotel_name, 'started'));
}

function html(hotelName, state) {
  const message = state === 'already_started'
    ? `Scan for <strong>${hotelName}</strong> was already started.`
    : `Scan started for <strong>${hotelName}</strong>. Findings will arrive in your inbox once complete.`;

  return `<!DOCTYPE html><html>
  <head><title>cpulze</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; color: #1a1a1a; }
    .badge { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6366f1; margin-bottom: 16px; }
    h2 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #555; line-height: 1.7; }
  </style>
  </head>
  <body>
    <div class="badge">cpulze</div>
    <h2>${state === 'already_started' ? 'Already running' : 'Scan started ✓'}</h2>
    <p>${message}</p>
  </body></html>`;
}
