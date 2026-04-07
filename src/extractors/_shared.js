const URL_REGEX = /(https?:\/\/[^"'\s]+(?:\.m3u8|\.mp4|\.mpd)(?:\?[^"'\s]*)?)/gi;

function cleanUrl(raw, pageUrl) {
  if (!raw) {
    return null;
  }

  let normalized = String(raw)
    .trim()
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&");

  if ((normalized.startsWith("\"") && normalized.endsWith("\"")) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  if (normalized.startsWith("/")) {
    try {
      return new URL(normalized, pageUrl).toString();
    } catch (_) {
      return null;
    }
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return null;
}

function collectVideoUrls(html, pageUrl) {
  const content = String(html || "");
  const candidates = new Set();

  const patterns = [
    /(?:file|src)\s*[:=]\s*["']([^"']+(?:\.m3u8|\.mp4|\.mpd)(?:\?[^"']*)?)["']/gi,
    /sources\s*:\s*\[[\s\S]*?file\s*:\s*["']([^"']+)["']/gi,
    /MDCore\.(?:wurl|vurl)\s*=\s*["']([^"']+)["']/gi,
    URL_REGEX
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const value = match[1] || match[0];
      const finalUrl = cleanUrl(value, pageUrl);
      if (finalUrl) {
        candidates.add(finalUrl);
      }
    }
  }

  return [...candidates];
}

function asStreams(urls, label, referer) {
  return urls.map((url) => ({
    title: `${label} - auto`,
    url,
    referer
  }));
}

module.exports = {
  collectVideoUrls,
  asStreams
};