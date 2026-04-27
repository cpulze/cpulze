export default async function handler(req, res) {
  const token = req.query.token;

  if (!token) {
    return res.redirect('/');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scan_requests?request_id=eq.${token}&select=*`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const requests = await lookupRes.json();
  const request = requests[0];

  if (!request) {
    return res.redirect('/?error=invalid_token');
  }

  if (request.status !== 'pending') {
    return res.redirect('/scan-confirmed.html?already=true');
  }

  // Check 24hr expiry
  if (Date.now() - new Date(request.created_at).getTime() > 24 * 60 * 60 * 1000) {
    await fetch(`${SUPABASE_URL}/rest/v1/scan_requests?request_id=eq.${token}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'expired' })
    });
    return res.redirect('/?error=link_expired');
  }

  // Mark confirmed
  await fetch(`${SUPABASE_URL}/rest/v1/scan_requests?request_id=eq.${token}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'confirmed', completed_at: new Date().toISOString() })
  });

  // Trigger n8n scan
  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET
      },
      body: JSON.stringify({
        email: request.email,
        hotel_name: request.hotel_name,
        location: request.location,
        tier: request.tier || 'free',
        model: request.model || 'perplexity',
        theme: request.theme || 'cleanliness'
      })
    });
  } catch (err) {
    console.error('n8n trigger error:', err);
  }

  return res.redirect('/scan-confirmed.html');
}
