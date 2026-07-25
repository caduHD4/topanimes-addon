const http = require("../utils/http");
const { collectVideoUrls, asStreams } = require("./_shared");
const vm = require("vm");

function normalizeMediaUrl(raw) {
  if (!raw) {
    return null;
  }

  const value = String(raw).trim().replace(/\\\//g, "/");

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return null;
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

function decodeMixDropFromScript(script) {
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
    return normalizeMediaUrl(sandbox.MDCore.wurl) || normalizeMediaUrl(sandbox.MDCore.furl);
  } catch (_) {
    return null;
  }
}

async function extractMixDrop(url) {
  const mirrorsToTry = [url];

  // If URL has a Mixdrop code e.g. /e/knjg7jq0fp3o0n, add backup mirrors
  const codeMatch = url.match(/\/e\/([a-zA-Z0-9]+)/);
  if (codeMatch && codeMatch[1]) {
    const code = codeMatch[1];
    const backupDomains = ["mixdrop.to", "mixdrop.bz", "mixdrop.is", "mixdrop.gl", "mixdrop.ch"];
    for (const domain of backupDomains) {
      const mirrorUrl = `https://${domain}/e/${code}`;
      if (mirrorUrl !== url) {
        mirrorsToTry.push(mirrorUrl);
      }
    }
  }

  for (const targetUrl of mirrorsToTry) {
    try {
      const response = await http.get(targetUrl, { timeout: 5000 });
      const html = String(response.data || "");

      // Check if file is deleted on MixDrop
      if (html.includes("File Not Found") || html.includes("deleted") || html.includes("#ed524e")) {
        continue;
      }

      const urls = collectVideoUrls(html, targetUrl);

      if (urls.length === 0) {
        const packedScripts = extractPackedScripts(html);
        for (const script of packedScripts) {
          const decoded = decodeMixDropFromScript(script);
          if (decoded) {
            urls.push(decoded);
          }
        }
      }

      if (urls.length > 0) {
        return asStreams(urls, "MixDrop", targetUrl);
      }
    } catch (_) {}
  }

  return [];
}

module.exports = {
  extractMixDrop
};