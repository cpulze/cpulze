// In-memory tracker for basic rate limiting
const ipTracker = new Map();

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- 1.5 VIP WHITELIST ---
  const vipEmails = [
    'info@nuwayzsystems.co.uk',
    'info@cpulze.com',
    'mdovais@gmail.com'
  ];

  // Extract email from payload safely
  const userEmail = req.body.email ? req.body.email.toLowerCase().trim() : '';
  const isVip = vipEmails.includes(userEmail);
  // -------------------------

  // --- 2. RATE LIMITING (5 requests per 30 mins, bypassed for VIPs) ---
  const ip = req.headers['x-forwarded-for'] || 'unknown_ip';
  const currentTime = Date.now();
  const windowMs = 30 * 60 * 1000;
  const maxRequests = 5;

  if (!isVip) {
    if (ipTracker.has(ip)) {
      const userData = ipTracker.get(ip);
      if (currentTime - userData.timestamp < windowMs) {
        if (userData.count >= maxRequests) {
          console.warn(`Rate limit blocked IP: ${ip}`);
          return res.status(429).json({ error: 'Too many requests. Try again later.' });
        }
        userData.count += 1;
      } else {
        ipTracker.set(ip, { count: 1, timestamp: currentTime });
      }
    } else {
      ipTracker.set(ip, { count: 1, timestamp: currentTime });
    }
  } else {
    console.log(`VIP user ${userEmail} bypassed rate limit.`);
  }
  // ----------------------------------------------------

  // --- 3. CLOUDFLARE TURNSTILE VERIFICATION ---
  const turnstileToken = req.body.turnstileToken;
  
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
    console.warn('Turnstile verification failed');
    return res.status(403).json({ error: 'Failed security challenge' });
  }
  // --------------------------------------------

  // 4. Pull secret URLs from Vercel Environment Variables
  const N8N_URL = process.env.N8N_WEBHOOK_URL;
  const SECRET = process.env.WEBHOOK_SECRET;

  if (!N8N_URL) {
    return res.status(500).json({ error: 'Backend misconfigured' });
  }

  // 5. Forward the secure payload to n8n
  try {
    const response = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': SECRET
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      throw new Error('n8n workflow rejected the request');
    }

    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('API Route Error:', error);
    return res.status(500).json({ error: 'Failed to trigger scan' });
  }
}
