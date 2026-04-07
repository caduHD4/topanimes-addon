const { extractRuplay } = require("./ruplayExtractor");
const { extractNoa } = require("./noaExtractor");
const { extractStreamWish } = require("./streamWishExtractor");
const { extractFileMoon } = require("./fileMoonExtractor");
const { extractMixDrop } = require("./mixDropExtractor");
const { extractUniversal } = require("./universalExtractor");

async function resolvePlayerStreams(player) {
  const name = (player.name || "").toLowerCase();
  const url = player.url;

  if (!url) {
    return [];
  }

  try {
    if (url.includes("blogger.com/video.g")) {
      return [{
        title: `${player.name || "Blogger"} - direct`,
        url,
        referer: url
      }];
    }

    if (name.includes("ruplay")) {
      return await extractRuplay(url);
    }

    if (name.includes("streamwish") || url.includes("streamwish")) {
      return await extractStreamWish(url);
    }

    if (name.includes("filemoon") || url.includes("filemoon")) {
      return await extractFileMoon(url);
    }

    if (name.includes("mixdrop") || url.includes("mixdrop")) {
      return await extractMixDrop(url);
    }

    if (name.includes("noa") || name.includes("mdplayer") || url.includes("/antivirus3/")) {
      return await extractNoa(url, player.name || "NOA");
    }

    return await extractUniversal(url, player.name || "Universal");
  } catch (error) {
    return [];
  }
}

module.exports = {
  resolvePlayerStreams
};