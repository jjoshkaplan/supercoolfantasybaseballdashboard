const { EncryptJWT, jwtDecrypt } = require('jose');

const SECRET = new TextEncoder().encode(
  (process.env.TOKEN_SECRET || '').padEnd(32, '0').slice(0, 32)
);
const COOKIE_NAME = 'scfbd_session';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://supercoolfantasybaseballdashboard.xyz';

async function encryptTokens(tokenData) {
  return await new EncryptJWT({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .encrypt(SECRET);
}

async function decryptTokens(cookie) {
  try {
    const { payload } = await jwtDecrypt(cookie, SECRET);
    return payload;
  } catch (e) {
    return null;
  }
}

function getSessionCookie(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').find(c => c.trim().startsWith(COOKIE_NAME + '='));
  return match ? match.split('=').slice(1).join('=').trim() : null;
}

function setSessionCookie(res, jwe) {
  const isLocalhost = BASE_URL.includes('localhost');
  const cookie = [
    `${COOKIE_NAME}=${jwe}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${30 * 24 * 60 * 60}`,
    'SameSite=Lax',
    ...(isLocalhost ? [] : ['Secure']),
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

async function getValidToken(req) {
  const cookie = getSessionCookie(req);
  if (!cookie) return null;
  const tokens = await decryptTokens(cookie);
  if (!tokens) return null;
  if (tokens.expires_at && Date.now() > tokens.expires_at - 60000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed) return refreshed;
    return null;
  }
  return tokens;
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.YAHOO_CLIENT_ID,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.refresh_token) data.refresh_token = refreshToken;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

module.exports = {
  encryptTokens, decryptTokens, getSessionCookie, setSessionCookie,
  clearSessionCookie, getValidToken, refreshAccessToken, COOKIE_NAME, BASE_URL,
};