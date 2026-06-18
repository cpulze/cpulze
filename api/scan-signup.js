import { createHmac } from 'crypto';

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

  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const isProd = host === 'cpulze.com';

  if (isProd || turnstileToken !== 'staging-bypass') {
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
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BREVO_KEY    = process.env.BREVO_API_KEY;

  const emailLower      = email.toLowerCase().trim();
  const hotelName       = hotel_name.trim();
  const locationTrimmed = location.trim();

  const vipEmails = ['info@nuwayzsystems.co.uk', 'info@cpulze.com', 'mdovais@gmail.com'];
  const isVip = vipEmails.includes(emailLower);

  const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  if (!isVip) {
    // 24-hour rate limit — max 3 submissions per email
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scans?email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${encodeURIComponent(since)}&select=scan_id`,
      { headers: sbHeaders }
    );
    const recentScans = await rateRes.json();
    if (Array.isArray(recentScans) && recentScans.length >= 3) {
      return res.status(429).json({ error: 'rate_limit_24h' });
    }

    // Lifetime limit — max 5 scans
    const lifetimeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scans?email=eq.${encodeURIComponent(emailLower)}&select=scan_id`,
      { headers: sbHeaders }
    );
    const lifetimeScans = await lifetimeRes.json();
    if (Array.isArray(lifetimeScans) && lifetimeScans.length >= 5) {
      return res.status(429).json({ error: 'scan_limit_reached' });
    }
  }

  // Create or find Supabase auth user
  let userId, isNewUser;

  const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify({ email: emailLower, email_confirm: true, user_metadata: { hotel_name: hotelName } })
  });

  if (!createUserRes.ok) {
    if (createUserRes.status !== 422) {
      console.error('User creation error:', await createUserRes.text());
      return res.status(500).json({ error: 'Failed to create account' });
    }
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: sbHeaders }
    );
    const listData = await listRes.json();
    const existing = listData.users?.find(u => u.email === emailLower);
    if (!existing) return res.status(500).json({ error: 'Could not locate account' });
    userId    = existing.id;
    isNewUser = false;
  } else {
    const newUser = await createUserRes.json();
    userId    = newUser.id;
    isNewUser = true;

    await fetch(`${SUPABASE_URL}/rest/v1/scan_users`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, email: emailLower, tier: 'free' })
    });

    await fetch(`${SUPABASE_URL}/rest/v1/hotel_profiles`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, hotel_name: hotelName, location: locationTrimmed })
    });
  }

  // Generate scan ID (same format as n8n)
  const alpha  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alnum  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const now    = new Date();
  const dt     = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') +
    String(now.getMilliseconds()).padStart(3, '0');
  const rand   = (set, n) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  const scanId = alpha[Math.floor(Math.random() * alpha.length)] + dt + alpha[Math.floor(Math.random() * alpha.length)] + rand(alnum, 3);

  // Store scan request as pending_review
  await fetch(`${SUPABASE_URL}/rest/v1/scans`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      scan_id:       scanId,
      email:         emailLower,
      hotel_name:    hotelName,
      location:      locationTrimmed,
      tier:          'free',
      model:         'perplexity',
      status:        'pending_review',
      user_id:       userId,
      is_new_user:   isNewUser,
      themes_found:  0,
      themes_shown:  0,
      themes_gated:  0,
      gate_teaser:   ''
    })
  });

  // Generate HMAC approval token
  const token      = createHmac('sha256', process.env.APPROVAL_SECRET || 'fallback-secret').update(scanId).digest('hex');
  const origin     = isProd ? 'https://cpulze.com' : `https://${host}`;
  const approvalUrl = `${origin}/api/approve-scan?scan_id=${encodeURIComponent(scanId)}&token=${encodeURIComponent(token)}`;

  const brevoPost = async (to, subject, htmlContent, senderName = 'cpulze pulse', senderEmail = 'pulse@cpulze.com') => {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent
      })
    });
  };

  // Acknowledgment to guest
  await brevoPost(
    emailLower,
    `We're scanning ${hotelName} now`,
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <div style="padding:24px 0 8px;">
        <span style="font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#6366f1;">cpulze</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;">We're scanning ${hotelName} now.</h2>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 16px;">
        We've received your request and are scanning TripAdvisor and other sources to find what AI is surfacing about your property.
      </p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 16px;">
        You'll receive a personal findings report from Ovais at cpulze within the next 24 hours.
      </p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 32px;">
        Questions in the meantime? Reply to this email or write to <a href="mailto:ovais@cpulze.com" style="color:#6366f1;">ovais@cpulze.com</a>.
      </p>
      <p style="font-size:14px;color:#1a1a1a;margin:0 0 2px;font-weight:600;">Ovais</p>
      <p style="font-size:12px;color:#888;margin:0 0 32px;">Founder, cpulze</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:11px;color:#ccc;margin:0;">cpulze · <a href="mailto:pulse@cpulze.com" style="color:#ccc;">pulse@cpulze.com</a></p>
    </body></html>`
  );

  // Approval notification to Ovais
  await brevoPost(
    'ovais@cpulze.com',
    `New scan request — ${hotelName}`,
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 20px;">New scan request</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="font-size:13px;color:#888;padding:6px 0;width:120px;">Hotel</td><td style="font-size:14px;font-weight:600;">${hotelName}</td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Location</td><td style="font-size:14px;">${locationTrimmed}</td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Guest email</td><td style="font-size:14px;"><a href="mailto:${emailLower}" style="color:#6366f1;">${emailLower}</a></td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Scan ID</td><td style="font-size:12px;color:#aaa;">${scanId}</td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Submitted</td><td style="font-size:14px;">${now.toUTCString()}</td></tr>
      </table>
      <a href="${approvalUrl}" style="display:inline-block;background:#6366f1;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
        Start Scan →
      </a>
      <p style="font-size:12px;color:#aaa;margin-top:16px;">Clicking this starts the Perplexity + Claude scan. Findings will come back to you for review before anything is sent to the guest.</p>
    </body></html>`
  );

  return res.status(200).json({ success: true });
}
