const { getValidToken, encryptTokens, setSessionCookie } = require('./_auth');

module.exports = async (req, res) => {
  const tokens = await getValidToken(req);
  if (!tokens) {
    return res.status(200).json({ authenticated: false });
  }

  const jwe = await encryptTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type,
    expires_in: Math.max(1, Math.floor((tokens.expires_at - Date.now()) / 1000)),
  });
  setSessionCookie(res, jwe);
  res.status(200).json({ authenticated: true });
};
