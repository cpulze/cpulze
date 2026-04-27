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
    return res.status(403).json({ error: 'Failed security challenge' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emailLower = email.toLowerCase().trim();
  const hotelName = hotel_name.trim();
  const locationTrimmed = location.trim();

  const vipEmails = ['info@nuwayzsystems.co.uk', 'info@cpulze.com', 'mdovais@gmail.com'];
  const isVip = vipEmails.includes(emailLower);

  if (!isVip) {
    // Check lifetime scan limit
    const limitRes = await fetch(
      `${SUPABASE_URL}/rest/v1/free_scan_leads?email=eq.${encodeURIComponent(emailLower)}&select=id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const leads = await limitRes.json();
    if (Array.isArray(leads) && leads.length >= 5) {
      return res.status(429).json({ error: 'scan_limit_reached' });
    }

    // Prevent duplicate pending requests within 10 mins
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scan_requests?email=eq.${encodeURIComponent(emailLower)}&status=eq.pending&created_at=gte.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}&select=request_id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const recent = await recentRes.json();
    if (Array.isArray(recent) && recent.length > 0) {
      return res.status(429).json({ error: 'confirmation_pending' });
    }
  }

  // Insert scan request
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
      status: 'pending'
    })
  });

  const insertData = await insertRes.json();
  if (!insertRes.ok || !insertData[0]?.request_id) {
    console.error('Supabase insert error:', insertData);
    return res.status(500).json({ error: 'Failed to create scan request' });
  }

  const requestId = insertData[0].request_id;
  const confirmUrl = `https://cpulze.com/api/confirm-scan?token=${requestId}`;

  const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
  <div style="padding:24px 0 8px;">
    <span style="font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#6366f1;">cpulze</span>
  </div>
  <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;">Confirm your scan for ${hotelName}</h2>
  <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
    Click below to confirm and run your free AI narrative scan for <strong>${hotelName}</strong> in ${locationTrimmed}.
    Your report will arrive in this inbox within a few minutes.
  </p>
  <a href="${confirmUrl}"
     style="display:inline-block;background:#6366f1;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
    Confirm &amp; run scan →
  </a>
  <p style="font-size:12px;color:#999;margin:0 0 24px;">
    Link expires in 24 hours. If you didn't request this scan, ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#ccc;margin:0;">
    cpulze · pulse@cpulze.com · cpulze is a trading name of Nuwayz Systems Ltd
  </p>
</div>`;

  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'cpulze', email: 'pulse@cpulze.com' },
      to: [{ email: emailLower }],
      subject: `Confirm your AI scan for ${hotelName}`,
      htmlContent: emailHtml
    })
  });

  if (!brevoRes.ok) {
    console.error('Brevo error:', await brevoRes.text());
    return res.status(500).json({ error: 'Failed to send confirmation email' });
  }

  return res.status(200).json({ success: true });
}
