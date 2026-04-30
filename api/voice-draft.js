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

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  });
  if (!userRes.ok) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { hotel_name, theme, finding_para, verbatim_quote, owner_context } = req.body;

  if (!owner_context?.trim()) {
    return res.status(400).json({ error: 'owner_context is required' });
  }

  const prompt = `You are helping the owner of ${hotel_name} write a PropertyVoice update — a brief, credible public statement addressing a specific guest complaint that AI search engines have been citing about their property.

The complaint theme: ${theme}
The guest quote AI is surfacing: "${verbatim_quote}"
${finding_para ? `Context: ${finding_para}` : ''}

The owner has told us what they have done about it:
"${owner_context}"

Write a PropertyVoice update (2-3 short paragraphs, 120-180 words) that:
1. Acknowledges the specific issue honestly without being defensive
2. Describes the concrete action taken using the owner's own details
3. Closes with a warm, confident invitation for future guests to notice the improvement

Rules:
— No marketing language, superlatives, or "we are committed to excellence" boilerplate
— Use specific details from the owner's context — they are more credible than general statements
— Warm, honest, professional tone
— Write only the response text with no labels or preamble`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await claudeRes.json();
    const draft = data.content?.[0]?.text || '';
    return res.status(200).json({ draft });
  } catch (err) {
    console.error('voice draft error:', err);
    return res.status(500).json({ error: 'Failed to generate draft' });
  }
}
