const { fromEpisodeId } = require("../utils/ids");
const { resolvePlayerStreams } = require("../extractors/routerExtractor");

async function buildStreamHandler(scraper) {
  return async function streamHandler(args) {
    try {
      const episodeUrl = fromEpisodeId(args.id);
      if (!episodeUrl) {
        return { streams: [] };
      }

      const episodePageUrl = await scraper.getEpisodePage(episodeUrl);
      if (!episodePageUrl) {
        return { streams: [] };
      }

      const players = await scraper.getPlayerCandidates(episodePageUrl);
      const streamEntries = [];

      for (const player of players) {
        const extracted = await resolvePlayerStreams(player);
        for (const item of extracted) {
          const stream = {
            name: "TopAnimes",
            title: item.title,
            url: item.url
          };

          if (item.referer) {
            stream.behaviorHints = {
              proxyHeaders: {
                request: {
                  Referer: item.referer
                }
              }
            };
          }

          streamEntries.push(stream);
        }
      }

      const dedup = [];
      const seen = new Set();
      for (const entry of streamEntries) {
        if (!entry.url || seen.has(entry.url)) {
          continue;
        }
        seen.add(entry.url);
        dedup.push(entry);
      }

      return { streams: dedup };
    } catch (error) {
      return { streams: [] };
    }
  };
}

module.exports = {
  buildStreamHandler
};