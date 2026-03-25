const { getValidToken, encryptTokens, setSessionCookie, refreshAccessToken } = require('../lib/auth');

const YAHOO_API = 'https://fantasysports.yahooapis.com/fantasy/v2';

module.exports = async (req, res) => {
  // Get the endpoint from query param
  const url = new URL(req.url, 'https://localhost');
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  // Validate endpoint doesn't escape the fantasy API
  if (endpoint.includes('..') || endpoint.includes('://')) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  let tokens = await getValidToken(req);
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const yahooUrl = `${YAHOO_API}/${endpoint}`;

  // First attempt
  let resp = await fetchYahoo(yahooUrl, tokens.access_token);

  // If 401, try token refresh
  if (resp.status === 401 && tokens.refresh_token) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed) {
      tokens = refreshed;
      // Update cookie with refreshed tokens
      const jwe = await encryptTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'bearer',
        expires_in: Math.max(1, Math.floor((tokens.expires_at - Date.now()) / 1000)),
      });
      setSessionCookie(res, jwe);
      resp = await fetchYahoo(yahooUrl, tokens.access_token);
    }
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Yahoo API error ${resp.status}:`, errText.slice(0, 500));
    return res.status(resp.status).json({ error: 'Yahoo API error', status: resp.status });
  }

  const data = await resp.json();
  res.status(200).json(data);
};

async function fetchYahoo(url, accessToken) {
  return fetch(`${url}?format=json`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}
