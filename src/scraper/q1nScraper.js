const cheerio = require("cheerio");
const http = require("../utils/http");
const { TTLCache } = require("../utils/cache");
const { toAnimeId, toEpisodeId } = require("../utils/ids");

const BASE_URL = process.env.TOPANIMES_BASE_URL || "https://topanimes.net";
const DEFAULT_RELEASE_DATE = "2026-04-06";

class Q1NScraper {
  constructor() {
    this.cache = new TTLCache();
  }

  async listCatalog(searchQuery) {
    const query = (searchQuery || "").trim();
    const cacheKey = `catalog:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const html = query ? await this.searchHtml(query) : await this.popularHtml();
    const $ = cheerio.load(html);

    const items = [];
    const selectors = query
      ? ["div.result-item article div.thumbnail > a", "article.item .poster a"]
      : ["div.items.featured article div.poster a", "article.item .poster a"];

    const seen = new Set();
    selectors.forEach((selector) => $(selector).each((_, el) => {
      const url = $(el).attr("href");
      if (!url) {
        return;
      }

      const absolute = this.absoluteUrl(url);
      // Filtrar para apenas animes (não episódios)
      if (!query && absolute.includes('/episodio/')) {
        return;
      }
      if (seen.has(absolute)) {
        return;
      }
      seen.add(absolute);

      const slug = this.slugFromUrl(absolute);
      if (!slug) {
        return;
      }

      const article = $(el).closest("article");
      const titleFromAttr =
        $(el).attr("title") ||
        $(el).find("img").attr("alt") ||
        article.find("h3").first().text() ||
        article.find("strong span.serie").first().text() ||
        "Anime";
      
      // Busca imagem: primeiro tenta no .poster > img direto, depois picture, depois img em qualquer lugar
      let poster = article.find("div.poster > img").attr("src") || 
                   article.find("div.poster > img").attr("data-src");
      
      if (!poster) {
        const picture = article.find("picture").first();
        poster =
          picture.find("source").first().attr("srcset") ||
          picture.find("img").attr("src") ||
          picture.find("img").attr("data-src");
      }
      
      // Fallback para img em qualquer lugar na article (para search results)
      if (!poster) {
        poster = article.find("img").first().attr("src") || 
                 article.find("img").first().attr("data-src");
      }

      items.push({
        id: toAnimeId(slug),
        type: "series",
        name: titleFromAttr.trim(),
        poster: poster ? this.normalizePosterUrl(this.absoluteUrl(poster), "w154") : undefined
      });
    }));

    this.cache.set(cacheKey, items, 2 * 60 * 1000);
    return items;
  }

  async listEpisodes() {
    const cacheKey = `episodes`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await http.get(`${BASE_URL}/episodio/`);
      const $ = cheerio.load(response.data);

      const items = [];
      const seenSlugs = new Set();
      const articles = $("article.item").toArray();

      // Extrai artigos (episódios)
      for (const article of articles) {
        const link = $(article).find(".serie a, a[href*='/episodio/']").first();
        if (!link.length) {
          continue;
        }

        const href = link.attr("href");
        if (!href || !href.includes("/episodio/")) {
          continue;
        }

        // Extrai slug do anime da URL do episódio (ex: /episodio/naruto-shippuden-episodio-1/)
        const match = href.match(/\/episodio\/([^\/]+)-episodio-\d+\//);
        if (!match || !match[1]) {
          continue;
        }

        const slug = match[1];
        if (seenSlugs.has(slug)) {
          continue; // Já temos este anime
        }
        seenSlugs.add(slug);

        // Extrai título e imagem do episódio (próximo será o anime official)
        const article$ = $(article);
        const titleEl = article$.find("span.serie").first();
        const title = titleEl.text().trim() || "Anime";

        // Busca imagem
        let poster = article$.find("div.poster > img").attr("src") || 
                     article$.find("div.poster > img").attr("data-src");

        if (!poster) {
          const picture = article$.find("picture").first();
          poster =
            picture.find("source").first().attr("srcset") ||
            picture.find("img").attr("src") ||
            picture.find("img").attr("data-src");
        }

        if (!poster) {
          poster = article$.find("img").first().attr("src") || 
                   article$.find("img").first().attr("data-src");
        }

        const animePoster = await this.getAnimePosterByEpisodeSlug(slug);

        const unixTimeRaw = article$.find("time.timeS").attr("time") || article$.find("time").attr("datetime");
        const unixTime = Number(unixTimeRaw);

        items.push({
          id: toAnimeId(slug),
          type: "series",
          name: title,
          poster: animePoster || (poster ? this.normalizePosterUrl(this.absoluteUrl(poster), "w154") : undefined),
          _ts: Number.isFinite(unixTime) && unixTime > 0 ? unixTime : 0
        });
      }

      // Ordena do mais novo para o mais antigo.
      items.sort((a, b) => b._ts - a._ts);

      const metas = items.map(({ _ts, ...meta }) => meta);

      this.cache.set(cacheKey, metas, 10 * 60 * 1000);  // 10 min cache
      return metas;
    } catch (e) {
      console.error("Erro listEpisodes:", e.message);
      return [];
    }
  }

  async getAnimePosterByEpisodeSlug(slug) {
    const cacheKey = `animePoster:${slug}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached || undefined;
    }

    const candidates = [
      `${BASE_URL}/animes/${slug}/`,
      `${BASE_URL}/filmes/${slug}/`
    ];

    for (const url of candidates) {
      try {
        const response = await http.get(url);
        const $ = cheerio.load(response.data);
        const poster =
          $("div.sheader div.poster img").first().attr("src") ||
          $("div.sheader div.poster img").first().attr("data-src") ||
          $("div.poster img").first().attr("src") ||
          $("div.poster img").first().attr("data-src");

        if (poster) {
          const absolutePoster = this.normalizePosterUrl(this.absoluteUrl(poster));
          this.cache.set(cacheKey, absolutePoster, 60 * 60 * 1000);
          return absolutePoster;
        }
      } catch (_) {
        // Tenta o próximo candidato de URL.
      }
    }

    // Cache negativo para evitar bater no mesmo slug repetidamente.
    this.cache.set(cacheKey, "", 30 * 60 * 1000);
    return undefined;
  }
  async getMetaBySlug(slug) {
    const cacheKey = `meta:${slug}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${BASE_URL}/${slug}`;
    const response = await http.get(url);
    const $ = cheerio.load(response.data);

    const header = $("div.sheader").first();
    const title = header.find("div.data > h1").first().text().trim() || "Anime";
    const poster = header.find("div.poster img").attr("src") || header.find("div.poster img").attr("data-src") || undefined;
    const description = $("div.wp-content").first().text().trim();
    const genres = header
      .find("div.data div.sgeneros > a")
      .map((_, g) => $(g).text().trim())
      .get()
      .filter(Boolean);

    const externalLogo = await this.getExternalStyledLogo(title, slug);

    const videos = [];
    $("ul.episodios li").each((_, li) => {
      const row = $(li);
      const epLink = row.find("a").first();
      const epHref = epLink.attr("href");
      const epText = epLink.text().trim();
      const number = Number((epText.match(/(\d+[\.,]?\d*)/) || ["0"])[0].replace(",", "."));

      if (!epHref) {
        return;
      }

      let epThumb =
        row.find("div.imagen img").first().attr("src") ||
        row.find("div.imagen img").first().attr("data-src") ||
        row.find("img").first().attr("src") ||
        row.find("img").first().attr("data-src");

      if (!epThumb) {
        const picture = row.find("picture").first();
        epThumb =
          picture.find("source").first().attr("srcset") ||
          picture.find("img").attr("src") ||
          picture.find("img").attr("data-src");
      }

      const normalizedThumb = epThumb
        ? this.normalizePosterUrl(this.absoluteUrl(epThumb), "w300")
        : undefined;

      videos.push({
        id: toEpisodeId(this.absoluteUrl(epHref)),
        title: epText || `Episodio ${videos.length + 1}`,
        season: 1,
        episode: number || videos.length + 1,
        released: DEFAULT_RELEASE_DATE,
        thumbnail: normalizedThumb
      });
    });
    const meta = {
      id: toAnimeId(slug),
      type: "series",
      name: title,
      poster: poster ? this.normalizePosterUrl(this.absoluteUrl(poster), "w300") : undefined,
      logo: externalLogo || this.buildTitleLogo(title),
      description,
      genres,
      videos
    };

    this.cache.set(cacheKey, meta, 5 * 60 * 1000);
    return meta;
  }

  async getExternalStyledLogo(title, slug) {
    const cacheKey = `logo:${slug}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached || undefined;
    }

    try {
      const wikidata = await this.getWikidataInfo(title);
      if (wikidata.logoUrl) {
        this.cache.set(cacheKey, wikidata.logoUrl, 12 * 60 * 60 * 1000);
        return wikidata.logoUrl;
      }

      const wikidataThumb = await this.getLogoFromWikidataPage(wikidata.qid || title);
      if (wikidataThumb) {
        this.cache.set(cacheKey, wikidataThumb, 12 * 60 * 60 * 1000);
        return wikidataThumb;
      }

      const th3Logo = await this.getLogoFromTh3Anime(wikidata.jaLabel || title);
      if (th3Logo) {
        this.cache.set(cacheKey, th3Logo, 12 * 60 * 60 * 1000);
        return th3Logo;
      }

      const neoLogo = await this.getLogoFromNeoApo(wikidata.jaLabel || title);
      if (neoLogo) {
        this.cache.set(cacheKey, neoLogo, 12 * 60 * 60 * 1000);
        return neoLogo;
      }
    } catch (_) {
      // Ignora falhas de provider externo e usa fallback SVG.
    }

    this.cache.set(cacheKey, "", 2 * 60 * 60 * 1000);
    return undefined;
  }

  async getWikidataInfo(title) {
    const queries = [
      title,
      this.normalizeLookupTitle(title)
    ].filter(Boolean);

    for (const query of queries) {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&language=en&search=${encodeURIComponent(query)}`;
      const searchResponse = await http.get(searchUrl);
      const hits = (searchResponse.data && searchResponse.data.search) || [];

      for (const hit of hits.slice(0, 5)) {
        const qid = hit.id;
        if (!qid) {
          continue;
        }

        const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
        const entityResponse = await http.get(entityUrl);
        const entity = entityResponse.data && entityResponse.data.entities && entityResponse.data.entities[qid];
        if (!entity) {
          continue;
        }

        const instanceClaims = entity.claims && entity.claims.P31;
        const isAnime = Array.isArray(instanceClaims) && instanceClaims.some((claim) => {
          const value = claim && claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
          return value && value.id === "Q63952888";
        });

        if (!isAnime) {
          continue;
        }

        const logoFile = this.extractWikidataFile(entity, "P154") || this.extractWikidataFile(entity, "P18");
        const jaLabel = entity.labels && entity.labels.ja && entity.labels.ja.value;

        if (logoFile) {
          return {
            logoUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFile)}`,
            qid,
            jaLabel
          };
        }

        return { logoUrl: undefined, qid, jaLabel };
      }
    }

    return { logoUrl: undefined, qid: undefined, jaLabel: undefined };
  }

  extractWikidataFile(entity, propertyId) {
    const claims = entity && entity.claims && entity.claims[propertyId];
    if (!Array.isArray(claims) || claims.length === 0) {
      return undefined;
    }

    const value = claims[0]
      && claims[0].mainsnak
      && claims[0].mainsnak.datavalue
      && claims[0].mainsnak.datavalue.value;

    return typeof value === "string" ? value : undefined;
  }

  async getLogoFromNeoApo(searchTitle) {
    if (!searchTitle) {
      return undefined;
    }

    const searchUrl = `https://neoapo.com/animes/search/${encodeURIComponent(searchTitle)}`;
    const searchResponse = await http.get(searchUrl);
    const html = String(searchResponse.data || "");
    const match = html.match(/\/animes\/(\d+)/);
    if (!match || !match[1]) {
      return undefined;
    }

    const detailUrl = `https://neoapo.com/animes/${match[1]}`;
    const detailResponse = await http.get(detailUrl);
    const $ = cheerio.load(detailResponse.data);

    const logo =
      $("div.left img.logo_img").first().attr("src") ||
      $("div.left .logo_img").first().attr("src") ||
      $("img.logo_img").first().attr("src") ||
      $("img[alt*='ロゴ']").first().attr("src") ||
      $("img[alt*='logo']").first().attr("src");

    return logo ? this.absoluteUrl(logo) : undefined;
  }

  async getLogoFromWikidataPage(identifier) {
    const qid = String(identifier || "").match(/^Q\d+$/) ? identifier : undefined;
    if (!qid) {
      return undefined;
    }

    const pageResponse = await http.get(`https://www.wikidata.org/wiki/${qid}`);
    const $ = cheerio.load(pageResponse.data);

    const thumb =
      $("div.thumb img").first().attr("src") ||
      $("div.thumb img").first().attr("data-src") ||
      $("div.thumb img").first().attr("srcset");

    if (thumb) {
      const absolute = this.absoluteUrl(thumb);
      const fileMatch = absolute.match(/Special:FilePath\/([^?#]+)/i);
      if (fileMatch && fileMatch[1]) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileMatch[1]}`;
      }
      return absolute;
    }

    const fileLink = $("a[href*='File:']").first().attr("href");
    if (fileLink) {
      const fileName = decodeURIComponent(fileLink.split("File:").pop() || "").replace(/\s+/g, " ").trim();
      if (fileName) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
      }
    }

    return undefined;
  }

  async getLogoFromTh3Anime(searchTitle) {
    if (!searchTitle) {
      return undefined;
    }

    const searchUrl = `https://th3anime.me/search?keyword=${encodeURIComponent(searchTitle)}`;
    const searchResponse = await http.get(searchUrl);
    const html = String(searchResponse.data || "");
    const detailMatch = html.match(/\/details\/([a-z0-9-]+-\d+)/i);
    if (!detailMatch || !detailMatch[1]) {
      return undefined;
    }

    const detailUrl = `https://th3anime.me/details/${detailMatch[1]}`;
    const detailResponse = await http.get(detailUrl);
    const detailHtml = String(detailResponse.data || "");

    const $ = cheerio.load(detailHtml);
    const filmNameWrapLogo =
      $(".film-name-wrap img").first().attr("src") ||
      $(".film-name-wrap img").first().attr("data-src") ||
      $(".film-name-wrap img").first().attr("srcset");

    if (filmNameWrapLogo) {
      return this.absoluteUrl(filmNameWrapLogo);
    }

    // Normalmente o logo vem como PNG em image.tmdb.org/t/p/original/*.png
    const pngLogoMatch = detailHtml.match(/https:\/\/image\.tmdb\.org\/t\/p\/original\/[^"']+\.png/i);
    if (pngLogoMatch && pngLogoMatch[0]) {
      return pngLogoMatch[0];
    }

    const fallbackLogo =
      $(".left .logo_img").first().attr("src") ||
      $(".left .logo_img").first().attr("data-src") ||
      $("img[src*='image.tmdb.org/t/p/original']").first().attr("src") ||
      $("img[src*='logo']").first().attr("src");

    return fallbackLogo ? this.absoluteUrl(fallbackLogo) : undefined;
  }

  normalizeLookupTitle(title) {
    return String(title || "")
      .replace(/\s+\(([^)]*)\)/g, " ")
      .replace(/\b(dublado|legendado|filme|movie|season|temporada)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async getEpisodePage(episodeUrl) {
    return this.absoluteUrl(episodeUrl);
  }

  async getPlayerCandidates(episodePageUrl) {
    const response = await http.get(episodePageUrl);
    const $ = cheerio.load(response.data);
    const players = [];

    $("ul#playeroptionsul li").each((_, li) => {
      const playerId = $(li).attr("data-nume");
      const name = $(li).find("span.title").text().trim().toLowerCase();
      if (!playerId) {
        return;
      }

      const iframe = $(`div#source-player-${playerId} iframe`).first();
      const src = iframe.attr("data-litespeed-src") || iframe.attr("src");
      if (!src) {
        return;
      }

      players.push({
        name,
        url: this.normalizePlayerUrl(this.absoluteUrl(src))
      });
    });

    return players;
  }

  normalizePlayerUrl(url) {
    if (!url.includes("/aviso/")) {
      return url;
    }

    try {
      const parsed = new URL(url);
      const real = parsed.searchParams.get("url");
      return real || url;
    } catch (_) {
      return url;
    }
  }

  async popularHtml() {
    const response = await http.get(`${BASE_URL}/animes/`);
    return response.data;
  }

  async searchHtml(query) {
    const response = await http.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    return response.data;
  }

  absoluteUrl(path) {
    if (!path) {
      return path;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    if (path.startsWith("//")) {
      return `https:${path}`;
    }

    if (path.startsWith("/")) {
      return `${BASE_URL}${path}`;
    }

    return `${BASE_URL}/${path}`;
  }

  slugFromUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "") || null;
    } catch (_) {
      return null;
    }
  }

  normalizePosterUrl(url, size = "w300") {
    if (!url) {
      return url;
    }

    // Padroniza imagens do TMDB para tamanho de capa solicitado.
    if (url.includes("image.tmdb.org/t/p/")) {
      return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`);
    }

    return url;
  }

  buildTitleLogo(title) {
    if (!title) {
      return undefined;
    }

    const safeTitle = this.escapeXml(title);
    const shortTitle = safeTitle.length > 42 ? `${safeTitle.slice(0, 39)}...` : safeTitle;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="50%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
          <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="50%" stop-color="#fda4af"/>
            <stop offset="100%" stop-color="#93c5fd"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.55"/>
          </filter>
        </defs>
        <rect width="1200" height="360" rx="30" fill="url(#bg)"/>
        <circle cx="1030" cy="72" r="120" fill="#38bdf8" opacity="0.12"/>
        <circle cx="160" cy="300" r="150" fill="#fb7185" opacity="0.10"/>
        <text x="70" y="175" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="6" opacity="0.82">TOP ANIMES</text>
        <text x="70" y="265" fill="url(#fg)" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" filter="url(#shadow)">
          <tspan x="70" dy="0" textLength="1060" lengthAdjust="spacingAndGlyphs">${shortTitle}</tspan>
        </text>
      </svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

module.exports = {
  Q1NScraper
};