const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest");
const { Q1NScraper } = require("./scraper/q1nScraper");
const { buildCatalogHandler } = require("./handlers/catalog");
const { buildMetaHandler } = require("./handlers/meta");
const { buildStreamHandler } = require("./handlers/stream");

async function bootstrap() {
  const scraper = new Q1NScraper();
  const builder = new addonBuilder(manifest);

  const catalogHandler = await buildCatalogHandler(scraper);
  const metaHandler = await buildMetaHandler(scraper);
  const streamHandler = await buildStreamHandler(scraper);

  builder.defineCatalogHandler(catalogHandler);
  builder.defineMetaHandler(metaHandler);
  builder.defineStreamHandler(streamHandler);

  const port = Number(process.env.PORT || 7000);
  serveHTTP(builder.getInterface(), { port });

  console.log(`TopAnimes addon ativo em http://127.0.0.1:${port}/manifest.json`);
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar TopAnimes addon", error);
  process.exit(1);
});