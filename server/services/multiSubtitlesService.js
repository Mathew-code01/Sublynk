// server/services/multiSubtitlesService.js

// server/services/multiSubtitlesService.js
// server/services/multiSubtitlesService.js

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const axios = require("axios");
const crypto = require("crypto");
const {
  fetchOpenSubtitles,
  getLatestSubtitles,
  getTopRatedSubtitles,
} = require("./openSubtitlesService");
const { isIdRegisteredRemoved } = require("../utils/removedIds");

// 🔴 YIFY disabled due to API issues — returning empty array instead
async function fetchYifySubtitles(query) {
  console.warn("YIFY fetch skipped (API down)");
  return [];
}

// ✅ Podnapisi with better retry handling
async function fetchPodnapisiSubtitles(query) {
  try {
    const res = await axios.get(
      `https://www.podnapisi.net/subtitles/search/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 15000,
      }
    );

    const $ = cheerio.load(res.data);
    const entries = [];

    $(".subtitle-entry").each((_, el) => {
      const href = $(el).find("a").attr("href");
      const lang = $(el).find(".language").text().trim();
      const release = $(el).find(".release").text().trim();
      if (href) {
        entries.push({
          lang,
          release,
          pageUrl: `https://www.podnapisi.net${href}`,
        });
      }
    });

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const subtitles = [];
    for (const sub of entries) {
      try {
        await delay(300);
        const pageRes = await axios.get(sub.pageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          },
          timeout: 10000,
        });

        const $$ = cheerio.load(pageRes.data);
        const downloadHref = $$('a[href*="/en/subtitleserve/"]').attr("href");

        if (downloadHref) {
          const id = `p-${crypto
            .createHash("md5")
            .update(downloadHref)
            .digest("hex")}`;

          subtitles.push({
            id,
            lang: sub.lang || "EN",
            release: sub.release || query,
            source: "Podnapisi",
            external: false,
            downloadUrl: `/api/podnapisi/download?url=${encodeURIComponent(
              `https://www.podnapisi.net${downloadHref}`
            )}`,
            filename: `${sub.release || "subtitle"}.zip`,
          });
        }
      } catch (err) {
        console.warn("Podnapisi page fetch error:", err.message);
      }
    }

    return subtitles;
  } catch (err) {
    console.error("Podnapisi fetch error:", err.message);
    return [];
  }
}

async function fetchTVSubtitles(query) {
  try {
    const searchUrl = `https://www.tvsubtitles.net/search.php?q=${encodeURIComponent(
      query
    )}`;
    const { data: searchHtml } = await axios.get(searchUrl);
    const $ = cheerio.load(searchHtml);

    const subtitles = [];

    $("a[href^='subtitle-']").each((i, el) => {
      if (i >= 3) return false; // limit to 3 results for speed
      const href = $(el).attr("href");
      const title = $(el).text().trim();
      const id = `tv-${crypto.createHash("md5").update(href).digest("hex")}`;
      subtitles.push({
        id,
        lang: "EN",
        release: title,
        source: "TVSubtitles",
        external: false,
        downloadUrl: `/api/tvsubtitles/download?url=https://www.tvsubtitles.net/${href}`,
        filename: `${title || "subtitle"}.zip`,
      });
    });

    return subtitles;
  } catch (err) {
    console.error("TVSubtitles fetch error:", err.message);
    return [];
  }
}

module.exports = {
  fetchTVSubtitles,
  proxyTVSubtitlesDownload,
};

// server/services/tvSubtitlesService.js

async function proxyTVSubtitlesDownload(req, res) {
  try {
    const { url } = req.query;

    if (!url.includes("tvsubtitles.net/episode-")) {
      return res.status(400).json({ error: "Only episode pages are supported in this route" });
    }

    // Step 1: Fetch episode page
    const { data: episodeHtml } = await axios.get(url);
    const $ = cheerio.load(episodeHtml);

    // Step 2: Get first subtitle page link
    const subtitlePageHref = $('a[href^="subtitle-"]').first().attr("href");

    if (!subtitlePageHref) {
      return res.status(404).json({ error: "No subtitle link found on episode page" });
    }

    const subtitlePageUrl = `http://www.tvsubtitles.net/${subtitlePageHref}`;
    ;


    // Step 3: Fetch subtitle page
    const { data: subtitleHtml } = await axios.get(subtitlePageUrl);
    const $$ = cheerio.load(subtitleHtml);

    const downloadHref = $$('a[href^="download"]').attr("href");

    if (!downloadHref) {
      return res.status(404).json({ error: "Download link not found on subtitle page" });
    }

    const downloadUrl = `http://www.tvsubtitles.net/${downloadHref}`;
    return res.json({
      episode: url,
      subtitlePage: subtitlePageUrl,
      download: downloadUrl,
    });

  } catch (err) {
    console.error("Subtitle scrape error:", err.message);
    return res.status(500).json({ error: "Something went wrong while scraping subtitles." });
  }
}

module.exports = proxyTVSubtitlesDownload;


async function fetchCombinedSubtitles(query) {
  const [yify, podnapisi, tvsubtitles] = await Promise.all([
    fetchYifySubtitles(query),
    fetchPodnapisiSubtitles(query),
    fetchTVSubtitles(query),
  ]);

  return [...yify, ...podnapisi, ...tvsubtitles];
}

async function filterSubtitles(subtitles) {
  const filtered = [];
  for (const sub of subtitles) {
    const hasDownload =
      sub.download_url || (sub.id && !(await isIdRegisteredRemoved(sub.id)));
    if (hasDownload) {
      filtered.push(sub);
    }
  }
  return filtered;
}

async function aggregateSubtitles(query) {
  const [openSubs, others] = await Promise.all([
    fetchOpenSubtitles(query),
    fetchCombinedSubtitles(query),
  ]);
  const allSubs = [...openSubs, ...others];
  const filtered = await filterSubtitles(allSubs);
  return filtered.sort(() => 0.5 - Math.random());
}

async function getCombinedLatestSubtitles() {
  const openLatest = await getLatestSubtitles();
  const others = await fetchCombinedSubtitles("the");
  const allSubs = [...openLatest, ...others];
  const filtered = await filterSubtitles(allSubs);
  return filtered.slice(0, 50);
}

async function getCombinedTopRatedSubtitles() {
  const openTop = await getTopRatedSubtitles();
  const others = await fetchCombinedSubtitles("matrix");
  const allSubs = [...openTop, ...others];
  const filtered = await filterSubtitles(allSubs);
  return filtered.slice(0, 50);
}

module.exports = {
  fetchYifySubtitles,
  fetchPodnapisiSubtitles,
  fetchTVSubtitles,
  fetchCombinedSubtitles,
  aggregateSubtitles,
  getCombinedLatestSubtitles,
  getCombinedTopRatedSubtitles,
};
