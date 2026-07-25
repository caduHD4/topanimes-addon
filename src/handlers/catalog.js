async function buildCatalogHandler(scraper) {
  return async function catalogHandler(args) {
    try {
      const search = args.extra?.search || "";
      const skip = Number(args.extra?.skip || 0);
      const page = Math.floor(skip / 30) + 1;

      if (args.id === "topanimes-episodes") {
        const metas = await scraper.listEpisodes(page);
        return { metas };
      }

      const metas = await scraper.listCatalog(search, page);
      return { metas };
    } catch (error) {
      return { metas: [] };
    }
  };
}

module.exports = {
  buildCatalogHandler
};