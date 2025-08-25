// server/routes/bsplayer.js

// server/routes/bsplayer.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

/**
 * GET /api/bsplayer/search?query=movie
 * Scrapes BSPlayer for subtitle listings.
 */
router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const url = `https://bsplayer-subtitles.com/search?q=${encodeURIComponent(query)}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SubtitleFinder/1.0",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const subtitles = [];

    $(".subtitle-box").each((i, el) => {
      const link = $(el).find("a").attr("href");
      if (!link) return;

      subtitles.push({
        id: `bsplayer-${i}`,
        release: $(el).find(".title").text().trim() || "BSPlayer Release",
        lang: $(el).find(".language").text().trim() || "EN",
        download_url: link.startsWith("http")
          ? link
          : `https://bsplayer-subtitles.com${link}`,
      });
    });

    res.json({ subtitles });
  } catch (err) {
    console.error("BSPlayer fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch BSPlayer subtitles" });
  }
});

/**
 * GET /api/bsplayer/download?url=https://...
 * Proxies the actual subtitle download.
 */
router.get("/download", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SubtitleFinder/1.0",
      },
    });

    // Try to set correct content-type
    res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
    res.send(response.data);
  } catch (err) {
    console.error("BSPlayer download proxy error:", err.message);
    res.status(500).json({ error: "Failed to download from BSPlayer" });
  }
});

module.exports = router;
