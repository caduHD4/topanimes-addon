const http = require("../utils/http");
const { collectVideoUrls, asStreams } = require("./_shared");
const { extractUniversal } = require("./universalExtractor");

async function extractFileMoon(url) {
  try {
    const codeMatch = url.match(/\/e\/([a-zA-Z0-9]+)/);
    const mirrors = [url];

    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1];
      const backupDomains = ["filemoon.top", "filemoon.to", "filemoon.lat", "filemoon.nl"];
      for (const d of backupDomains) {
        const mirrorUrl = `https://${d}/e/${code}`;
        if (mirrorUrl !== url) {
          mirrors.push(mirrorUrl);
        }
      }
    }

    for (const targetUrl of mirrors) {
      try {
        const streams = await extractUniversal(targetUrl, "FileMoon");
        if (streams && streams.length > 0) {
          return streams;
        }
      } catch (_) {}
    }

    return [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  extractFileMoon
};