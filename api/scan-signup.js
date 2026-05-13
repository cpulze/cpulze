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

  // Step 1: Create Supabase auth user (email_confirm: true skips the verify email)
  const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: emailLower, email_confirm: true })
  });

  if (!createUserRes.ok) {
    if (createUserRes.status === 422) {
      return res.status(409).json({ error: 'account_exists' });
    }
    console.error('User creation error:', await createUserRes.text());
    return res.status(500).json({ error: 'Failed to create account' });
  }

  const newUser = await createUserRes.json();
  const userId = newUser.id;

  // Step 2: Create scan_users record (trial start)
  await fetch(`${SUPABASE_URL}/rest/v1/scan_users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ user_id: userId })
  });

  // Step 3: Create hotel_profiles record
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

  // Step 4: Send magic link so user can access dashboard
  await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=https%3A%2F%2Fapp.cpulze.com%2Fdashboard%2F`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: emailLower, create_user: false })
  });

  // Step 5: Trigger n8n auth workflow with user context
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
        is_new_user: true
      })
    });
  } catch (err) {
    console.error('n8n trigger error:', err);
  }

  return res.status(200).json({ success: true });
}
