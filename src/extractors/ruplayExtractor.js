const http = require("../utils/http");

async function extractRuplay(url) {
  const response = await http.get(url);
  const html = String(response.data || "");

  const filePayload = html
    .split("Playerjs({")[1]
    ?.split("file:\"")[1]
    ?.split("\"")[0] || "";

  if (!filePayload) {
    return [];
  }

  return filePayload
    .split(",")
    .map((part) => {
      const quality = (part.match(/\[([^\]]+)\]/) || ["", "Default"])[1];
      const videoUrl = part.split("]")[1] || "";
      return {
        title: `Ruplay - ${quality}`,
        url: videoUrl.trim(),
        referer: url
      };
    })
    .filter((entry) => Boolean(entry.url));
}

module.exports = {
  extractRuplay
};