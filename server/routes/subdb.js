// server/routes/subdb.js
// server/routes/subdb.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

/**
 * GET /api/subdb/search?query=movie
 * Uses SubDB public API (search by movie name).
 */
router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const { data } = await axios.get(
      `https://api.thesubdb.com/?action=search&query=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "SubDB/1.0 (Subtitle Finder/1.0; https://yoursite.com)",
        },
      }
    );

    const subtitles = data.split("\n").map((item, i) => ({
      id: `subdb-${i}`,
      release: item,
      lang: "EN",
      download_url: `https://api.thesubdb.com/?action=download&hash=${item}`,
    }));

    res.json({ subtitles });
  } catch (err) {
    console.error("SubDB fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch SubDB subtitles" });
  }
});

/**
 * GET /api/subdb/download?url=https://...
 * Proxies the actual subtitle download.
 */
router.get("/download", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "SubDB/1.0 (Subtitle Finder/1.0; https://yoursite.com)",
      },
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(response.data);
  } catch (err) {
    console.error("SubDB download proxy error:", err.message);
    res.status(500).json({ error: "Failed to download from SubDB" });
  }
});

module.exports = router;
