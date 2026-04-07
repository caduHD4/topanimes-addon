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
  const response = await http.get(url);
  const html = response.data;
  const urls = collectVideoUrls(html, url);

  if (urls.length === 0) {
    const packedScripts = extractPackedScripts(html);
    for (const script of packedScripts) {
      const decoded = decodeMixDropFromScript(script);
      if (decoded) {
        urls.push(decoded);
      }
    }
  }

  return asStreams(urls, "MixDrop", url);
}

module.exports = {
  extractMixDrop
};