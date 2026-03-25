const { clearSessionCookie } = require('./_auth');

module.exports = (req, res) => {
  clearSessionCookie(res);
  res.writeHead(302, { Location: '/' });
  res.end();
};