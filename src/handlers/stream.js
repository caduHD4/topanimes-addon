const { fromEpisodeId } = require("../utils/ids");
const { resolvePlayerStreams } = require("../extractors/routerExtractor");

const DEBUG_STREAMS = process.env.TOPANIMES_DEBUG_STREAMS === "1";

function debugLog(message, extra) {
  if (!DEBUG_STREAMS) {
    return;
  }

  if (typeof extra === "undefined") {
    console.log(`[stream-handler] ${message}`);
    return;
  }

  console.log(`[stream-handler] ${message}`, extra);
}

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
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const episodeUrl = fromEpisodeId(args.id);
      if (!episodeUrl) {
        debugLog("invalid episode id", { requestId, id: args.id });
        return { streams: [] };
      }

      debugLog("request start", { requestId, id: args.id, episodeUrl });

      const episodePageUrl = await scraper.getEpisodePage(episodeUrl);
      if (!episodePageUrl) {
        debugLog("episode page not found", { requestId, episodeUrl });
        return { streams: [] };
      }

      const players = await scraper.getPlayerCandidates(episodePageUrl);
      debugLog("players found", {
        requestId,
        count: players.length,
        players: players.map((player) => ({ name: player.name, url: player.url }))
      });

      const streamEntries = [];

      for (const player of players) {
        const extracted = await resolvePlayerStreams(player);
        debugLog("player resolved", {
          requestId,
          player: player.name,
          extracted: extracted.length
        });

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

      debugLog("request done", {
        requestId,
        totalBeforeDedup: streamEntries.length,
        totalAfterDedup: dedup.length,
        totalAfterValidation: dedup.length
      });

      return { streams: dedup };
    } catch (error) {
      debugLog("request error", {
        requestId,
        message: error && error.message ? error.message : String(error)
      });

      return { streams: [] };
    }
  };
}

module.exports = {
  buildStreamHandler
};