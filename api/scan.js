export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Pull secret URLs from Vercel Environment Variables (not hardcoded)
  const N8N_URL = process.env.N8N_WEBHOOK_URL;
  const SECRET = process.env.WEBHOOK_SECRET;

  if (!N8N_URL) {
    return res.status(500).json({ error: 'Backend misconfigured' });
  }

  // 3. Forward the secure payload to n8n
  try {
    const response = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': SECRET // Ensures n8n knows it's really from Vercel
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
