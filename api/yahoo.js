const { getValidToken, encryptTokens, setSessionCookie, refreshAccessToken } = require('./_auth');

const YAHOO_API = 'https://fantasysports.yahooapis.com/fantasy/v2';

// Disable Vercel's default body parser so XML PUT/POST bodies are read raw from the stream
// Without this, Vercel may consume the stream but fail to store XML in req.body properly
module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  // Handle CORS preflight for PUT/POST
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const url = new URL(req.url, 'https://localhost');
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }
  if (endpoint.includes('..') || endpoint.includes('://')) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  let tokens = await getValidToken(req);
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const method = req.method || 'GET';
  const yahooUrl = `${YAHOO_API}/${endpoint}`;

  // Read body for PUT/POST requests
  let body = null;
  if (method === 'PUT' || method === 'POST') {
    body = await readBody(req);
  }

  if (method === 'PUT' || method === 'POST') {
    console.log(`[Yahoo Proxy] ${method} ${endpoint}, body length: ${body ? body.length : 0}, body preview: ${body ? body.slice(0, 200) : '(empty)'}`);
  }

  let resp = await fetchYahoo(yahooUrl, tokens.access_token, method, body);

  // Retry on 401 with token refresh
  if (resp.status === 401 && tokens.refresh_token) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed) {
      tokens = refreshed;
      const jwe = await encryptTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'bearer',
        expires_in: Math.max(1, Math.floor((tokens.expires_at - Date.now()) / 1000)),
      });
      setSessionCookie(res, jwe);
      resp = await fetchYahoo(yahooUrl, tokens.access_token, method, body);
    }
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Yahoo API error ${resp.status} [${method}]:`, errText.slice(0, 500));
    return res.status(resp.status).json({ error: 'Yahoo API error', status: resp.status, detail: errText.slice(0, 200) });
  }

  // For PUT/POST responses, Yahoo may return XML or empty
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    const data = await resp.json();
    res.status(200).json(data);
  } else {
    const text = await resp.text();
    res.status(200).json({ success: true, response: text.slice(0, 500) });
  }
};

async function fetchYahoo(url, accessToken, method = 'GET', body = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const opts = { method, headers };

  if (method === 'GET') {
    // Append format=json for GET requests
    const separator = url.includes('?') ? '&' : '?';
    headers['Content-Type'] = 'application/json';
    return fetch(`${url}${separator}format=json`, opts);
  } else {
    // PUT/POST: send body as-is (XML for roster changes)
    headers['Content-Type'] = 'application/xml';
    opts.body = body;
    return fetch(url, opts);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    // With bodyParser: false, always read raw body from stream
    // Check if Vercel pre-parsed anyway (safety fallback)
    if (typeof req.body === 'string' && req.body.length > 0) return resolve(req.body);
    if (Buffer.isBuffer(req.body) && req.body.length > 0) return resolve(req.body.toString());
    // Read from stream (primary path with bodyParser disabled)
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}