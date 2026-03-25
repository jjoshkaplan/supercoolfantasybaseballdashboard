const { encryptTokens, setSessionCookie, BASE_URL } = require('../../lib/auth');

module.exports = async (req, res) => {
  const code = new URL(req.url, BASE_URL).searchParams.get('code');
  if (!code) {
    res.writeHead(302, { Location: '/?error=no_code' });
    return res.end();
  }

  try {
    const tokenResp = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL}/api/auth/callback`,
        client_id: process.env.YAHOO_CLIENT_ID,
        client_secret: process.env.YAHOO_CLIENT_SECRET,
      }),
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
    res.writeHead(302, { Location: '/dashboard' });
    res.end();
  } catch (e) {
    console.error('Callback error:', e);
    res.writeHead(302, { Location: '/?error=callback_failed' });
    res.end();
  }
};
