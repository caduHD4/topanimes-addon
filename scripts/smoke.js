const axios = require("axios");

const base = process.env.TOPANIMES_LOCAL_BASE || "http://127.0.0.1:7000";
const strictStreams = process.env.TOPANIMES_SMOKE_STRICT_STREAMS === "1";

async function getJson(path) {
  const { data } = await axios.get(`${base}${path}`, { timeout: 25000 });
  return data;
}

(async () => {
  try {
    const manifest = await getJson("/manifest.json");
    if (!manifest?.id) {
      throw new Error("manifest invalido");
    }

    const catalog = await getJson("/catalog/series/topanimes/search=naruto.json");
    if (!Array.isArray(catalog?.metas) || catalog.metas.length === 0) {
      throw new Error("catalog vazio");
    }

    let checkedMetas = 0;
    let checkedVideos = 0;
    let streamHits = 0;

    for (const item of catalog.metas.slice(0, 5)) {
      const meta = await getJson(`/meta/series/${item.id}.json`);
      if (!meta?.meta?.id) {
        continue;
      }

      checkedMetas += 1;
      const videos = meta.meta.videos || [];

      for (const video of videos.slice(0, 3)) {
        const stream = await getJson(`/stream/series/${video.id}.json`);
        if (!Array.isArray(stream?.streams)) {
          throw new Error("stream resposta invalida");
        }

        checkedVideos += 1;
        if (stream.streams.length > 0) {
          streamHits += 1;
          break;
        }
      }

      if (streamHits > 0) {
        break;
      }
    }

    if (streamHits === 0) {
      const knownMeta = await getJson("/meta/series/topanimes:animes%2Fnaruto.json");
      const knownVideos = knownMeta?.meta?.videos || [];

      for (const video of knownVideos.slice(0, 2)) {
        const stream = await getJson(`/stream/series/${video.id}.json`);
        if (!Array.isArray(stream?.streams)) {
          throw new Error("stream resposta invalida");
        }

        checkedVideos += 1;
        if (stream.streams.length > 0) {
          streamHits += 1;
          break;
        }
      }
    }

    if (strictStreams && streamHits === 0) {
      throw new Error("nenhum stream encontrado em modo estrito");
    }

    console.log("SMOKE OK", {
      manifest: manifest.id,
      metas: catalog.metas.length,
      checkedMetas,
      checkedVideos,
      streamHits,
      strictStreams
    });
    process.exit(0);
  } catch (error) {
    console.error("SMOKE FAIL", error.message);
    process.exit(1);
  }
})();