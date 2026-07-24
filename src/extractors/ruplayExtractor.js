const http = require("../utils/http");

function extractIntermediatePageUrl(html) {
  const content = String(html || "");

  const candidates = [
    /https?:\/\/[^"'\s)]*(?:secvideo1|fsst|csst|incvideo1)[^"'\s)]*\/(?:videos|embed)\/[^"'\s)]+/i,
    /https?:\/\/[^"'\s)]+\/(?:videos|embed)\/[^"'\s)]+/i
  ];

  for (const pattern of candidates) {
    const match = content.match(pattern);
    if (match && match[0]) {
      return match[0];
    }
  }

  return undefined;
}

function extractPreferredReferer(html, fallbackUrl, videoUrl) {
  if (videoUrl) {
    try {
      const origin = new URL(videoUrl).origin;
      if (origin) {
        return `${origin}/`;
      }
    } catch (_) {}
  }

  const content = String(html || "");

  const match = content.match(/https?:\/\/[^"'\s)]*(?:secvideo1|fsst|csst|incvideo1)[^"'\s)]*\/(?:videos|embed)\/[^"'\s)]+/i);
  if (match && match[0]) {
    return match[0];
  }

  return fallbackUrl;
}

async function extractRuplay(url) {
  const response = await http.get(url);
  const initialHtml = String(response.data || "");
  const intermediatePageUrl = extractIntermediatePageUrl(initialHtml);

  let html = initialHtml;

  if (intermediatePageUrl && intermediatePageUrl !== url) {
    try {
      const pageResponse = await http.get(intermediatePageUrl, {
        headers: {
          Referer: url,
          "User-Agent": process.env.TOPANIMES_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9"
        }
      });

      html = String(pageResponse.data || "");
    } catch (_) {
      // Mantém o HTML inicial como fallback.
    }
  }

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
      const rawVideoUrl = (part.split("]")[1] || "").trim();
      const videoUrl = rawVideoUrl.replace(/\/+$/, "");

      const referer = extractPreferredReferer(html, intermediatePageUrl || url, videoUrl);

      return {
        title: `Ruplay - ${quality}`,
        url: videoUrl,
        referer
      };
    })
    .filter((entry) => Boolean(entry.url));
}

module.exports = {
  extractRuplay
};