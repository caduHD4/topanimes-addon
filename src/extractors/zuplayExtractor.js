const http = require("../utils/http");

async function extractZuplay(url, providerName = "Zuplay") {
  try {
    const response = await http.get(url);
    const html = String(response.data || "");
    const streams = [];

    // Pattern 1: jwplayer sources array: [{"file":"...","type":"video/mp4","label":"1080p"}]
    const sourcesMatch = html.match(/sources\s*:\s*(\[[\s\S]*?\])/);
    if (sourcesMatch && sourcesMatch[1]) {
      try {
        const parsed = JSON.parse(sourcesMatch[1]);
        for (const item of parsed) {
          if (item.file) {
            streams.push({
              title: `${providerName}${item.label ? ` - ${item.label}` : ""}`,
              url: item.file,
              referer: url
            });
          }
        }
      } catch (_) {}
    }

    // Pattern 2: Fallback regex for video URLs in HTML
    if (streams.length === 0) {
      const fileMatches = html.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8)(?:\?[^"'\s]*)?/gi) || [];
      const unique = [...new Set(fileMatches)];
      for (const fileUrl of unique) {
        if (!fileUrl.includes("jwplayer") && !fileUrl.includes("jquery") && !fileUrl.includes("googleapis")) {
          streams.push({
            title: `${providerName} - Direct`,
            url: fileUrl,
            referer: url
          });
        }
      }
    }

    return streams;
  } catch (error) {
    return [];
  }
}

module.exports = {
  extractZuplay
};
