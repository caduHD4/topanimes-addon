const { createAddonInterface } = require('../src/addonFactory');

let addonPromise;

async function getAddonInterface() {
  if (!addonPromise) {
    addonPromise = createAddonInterface();
  }

  return addonPromise;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const addon = await getAddonInterface();
  const originalUrl = req.url || '/';
  const [rawPath, rawQuery = ''] = originalUrl.split('?');

  // Remove prefix /api quando vier por rewrite da Vercel.
  let path = rawPath;
  if (path === '/api') {
    path = '/';
  } else if (path.startsWith('/api/')) {
    path = path.slice(4) || '/';
  }

  if (path === '/' || path === '') {
    res.statusCode = 302;
    res.setHeader('Location', '/manifest.json');
    res.end();
    return;
  }

  if (path.endsWith('/manifest.json') || path === '/manifest.json') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(addon.manifest));
    return;
  }

  const match = path.match(/^\/(?:([^/]+)\/)?(catalog|meta|stream|subtitles)\/([^/]+)\/(.+)\.json$/);
  if (!match) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ err: 'not found' }));
    return;
  }

  const [, configSegment, resource, type, idRaw] = match;
  const id = decodeURIComponent(idRaw);

  const extra = {};
  const query = new URLSearchParams(rawQuery);
  query.forEach((value, key) => {
    extra[key] = value;
  });

  const config = {};
  if (configSegment && configSegment !== 'api') {
    config._raw = configSegment;
  }

  try {
    const result = await addon.get(resource, type, id, extra, config);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error && error.noHandler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ err: 'not found' }));
      return;
    }

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ err: 'handler error' }));
  }
};
