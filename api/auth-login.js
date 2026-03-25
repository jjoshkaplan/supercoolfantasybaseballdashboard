const { BASE_URL } = require('./_auth');

module.exports = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth-callback`,
    response_type: 'code',
    scope: 'fspt-r',
    language: 'en-us',
  });
  res.writeHead(302, { Location: `https://api.login.yahoo.com/oauth2/request_auth?${params}` });
  res.end();
};