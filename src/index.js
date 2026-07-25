const { addonBuilder, getRouter } = require("stremio-addon-sdk");
const http = require("http");
const manifest = require("./manifest");
const { Q1NScraper } = require("./scraper/q1nScraper");
const { buildCatalogHandler } = require("./handlers/catalog");
const { buildMetaHandler } = require("./handlers/meta");
const { buildStreamHandler } = require("./handlers/stream");
const { proxyHandler } = require("./handlers/proxy");

async function bootstrap() {
  const scraper = new Q1NScraper();
  const builder = new addonBuilder(manifest);

  const catalogHandler = await buildCatalogHandler(scraper);
  const metaHandler = await buildMetaHandler(scraper);
  const streamHandler = await buildStreamHandler(scraper);

  builder.defineCatalogHandler(catalogHandler);
  builder.defineMetaHandler(metaHandler);
  builder.defineStreamHandler(streamHandler);

  const router = getRouter(builder.getInterface());
  const port = Number(process.env.PORT || 7000);

  const server = http.createServer((req, res) => {
    if (req.url && (req.url === "/" || req.url === "")) {
      res.statusCode = 302;
      res.setHeader("Location", "/manifest.json");
      res.end();
      return;
    }

    if (req.url && req.url.startsWith("/proxy")) {
      return proxyHandler(req, res);
    }

    return router(req, res, () => {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ err: "not found" }));
    });
  });

  server.listen(port, () => {
    console.log(`TopAnimes addon v${manifest.version} ativo em http://127.0.0.1:${port}/manifest.json`);
  });
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar TopAnimes addon", error);
  process.exit(1);
});