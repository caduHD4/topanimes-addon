const { getRouter } = require('stremio-addon-sdk');
const { createAddonInterface } = require('../src/addonFactory');

let routerPromise;

async function getRouterInstance() {
  if (!routerPromise) {
    routerPromise = createAddonInterface().then((addonInterface) => getRouter(addonInterface));
  }

  return routerPromise;
}

module.exports = async function handler(req, res) {
  if (req.url && req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }

  const router = await getRouterInstance();

  return router(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ err: 'not found' }));
  });
};
