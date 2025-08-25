// server/routes/addic7ed.js
// server/routes/addic7ed.js

/**
 * server/routes/addic7ed.js
 *
 * Addic7ed does not provide a public JSON API. This route scrapes search
 * results and (optionally) logs in via Puppeteer when needed.
 *
 * Exposed endpoints:
 *   GET /api/addic7ed/search?query=TITLE
 *   GET /api/addic7ed/download?url=ENCODED_ADDIC7ED_URL[&name=FILENAME]
 *
 * NOTES:
 * - Search returns *metadata only*; each item includes a `download_url` pointing
 *   to the Addic7ed subtitle page.
 * - The /download endpoint BELOW now attempts to parse that page, follow the
 *   internal Addic7ed download flow, and stream the actual subtitle file (.srt /
 *   .zip) back to the client.
 * - Addic7ed tracks downloads & has Terms of Service; use responsibly.
 */

const express = require("express");
const axios = require("axios").default;
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper: axiosCookieJarSupport } = require("axios-cookiejar-support");
const qs = require("querystring");

axiosCookieJarSupport(axios);

const router = express.Router();

const DEBUG = /^true$/i.test(process.env.DEBUG_ADDIC7ED || "");
function debugLog(...args) {
  if (DEBUG) {
    console.log(`[${new Date().toISOString()}] [Addic7ed]`, ...args);
  }
}


/* ------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------ */
const ADDIC7ED_BASE = "https://www.addic7ed.com";
const USE_PUPPETEER =
  /^true$/i.test(process.env.USE_PUPPETEER || "") ||
  /^1$/.test(process.env.USE_PUPPETEER || "");
const ADDIC7ED_USERNAME = process.env.ADDIC7ED_USERNAME || null;
const ADDIC7ED_PASSWORD = process.env.ADDIC7ED_PASSWORD || null;
const CACHE_TTL =
  parseInt(process.env.ADDIC7ED_CACHE_TTL_MS, 10) > 0
    ? parseInt(process.env.ADDIC7ED_CACHE_TTL_MS, 10)
    : 5 * 60 * 1000; // default 5m

/* ------------------------------------------------------------------
 * Simple in-memory cache
 * ------------------------------------------------------------------ */
const cache = new Map(); // key=queryLower -> { data, expires }
function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */
function normalizeLang(str = "") {
  const s = str.trim().toLowerCase();
  if (!s) return "EN";
  if (s.includes("english")) return "EN";
  if (s.includes("spanish")) return "ES";
  if (s.includes("french")) return "FR";
  if (s.includes("german")) return "DE";
  if (s.includes("italian")) return "IT";
  if (s.includes("portuguese")) return "PT";
  if (s.includes("russian")) return "RU";
  if (s.includes("arabic")) return "AR";
  return str.trim().toUpperCase().slice(0, 5);
}

function buildSubtitleObj({ id, lang, release, url }) {
  return {
    id: `addic7ed-${id}`,
    lang: normalizeLang(lang),
    release: release || "Addic7ed Release",
    download_url: `${ADDIC7ED_BASE}${url}`,
  };
}

/* ------------------------------------------------------------------
 * Parse HTML from Addic7ed search results (unauthenticated)
 * ------------------------------------------------------------------ */
function parseAddic7edSearchHTML(html) {
  const $ = cheerio.load(html);
  const subs = [];

  // Addic7ed lists results in tables; rows often have classes even/odd
  $("tr.even, tr.odd").each((i, el) => {
    const cols = $(el).find("td");
    if (cols.length < 5) return;

    const release = $(cols[1]).text().trim(); // Show / Episode / Release
    const lang = $(cols[3]).text().trim();
    const linkRel = $(el).find("a[href*='subtitle.php']").attr("href");

    if (!linkRel) return;

    subs.push(
      buildSubtitleObj({
        id: i,
        lang,
        release,
        url: linkRel,
      })
    );
  });

  return subs;
}

/* ------------------------------------------------------------------
 * Detect if HTML is a login or blocked page
 * ------------------------------------------------------------------ */
function isLoginOrBlocked(html) {
  const lc = html.toLowerCase();
  return (
    lc.includes("login") &&
    (lc.includes("username") || lc.includes("password") || lc.includes("login area"))
  );
}

/* ------------------------------------------------------------------
 * Fast fetch via Axios (no login)
 * ------------------------------------------------------------------ */
async function fetchAddic7edFast(query) {
  const url = `${ADDIC7ED_BASE}/search.php?search=${encodeURIComponent(query)}`;
  debugLog("Fast fetch starting:", url);

  try {
    const resp = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SubtitleFinder/1.0",
      },
      timeout: 15000,
    });
    debugLog("Fast fetch response status:", resp.status);
    const html = resp.data;

    if (isLoginOrBlocked(html)) {
      debugLog("Fast fetch detected login/blocked page.");
      return { blocked: true, subtitles: [] };
    }
    const subs = parseAddic7edSearchHTML(html);
    debugLog(`Fast fetch parsed ${subs.length} subtitles.`);
    return { blocked: false, subtitles: subs };
  } catch (err) {
    debugLog("Fast fetch error:", err.message);
    return { blocked: true, subtitles: [] };
  }
}


/* ------------------------------------------------------------------
 * Puppeteer fallback (optional)
 * ------------------------------------------------------------------ */
async function fetchAddic7edWithPuppeteer(query) {
  debugLog("Launching Puppeteer...");
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  try {
    // Login if creds
    if (ADDIC7ED_USERNAME && ADDIC7ED_PASSWORD) {
      await page.goto(`${ADDIC7ED_BASE}/dologin.php`, { waitUntil: "domcontentloaded" });
      await page.type("input[name='username']", ADDIC7ED_USERNAME, { delay: 10 });
      await page.type("input[name='password']", ADDIC7ED_PASSWORD, { delay: 10 });
      await Promise.all([
        page.click("input[type='submit']"),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
      debugLog("Login complete.");
    }

    debugLog("Navigating to search results page...");
    // Search
    await page.goto(
      `${ADDIC7ED_BASE}/search.php?search=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded" }
    );

    const subs = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr.even, tr.odd"));
      return rows
        .map((row, idx) => {
          const tds = row.querySelectorAll("td");
          if (tds.length < 5) return null;
          const release = tds[1].innerText.trim();
          const lang = tds[3].innerText.trim();
          const a = row.querySelector("a[href*='subtitle.php']");
          if (!a) return null;
          return {
            id: idx,
            lang,
            release,
            url: a.getAttribute("href"),
          };
        })
        .filter(Boolean);
    });

    const normalized = subs.map((s) =>
      buildSubtitleObj({
        id: s.id,
        lang: s.lang,
        release: s.release,
        url: s.url,
      })
    );

    debugLog(`Puppeteer parsed ${normalized.length} subtitles.`);
    await browser.close();
    return normalized;
  } catch (err) {
    console.error("Addic7ed Puppeteer scrape error:", err);
    debugLog("Puppeteer scrape error:", err.message);
    await browser.close();
    return [];
  }
}

/* ------------------------------------------------------------------
 * Unified search
 * ------------------------------------------------------------------ */
async function searchAddic7ed(query) {
  const key = (query || "").trim().toLowerCase();
  const cached = getCache(key);
  if (cached) return cached;

  // First attempt with full query
  let fast = await fetchAddic7edFast(query);
  let subs = fast.subtitles;

  // Puppeteer fallback if blocked
  if (fast.blocked && USE_PUPPETEER) {
    subs = await fetchAddic7edWithPuppeteer(query);
  }

  // 🔹 NEW: Retry with partial keywords if nothing found
  if (subs.length === 0) {
    const words = query.split(/\s+/).filter(Boolean);
    // Try dropping words from the end until something matches
    for (let i = words.length - 1; i > 0 && subs.length === 0; i--) {
      const partial = words.slice(0, i).join(" ");
      debugLog(`No results, retrying with partial query: "${partial}"`);
      const retry = await fetchAddic7edFast(partial);
      if (retry.blocked && USE_PUPPETEER) {
        subs = await fetchAddic7edWithPuppeteer(partial);
      } else {
        subs = retry.subtitles;
      }
    }
  }

  setCache(key, subs);
  return subs;
}

/* ------------------------------------------------------------------
 * Internal: Axios instance headers shortcut
 * ------------------------------------------------------------------ */
function baseHeaders(referer = ADDIC7ED_BASE) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SubtitleFinder/1.0",
    Referer: referer,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

/* ------------------------------------------------------------------
 * Internal: Ensure absolute Addic7ed URL
 * ------------------------------------------------------------------ */
function toAbsolute(url) {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${ADDIC7ED_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/* ------------------------------------------------------------------
 * Internal: Attempt programmatic login (if creds configured)
 * ------------------------------------------------------------------ */
async function attemptLogin(jar) {
  if (!ADDIC7ED_USERNAME || !ADDIC7ED_PASSWORD) return false;
  try {
    // Form-based login endpoint
    const loginUrl = `${ADDIC7ED_BASE}/dologin.php`;
    const form = qs.stringify({
      username: ADDIC7ED_USERNAME,
      password: ADDIC7ED_PASSWORD,
      remember: "1",
      login: "Login",
    });

    await axios.post(loginUrl, form, {
      jar,
      withCredentials: true,
      headers: {
        ...baseHeaders(loginUrl),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      maxRedirects: 5,
    });
    return true;
  } catch (err) {
    console.error("Addic7ed login failed:", err.message);
    return false;
  }
}

/* ------------------------------------------------------------------
 * Internal: Parse direct download link from subtitle page HTML
 *
 * Common patterns:
 *   <a class="buttonDownload" href="/updated/1/123456/0">Download</a>
 *   <a href="/original/1/123456/0/...srt">
 *   Links containing '.srt'
 * ------------------------------------------------------------------ */
function extractDirectDownloadLink(html) {
  const $ = cheerio.load(html);

  // 1. Typical download button
  let href = $("a.buttonDownload").attr("href");
  if (href) return toAbsolute(href);

  // 2. Any anchor containing '.srt'
  href = $("a[href*='.srt']").attr("href");
  if (href) return toAbsolute(href);

  // 3. Updated/original paths Addic7ed uses for counting downloads
  href = $("a[href*='/updated/']").attr("href");
  if (href) return toAbsolute(href);

  href = $("a[href*='/original/']").attr("href");
  if (href) return toAbsolute(href);

  // 4. Fallback: first button-like link
  href = $("a:contains('Download')").attr("href");
  if (href) return toAbsolute(href);

  return null;
}

/* ------------------------------------------------------------------
 * Internal: Try to get filename from Content-Disposition
 * ------------------------------------------------------------------ */
function getFilenameFromDisposition(cd) {
  if (!cd) return null;
  // content-disposition: attachment; filename="whatever.srt"
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd);
  if (!match) return null;
  return decodeURIComponent(match[1] || match[2] || match[3] || "").trim();
}

/* ------------------------------------------------------------------
 * Download proxy (now attempts to fetch the real subtitle file)
 * ------------------------------------------------------------------ */
router.get("/download", async (req, res) => {
  debugLog("Download route hit. Query params:", req.query);
  const pageUrlRaw = req.query.url;
  const overrideName = (req.query.name || "").trim();
  
  if (!pageUrlRaw) return res.status(400).json({ error: "Missing url" });

  const pageUrl = toAbsolute(pageUrlRaw);

  const jar = new CookieJar();

  debugLog("Fetching Addic7ed page:", pageUrl);
  try {
    // 1. Fetch the Addic7ed subtitle PAGE
    let pageResp = await axios.get(pageUrl, {
      jar,
      withCredentials: true,
      headers: baseHeaders(pageUrl),
      responseType: "text",
      maxRedirects: 5,
    });
    let html = pageResp.data;

    // 2. If looks like login page: attempt login, then refetch
    if (isLoginOrBlocked(html)) {
      const logged = await attemptLogin(jar);
      if (logged) {
        pageResp = await axios.get(pageUrl, {
          jar,
          withCredentials: true,
          headers: baseHeaders(pageUrl),
          responseType: "text",
          maxRedirects: 5,
        });
        html = pageResp.data;
      }
    }

    // 3. Extract direct subtitle download link
    const directLink = extractDirectDownloadLink(html);
    debugLog("Extracted direct subtitle link:", directLink);

    if (!directLink) {
      return res.status(404).json({ error: "Subtitle link not found on Addic7ed page." });
    }

    // 4. Fetch the actual subtitle file
    const fileResp = await axios.get(directLink, {
      jar,
      withCredentials: true,
      headers: baseHeaders(pageUrl),
      responseType: "arraybuffer",
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400, // 3xx allowed; axios will follow
    });

    // 5. Determine filename
    let filename =
      overrideName ||
      getFilenameFromDisposition(fileResp.headers["content-disposition"]) ||
      (directLink.split("/").pop() || "subtitle.srt");
      debugLog("Final filename resolved:", filename);

    // If no extension, default .srt (unless content-type looks like zip)
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
      const ct = (fileResp.headers["content-type"] || "").toLowerCase();
      if (ct.includes("zip")) filename += ".zip";
      else filename += ".srt";
    }

    // 6. Set headers & stream to client
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const ct = fileResp.headers["content-type"] || "application/x-subrip";
    res.setHeader("Content-Type", ct);
    res.send(fileResp.data);
  } catch (err) {
    console.error("Addic7ed direct download error:", err.message);
    res.status(500).json({ error: "Failed to fetch Addic7ed subtitle" });
  }
});

/* ------------------------------------------------------------------
 * Search endpoint
 * ------------------------------------------------------------------ */
router.get("/search", async (req, res) => {
  res.setHeader("Cache-Control", "no-store"); // Disable browser caching
  res.setHeader("ETag", Date.now().toString()); // Force-change each request

  const query = (req.query.query || "").trim();
   debugLog("Search route hit. Query:", req.query.query);
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const subtitles = await searchAddic7ed(query);
    debugLog(`Returning ${subtitles.length} results to client.`);
    res.status(200).json({ subtitles });
  } catch (err) {
    console.error("Addic7ed search controller error:", err);
    res.status(500).json({ error: "Failed to fetch Addic7ed subtitles" });
  }
});


module.exports = router;
