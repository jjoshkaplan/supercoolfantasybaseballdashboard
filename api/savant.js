// Savant API proxy — bypasses CORS for Baseball Savant CSV/JSON endpoints
module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://localhost');
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  // Only allow baseballsavant leaderboard paths
  const allowed = ['/leaderboard/percentile-rankings', '/leaderboard/pitch-arsenal-stats'];
  if (!allowed.some(a => endpoint.startsWith(a))) {
    return res.status(400).json({ error: 'Endpoint not allowed' });
  }

  const savantUrl = `https://baseballsavant.mlb.com${endpoint}`;

  try {
    const resp = await fetch(savantUrl, {
      headers: {
        'Accept': '*/*',
        'User-Agent': 'SCFBD/1.0',
        'Origin': 'https://www.mlb.com',
        'Referer': 'https://www.mlb.com/',
      }
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Savant API error', status: resp.status });
    }

    const contentType = resp.headers.get('content-type') || '';
    const body = await resp.text();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // cache 1 hour

    if (contentType.includes('json')) {
      res.setHeader('Content-Type', 'application/json');
    } else {
      res.setHeader('Content-Type', 'text/csv');
    }

    res.status(200).send(body);
  } catch (e) {
    console.error('Savant proxy error:', e.message);
    res.status(500).json({ error: 'Proxy error', detail: e.message });
  }
};