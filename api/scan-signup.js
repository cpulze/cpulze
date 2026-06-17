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
  const isStaging = host.includes('stage') || host.includes('localhost') || host.includes('vercel.app');
  const turnstileSecret = isStaging ? '1x0000000000000000000000000000000AA' : process.env.TURNSTILE_SECRET_KEY;

  const cfVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${turnstileSecret}&response=${turnstileToken}`
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

  const vipEmails = ['info@nuwayzsystems.co.uk', 'info@cpulze.com', 'mdovais@gmail.com'];
  const isVip = vipEmails.includes(emailLower);

  // Step 1: Create Supabase auth user (email_confirm: true skips the verify email)
  const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: emailLower, email_confirm: true, user_metadata: { hotel_name: hotelName } })
  });

  let userId, isNewUser;

  if (!createUserRes.ok) {
    if (createUserRes.status !== 422) {
      console.error('User creation error:', await createUserRes.text());
      return res.status(500).json({ error: 'Failed to create account' });
    }

    // Existing user — look up their user_id via admin list
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const listData = await listRes.json();
    const existingUser = listData.users?.find(u => u.email === emailLower);
    if (!existingUser) {
      return res.status(500).json({ error: 'Could not locate account. Please try signing in.' });
    }
    userId = existingUser.id;
    isNewUser = false;

    // Check scan limit for existing user — query by email, same as auth-scan.js
    if (!isVip) {
      const scansRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scans?email=eq.${encodeURIComponent(emailLower)}&select=scan_id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const existingScans = await scansRes.json();
      if (Array.isArray(existingScans) && existingScans.length >= 5) {
        return res.status(429).json({ error: 'scan_limit_reached' });
      }
    }
  } else {
    const newUser = await createUserRes.json();
    userId = newUser.id;
    isNewUser = true;

    // Create scan_users record (trial start)
    await fetch(`${SUPABASE_URL}/rest/v1/scan_users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ user_id: userId, email: emailLower, tier: 'free' })
    });

    // Create hotel_profiles record
    await fetch(`${SUPABASE_URL}/rest/v1/hotel_profiles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ user_id: userId, hotel_name: hotelName, location: locationTrimmed })
    });
  }

  if (isNewUser) {
    // New user: send magic link to confirm email ownership — scan triggers from /confirmed/ after they click
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'app.cpulze.com';
    const appOrigin = host.includes('stage') ? 'https://app.stage.cpulze.com' : 'https://app.cpulze.com';
    const confirmedUrl = `${appOrigin}/confirmed/?hotel=${encodeURIComponent(hotelName)}&loc=${encodeURIComponent(locationTrimmed)}`;
    const redirectTo = encodeURIComponent(confirmedUrl);
    await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${redirectTo}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: emailLower, create_user: false })
    });
  } else {
    // Existing user: already verified — trigger scan immediately via n8n
    const webhookUrl = process.env.N8N_WEBHOOK_URL_AUTH || process.env.N8N_WEBHOOK_URL;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.WEBHOOK_SECRET
        },
        body: JSON.stringify({
          email: emailLower,
          hotel_name: hotelName,
          location: locationTrimmed,
          tier: 'free',
          user_id: userId,
          is_new_user: false
        })
      });
    } catch (err) {
      console.error('n8n trigger error:', err);
    }
  }

  return res.status(200).json({ success: true, is_new_user: isNewUser });
}
