const http = require("../utils/http");

function extractIntermediatePageUrl(html) {
  const content = String(html || "");

  const candidates = [
    /https:\/\/www\.secvideo1\.online\/videos\/[^"'\s)]+/i,
    /https:\/\/www\.secvideo1\.online\/embed\/[^"'\s)]+/i,
    /https:\/\/fsst\.online\/videos\/[^"'\s)]+/i,
    /https:\/\/fsst\.online\/embed\/[^"'\s)]+/i
  ];

  for (const pattern of candidates) {
    const match = content.match(pattern);
    if (match && match[0]) {
      return match[0];
    }
  }

  return undefined;
}

function extractPreferredReferer(html, fallbackUrl) {
  const content = String(html || "");

  const secVideoPageMatch = content.match(/https:\/\/www\.secvideo1\.online\/videos\/[^"'\s)]+/i);
  if (secVideoPageMatch && secVideoPageMatch[0]) {
    return secVideoPageMatch[0];
  }

  const secVideoEmbedMatch = content.match(/https:\/\/www\.secvideo1\.online\/embed\/[^"'\s)]+/i);
  if (secVideoEmbedMatch && secVideoEmbedMatch[0]) {
    return secVideoEmbedMatch[0];
  }

  const fsstPageMatch = content.match(/https:\/\/fsst\.online\/videos\/[^"'\s)]+/i);
  if (fsstPageMatch && fsstPageMatch[0]) {
    return fsstPageMatch[0];
  }

  const fsstEmbedMatch = content.match(/https:\/\/fsst\.online\/embed\/[^"'\s)]+/i);
  if (fsstEmbedMatch && fsstEmbedMatch[0]) {
    return fsstEmbedMatch[0];
  }

  const ogVideoMatch = content.match(/<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i);
  if (ogVideoMatch && ogVideoMatch[1]) {
    return ogVideoMatch[1];
  }

  const ogUrlMatch = content.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  if (ogUrlMatch && ogUrlMatch[1]) {
    return ogUrlMatch[1];
  }

  const embedMatch = content.match(/embed:\s*["']([^"']+)["']/i);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  const urlMatch = content.match(/url:\s*["']([^"']+)["']/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
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

  const referer = extractPreferredReferer(html, intermediatePageUrl || url);

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
        referer
      };
    })
    .filter((entry) => Boolean(entry.url));
}

module.exports = {
  extractRuplay
};