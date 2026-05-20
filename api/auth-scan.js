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
  if (!hotel_name || !location) {
    return res.status(400).json({ error: 'hotel_name and location are required' });
  }

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
    return res.status(400).json({ error: 'Account not found' });
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
        hotel_name: hotel_name.trim(),
        location: location.trim(),
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
