const { fromEpisodeId } = require("../utils/ids");
const { resolvePlayerStreams } = require("../extractors/routerExtractor");

function buildProxyHeaders(referer) {
  if (!referer) {
    return undefined;
  }

  const requestHeaders = {
    Referer: referer,
    "User-Agent": process.env.TOPANIMES_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9"
  };

  try {
    const origin = new URL(referer).origin;
    if (origin) {
      requestHeaders.Origin = origin;
    }
  } catch (_) {
    // Ignore origin parse failures and keep referer-only headers.
  }

  return {
    proxyHeaders: {
      request: requestHeaders
    }
  };
}

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

          const behaviorHints = buildProxyHeaders(item.referer);
          if (behaviorHints) {
            stream.behaviorHints = behaviorHints;
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