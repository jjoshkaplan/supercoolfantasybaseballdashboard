const crypto = require('crypto');
const { BASE_URL } = require('./_auth');

module.exports = (req, res) => {
  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Store code_verifier in a cookie so callback can use it
  const isLocalhost = BASE_URL.includes('localhost');
  const verifierCookie = [
    `scfbd_verifier=${codeVerifier}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=600',
    'SameSite=Lax',
    ...(isLocalhost ? [] : ['Secure']),
  ].join('; ');

  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth-callback`,
    response_type: 'code',
    scope: 'fspt-w',
    language: 'en-us',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.setHeader('Set-Cookie', verifierCookie);
  res.writeHead(302, { Location: `https://api.login.yahoo.com/oauth2/request_auth?${params}` });
  res.end();
};