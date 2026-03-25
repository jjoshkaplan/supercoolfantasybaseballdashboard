const { encryptTokens, setSessionCookie, BASE_URL } = require('./_auth');

module.exports = async (req, res) => {
  const code = new URL(req.url, BASE_URL).searchParams.get('code');
  if (!code) {
    res.writeHead(302, { Location: '/?error=no_code' });
    return res.end();
  }

  // Read the PKCE code_verifier from the cookie
  const cookies = req.headers.cookie || '';
  const verifierMatch = cookies.split(';').find(c => c.trim().startsWith('scfbd_verifier='));
  const codeVerifier = verifierMatch ? verifierMatch.split('=').slice(1).join('=').trim() : '';

  try {
    const body = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${BASE_URL}/api/auth-callback`,
      client_id: process.env.YAHOO_CLIENT_ID,
      client_secret: process.env.YAHOO_CLIENT_SECRET,
    };

    // Include code_verifier if we have it (PKCE)
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const tokenResp = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error('Token exchange failed:', err);
      res.writeHead(302, { Location: '/?error=token_failed' });
      return res.end();
    }

    const tokenData = await tokenResp.json();
    const jwe = await encryptTokens(tokenData);
    setSessionCookie(res, jwe);

    // Clear the verifier cookie
    const isLocalhost = BASE_URL.includes('localhost');
    const clearVerifier = [
      'scfbd_verifier=',
      'Path=/',
      'HttpOnly',
      'Max-Age=0',
      'SameSite=Lax',
      ...(isLocalhost ? [] : ['Secure']),
    ].join('; ');

    // Set both cookies (session + clear verifier)
    const sessionCookieHeader = res.getHeader('Set-Cookie');
    if (sessionCookieHeader) {
      res.setHeader('Set-Cookie', [sessionCookieHeader, clearVerifier]);
    }

    res.writeHead(302, { Location: '/dashboard.html' });
    res.end();
  } catch (e) {
    console.error('Callback error:', e);
    res.writeHead(302, { Location: '/?error=callback_failed' });
    res.end();
  }
};