function getBaseUrl() {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://127.0.0.1:7000";
}

const baseUrl = getBaseUrl();

module.exports = {
  id: "org.topanimes.stremio",
  version: "0.1.0",
  name: "TopAnimes",
  description: "Busca e streams da fonte Q1N/AnimesGratis",
  logo: `${baseUrl}/icon.png`,
  background: `${baseUrl}/icon.png`,
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  idPrefixes: ["topanimes:", "topanimesep:"],
  catalogs: [
    {
      type: "series",
      id: "topanimes",
      name: "Top Animes",
      extra: [
        { name: "search", isRequired: false }
      ]
    },
    {
      type: "series",
      id: "topanimes-episodes",
      name: "Lançamentos",
      extra: []
    }
  ],
  behaviorHints: {
    configurable: false,
    adult: false,
    p2p: false
  }
};