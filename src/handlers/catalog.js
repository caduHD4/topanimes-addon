async function buildCatalogHandler(scraper) {
  return async function catalogHandler(args) {
    try {
      const search = args.extra?.search || "";
     
     if (args.id === "topanimes-episodes") {
       const metas = await scraper.listEpisodes();
       return { metas };
     }

      const metas = await scraper.listCatalog(search);
      return { metas };
    } catch (error) {
      return { metas: [] };
    }
  };
}

module.exports = {
  buildCatalogHandler
};