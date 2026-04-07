const http = require("../utils/http");
const { collectVideoUrls, asStreams } = require("./_shared");

async function extractMixDrop(url) {
  const response = await http.get(url);
  const urls = collectVideoUrls(response.data, url);
  return asStreams(urls, "MixDrop", url);
}

module.exports = {
  extractMixDrop
};