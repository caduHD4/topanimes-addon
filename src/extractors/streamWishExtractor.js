const http = require("../utils/http");
const { collectVideoUrls, asStreams } = require("./_shared");

async function extractStreamWish(url) {
  const response = await http.get(url);
  const urls = collectVideoUrls(response.data, url);
  return asStreams(urls, "StreamWish", url);
}

module.exports = {
  extractStreamWish
};