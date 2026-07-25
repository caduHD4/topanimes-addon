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

const { TTLCache } = require("../utils/cache");

const streamCache = new TTLCache();
const PLAYER_TIMEOUT_MS = Number(process.env.TOPANIMES_PLAYER_TIMEOUT_MS || 6000);

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve([]);
      });
  });
}

async function buildStreamHandler(scraper) {
  return async function streamHandler(args) {
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      if (!args || !args.id) {
        return { streams: [] };
      }

      const cacheKey = `stream:${args.id}`;
      const cached = streamCache.get(cacheKey);
      if (cached) {
        debugLog("cache hit", { requestId, id: args.id });
        return { streams: cached };
      }

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

      const allPlayers = await scraper.getPlayerCandidates(episodePageUrl);
      
      // Filtrar leitores offline (URLs /off/)
      const players = allPlayers.filter((p) => p && p.url && !p.url.includes("/off/"));

      debugLog("players found", {
        requestId,
        total: allPlayers.length,
        filtered: players.length,
        players: players.map((player) => ({ name: player.name, url: player.url }))
      });

      // Resolver todos os players em paralelo com timeout individual
      const playerPromises = players.map((player) =>
        withTimeout(resolvePlayerStreams(player), PLAYER_TIMEOUT_MS)
      );

      const results = await Promise.allSettled(playerPromises);

      const streamEntries = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status !== "fulfilled" || !Array.isArray(res.value)) {
          continue;
        }

        for (const item of res.value) {
          const behaviorHints = buildProxyHeaders(item.referer);
          const needsProxy = item.referer && (
            item.url.includes("incvideo1") ||
            item.url.includes("secvideo1") ||
            item.url.includes("csst.online") ||
            item.url.includes("fsst.online")
          );

          if (needsProxy) {
            const addonBase = process.env.ADDON_URL || process.env.RENDER_EXTERNAL_URL || "http://127.0.0.1:7000";
            const cleanAddonBase = addonBase.startsWith("http") ? addonBase : `https://${addonBase}`;
            const proxiedUrl = `${cleanAddonBase}/proxy?url=${encodeURIComponent(item.url)}&referer=${encodeURIComponent(item.referer)}`;

            // Opção 1: Proxy com CORS e Referer
            streamEntries.push({
              name: "TopAnimes",
              title: item.title,
              url: proxiedUrl
            });

            // Opção 2: Link Direto
            const directStream = {
              name: "TopAnimes",
              title: `${item.title} (Direto)`,
              url: item.url
            };
            if (behaviorHints) {
              directStream.behaviorHints = behaviorHints;
            }
            streamEntries.push(directStream);
          } else {
            const stream = {
              name: "TopAnimes",
              title: item.title,
              url: item.url
            };
            if (behaviorHints) {
              stream.behaviorHints = behaviorHints;
            }
            streamEntries.push(stream);
          }
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
        totalAfterDedup: dedup.length
      });

      if (dedup.length > 0) {
        streamCache.set(cacheKey, dedup, 20 * 60 * 1000); // 20 minutos de cache
      }

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