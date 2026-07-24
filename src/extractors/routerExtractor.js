const { extractRuplay } = require("./ruplayExtractor");
const { extractNoa } = require("./noaExtractor");
const { extractStreamWish } = require("./streamWishExtractor");
const { extractFileMoon } = require("./fileMoonExtractor");
const { extractMixDrop } = require("./mixDropExtractor");
const { extractUniversal } = require("./universalExtractor");

const DEBUG_STREAMS = process.env.TOPANIMES_DEBUG_STREAMS === "1";

function debugLog(message, extra) {
  if (!DEBUG_STREAMS) {
    return;
  }

  if (typeof extra === "undefined") {
    console.log(`[stream-router] ${message}`);
    return;
  }

  console.log(`[stream-router] ${message}`, extra);
}

async function resolvePlayerStreams(player) {
  const name = (player.name || "").toLowerCase();
  const url = player.url;

  if (!url) {
    return [];
  }

  try {
    debugLog("resolver start", { player: player.name || "unknown", url });

    if (url.includes("blogger.com/video.g")) {
      const direct = [{
        title: `${player.name || "Blogger"} - direct`,
        url,
        referer: url
      }];

      debugLog("resolver success (blogger direct)", { count: direct.length });
      return direct;
    }

    if (name.includes("ruplay") || name.includes("zuplay") || url.includes("csst.online") || url.includes("secvideo1") || url.includes("fsst.online") || url.includes("incvideo1")) {
      const result = await extractRuplay(url);
      debugLog("resolver success (ruplay)", { count: result.length });
      return result;
    }

    if (name.includes("streamwish") || url.includes("streamwish")) {
      const result = await extractStreamWish(url);
      debugLog("resolver success (streamwish)", { count: result.length });
      return result;
    }

    if (name.includes("filemoon") || url.includes("filemoon")) {
      const result = await extractFileMoon(url);
      debugLog("resolver success (filemoon)", { count: result.length });
      return result;
    }

    if (name.includes("mixdrop") || url.includes("mixdrop")) {
      const result = await extractMixDrop(url);
      debugLog("resolver success (mixdrop)", { count: result.length });
      return result;
    }

    if (name.includes("noa") || name.includes("mdplayer") || url.includes("/antivirus3/")) {
      const result = await extractNoa(url, player.name || "NOA");
      debugLog("resolver success (noa)", { count: result.length });
      return result;
    }

    const fallbackResult = await extractUniversal(url, player.name || "Universal");
    debugLog("resolver success (universal)", { count: fallbackResult.length });
    return fallbackResult;
  } catch (error) {
    debugLog("resolver error", {
      player: player.name || "unknown",
      url,
      message: error && error.message ? error.message : String(error)
    });
    return [];
  }
}

module.exports = {
  resolvePlayerStreams
};