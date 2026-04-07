const http = require("../utils/http");

const VIDEO_REGEX = /https?:\/\/[^\"'\s]+\.(mp4|m3u8|mpd)(\?[^\"'\s]*)?/gi;
const BROWSER_TIMEOUT_MS = Number(process.env.TOPANIMES_BROWSER_TIMEOUT_MS || 12000);

function normalizeMatches(matches, name, referer) {
  const unique = [...new Set(matches)];
  return unique.map((videoUrl) => ({
    title: `${name || "Universal"} - auto`,
    url: videoUrl,
    referer
  }));
}

async function extractWithBrowser(url, name) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (_) {
    return [];
  }

  const found = new Set();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent:
        process.env.TOPANIMES_USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    });

    page.on("response", (response) => {
      const responseUrl = response.url();
      if (VIDEO_REGEX.test(responseUrl)) {
        found.add(responseUrl);
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: BROWSER_TIMEOUT_MS });
    await page.waitForTimeout(2200);

    await page.evaluate(() => {
      const playButton = document.getElementById("player-button-container");
      if (playButton) {
        playButton.click();
      }

      const downloadButton = document.querySelector(".downloader-button");
      if (downloadButton) {
        if (downloadButton.href) {
          window.location.href = downloadButton.href;
        } else {
          downloadButton.click();
        }
      }

      try {
        window.jwplayer(0).play();
      } catch (_) {
        // no-op
      }
    });

    await page.waitForTimeout(2800);
    return normalizeMatches([...found], name, url);
  } finally {
    await browser.close();
  }
}

async function extractUniversal(url, name) {
  const response = await http.get(url);
  const html = String(response.data || "");
  const matches = html.match(VIDEO_REGEX) || [];

  if (matches.length > 0) {
    return normalizeMatches(matches, name, url);
  }

  return extractWithBrowser(url, name);
}

module.exports = {
  extractUniversal
};