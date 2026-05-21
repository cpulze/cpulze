export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, hotel_name, location, turnstileToken } = req.body || {};

  if (!email || !hotel_name || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (!turnstileToken) {
    return res.status(400).json({ error: 'Security token missing' });
  }

  const cfVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.TURNSTILE_SECRET_KEY}&response=${turnstileToken}`
  });
  const cfData = await cfVerify.json();
  if (!cfData.success) {
    console.error('Turnstile failed:', JSON.stringify(cfData));
    return res.status(403).json({ error: 'Failed security challenge' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emailLower = email.toLowerCase().trim();
  const hotelName = hotel_name.trim();
  const locationTrimmed = location.trim();

  const vipEmails = ['info@nuwayzsystems.co.uk', 'mdovais@gmail.com'];
  const isVip = vipEmails.includes(emailLower);

  // Check lifetime scan limit and whether email is verified (has prior scan)
  const limitRes = await fetch(
    `${SUPABASE_URL}/rest/v1/free_scan_leads?email=eq.${encodeURIComponent(emailLower)}&select=id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const leads = await limitRes.json();

  if (!isVip) {
    if (Array.isArray(leads) && leads.length >= 5) {
      return res.status(429).json({ error: 'scan_limit_reached' });
    }
  }

  const isReturningUser = Array.isArray(leads) && leads.length > 0;

  // Insert scan request record
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/scan_requests`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      email: emailLower,
      hotel_name: hotelName,
      location: locationTrimmed,
      tier: 'free',
      model: 'perplexity',
      theme: 'cleanliness',
      status: isReturningUser || isVip ? 'confirmed' : 'pending'
    })
  });

  const insertData = await insertRes.json();
  if (!insertRes.ok || !insertData[0]?.request_id) {
    console.error('Supabase insert error:', insertData);
    return res.status(500).json({ error: 'Failed to create scan request' });
  }

  // Returning users and VIPs skip confirmation — trigger scan immediately
  if (isReturningUser || isVip) {
    try {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          email: emailLower,
          hotel_name: hotelName,
          location: locationTrimmed,
          tier: 'free',
          model: 'perplexity',
          theme: 'cleanliness',
        }),
      });
    } catch (err) {
      console.error('n8n trigger error:', err);
      return res.status(500).json({ error: 'Failed to trigger scan. Please try again.' });
    }
    return res.status(200).json({ success: true, queued: true });
  }

  const requestId = insertData[0].request_id;
  const allowedOrigins = ['https://cpulze.com', 'https://stage.cpulze.com'];
  const requestOrigin = req.headers['origin'] || req.headers['referer'] || '';
  const baseUrl = allowedOrigins.find(o => requestOrigin.startsWith(o)) || 'https://cpulze.com';
  const confirmUrl = `${baseUrl}/api/confirm-scan?token=${requestId}`;

  const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
  <div style="padding:24px 0 16px;">
    <span style="font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#6366f1;">cpulze</span>
  </div>
  <p style="font-size:16px;font-weight:600;margin:0 0 8px;color:#1a1a1a;">One tap to find out what AI is saying about ${hotelName}.</p>
  <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 28px;">
    You requested a free AI narrative scan. Click below to confirm —
  </p>
  <a href="${confirmUrl}"
     style="display:inline-block;background:#1a1a2e;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;margin-bottom:28px;">
    Confirm &amp; run my scan →
  </a>
  <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
    We'll check what AI narratives are telling guests about your property and the report lands in your inbox within 15 minutes.
  </p>
  <p style="font-size:12px;color:#999;margin:0 0 24px;">
    Link expires in 24 hours. If this wasn't you, ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#ccc;margin:0;">cpulze · pulse@cpulze.com</p>
</div>`;

  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'cpulze', email: 'noreply@cpulze.com' },
      to: [{ email: emailLower }],
      subject: `Confirm your free AI scan for ${hotelName}`,
      htmlContent: emailHtml
    })
  });

  if (!brevoRes.ok) {
    console.error('Brevo error:', await brevoRes.text());
    return res.status(500).json({ error: 'Failed to send confirmation email' });
  }

  return res.status(200).json({ success: true });
}
