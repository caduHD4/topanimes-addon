module.exports = {
  id: "org.topanimes.stremio",
  version: "0.2.0",
  name: "TopAnimes",
  description: "Busca e streams da fonte Q1N/AnimesGratis",
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