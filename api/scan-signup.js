export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, hotel_name, location } = req.body || {};

  if (!email || !hotel_name || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const BREVO_KEY = process.env.BREVO_API_KEY;
  const emailLower = email.toLowerCase().trim();
  const hotelName = hotel_name.trim();
  const locationTrimmed = location.trim();
  const now = new Date();

  const brevoPost = async (to, subject, htmlContent, senderName = 'cpulze pulse', senderEmail = 'pulse@cpulze.com') => {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent
      })
    });
    if (!resp.ok) {
      console.error('Brevo send failed:', await resp.text());
    }
    return resp.ok;
  };

  // Notification to Ovais — the actual scan request details
  const notifySent = await brevoPost(
    'ovais@cpulze.com',
    `New scan request — ${hotelName}`,
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 20px;">New scan request</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="font-size:13px;color:#888;padding:6px 0;width:120px;">Hotel</td><td style="font-size:14px;font-weight:600;">${hotelName}</td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Location</td><td style="font-size:14px;">${locationTrimmed}</td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Guest email</td><td style="font-size:14px;"><a href="mailto:${emailLower}" style="color:#6366f1;">${emailLower}</a></td></tr>
        <tr><td style="font-size:13px;color:#888;padding:6px 0;">Submitted</td><td style="font-size:14px;">${now.toUTCString()}</td></tr>
      </table>
    </body></html>`
  );

  if (!notifySent) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  // Acknowledgment to the guest — matches the 48-hour promise on the site
  await brevoPost(
    emailLower,
    `We're scanning ${hotelName} now`,
    `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:24px;">
      <div style="padding:24px 0 8px;">
        <span style="font-size:13px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#6366f1;">cpulze</span>
      </div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;">We're scanning ${hotelName} now.</h2>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 16px;">
        We've received your request. You'll get a personal AI narrative report from Ovais at cpulze within 48 hours.
      </p>
      <p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 16px;">
        Questions in the meantime? Reply to this email or write to <a href="mailto:ovais@cpulze.com" style="color:#6366f1;">ovais@cpulze.com</a>.
      </p>
      <p style="font-size:14px;color:#1a1a1a;margin:0 0 2px;font-weight:600;">Ovais</p>
      <p style="font-size:12px;color:#888;margin:0 0 32px;">Founder, cpulze</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-size:11px;color:#ccc;margin:0;">cpulze · <a href="mailto:pulse@cpulze.com" style="color:#ccc;">pulse@cpulze.com</a></p>
    </body></html>`
  );

  return res.status(200).json({ success: true });
}
