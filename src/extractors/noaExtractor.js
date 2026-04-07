const http = require("../utils/http");

const LABEL_REGEX = /label.*?:\"([^\"]+)\"/;
const FILE_REGEX = /["']file["']\s*:\s*["']([^"']+)["']/gi;

function normalizeVideoUrl(raw) {
  if (!raw) {
    return "";
  }

  return String(raw)
    .trim()
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

async function extractNoa(url, providerName) {
  const response = await http.get(url);
  const body = String(response.data || "");

  const regexMatches = [];
  let fileMatch;
  while ((fileMatch = FILE_REGEX.exec(body)) !== null) {
    const videoUrl = normalizeVideoUrl(fileMatch[1]);
    if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
      regexMatches.push(videoUrl);
    }
  }

  if (regexMatches.length > 0) {
    const unique = [...new Set(regexMatches)];
    return unique.map((videoUrl, index) => ({
      title: `${providerName || "NOA"}${unique.length > 1 ? ` - ${index + 1}` : ""}`,
      url: videoUrl,
      referer: url
    }));
  }

  if (body.includes("file: jw.file")) {
    const videoUrl = body
      .split("file")[1]
      ?.split(':\"')[1]
      ?.split('"')[0]
      ?.replace(/\\/g, "") || "";

    return videoUrl
      ? [{ title: providerName || "NOA", url: videoUrl, referer: url }]
      : [];
  }

  if (body.includes("sources:")) {
    const section = body.split("sources: [")[1]?.split("]")[0] || "";

    return section
      .split("{")
      .slice(1)
      .map((raw) => {
        const label = (raw.match(LABEL_REGEX) || ["", "Default"])[1];
        const videoUrl = normalizeVideoUrl(raw
          .split("file")[1]
          ?.split(":")[1]
          ?.split('"')[1]
          ?.replace(/\\/g, "") || "");

        return {
          title: `${providerName || "NOA"} - ${label}`,
          url: videoUrl,
          referer: url
        };
      })
      .filter((entry) => Boolean(entry.url));
  }

  return [];
}

module.exports = {
  extractNoa
};