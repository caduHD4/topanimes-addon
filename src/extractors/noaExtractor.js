const http = require("../utils/http");

const LABEL_REGEX = /label.*?:\"([^\"]+)\"/;

async function extractNoa(url, providerName) {
  const response = await http.get(url);
  const body = String(response.data || "");

  if (body.includes("file: jw.file")) {
    const videoUrl = body
      .split("file")[1]
      ?.split(':\"')[1]
      ?.split('"')[0]
      ?.replace(/\\/g, "") || "";

    return videoUrl
      ? [{ title: providerName || "NOA", url: videoUrl }]
      : [];
  }

  if (body.includes("sources:")) {
    const section = body.split("sources: [")[1]?.split("]")[0] || "";

    return section
      .split("{")
      .slice(1)
      .map((raw) => {
        const label = (raw.match(LABEL_REGEX) || ["", "Default"])[1];
        const videoUrl = raw
          .split("file")[1]
          ?.split(":")[1]
          ?.split('"')[1]
          ?.replace(/\\/g, "") || "";

        return {
          title: `${providerName || "NOA"} - ${label}`,
          url: videoUrl
        };
      })
      .filter((entry) => Boolean(entry.url));
  }

  return [];
}

module.exports = {
  extractNoa
};