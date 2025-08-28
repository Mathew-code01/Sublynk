// server/routes/TVSubtitles.js

// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
// server/routes/TVSubtitles.js
const express  = require("express");
const axios    = require("axios");
const cheerio  = require("cheerio");
const https    = require("https");
const dayjs = require("dayjs");
const pLimit = require("p-limit");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const chromium = require("chromium");
const chromeLauncher = require("chrome-launcher");
const relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime);
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteerExtra.use(StealthPlugin());


console.log("✅ TVSubtitles route file loaded");

const axiosRetry = require("axios-retry");

const router          = express.Router();
const TVSUB_BASE      = "https://www.tvsubtitles.net";
const SEARCH_TIMEOUT  = 15000;
const CACHE_TTL       = 5 * 60 * 1000; // 5 minutes
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";
const agent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
});
async function getPuppeteer() {
  return (await import("puppeteer")).default;
}

// Setup retry for axios
const axiosInstance = axios.create({
  httpsAgent: agent,
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",

    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    Referer: "https://www.tvsubtitles.net/",
    DNT: "1", // Do Not Track
    Connection: "keep-alive",
  },
});
console.log("⌛ Axios timeout is:", axiosInstance.defaults.timeout);

axiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkError(error) || error.code === "ECONNABORTED";
  },
});

// ────────────────────────────────────────────────────────────
// In‑memory cache (key ➜ { data, expires })
// ────────────────────────────────────────────────────────────
const cache = new Map();
function getCache(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

function parseRelativeTime(text) {
  const now = dayjs();

  const match = text.match(
    /(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours|d|day|days)/i
  );
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const map = {
    s: "second",
    sec: "second",
    second: "second",
    seconds: "second",
    m: "minute",
    min: "minute",
    minute: "minute",
    minutes: "minute",
    h: "hour",
    hour: "hour",
    hours: "hour",
    d: "day",
    day: "day",
    days: "day",
  };

  const parsedUnit = map[unit];
  if (!parsedUnit) return null;

  return now.subtract(num, parsedUnit).fromNow(); // e.g., "2 hours ago"
}




// ────────────────────────────────────────────────────────────
// Fetch and filter TV shows
// ────────────────────────────────────────────────────────────
async function fetchAndFilterTvShows(query) {
  const url = `${TVSUB_BASE}/tvshows.html`;
  console.log(`🌐 Fetching show list: ${url}`);

  const { data } = await axiosInstance.get(url, {
    timeout: axiosInstance.defaults.timeout || 15000,
  });
  const $ = cheerio.load(data);

  console.log("⌛ Axios timeout is:", axiosInstance.defaults.timeout);

  console.log("📦 Loaded HTML length:", data.length);
  console.log("🔍 Trying to find show anchors…");

  const anchors = $("a[href^='tvshow-']");
  console.log("🔗 Found", anchors.length, "tvshow- anchors");

  const normalizedQuery = query.trim().toLowerCase();
  const shows = [];

  anchors.each((i, el) => {
    const title = $(el).text().trim();
    const href  = $(el).attr("href");

    if (!href || !title) return;

    const normalizedTitle = title.toLowerCase();
    const isMatch =
      normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle);

    if (isMatch) {
      shows.push({
        id: `tvsub-${i}`,
        title,
        page_url: `${TVSUB_BASE}/${href}`,
      });
    }

    if (i < 5) {
      console.log(`   ➤ [${i}] "${title}" -> ${href}`);
    }
  });

  shows.forEach(r =>
    console.log(`🎯 Match: "${r.title}" ➜ ${r.page_url}`)
  );

  console.log(`✅ Parsed ${shows.length} matching TV shows`);
  return shows;
}
// Helpers (put near top once)
const ALLOWED_HOSTS = new Set(["tvsubtitles.net", "www.tvsubtitles.net"]);

function nowNs() { return process.hrtime.bigint(); }
function msSince(start) {
  const diff = Number(process.hrtime.bigint() - start);
  return Math.round(diff / 1e6);
}
function hostFrom(u) { try { return new URL(u).hostname; } catch { return null; } }
function toAbs(base, maybe) { try { return new URL(maybe, base).toString(); } catch { return null; } }

// ────────────────────────────────────────────────────────────
// /download – Directly download ZIP from TVSubtitles (verbose)
// ────────────────────────────────────────────────────────────

puppeteerExtra.use(StealthPlugin());

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



const os = require("os");

router.get("/download", async (req, res) => {
  const t0 = Date.now();
  const reqId = Date.now();
  let { url } = req.query;

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid or missing URL" });
  }

  // Normalize: convert /download-* → /subtitle-*
  url = url.replace("/download-", "/subtitle-");

  let browser;
  let downloadPath;
  try {
   const browser = await puppeteer.launch({
     headless: true,
     executablePath: chromium.path, // 👈 use chromium npm path
     args: ["--no-sandbox", "--disable-setuid-sandbox"],
   });


    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    );

    console.log(`[DL ${reqId}] 🔹 Warmup...`);
    await page.goto("https://www.tvsubtitles.net/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log(`[DL ${reqId}] 🔹 Navigating to ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // If we’re on an episode page → click into subtitle
    if (page.url().includes("/episode-")) {
      const subtitleSel = 'a[href*="subtitle-"][href$="-en.html"]';
      const hasSub = await page.$(subtitleSel);
      if (!hasSub) throw new Error("Subtitle link not found on episode page");
      await Promise.all([
        page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }),
        page.click(subtitleSel),
      ]);
    }

    console.log(`[DL ${reqId}] 🔹 Looking for download link...`);

    // Try English first
    let downloadSel = 'a[href*="download-"][href$="-en.html"]';
    let linkHandle = await page.$(downloadSel);

    // Fallback → generic
    if (!linkHandle) {
      console.log(
        `[DL ${reqId}] ⚠️ English download not found, trying generic...`
      );
      downloadSel = 'a[href^="download-"]';
      linkHandle = await page.$(downloadSel);
    }

    if (!linkHandle) throw new Error("Download link not found");

    // Setup Puppeteer download dir
    downloadPath = path.join(os.tmpdir(), `tvsub_${reqId}`);
    fs.mkdirSync(downloadPath, { recursive: true });
    try {
      await page._client().send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath,
      });
    } catch {
      console.warn(`[DL ${reqId}] ⚠️ Could not set download behavior`);
    }

    console.log(`[DL ${reqId}] 🔹 Clicking download link...`);
    await page.click(downloadSel);

    // Wait for .zip file
    // After waiting loop for .zip
    let zipFile;
    for (let i = 0; i < 40; i++) {
      const files = fs
        .readdirSync(downloadPath)
        .filter((f) => f.endsWith(".zip"));
      if (files.length > 0) {
        zipFile = path.join(downloadPath, files[0]);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!zipFile) {
      console.log(`[DL ${reqId}] ⚠️ No ZIP found (marking as missing)`);
      res.setHeader("X-Subtitle-Status", "missing");
      return res.status(404).json({
        error: "Subtitle ZIP missing",
        status: "missing",
        message: "Subtitle exists but no .zip available",
      });
    }

    // Preserve filename
    const filename = path.basename(zipFile) || "subtitle.zip";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/zip");

    // Stream and cleanup
    const stream = fs.createReadStream(zipFile);
    stream.pipe(res);
    stream.on("close", () => {
      try {
        fs.rmSync(downloadPath, { recursive: true, force: true });
        console.log(`[DL ${reqId}] 🧹 Temp cleaned up`);
      } catch {}
    });

    console.log(`[DL ${reqId}] ✅ Streamed to client in ${Date.now() - t0}ms`);
  } catch (err) {
    console.error(`[DL ${reqId}] ❌ Error: ${err.message}`);
    res.status(500).json({ error: "Download failed", message: err.message });
    if (downloadPath) {
      try {
        fs.rmSync(downloadPath, { recursive: true, force: true });
      } catch {}
    }
  } finally {
    if (browser) await browser.close();
  }
});




// ────────────────────────────────────────────────────────────
// /resolve – Resolve subtitle page ➜ ZIP URL
// ────────────────────────────────────────────────────────────


// /tvsubtitles/resolve
// Keep / define these near the top of the file if not already present
const BASE = "https://www.tvsubtitles.net";

function nowNs() { return process.hrtime.bigint(); }
function msSince(start) {
  const diff = Number(process.hrtime.bigint() - start);
  return Math.round(diff / 1e6);
}

// Helper to choose axios instance if you have one
function getHttpClient() {
  return (typeof axiosInstance !== "undefined") ? axiosInstance : axios;
}

function normalizeToAbsolute(urlLike) {
  // Accept absolute, protocol-relative, root-relative or bare paths like 'subtitle-123.html'
  try {
    if (/^https?:\/\//i.test(urlLike)) {
      return urlLike;
    }
    if (urlLike.startsWith("//")) {
      return "https:" + urlLike;
    }
    if (urlLike.startsWith("/")) {
      return `${BASE}${urlLike}`;
    }
    // bare path
    return `${BASE}/${urlLike}`;
  } catch {
    return null;
  }
}

function hostFrom(u) {
  try { return new URL(u).hostname; } catch { return null; }
}

// ────────────────────────────────────────────────────────────
// /resolve – Resolve subtitle page ➜ actual download link
// ────────────────────────────────────────────────────────────
router.get("/resolve", async (req, res) => {
    const t0 = nowNs();
    const reqId =
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      const rawUrl = (req.query.url || "").trim();
      const wantDebug = String(req.query.debug || "") === "1";

      console.log(`[RES ${reqId}] ① Received /resolve url="${rawUrl}"`);

      if (!rawUrl) {
        console.warn(`[RES ${reqId}] ⚠️ Missing subtitle URL`);
        return res.status(400).json({ error: "Missing subtitle URL" });
      }

      // ② Normalize to absolute URL
      const subtitlePageUrl = normalizeToAbsolute(rawUrl);
      if (!subtitlePageUrl) {
        console.warn(`[RES ${reqId}] ⚠️ Could not normalize URL`);
        return res.status(400).json({ error: "Invalid URL" });
      }
      const inputHost = hostFrom(subtitlePageUrl);
      console.log(
        `[RES ${reqId}] ② Normalized URL: ${subtitlePageUrl} (host=${inputHost})`
      );

      // ③ Host allow-list
      if (!inputHost || !ALLOWED_HOSTS.has(inputHost)) {
        console.warn(`[RES ${reqId}] ⚠️ Unsupported host: ${inputHost}`);
        return res.status(400).json({ error: "Host not supported" });
      }

      // ④ If already a download page, return canonical form
      // step ④ Already a download link
      if (/\/?download-\d+(?:-\d+)?-?[a-z]{0,3}\.html$/i.test(subtitlePageUrl)) {
        const canonical = subtitlePageUrl.startsWith("http")
          ? subtitlePageUrl
          : `${BASE}/${subtitlePageUrl}`;
        console.log(
          `[RES ${reqId}] ④ Already a download link -> ${canonical} (+${msSince(
            t0
          )}ms)`
        );
        return res.json({
          downloadUrl: canonical,
          provider: "tvsubtitles",
        });
      }

      // ⑤ Fetch the subtitle page
      console.log(`[RES ${reqId}] ⑤ Fetching subtitle page…`);
      const tFetch = nowNs();
      try {
        const client = getHttpClient();
        const response = await client.get(subtitlePageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.8",
            Referer: BASE,
          },
          timeout: 15000,
          httpsAgent: typeof agent !== "undefined" ? agent : undefined,
          maxRedirects: 0, // IMPORTANT: don’t auto-follow; we want to see Location
          validateStatus: (s) => s >= 200 && s < 400, // accept 3xx so we can log Location
        });

        console.log(
          `[RES ${reqId}] ⑤ Page fetched: status=${response.status}, bytes=${
            String(response.data).length
          }, tookMs=${msSince(tFetch)}`
        );

        if (response.status >= 300 && response.status < 400) {
          const loc = response.headers?.location;
          console.warn(
            `[RES ${reqId}] ⚠️ Subtitle page redirected immediately -> ${loc}`
          );
          const locHost = hostFrom(normalizeToAbsolute(loc || ""));
          console.warn(`[RES ${reqId}] ⚠️ Redirect host: ${locHost}`);
          return res
            .status(502)
            .json({
              error: "Unexpected redirect on subtitle page",
              location: loc,
              locationHost: locHost,
            });
        }

        // ⑥ Parse and find download- anchors
        console.log(`[RES ${reqId}] ⑥ Parsing HTML with Cheerio…`);
        const tParse = nowNs();
        const $ = cheerio.load(response.data);
        console.log(`[RES ${reqId}] ⑥ Parsed in ${msSince(tParse)}ms`);

        const anchors = $('a[href^="download-"]');
        const count = anchors.length;
        console.log(
          `[RES ${reqId}] ⑥ Found ${count} anchor(s) with href^="download-"`
        );

        if (count === 0) {
          // Provide more diagnostics: look for any anchor containing "download"
          const fuzzy = $('a[href*="download"]');
          console.log(
            `[RES ${reqId}] ⑥ (fuzzy) a[href*="download"] count=${fuzzy.length}`
          );
          console.warn(
            `[RES ${reqId}] ⚠️ No direct download- anchor found on page`
          );
          const dbg = wantDebug
            ? { haveAnchors: count, haveFuzzy: fuzzy.length }
            : undefined;
          return res
            .status(404)
            .json({ error: "Download link not found", debug: dbg });
        }

        // Log first few candidates
        const candidates = anchors
          .map((i, el) => $(el).attr("href"))
          .get()
          .filter(Boolean)
          .slice(0, 3);
        console.log(
          `[RES ${reqId}] ⑥ Sample hrefs: ${candidates
            .map((c) => `"${c}"`)
            .join(", ")}`
        );

        // ⑦ Choose the first download- href and normalize it
        const href = anchors.first().attr("href");
        const absoluteDownloadPage = normalizeToAbsolute(href);
        const dlHost = hostFrom(absoluteDownloadPage);
        console.log(
          `[RES ${reqId}] ⑦ Chosen href="${href}" -> absolute="${absoluteDownloadPage}" (host=${dlHost})`
        );

        if (!dlHost || !ALLOWED_HOSTS.has(dlHost)) {
          console.warn(
            `[RES ${reqId}] ⚠️ Resolved download host not allowed: ${dlHost}`
          );
          return res
            .status(400)
            .json({
              error: "Resolved download host not allowed",
              url: absoluteDownloadPage,
              host: dlHost,
            });
        }

        // ⑧ Verify redirect chain of download page (HEAD, no-follow)
        console.log(
          `[RES ${reqId}] ⑧ Verifying download page with HEAD (no redirects)…`
        );
        const tHead = nowNs();
        try {
          const headResp = await getHttpClient().head(absoluteDownloadPage, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36",
              Referer: subtitlePageUrl,
            },
            timeout: 15000,
            httpsAgent: typeof agent !== "undefined" ? agent : undefined,
            maxRedirects: 0,
            validateStatus: (s) => s >= 200 && s < 400,
          });

          if (headResp.status >= 300 && headResp.status < 400) {
            const loc = headResp.headers?.location;
            const locAbs = normalizeToAbsolute(loc || "");
            const locHost = hostFrom(locAbs);
            console.warn(
              `[RES ${reqId}] ⚠️ Download page redirects -> ${loc} (abs=${locAbs}, host=${locHost})`
            );
            if (locHost && !ALLOWED_HOSTS.has(locHost)) {
              console.warn(
                `[RES ${reqId}] ❌ External redirect detected to host=${locHost}`
              );
            }
            console.log(`[RES ${reqId}] ⑧ HEAD completed in ${msSince(tHead)}ms`);
            const payload = {
              url: absoluteDownloadPage, // old style
              downloadUrl: absoluteDownloadPage, // new style, what frontend wants
              provider: "tvsubtitles",
            };
            if (wantDebug) {
                res.setHeader("X-Debug-Screenshot", `/tmp/${reqId}-page.png`);
                res.setHeader("X-Debug-Html", `/tmp/${reqId}-page.html`);
              payload.debug = {
                step: "resolved-download",
                headStatus: headResp.status,
                redirectLocation: loc,
                redirectAbsolute: locAbs,
                redirectHost: locHost,
                tookMs: msSince(t0),
              };
                
                const html = await page.content();
                console.log(`[DL ${reqId}] 📝 Page HTML length=${html.length}`);
                fs.writeFileSync(`/tmp/${reqId}-page.html`, html);
                console.log(
                  `[DL ${reqId}] 📝 Saved HTML snapshot -> /tmp/${reqId}-page.html`
                );
            }
            return res.json(payload);
          } else {
            console.log(
              `[RES ${reqId}] ⑧ HEAD status=${
                headResp.status
              } (no redirect) in ${msSince(tHead)}ms`
            );
            const payload = {
              url: absoluteDownloadPage, // old style
              downloadUrl: absoluteDownloadPage, // new style, what frontend wants
              provider: "tvsubtitles",
            };
            if (wantDebug) {
                const screenshotPath = `/tmp/${reqId}-page.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(
                  `[DL ${reqId}] 📸 Saved screenshot -> ${screenshotPath}`
                );
              payload.debug = {
                step: "resolved-download",
                headStatus: headResp.status,
                tookMs: msSince(t0),
              };
            }
            return res.json(payload);
          }
        } catch (headErr) {
          // e.g., 403/405 on HEAD, or network; still return resolved URL with diagnostics
          const code = headErr.response?.status || headErr.code || "ERR";
          const loc = headErr.response?.headers?.location;
          const locAbs = normalizeToAbsolute(loc || "");
          const locHost = hostFrom(locAbs);
          console.warn(
            `[RES ${reqId}] ⚠️ HEAD failed: code=${code}, location=${loc}, host=${locHost}, tookMs=${msSince(
              tHead
            )}`
          );
          const payload = {
            url: absoluteDownloadPage, // old style
            downloadUrl: absoluteDownloadPage, // new style, what frontend wants
            provider: "tvsubtitles",
          };
          if (wantDebug) {
            payload.debug = {
              step: "resolved-download",
              headError: String(code),
              redirectLocation: loc,
              redirectAbsolute: locAbs,
              redirectHost: locHost,
              tookMs: msSince(t0),
            };
            page.on("request", (req) => {
              console.log(`[DL ${reqId}] ↗️ Request: ${req.method()} ${req.url()}`);
            });
            page.on("response", (resp) => {
              console.log(
                `[DL ${reqId}] ↙️ Response: ${resp.status()} ${resp.url()}`
              );
            });
          }
          return res.json(payload);
        }
      } catch (err) {
        console.error(
          `[RES ${reqId}] 💥 Resolve error: ${err.message} (+${msSince(t0)}ms)`
        );
        return res.status(500).json({ error: "Failed to resolve download link" });
    }
});

 
// ────────────────────────────────────────────────────────────
// /search – Find TV shows
// ────────────────────────────────────────────────────────────
// Put this near the top of the file (helpers for this route only)

// Small helper to time steps
function nowNs() { return process.hrtime.bigint(); }
function msSince(start) {
  const diff = Number(nowNs() - start);
  return Math.round(diff / 1e6);
}

async function fetchHtmlVerbose(url, reqId, label = "fetchHtml") {
  const t0 = nowNs();
  console.log(`[TVSUB ${reqId}] 🌐 ${label}: GET ${url}`);
  try {
    // Prefer your axiosInstance if you have one; fallback to axios
    const client = (typeof axiosInstance !== "undefined") ? axiosInstance : axios;
    const res = await client.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": BASE,
      },
      timeout: 15000,
      httpsAgent: (typeof agent !== "undefined") ? agent : undefined,
      validateStatus: (s) => s >= 200 && s < 400, // treat redirects as ok
    });

    const loadStart = nowNs();
    const $ = cheerio.load(res.data);
    console.log(
      `[TVSUB ${reqId}] ✅ ${label}: status=${res.status}, bytes=${String(res.data).length}, parseMs=${msSince(loadStart)}, totalMs=${msSince(t0)}`
    );
    return $;
  } catch (err) {
    const code = err.code || err.response?.status || "ERR";
    console.log(`[TVSUB ${reqId}] ❌ ${label} failed: code=${code}, totalMs=${msSince(t0)} msg=${err.message}`);
    throw err;
  }
}

function scoreCloseness(title, q) {
  const t = title.toLowerCase();
  const needle = q.toLowerCase();
  const idx = t.indexOf(needle);
  // Smaller is better; -1 means "not found" -> push to bottom with big number
  return idx === -1 ? 1e9 : idx;
}

function safeGetUrlFromMatch(match) {
  // Your fetchAndFilterTvShows() sometimes returns different keys.
  return (
    match.page_url ||
    match.url ||
    match.link ||
    match.href ||
    match.fullUrl ||
    null
  );
}

function mapError(err) {
  if (!err) return "Unknown error";

  if (
    err.code === "ENOTFOUND" ||
    err.code === "ECONNREFUSED" ||
    err.code === "ECONNRESET" ||
    err.code === "ETIMEDOUT"
  ) {
    return "Network unavailable. Please check your internet connection.";
  }

  // Puppeteer network-level errors
  if (
    err.message &&
    /net::(ERR_|CONNECTION|TIMED_OUT|INTERNET_DISCONNECTED)/i.test(err.message)
  ) {
    return "Network unavailable. Please check your internet connection.";
  }

  return err.message || "Unexpected server error";
}


router.get("/search", async (req, res) => {
  const query = (req.query.query || "").trim();
  const reqId =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    console.log(`[${reqId}] 🔎 Starting search for query: "${query}"`);

    // Step 1: Fetch TV shows matching query
    const shows = await fetchAndFilterTvShows(query);
    console.log(`[${reqId}] 📝 Shows found: ${shows.length}`);
    if (!Array.isArray(shows) || shows.length === 0) {
      return res.status(404).json({ message: "No subtitles found" });
    }

    // Step 2: Sort by closeness
    shows.sort(
      (a, b) =>
        scoreCloseness(a.title || "", query) -
        scoreCloseness(b.title || "", query)
    );
    console.log(`[${reqId}] 🏆 Closest match: ${shows[0].title}`);

    let chosen = null;
    let mode = null;
    let showId = null;
    let subtitleId = null;

    // Step 3: Pick first valid show/subtitle
    for (const cand of shows) {
      const rawUrl = safeGetUrlFromMatch(cand);
      console.log(`[${reqId}] 🔹 Checking candidate URL: ${rawUrl}`);
      if (!rawUrl) continue;

      let m = rawUrl.match(/tvshow-(\d+)-(\d+)\.html/);
      if (m) {
        chosen = cand;
        mode = "seasoned";
        showId = m[1];
        console.log(
          `[${reqId}] 📄 Multi-season show detected: ${chosen.title}`
        );
        break;
      }

      m = rawUrl.match(/subtitle-(\d+)\.html/);
      if (m) {
        chosen = cand;
        mode = "single";
        subtitleId = m[1];
        console.log(`[${reqId}] 📄 Single subtitle detected: ${chosen.title}`);
        break;
      }
    }

    if (!chosen) {
      console.warn(`[${reqId}] ⚠️ No valid URL pattern found`);
      return res.status(404).json({ message: "No valid URL pattern found" });
    }

    // ===== Single subtitle =====
    if (mode === "single") {
      const subUrl = `${BASE}/subtitle-${subtitleId}.html`;
      console.log(`[${reqId}] 📄 Fetching single subtitle page: ${subUrl}`);

      const $sub = await fetchHtmlVerbose(subUrl, reqId, "subtitle-single");

      // Step 4: Extract download link
      const dlPath = $sub("a[href^='download-']").attr("href");
      if (!dlPath) {
        console.warn(`[${reqId}] ⚠️ No download link found on subtitle page`);
        return res.status(404).json({ message: "No download link found" });
      }

      const downloadUrl = `${BASE}/${dlPath}`;
      console.log(`[${reqId}] ✅ Resolved download URL: ${downloadUrl}`);

      // Extra Step 5: Verify URL does not redirect externally
      try {
        const headResp = await axios.head(downloadUrl, {
          maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
        });
        console.log(`[${reqId}] 🔗 Head request status: ${headResp.status}`);
      } catch (headErr) {
        console.warn(
          `[${reqId}] ⚠️ Possible redirect or external URL: ${headErr.message}`
        );
      }

      // Return the actual download URL
      return res.json({
        requestId: reqId,
        subtitles: [
          {
            provider: "tvsubtitles",
            season: 1,
            title: chosen.title,
            downloadUrl,
          },
        ],
      });
    }

    // ===== Multi-season show =====
    const firstSeasonUrl = `${BASE}/tvshow-${showId}-1.html`;
    console.log(`[${reqId}] 📄 Fetching first season page: ${firstSeasonUrl}`);

    const $firstSeason = await fetchHtmlVerbose(
      firstSeasonUrl,
      reqId,
      "season-1"
    );

    // Step 6: Detect total seasons dynamically
    const seasonLinks = $firstSeason(`a[href^='tvshow-${showId}-']`)
      .map((i, el) => {
        const href = $firstSeason(el).attr("href");
        const match = href?.match(new RegExp(`tvshow-${showId}-(\\d+)\\.html`));
        return match ? parseInt(match[1], 10) : null;
      })
      .get()
      .filter((num) => Number.isInteger(num) && num > 0);

    const totalSeasons = seasonLinks.length ? Math.max(...seasonLinks) : 1;
    console.log(`[${reqId}] 🔢 Total seasons detected: ${totalSeasons}`);

    // Step 7: Build subtitles array
    const subtitles = [];
    for (let season = 1; season <= totalSeasons; season++) {
      const dlUrl = `${BASE}/download-${showId}-${season}-en.html`;
      console.log(`[${reqId}] ➜ Season ${season} download URL: ${dlUrl}`);
      subtitles.push({
        provider: "tvsubtitles",
        season,
        title: `${chosen.title} Season ${season} complete`,
        downloadUrl: dlUrl,
      });
    }

    return res.json({
      requestId: reqId,
      subtitles,
    });
  } catch (err) {
    console.error(`[${reqId}] 💥 Search error:`, err);

    return res.status(500).json({
      error: mapError(err),
    });
  }

});



router.get("/show-info", async (req, res) => {
  const showUrl = req.query.url;

  if (!showUrl || !showUrl.startsWith(TVSUB_BASE)) {
    return res.status(400).json({ error: "Invalid or missing show URL." });
  }

  console.log("🎬 [TVSubtitles] Fetching show info:", showUrl);

  try {
    const { data } = await axiosInstance.get(showUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36",
      },
      timeout: axiosInstance.defaults.timeout || 15000,
      httpsAgent: agent,
    });

    const $ = cheerio.load(data);

    // Extract show title
    const title = $(".left_articles h2").first().text().trim();
    if (!title) {
      return res.status(404).json({ error: "Show title not found." });
    }

    // Extract season number from the page (from <p class="description"> or URL)
    // Fallback: parse season from URL like tvshow-2515-2.html
    let seasonNum = null;
    const seasonDesc = $("p.description font").first().text().trim(); // e.g. "Season 2"
    if (seasonDesc.toLowerCase().startsWith("season")) {
      const match = seasonDesc.match(/season\s*(\d+)/i);
      if (match) seasonNum = parseInt(match[1], 10);
    }
    if (!seasonNum) {
      // Try URL fallback
      const urlSeasonMatch = showUrl.match(/tvshow-\d+-(\d+)/);
      if (urlSeasonMatch) {
        seasonNum = parseInt(urlSeasonMatch[1], 10);
      }
    }

    if (!seasonNum) {
      // Default to 1 if can't detect
      seasonNum = 1;
    }

    // Episodes are inside table rows in nested tables
    // Select all rows under the main table(s) with episodes
    const episodes = [];

    // Select all tables with class "tableauto" or use #table5 inside main content
    $("table#table5 tr").each((_, row) => {
      const tds = $(row).find("td");
      if (tds.length < 4) return; // Skip header or malformed rows

      const seasonEpisode = $(tds[0]).text().trim(); // e.g., "2x08"
      const episodeMatch = seasonEpisode.match(/(\d+)x(\d+)/i);
      if (!episodeMatch) return;

      const seasonFromRow = parseInt(episodeMatch[1], 10);
      const episodeNum = parseInt(episodeMatch[2], 10);

      const episodeTitle = $(tds[1]).find("a").text().trim();

      // The subtitles column contains multiple links per language
      const subtitleAnchors = $(tds[3]).find("a[href^='subtitle-']");

      // If no subtitle links, keep empty array
      const subtitleLinks = subtitleAnchors
        .map((_, a) => {
          const href = $(a).attr("href");
          return href ? `${TVSUB_BASE}/${href}` : null;
        })
        .get()
        .filter(Boolean);

      episodes.push({
        season: seasonFromRow,
        episode: episodeNum,
        title: episodeTitle,
        subtitles: subtitleLinks,
      });
    });

    // Group episodes by season
    const seasonMap = {};
    for (const ep of episodes) {
      if (!seasonMap[ep.season]) seasonMap[ep.season] = [];
      seasonMap[ep.season].push({
        episode: ep.episode,
        title: ep.title,
        subtitles: ep.subtitles,
      });
    }

    // Sort seasons and episodes
    const seasons = Object.keys(seasonMap)
      .sort((a, b) => a - b)
      .map((sn) => ({
        season: parseInt(sn, 10),
        episodes: seasonMap[sn].sort((a, b) => a.episode - b.episode),
      }));

    return res.json({ title, seasons });
  } catch (err) {
    console.error("💥 Error fetching show info:", err.message);
    return res.status(500).json({ error: "Failed to fetch show information." });
  }
});

// ────────────────────────────────────────────────────────────
// /latest – Fetch latest uploaded subtitles
// ────────────────────────────────────────────────────────────

const BASE_URL = "https://www.tvsubtitles.net";
// 🔹 Latest Subtitles
router.get("/latest", async (req, res) => {
  console.log("📥 [TVSubtitles] Fetching latest uploaded subtitles...");

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  try {
    const { data } = await axiosInstance.get(`${TVSUB_BASE}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36",
      },
      timeout: axiosInstance.defaults.timeout || 15000,
      httpsAgent: agent,
    });

    const $ = cheerio.load(data);

    const latestBox = $(".smallbox").filter((_, el) =>
      $(el).find(".smallboxtitle").text().toLowerCase().includes("latest")
    );

    if (!latestBox.length) {
      console.warn("❌ Could not locate 'Latest subtitles' box.");
      return res.status(500).json({ error: "Latest subtitles not found" });
    }

    const items = latestBox.find(".smallboxitemlong").toArray();
    const paginatedItems = items.slice(offset, offset + limit);

    const pLimit = require("p-limit").default;
    const limiter = pLimit(5);

    const subtitlePromises = paginatedItems.map((el) =>
      limiter(async () => {
        const block = $(el).find(".mainsubsitemall");
        const anchor = block.find("a");
        const href = anchor.attr("href");
        const title = anchor.find(".mainsubsitemname").text().trim();
        const release = anchor.find(".mainsubsitemrelease").text().trim();
        const uploadText = anchor.find(".mainsubsitemdate").text().trim();
        const downloads =
          parseInt(anchor.find(".mainsubsitemcounter").text().trim()) || 0;
        const ratingRed =
          parseInt(anchor.find("span").first().text().trim()) || 0;
        const ratingGreen =
          parseInt(anchor.find("span").eq(1).text().trim()) || 0;

        const langMatch = block.attr("style")?.match(/flags\/(.*?)\.gif/i);
        const lang = langMatch ? langMatch[1] : "unknown";

        if (!href || !title) return null;

        // 🔑 Instead of subtitle page → map to download page
        const pageUrl = `${TVSUB_BASE}${href}`;
        const downloadUrl = pageUrl.replace("/subtitle-", "/download-");

        return {
          title,
          release,
          lang,
          url: downloadUrl, // 👈 now points directly to download page
          uploaded_at: parseRelativeTime(uploadText),
          downloads,
          ratings: { red: ratingRed, green: ratingGreen },
        };
      })
    );

    const results = await Promise.allSettled(subtitlePromises);
    const subtitles = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => r.value);

    return res.json({
      page,
      limit,
      total: items.length,
      results: subtitles,
    });
  } catch (err) {
    console.error("❌ Error in /latest:", err.message);
    return res.status(500).json({ error: "Failed to fetch latest subtitles" });
  }
});


// 🔹 Most Downloaded Subtitles
router.get("/most-downloaded", async (req, res) => {
  try {
    console.log("➡ Fetching homepage for most downloaded subtitles...");

    const { data } = await axiosInstance.get(`${TVSUB_BASE}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36",
      },
      httpsAgent: agent,
      timeout: axiosInstance.defaults.timeout || 15000,
    });

    const $ = cheerio.load(data);
    const subtitles = [];

    const box = $(".smallbox").filter((_, el) => {
      const title = $(el).find(".smallboxtitle").text().trim().toLowerCase();
      return title.includes("most downloaded");
    });

    if (box.length === 0) {
      console.warn("⚠️ Could not find 'Most downloaded subtitles' section.");
      return res.status(500).json({ error: "Subtitles section not found" });
    }

    box.find(".smallboxitemlong").each((i, el) => {
      const item = $(el).find(".mainsubsitemall a");

      const href = item.attr("href");
      const title = item.find(".mainsubsitemname").text().trim();
      const release = item.find(".mainsubsitemrelease").text().trim();
      const downloads = item.find(".mainsubsitemcounter").text().trim();
      const langMatch = $(el)
        .find(".mainsubsitemall")
        .attr("style")
        ?.match(/flags\/(.*?)\.gif/i);
      const lang = langMatch ? langMatch[1] : "unknown";

      if (title && href) {
        // 🔑 convert subtitle page → download page
        const pageUrl = `${TVSUB_BASE}${href}`;
        const downloadUrl = pageUrl.replace("/subtitle-", "/download-");

        subtitles.push({
          title,
          release,
          downloads: parseInt(downloads) || 0,
          lang,
          url: downloadUrl, // 👈 now points directly to download page
        });
      }
    });

    console.log(`✅ Found ${subtitles.length} most downloaded items`);
    res.json(subtitles);
  } catch (err) {
    console.error("❌ Error fetching most downloaded subtitles:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch most downloaded subtitles" });
  }
});




console.log("✅ Final axios default timeout:", axiosInstance.defaults.timeout);



const SubtitleCache = require("../models/SubtitleCache");



async function updateCache(type, newData) {
  const existing = await SubtitleCache.findOne({ type });

  const isDifferent = !existing || JSON.stringify(existing.data) !== JSON.stringify(newData);
  if (isDifferent) {
    await SubtitleCache.findOneAndUpdate(
      { type },
      { data: newData, updatedAt: new Date() },
      { upsert: true }
    );
  }

  return newData;
}

router.get("/fallback", async (req, res) => {
  const latestUrl = "http://localhost:5000/api/tvsubtitles/latest";
  const downloadedUrl = "http://localhost:5000/api/tvsubtitles/most-downloaded";

  let combined = [];
  let usedSources = [];
  let fallbackUsed = false;

  try {
    const [latestRes, downloadedRes] = await Promise.allSettled([
      axiosInstance.get(latestUrl),
      axiosInstance.get(downloadedUrl),
    ]);

    // ✅ Latest
    if (latestRes.status === "fulfilled" && Array.isArray(latestRes.value.data) && latestRes.value.data.length > 0) {
      const latestData = latestRes.value.data;
      usedSources.push("latest");
      combined.push(...latestData);

      await updateCache("latest", latestData);
    }

    // ✅ Most Downloaded
    if (downloadedRes.status === "fulfilled" && Array.isArray(downloadedRes.value.data) && downloadedRes.value.data.length > 0) {
      const downloadedData = downloadedRes.value.data;
      usedSources.push("most-downloaded");

      const nonDuplicate = downloadedData.filter(dl => !combined.some(ld => ld.url === dl.url));
      const limitedExtra = combined.length ? nonDuplicate.slice(0, 5) : nonDuplicate;

      combined.push(...limitedExtra);

      await updateCache("most-downloaded", downloadedData);
    }

    if (combined.length > 0) {
      return res.json({
        data: combined,
        sources: usedSources,
        fallbackUsed: false,
      });
    }
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
  }

  // ❌ Use fallback cache if both failed
  const fallbackLatest = await SubtitleCache.findOne({ type: "latest" });
  const fallbackDownloaded = await SubtitleCache.findOne({ type: "most-downloaded" });

  if (fallbackLatest?.data?.length) {
    fallbackUsed = true;
    return res.json({
      data: fallbackLatest.data,
      sources: ["cache:latest"],
      fallbackUsed: true,
    });
  }

  if (fallbackDownloaded?.data?.length) {
    fallbackUsed = true;
    return res.json({
      data: fallbackDownloaded.data,
      sources: ["cache:most-downloaded"],
      fallbackUsed: true,
    });
  }

  return res.status(500).json({ error: "No data available from any source." });
});

module.exports = router;






