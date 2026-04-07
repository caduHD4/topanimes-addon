const { addonBuilder } = require("stremio-addon-sdk");
const manifest = require("./manifest");
const { Q1NScraper } = require("./scraper/q1nScraper");
const { buildCatalogHandler } = require("./handlers/catalog");
const { buildMetaHandler } = require("./handlers/meta");
const { buildStreamHandler } = require("./handlers/stream");

async function createAddonInterface() {
  const scraper = new Q1NScraper();
  const builder = new addonBuilder(manifest);

  const catalogHandler = await buildCatalogHandler(scraper);
  const metaHandler = await buildMetaHandler(scraper);
  const streamHandler = await buildStreamHandler(scraper);

  builder.defineCatalogHandler(catalogHandler);
  builder.defineMetaHandler(metaHandler);
  builder.defineStreamHandler(streamHandler);

  return builder.getInterface();
}

module.exports = {
  createAddonInterface
};