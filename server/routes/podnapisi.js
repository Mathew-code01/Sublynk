// server/routes/podnapisi.js
// server/routes/podnapisi.js
// server/routes/podnapisi.js
// server/routes/podnapisi.js
// server/routes/podnapisi.js
// server/routes/podnapisi.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const tough = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const qs = require("qs");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });
const router = express.Router();

const PODNAPISI_BASE = "https://www.podnapisi.net";
const FORUM_LOGIN_URL = "https://www.podnapisi.net/forum/ucp.php?mode=login";
// ✅ Define a UA for this route
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Small helpers
function sanitizeFilename(name) {
  return (name || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

function pickFilenameFromDisposition(disposition) {
  if (!disposition) return null;

  // RFC 5987: filename*=UTF-8''encoded-name.zip
  const star = /filename\*\s*=\s*([^']*)''([^;]+)/i.exec(disposition);
  if (star && star[2]) {
    try {
      return decodeURIComponent(star[2]);
    } catch {}
  }

  // filename="name.zip" or filename=name.zip
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(disposition);
  if (quoted && quoted[1]) return quoted[1];

  const bare = /filename\s*=\s*([^;]+)/i.exec(disposition);
  if (bare && bare[1]) return bare[1].trim();

  return null;
}

const CACHE_TTL = 5 * 60 * 1000;
const SEARCH_TIMEOUT = 45000;
const cache = new Map();

const DEBUG_ENABLED = process.env.DEBUG_PODNAPISI === "true";

// Axios with cookie jar
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));

/* ----------------------------- Debug Logger ----------------------------- */
function logDebug(...args) {
  if (DEBUG_ENABLED) console.debug("[PODNAPISI]", ...args);
}

/* ---------------------------- Cache Helpers ----------------------------- */
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

/* -------------------------- HTML Parser (Search) -------------------------- */
/* -------------------------- HTML Parser (Search) -------------------------- */
function parseSearchResults(html, query = "") {
  const $ = require("cheerio").load(html);
  const subtitles = [];

  function getRelativeTime(rawDate) {
    if (!rawDate) return null;

    const now = new Date();
    let dateObj;

    if (/today/i.test(rawDate)) {
      dateObj = new Date(now);
    } else if (/yesterday/i.test(rawDate)) {
      dateObj = new Date(now);
      dateObj.setDate(dateObj.getDate() - 1);
    } else {
      dateObj = new Date(rawDate);
      if (isNaN(dateObj)) {
        dateObj = new Date(`${rawDate} ${now.getFullYear()}`);
      }
      if (isNaN(dateObj)) return rawDate;
    }

    const diffMs = now - dateObj;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
    if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  }

  function normalizeUrl(href) {
    if (!href) return null;
    try {
      return href.startsWith("http")
        ? href
        : new URL(href, PODNAPISI_BASE).toString();
    } catch {
      return null;
    }
  }

  // -------------------- CASE 1: Forum-style search results --------------------
  const forumResults = $("div.search.post");
  console.debug("Forum results found:", forumResults.length);
  if (forumResults.length > 0) {
    forumResults.each((i, el) => {
      const $el = $(el);
      const $titleLink = $el.find("h3 a").first();
      const title = $titleLink.text().trim();
      const href = $titleLink.attr("href");
      if (!title || !href) return;

      const fullUrl = normalizeUrl(
        href.startsWith("/") ? href : `/forum/${href}`
      );

      const author = $el.find("dt.author a.username").text().trim() || null;
      const rawPostedAt =
        $el.find("dd.search-result-date").text().trim() || null;
      const postedAt = getRelativeTime(rawPostedAt);

      const releaseName = title.split(" - ")[0].trim() || title;
      const postedAtISO =
        rawPostedAt && !isNaN(new Date(rawPostedAt))
          ? new Date(rawPostedAt).toISOString()
          : null;

      subtitles.push({
        id: `f-${i}`,
        title,
        lang: "EN",
        release: releaseName,
        author,
        postedAt,
        postedAtISO,
        download_url: fullUrl,
      });
    });

    return subtitles;
  }

  // -------------------- CASE 2: Old Podnapisi <ul.list> results --------------------
  const subtitleResults = $("ul.list li");
  console.debug("Old list results found:", subtitleResults.length);
  if (subtitleResults.length > 0) {
    subtitleResults.each((i, el) => {
      const $el = $(el);
      const $link = $el.find("a[href*='/en/subtitles/']").first();
      const title = $link.text().trim();
      const href = $link.attr("href");
      if (!title || !href) return;

      const fullUrl = normalizeUrl(href);

      const lang = $el.find(".flag").attr("title") || "EN";
      const releaseText = $el.find(".release").text().trim();
      const releaseName = releaseText || title;

      const rawPostedAt = $el.find(".posted-date").text().trim() || null;
      const postedAt = getRelativeTime(rawPostedAt);

      subtitles.push({
        id: `s-${i}`,
        title,
        lang,
        release: releaseName,
        author: null,
        postedAt,
        postedAtISO:
          rawPostedAt && !isNaN(new Date(rawPostedAt))
            ? new Date(rawPostedAt).toISOString()
            : null,
        download_url: fullUrl,
      });
    });

    return subtitles;
  }

  // -------------------- CASE 3: New Podnapisi <tr.subtitle-entry> results --------------------
  const tableResults = $("tr.subtitle-entry");
  console.debug("Table results found:", tableResults.length);
  if (tableResults.length > 0) {
    tableResults.each((i, el) => {
      const $el = $(el);

      // main link
      const $link = $el.find("a[href*='/en/subtitles/']").first();
      const href = $link.attr("href");
      if (!href) return; // skip if no link

      const fullUrl = normalizeUrl(href);

      // title may be empty, so fallback to .release column
      let title = $link.text().trim();
      if (!title) {
        title = $el.find(".release").first().text().trim();
      }
      if (!title) {
        console.warn("⚠️ No title found for row, href:", href);
        title = "Unknown Title";
      }

      const lang =
        $el.find("abbr.language span").text().trim() ||
        $el.find("td.language abbr").attr("title") ||
        "EN";

      const releaseText = $el.find(".release").first().text().trim();
      const releaseName = releaseText || title;

      const author =
        $el.find("td a[href*='contributors']").text().trim() || null;

      const rawPostedAt =
        $el.find("td span[data-title]").attr("data-title") || null;
      const postedAt = getRelativeTime(rawPostedAt);

      subtitles.push({
        id: `t-${i}`,
        title,
        lang,
        release: releaseName,
        author,
        postedAt,
        postedAtISO:
          rawPostedAt && !isNaN(new Date(rawPostedAt))
            ? new Date(rawPostedAt).toISOString()
            : null,
        download_url: fullUrl,
      });
    });

    return subtitles;
  }

  console.debug("No matching results in HTML for query:", query);
  return subtitles;
}






async function loginToPodnapisi(username, password) {
  const loginPage = await client.get(FORUM_LOGIN_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const $ = cheerio.load(loginPage.data);
  const creation_time = $('input[name="creation_time"]').val();
  const form_token = $('input[name="form_token"]').val();
  const redirect = $('input[name="redirect"]').val() || "index.php";

  if (!creation_time || !form_token) throw new Error("Missing form tokens");

  const loginData = qs.stringify({
    username,
    password,
    autologin: "on",
    login: "Login",
    creation_time,
    form_token,
    redirect,
  });

  const response = await client.post(FORUM_LOGIN_URL, loginData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Referer: FORUM_LOGIN_URL,
    },
    maxRedirects: 0,
    validateStatus: (status) => status === 302 || status === 200,
  });

  const cookies = await cookieJar.getCookies("https://www.podnapisi.net");
  const session = cookies.find((c) => c.key.startsWith("phpbb3_"));

  if (!session) throw new Error("Login failed — no session cookie");
}



/* ---------------------------- Retry Helper ---------------------------- */
async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.get(url, options);
    } catch (err) {
      if (attempt < retries)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      else throw err;
    }
  }
}

/* ----------------------------- LOGIN ROUTE ----------------------------- */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Username and password are required" });

  try {
    const loginPage = await client.get(FORUM_LOGIN_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(loginPage.data);
    const creation_time = $('input[name="creation_time"]').val();
    const form_token = $('input[name="form_token"]').val();
    const redirect = $('input[name="redirect"]').val() || "index.php";

    if (!creation_time || !form_token)
      return res.status(500).json({ error: "Failed to extract form tokens" });

    const loginData = qs.stringify({
      username,
      password,
      autologin: "on",
      login: "Login",
      creation_time,
      form_token,
      redirect,
    });

    const response = await client.post(FORUM_LOGIN_URL, loginData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        Referer: FORUM_LOGIN_URL,
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status === 200,
    });

    const cookies = await cookieJar.getCookies("https://www.podnapisi.net");
    const session = cookies.find((c) => c.key.startsWith("phpbb3_"));

    if (!session) {
      return res
        .status(401)
        .json({ error: "Login failed – no session cookie" });
    }

    res.json({
      message: "Login successful",
      cookies: cookies.map((c) => `${c.key}=${c.value}`),
    });
  } catch (err) {
    console.error("❌ Login failed:", err.message);
    res.status(500).json({ error: "Login request failed" });
  }
});


/* ---------------------------- SEARCH ROUTE ---------------------------- */

// --- Robust fetch with retry + timeout ---
async function fetchWithRetry(url, options = {}, retries = 2) {
  try {
    const res = await axios.get(url, {
      timeout: options.timeout || 20000, // 20s default
      headers: {
        "User-Agent": options.userAgent || "Mozilla/5.0 SubtitleFinder/1.0",
        ...options.headers,
      },
      responseType: "text", // ensure HTML, not stream
      decompress: true, // auto handle gzip/deflate
      validateStatus: (status) => status >= 200 && status < 400, // follow 3xx redirects
    });

    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn(`⚠️ Fetch failed (${err.message}). Retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

// --- Podnapisi Search Route ---
router.get("/search", async (req, res) => {
  const query = (req.query.query || "").trim();
  if (!query) return res.status(400).json({ error: "Missing query" });

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ subtitles: cached, cached: true });

  // ✅ Ensure login
  let cookies = await cookieJar.getCookies("https://www.podnapisi.net");
  let isLoggedIn = cookies.some((c) => c.key.startsWith("phpbb3_"));

  if (!isLoggedIn) {
    console.warn("🔐 Not logged in – attempting auto-login...");
    try {
      const username = process.env.PODNAPISI_USER || "SoftCode";
      const password = process.env.PODNAPISI_PASS || "Mathew2006";
      await loginToPodnapisi(username, password);
      cookies = await cookieJar.getCookies("https://www.podnapisi.net");
      isLoggedIn = cookies.some((c) => c.key.startsWith("phpbb3_"));
      if (!isLoggedIn)
        return res.status(401).json({ error: "Auto-login failed" });
      console.log("✅ Auto-login successful");
    } catch (err) {
      console.error("❌ Auto-login failed:", err.message);
      return res.status(500).json({ error: "Auto-login to Podnapisi failed" });
    }
  }

  const url = `${PODNAPISI_BASE}/en/subtitles/search/?keywords=${encodeURIComponent(
    query
  )}`;

  try {
    const response = await fetchWithRetry(url, { timeout: SEARCH_TIMEOUT });
    const html = response.data;

    if (!html || html.length < 500) {
      console.error("❌ Empty or invalid HTML from Podnapisi");
      return res.status(502).json({ error: "Invalid response from Podnapisi" });
    }

    const subtitles = parseSearchResults(html, query);
    console.log("✅ Subtitles parsed:", subtitles.length);

    setCache(cacheKey, subtitles);
    res.json({ subtitles, cached: false, took_ms: Date.now() - res.startTime });
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      return res
        .status(503)
        .json({ error: "Network unavailable. Please check your connection." });
    }
    console.error("Podnapisi search error:", err.message);
    res.status(500).json({ error: "Failed to fetch Podnapisi subtitles" });
  }

});




/* --------------------------- DOWNLOAD ROUTE --------------------------- */
/* --------------------------- DOWNLOAD ROUTE --------------------------- */
/* --------------------------- PODNAPISI DOWNLOAD ROUTE --------------------------- */
router.get("/download", async (req, res) => {
  const t0 = Date.now();
  const reqId = Date.now();
  let { url: pageUrl, filename: reqFilename, debug } = req.query;

  if (!pageUrl || !pageUrl.startsWith("http")) {
    return res.status(400).json({ error: "Invalid or missing URL" });
  }
  debug = !!debug;

  let workingUrl = pageUrl;
  let hops = [];
  let formDownload = false; // <-- track if we scraped a form

  try {
    // 0) Normalize direct /download URL
    if (/\/subtitles\/.+\/download\/?$/.test(pageUrl)) {
      console.log(`[POD ${reqId}] ⚡ Direct download detected: ${pageUrl}`);
      workingUrl = pageUrl;
    } else if (/viewtopic\.php/.test(pageUrl)) {
      const resolved = await resolveForumToSubtitle(pageUrl, debug);
      if (!resolved) {
        res.setHeader("X-Subtitle-Status", "missing");
        return res
          .status(404)
          .json({ error: "Forum thread has no subtitle link", hops });
      }
      workingUrl = resolved.url;
      hops.push(resolved);
    } else if (/\/subtitles\/search/.test(pageUrl)) {
      const resolved = await resolveSearchToSubtitle(pageUrl, debug);
      if (!resolved) {
        res.setHeader("X-Subtitle-Status", "missing");
        return res
          .status(404)
          .json({ error: "Search page returned no subtitle results", hops });
      }
      workingUrl = resolved.url;
      hops.push(resolved);
    }

    let finalUrl = workingUrl;

    // 1) If not direct /download, scrape subtitle detail page
    if (!/\/download\/?$/.test(workingUrl)) {
      console.log(
        `[POD ${reqId}] 🔎 Scraping subtitle detail page: ${workingUrl}`
      );
      const pageResponse = await axios.get(workingUrl, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
          Referer: workingUrl,
        },
      });

      const $ = cheerio.load(pageResponse.data);
      const downloadForm = $("form.download-form");

      if (downloadForm.length) {
        const downloadPath = downloadForm.attr("action");
        finalUrl = new URL(downloadPath, workingUrl).href;
        formDownload = true;
        console.log(
          `[POD ${reqId}] ✅ Found form-based download URL: ${finalUrl}`
        );
      } else {
        const downloadPath = $('a[href*="/download"]').attr("href");
        if (!downloadPath) {
          res.setHeader("X-Subtitle-Status", "missing");
          return res.status(404).json({
            error: "Could not find download link on subtitle page",
            hops,
            candidates: $("a")
              .map((i, el) => $(el).attr("href"))
              .get(),
          });
        }
        finalUrl = new URL(downloadPath, workingUrl).href;
        console.log(`[POD ${reqId}] ✅ Scraped final URL: ${finalUrl}`);
      }
    } else {
      console.log(`[POD ${reqId}] ✅ Using direct URL: ${finalUrl}`);
    }

    // Debug mode → just return info, don’t stream
    if (debug) {
      return res.json({
        ok: true,
        resolvedZipUrl: finalUrl,
        hops,
        formDownload,
      });
    }

    // 2) Fetch the actual ZIP
    console.log(`[POD ${reqId}] ⬇️ Downloading subtitle ZIP...`);

    let fileResponse;
    if (formDownload) {
      // Mimic clicking the form: container=none, encoding empty (default utf-8)
      const formData = new URLSearchParams();
      formData.append("container", "none");
      formData.append("encoding", "");

      fileResponse = await axios.post(finalUrl, formData.toString(), {
        responseType: "stream",
        headers: {
          "User-Agent": UA,
          Referer: workingUrl,
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 5,
        timeout: 30000,
      });
    } else {
      fileResponse = await axios.get(finalUrl, {
        responseType: "stream",
        headers: { "User-Agent": UA, Referer: workingUrl, Accept: "*/*" },
        maxRedirects: 5,
        timeout: 30000,
      });
    }

    // Preserve filename
    const filename =
      sanitizeFilename(reqFilename) ||
      path.basename(new URL(finalUrl).pathname) ||
      "subtitle.zip";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Subtitle-Status", "ok");

    fileResponse.data.pipe(res);
    fileResponse.data.on("end", () => {
      console.log(
        `[POD ${reqId}] ✅ Streamed ${filename} in ${Date.now() - t0}ms`
      );
    });
  } catch (err) {
    console.error(`[POD ${reqId}] ❌ Error: ${err.message}`);

    const statusCode = err.response?.status || 500;
    const status = statusCode >= 500 ? "failed-server" : "failed";

    res.setHeader("X-Subtitle-Status", status);
    res.status(statusCode).json({
      error: "Download failed",
      message: err.message,
      status,
    });
  }

});



  // --- helpers ---

  async function resolveForumToSubtitle(forumUrl, debug = false) {
    const resp = await axios.get(forumUrl, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(resp.data);

    const candidates = $('a[href*="/subtitles/"]')
      .map((i, el) => $(el).attr("href"))
      .get();

    if (debug) {
      console.log("Forum candidates:", candidates);
    }

    if (!candidates.length) return null;

    return {
      url: new URL(candidates[0], "https://www.podnapisi.net").href,
      candidates,
      source: "forum",
    };
  }

  async function resolveSearchToSubtitle(searchUrl, debug = false) {
    const resp = await axios.get(searchUrl, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(resp.data);

    const entryHref = $("tr.subtitle-entry").first().attr("data-href");

    if (debug) {
      console.log("Search first result:", entryHref);
    }

    if (!entryHref) return null;

    return {
      url: new URL(entryHref, "https://www.podnapisi.net").href,
      candidates: [entryHref],
      source: "search",
    };
  }







module.exports = router;
