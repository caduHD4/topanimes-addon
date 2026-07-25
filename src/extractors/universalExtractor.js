const http = require("../utils/http");
const vm = require("vm");

const VIDEO_REGEX = /https?:\/\/[^\"'\s]+\.(mp4|m3u8|mpd)(\?[^\"'\s]*)?/gi;

function normalizeMatches(matches, name, referer) {
  const unique = [...new Set(matches)];
  return unique.map((videoUrl) => ({
    title: `${name || "Universal"} - auto`,
    url: videoUrl,
    referer
  }));
}

function extractPackedScripts(html) {
  const content = String(html || "");
  const scripts = [];
  const pattern = /eval\(function\(p,a,c,k,e,d\)[\s\S]+?\}\)\)/gi;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    scripts.push(match[0]);
  }

  return scripts;
}

function decodePackedScript(script) {
  const sandbox = {
    MDCore: {},
    window: {},
    document: {},
    navigator: {},
    location: {},
    atob: (value) => Buffer.from(String(value), "base64").toString("binary"),
    btoa: (value) => Buffer.from(String(value), "binary").toString("base64")
  };

  try {
    vm.runInNewContext(script, sandbox, { timeout: 1000 });
    const content = JSON.stringify(sandbox);
    const matches = content.match(VIDEO_REGEX) || [];
    return matches;
  } catch (_) {
    return [];
  }
}

async function extractUniversal(url, name) {
  try {
    const response = await http.get(url);
    const html = String(response.data || "");
    const foundUrls = new Set();

    // 1. JWPlayer sources
    const sourcesMatch = html.match(/sources\s*:\s*(\[[\s\S]*?\])/);
    if (sourcesMatch && sourcesMatch[1]) {
      try {
        const parsed = JSON.parse(sourcesMatch[1]);
        for (const item of parsed) {
          if (item.file) {
            foundUrls.add(item.file);
          }
        }
      } catch (_) {}
    }

    // 2. Playerjs file payload
    if (html.includes("Playerjs")) {
      const filePayload = html.split("Playerjs({")[1]?.split("file:\"")[1]?.split("\"")[0] || "";
      if (filePayload) {
        const parts = filePayload.split(",");
        for (const part of parts) {
          const videoUrl = (part.split("]")[1] || part).trim().replace(/\/+$/, "");
          if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
            foundUrls.add(videoUrl);
          }
        }
      }
    }

    // 3. Packed JS Scripts (Mixdrop, Filemoon, etc.)
    const packedScripts = extractPackedScripts(html);
    for (const script of packedScripts) {
      const unpackedUrls = decodePackedScript(script);
      for (const u of unpackedUrls) {
        foundUrls.add(u);
      }
    }

    // 4. Regex fallback on HTML
    const regexMatches = html.match(VIDEO_REGEX) || [];
    for (const u of regexMatches) {
      if (!u.includes("jwplayer") && !u.includes("jquery") && !u.includes("googleapis.com")) {
        foundUrls.add(u);
      }
    }

    if (foundUrls.size > 0) {
      return normalizeMatches([...foundUrls], name, url);
    }

    return [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  extractUniversal
};