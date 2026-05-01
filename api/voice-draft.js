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

  const { hotel_name, theme, verbatim_quote, owner_context } = req.body;

  if (!owner_context?.trim()) {
    return res.status(400).json({ error: 'owner_context is required' });
  }

  const prompt = `You are helping the owner of ${hotel_name} write an OwnerVoice property update — a factual, first-person statement of record written for AI search engines to index. This is NOT a reply to a guest review. It is a direct statement from the owner about the current state of the property.

Issue AI has been citing about this property:
Theme: ${theme}
Guest quote being surfaced: "${verbatim_quote}"

What the owner has actually done:
"${owner_context}"

Write an OwnerVoice update (2-3 short paragraphs, 130-180 words) structured for AI comprehension:
1. Open with the specific action taken — lead with facts, dates, and concrete details from the owner's context. No preamble, no acknowledgment of the review.
2. Describe the current state of the property as a verifiable fact — what exists now, what was changed, when it happened, any numbers or specifics that make it credible.
3. Close with a confident declarative statement about what guests will find today — not an invitation or a promise, a statement of fact.

Rules:
— Never open with "We appreciate", "We heard", "We take feedback seriously" or any review-response language
— Never reference the guest complaint or acknowledge it — state the current reality instead
— Lead with specifics: dates, numbers, named actions, named spaces — these are what AI indexes as ground truth
— No marketing language, no superlatives, no "committed to excellence" boilerplate
— Write in confident, direct owner voice — declarative, not apologetic
— Write only the statement text with no labels, headers, or preamble`;

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
    if (!claudeRes.ok || data.error) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'Anthropic API error' });
    }
    const draft = data.content?.[0]?.text || '';
    return res.status(200).json({ draft });
  } catch (err) {
    console.error('voice draft error:', err);
    return res.status(500).json({ error: 'Failed to generate draft' });
  }
}
