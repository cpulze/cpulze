export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userToken = authHeader.slice(7);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Verify JWT and get user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  });
  if (!userRes.ok) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const user = await userRes.json();

  // Get hotel profile
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/hotel_profiles?user_id=eq.${user.id}&select=*`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const profiles = await profileRes.json();
  const profile = profiles[0];
  if (!profile) {
    return res.status(400).json({ error: 'No hotel profile found. Complete onboarding first.' });
  }

  // Get account creation date
  const scanUserRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scan_users?user_id=eq.${user.id}&select=created_at`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const scanUsers = await scanUserRes.json();
  const scanUser = scanUsers[0];
  if (!scanUser) {
    return res.status(400).json({ error: 'Account not found' });
  }

  // Check 30-day trial
  const trialEnds = new Date(scanUser.created_at).getTime() + 30 * 24 * 60 * 60 * 1000;
  if (Date.now() > trialEnds) {
    return res.status(403).json({ error: 'trial_expired' });
  }

  // Count scans since account creation (by email, since auth scans use the same table)
  const emailLower = user.email.toLowerCase();
  const scansRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scans?email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${encodeURIComponent(scanUser.created_at)}&select=scan_id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const existingScans = await scansRes.json();
  const currentCount = Array.isArray(existingScans) ? existingScans.length : 0;

  if (currentCount >= 5) {
    return res.status(429).json({ error: 'scan_limit_reached' });
  }

  // Trigger n8n webhook for authenticated scan
  const webhookUrl = process.env.N8N_WEBHOOK_URL_AUTH || process.env.N8N_WEBHOOK_URL;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        email: emailLower,
        hotel_name: profile.hotel_name,
        location: profile.location,
        tier: 'free_trial',
        user_id: user.id,
        themes: ['cleanliness', 'service', 'location', 'value', 'atmosphere'],
      }),
    });
  } catch (err) {
    console.error('n8n trigger error:', err);
    return res.status(500).json({ error: 'Failed to trigger scan. Please try again.' });
  }

  return res.status(200).json({
    success: true,
    scans_used: currentCount + 1,
    scans_remaining: 4 - currentCount,
  });
}
