// server/routes/yify.js
// server/routes/yify.js
// server/routes/yify.js
// server/routes/yify.jss
// server/routes/yify.js
// server/routes/yify.js
// server/routes/yify.js
const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { pipeline } = require("stream");
const { promisify } = require("util");
const puppeteer = require("puppeteer-core");
const chromium = require("chromium");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const fs = require("fs");

puppeteerExtra.use(StealthPlugin());

const streamPipeline = promisify(pipeline);

const CHROME_PATH =
  process.env.CHROME_PATH || // use env variable if defined
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome"); // Render / Linux

const BASE_URL = "https://yifysubtitles.ch";


function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const router = express.Router();

// ------------------------------------------------------------
// GET /api/yify/search?query=<term> (Puppeteer version)
// ------------------------------------------------------------
// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
    }
  }
  return matrix[a.length][b.length];
}

router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  let browser;
  try {
    console.log("[YIFY] Launching browser...");
    browser = await puppeteerExtra.launch({
      headless: true,
      executablePath: chromium.path, // ✅ use chromium from node_modules
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-gpu",
      ],
      protocolTimeout: 120000,
    });



    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (rt === "image" || rt === "stylesheet" || rt === "font") {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    console.log("[YIFY] Navigating to:", BASE_URL);
    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("[YIFY] Page loaded");

    console.log("[YIFY] Waiting for search input...");
    await page.waitForSelector("input#qSearch", { timeout: 30000 });
    console.log("[YIFY] Search input found");

    console.log(`[YIFY] Typing query: "${query}"`);
    await page.click("input#qSearch", { clickCount: 3 });
    await page.type("input#qSearch", query, { delay: 100 });

    // Wait for suggestions
    const maxRetries = 5;
    let suggestionsVisible = false;
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(
          `[YIFY] Waiting for .tt-suggestion (attempt ${i + 1}/${maxRetries})`
        );
        await page.waitForSelector(".tt-suggestion", { timeout: 3000 });
        suggestionsVisible = true;
        break;
      } catch {
        console.log(
          `[YIFY] Suggestions not found, retrying (${i + 1}/${maxRetries})`
        );
        await page.type("input#qSearch", " ");
        await page.type("input#qSearch", "\b");
      }
    }
    if (!suggestionsVisible)
      throw new Error("Autocomplete suggestions did not appear");

    // Extract all suggestions with their text
    const suggestions = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".tt-suggestion"))
        .map((el) => ({
          title: el.innerText.trim(), // e.g. "Loki 7 2016"
          text: el.innerText.trim(),
        }))
        .filter((s) => s.title);
    });

    console.log(
      "[YIFY] Suggestions:",
      suggestions.map((s) => s.title)
    );

    // Pick best suggestion
    const normalizedQuery = query.trim().toLowerCase();
    let chosen = suggestions[0];
    let exact = false;

    for (const s of suggestions) {
      if (s.title.toLowerCase() === normalizedQuery) {
        chosen = s;
        exact = true;
        break;
      }
    }

    if (!exact) {
      let bestScore = Infinity;
      for (const s of suggestions) {
        const score = levenshtein(normalizedQuery, s.title.toLowerCase());
        if (score < bestScore) {
          bestScore = score;
          chosen = s;
        }
      }
    }

    console.log(
      `[YIFY] Clicking suggestion: "${chosen.title}" (exact: ${exact})`
    );

    const initialUrl = page.url();
    await page.evaluate((chosenTitle) => {
      const all = Array.from(document.querySelectorAll(".tt-suggestion"));
      const target = all.find((el) => el.innerText.trim() === chosenTitle);
      if (target) target.click();
    }, chosen.title);

    console.log("[YIFY] Waiting for URL to change after click...");
    await page.waitForFunction(
      (url) => window.location.href !== url,
      { timeout: 15000 },
      initialUrl
    );
    console.log("[YIFY] URL changed to:", page.url());

    console.log("[YIFY] Waiting for subtitles table rows...");
    await page.waitForSelector(".table-responsive tbody tr[data-id]", {
      timeout: 60000,
    });
    console.log("[YIFY] Subtitles table loaded");

    // Get detail page links
    const subsMeta = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".table-responsive tbody tr[data-id]")
      )
        .map((row) => {
          const lang = row.querySelector(".sub-lang")?.innerText.trim() || "";
          const rating =
            row.querySelector(".rating-cell .label")?.innerText.trim() || "";
          const link = row
            .querySelector("a[href^='/subtitles/']")
            ?.getAttribute("href");
          if (!link) return null;
          return {
            lang,
            rating,
            detailUrl: location.origin + link,
          };
        })
        .filter(Boolean);
    });

    // Filter English & limit
    const filtered = subsMeta
      .filter((sub) => sub.lang.toLowerCase().includes("english"))
      .slice(0, 5);

    // Go to each detail page & extract .zip download link
    const finalResults = [];
    for (const sub of filtered) {
      try {
        console.log(`[YIFY] Opening subtitle detail page: ${sub.detailUrl}`);
        const detailPage = await browser.newPage();
        await detailPage.setRequestInterception(true);
        detailPage.on("request", (req) => {
          const rt = req.resourceType();
          if (rt === "image" || rt === "stylesheet" || rt === "font") {
            req.abort();
          } else {
            req.continue();
          }
        });

        await detailPage.goto(sub.detailUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const zipUrl = await detailPage.evaluate(() => {
          const btn = document.querySelector("a[href$='.zip']");
          return btn ? btn.href : null;
        });
        await detailPage.close();

        if (zipUrl) {
          finalResults.push({
            ...sub,
            download_url: zipUrl,
          });
        } else {
          console.warn(`[YIFY] No .zip found for: ${sub.detailUrl}`);
        }
      } catch (e) {
        console.error("[YIFY] Error fetching detail page:", e.message);
      }
    }

    await browser.close();
    return res.json({
      query: chosen.title, // overwrite with matched suggestion
      matchedTitle: chosen.title,
      subtitles: finalResults,
    });

  } catch (err) {
    if (browser) await browser.close();
    console.error("[YIFY] Puppeteer search error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to fetch YIFY subtitles" });
    }
  }
});






// ------------------------------------------------------------
// GET /api/yify/download-link?url=<movie-page>
// ------------------------------------------------------------
// ------------------------------------------------------------
// GET /api/yify/download-link?url=<movie-page>
// ------------------------------------------------------------
router.get("/download-link", async (req, res) => {
  const detailUrl = req.query.url;
  if (!detailUrl) {
    console.log("[YIFY] Missing detail URL in /download-link");
    return res.status(400).json({ error: "Missing detail URL" });
  }

  console.log("[YIFY] Fetching movie page:", detailUrl);
  try {
    const htmlRes = await fetch(detailUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!htmlRes.ok) {
      console.error(
        "[YIFY] Failed to fetch movie page. Status:",
        htmlRes.status
      );
      return res.status(502).json({ error: "Failed to fetch movie page" });
    }

    const html = await htmlRes.text();
    const $ = cheerio.load(html);

    console.log("[YIFY] Parsing direct download button...");
    const btnHref = $("a.btn-icon.download-subtitle").attr("href");

    if (!btnHref) {
      console.log("[YIFY] No download button found.");
      return res.json({ downloads: [] });
    }

    // Make absolute URL
    const downloadUrl = btnHref.startsWith("http")
      ? btnHref
      : `${BASE_URL}${btnHref}`;

    console.log(`[YIFY] Found download URL: ${downloadUrl}`);

    res.json({
      downloads: [
        {
          lang: "English", // could parse language if you want
          rating: null,
          direct_download: downloadUrl,
        },
      ],
    });
  } catch (err) {
    console.error("[YIFY] Download link error:", err);
    res.status(500).json({ error: "Failed to extract download link" });
  }
});

// ------------------------------------------------------------
// GET /api/yify/final-download?url=<subtitle-page>
// ------------------------------------------------------------
router.get("/final-download", async (req, res) => {
  const subtitlePage = req.query.url;
  if (!subtitlePage && req.query.download_url) {
    console.warn("[YIFY] No subtitle page URL, using download_url fallback");
    subtitlePage = req.query.download_url;
  }

  if (!subtitlePage) {
    console.log("[YIFY] Missing subtitle page URL in /final-download");
    return res.status(400).json({ error: "Missing subtitle page URL" });
  }

  console.log("[YIFY] Fetching subtitle page:", subtitlePage);
  try {
    const htmlRes = await fetch(subtitlePage, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!htmlRes.ok) {
      console.error("[YIFY] Failed to fetch subtitle page. Status:", htmlRes.status);
      return res.status(502).json({ error: "Failed to fetch subtitle page" });
    }

    const html = await htmlRes.text();
    const $ = cheerio.load(html);
    const finalLink = $("a.btn-icon.download-subtitle").attr("href");


    console.log("[YIFY] Found final download link:", finalLink);

    if (finalLink) {
      const fullUrl = `${BASE_URL}${finalLink}`;
      console.log("[YIFY] Sending download URL:", fullUrl);
      res.json({ download_url: fullUrl });
    } else {
      console.warn("[YIFY] Download link not found on subtitle page");
      res.status(404).json({ error: "Download link not found" });
    }
  } catch (err) {
    console.error("[YIFY] Final download error:", err);
    res.status(500).json({ error: "Failed to fetch final subtitle link" });
  }
});

// ------------------------------------------------------------
// GET /api/yify/download?url=<zip-file-url>
// ------------------------------------------------------------
// ------------------------------------------------------------
// GET /api/yify/download?url=<zip-file-url>
// ------------------------------------------------------------
// ------------------------------------------------------------
// GET /api/yify/download?url=<zip-or-subtitle-url>
// ------------------------------------------------------------
router.get("/download", async (req, res) => {
  let fileUrl = req.query.url;
  if (!fileUrl) {
    console.log("[YIFY] Missing file URL in /download");
    return res.status(400).json({ error: "Missing file URL" });
  }

  console.log("[YIFY] Downloading ZIP file from:", fileUrl);

  try {
    // --- First try direct fetch ---
    const fileRes = await fetch(fileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        Referer: BASE_URL,
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
    });

    if (fileRes.ok) {
      const disposition = fileRes.headers.get("content-disposition");
      const filename =
        disposition?.match(/filename="?(.+)"?/)?.[1] || "subtitle.zip";

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader(
        "Content-Type",
        fileRes.headers.get("content-type") || "application/zip"
      );

      console.log("[YIFY] Streaming ZIP file via fetch...");
      await streamPipeline(fileRes.body, res);
      console.log("[YIFY] File streamed successfully (fetch).");
      return;
    }

    console.warn(
      "[YIFY] Fetch failed with status",
      fileRes.status,
      "→ retrying with Puppeteer"
    );

    // --- Puppeteer fallback ---
    const browser = await puppeteerExtra.launch({
      headless: true,
      executablePath: chromium.path,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      // If they passed a `.zip` link, convert it to its detail page
      if (fileUrl.includes("/subtitle/") && fileUrl.endsWith(".zip")) {
        fileUrl = fileUrl
          .replace("/subtitle/", "/subtitles/")
          .replace(/-english.*\.zip$/, ""); // strip zip suffix
      }

      console.log("[YIFY] Navigating to detail page:", fileUrl);
      await page.goto(fileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Setup download behavior
      const client = await page.target().createCDPSession();
      const downloadPath = path.join(__dirname, "../tmp_downloads");
      ensureDirExists(downloadPath);

      await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath,
      });

      // Trigger the download (no waitForEvent here!)
      console.log("[YIFY] Clicking download button...");
      await page.click("a.btn-icon.download-subtitle");

      // Wait a bit for Chromium to drop the file
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Find the downloaded zip file
      const files = fs.readdirSync(downloadPath);
      const zipFile = files.find((f) => f.endsWith(".zip"));
      if (!zipFile) throw new Error("No ZIP file found after download");

      const zipPath = path.join(downloadPath, zipFile);

      // Stream back to client
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${zipFile}"`
      );
      res.setHeader("Content-Type", "application/zip");

      const stream = fs.createReadStream(zipPath);
      stream.pipe(res);

      // cleanup after streaming finishes
      const cleanup = () => {
        fs.unlink(zipPath, (err) => {
          if (err) console.warn("[YIFY] Temp cleanup failed:", err.message);
          else console.log("[YIFY] Temp file deleted:", zipPath);
        });
      };

      res.on("finish", cleanup);
      res.on("close", cleanup);

      console.log("[YIFY] File streamed successfully (Puppeteer).");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[YIFY] Download error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download subtitle file" });
    }
  }
});






module.exports = router;
