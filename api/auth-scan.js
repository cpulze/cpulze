export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userToken = authHeader.slice(7);

  const { hotel_name, location } = req.body || {};

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

  // Get account creation date
  const scanUserRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scan_users?user_id=eq.${user.id}&select=created_at`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const scanUsers = await scanUserRes.json();
  const scanUser = scanUsers[0];
  if (!scanUser) {
  await fetch(`${SUPABASE_URL}/rest/v1/scan_users`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, email: user.email.toLowerCase(), tier: 'free' })
  });
}
  // Count scans by email since account creation
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

  // Resolve hotel details — from request body (dashboard form) or hotel_profiles (/confirmed/ flow)
  let hotelName = hotel_name?.trim();
  let hotelLocation = location?.trim();

  if (!hotelName || !hotelLocation) {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/hotel_profiles?user_id=eq.${user.id}&select=hotel_name,location`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const profiles = await profileRes.json();
    const profile = profiles[0];
    if (profile) {
      hotelName = hotelName || profile.hotel_name;
      hotelLocation = hotelLocation || profile.location;
    }
  }

  if (!hotelName || !hotelLocation) {
    return res.status(400).json({ error: 'hotel_name and location are required' });
  }

  // Trigger n8n webhook
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
        hotel_name: hotelName,
        location: hotelLocation,
        tier: 'free',
        user_id: user.id,
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
