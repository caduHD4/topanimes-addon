function toAnimeId(slug) {
  return `topanimes:${encodeURIComponent(slug)}`;
}

function fromAnimeId(id) {
  const raw = id.startsWith("topanimes:") ? id.slice("topanimes:".length) : id;
  return decodeURIComponent(raw);
}

function toEpisodeId(episodeUrl) {
  return `topanimesep:${Buffer.from(episodeUrl, "utf8").toString("base64url")}`;
}

function fromEpisodeId(id) {
  const clean = id.startsWith("topanimesep:") ? id.slice("topanimesep:".length) : id;
  return Buffer.from(clean, "base64url").toString("utf8");
}

module.exports = {
  toAnimeId,
  fromAnimeId,
  toEpisodeId,
  fromEpisodeId
};