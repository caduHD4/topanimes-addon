const axios = require("axios");

async function proxyHandler(req, res) {
  try {
    const host = req.headers.host || "127.0.0.1:7000";
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const fullUrl = `${protocol}://${host}${req.url}`;
    const parsed = new URL(fullUrl);

    const targetUrl = parsed.searchParams.get("url");
    const referer = parsed.searchParams.get("referer");

    if (!targetUrl) {
      res.statusCode = 400;
      res.end("Missing url parameter");
      return;
    }

    const forwardHeaders = {
      "User-Agent": process.env.TOPANIMES_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9"
    };

    if (referer) {
      forwardHeaders["Referer"] = referer;
      try {
        forwardHeaders["Origin"] = new URL(referer).origin;
      } catch (_) {}
    }

    if (req.headers["range"]) {
      forwardHeaders["Range"] = req.headers["range"];
    }

    const response = await axios({
      method: "get",
      url: targetUrl,
      headers: forwardHeaders,
      responseType: "stream",
      validateStatus: () => true,
      timeout: 10000
    });

    res.statusCode = response.status;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }
    if (response.headers["content-range"]) {
      res.setHeader("Content-Range", response.headers["content-range"]);
    }
    if (response.headers["accept-ranges"]) {
      res.setHeader("Accept-Ranges", response.headers["accept-ranges"]);
    }

    response.data.pipe(res);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(`Proxy error: ${error.message}`);
  }
}

module.exports = {
  proxyHandler
};
