// api/udesk.js
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS - 限制为你的店铺域名更安全；开发时可先用 *
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // e.g. https://your-shop.myshopify.com
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  try {
    const payload = req.body; // expect { ticket: { ... } }
    if (!payload || !payload.ticket) {
      return res.status(400).json({ error: 'Missing ticket payload' });
    }

    const admin = process.env.UDESK_ADMIN_EMAIL;
    const token = process.env.UDESK_API_TOKEN;
    if (!admin || !token) {
      return res.status(500).json({ error: 'Server not configured (missing UDESK env vars)' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    // Udesk v2 sign = sha256("email&token&timestamp&nonce&v2")
    const raw = `${admin}&${token}&${timestamp}&${nonce}&v2`;
    const sign = crypto.createHash('sha256').update(raw).digest('hex');

    const url = `https://demo.udesk.cn/open_api_v1/tickets?email=${encodeURIComponent(admin)}&timestamp=${timestamp}&sign=${sign}&nonce=${nonce}&sign_version=v2`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    // 将 Udesk 的响应原样返回给前端（或可按需处理）
    res.status(resp.status).json(data);
  } catch (err) {
    console.error('udesk-proxy error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}