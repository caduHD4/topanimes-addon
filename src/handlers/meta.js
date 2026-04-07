const { fromAnimeId } = require("../utils/ids");

async function buildMetaHandler(scraper) {
  return async function metaHandler(args) {
    try {
      const slug = fromAnimeId(args.id);
      const meta = await scraper.getMetaBySlug(slug);
      return { meta };
    } catch (error) {
      return { meta: null };
    }
  };
}

module.exports = {
  buildMetaHandler
};