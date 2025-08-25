// server/controllers/subtitleController.js
// server/controllers/subtitleController.js
// server/controllers/subtitleController.js
// server/controllers/subtitleController.js
/* ------------------------------------------------------------------
 * server/controllers/subtitleController.js
 * ------------------------------------------------------------------ */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const Subtitle = require("../models/Subtitle");
const {
  getLatestSubtitles,
  getTopRatedSubtitles,
  downloadAndCacheSubtitle,
  searchSubtitles,
} = require("../services/openSubtitlesService");

const {
  getCombinedLatestSubtitles,
  getCombinedTopRatedSubtitles,
  fetchCombinedSubtitles,
  fetchPodnapisi,
  fetchAddic7ed,
  fetchBSPlayer,
  fetchTVSubtitles,
  proxyTVSubtitlesDownload,
} = require("../services/multiSubtitlesService"); // ✅ correct


const { getMovieDetails } = require("../services/omdbService");


/* ------------------------ Normalization Helpers ------------------------ */
function getId(sub) {
  return (
    sub?.id ??
    sub?.subtitle_id ??
    sub?.attributes?.id ??
    sub?.attributes?.subtitle_id ??
    null
  );
}

function getFilesArray(sub) {
  if (Array.isArray(sub?.files)) return sub.files;
  if (Array.isArray(sub?.attributes?.files)) return sub.attributes.files;
  return [];
}

function pickPrimaryFile(sub) {
  if (sub?.file_id) {
    return {
      file_id: sub.file_id,
      file_name:
        sub.file_name || sub.filename || sub.name || `subtitle-${getId(sub) || "unknown"}.srt`,
    };
  }
  const files = getFilesArray(sub) || [];
  const first = files.find((f) => f?.file_id);
  if (!first) return null;
  return {
    file_id: first.file_id,
    file_name:
      first.file_name || first.filename || first.name || sub?.file_name || `subtitle-${getId(sub) || "unknown"}.srt`,
  };
}

function normalizeSubtitle(raw) {
  if (!raw) return null;
  const id = getId(raw);
  if (!id) return null;

  const status = raw?.status || raw?.attributes?.status || "ok";
  if (status === "removed" || status === "disabled") return null;

  const primaryFile = pickPrimaryFile(raw);
  if (!primaryFile?.file_id) return null;

  return {
    ...raw,
    id,
    file_id: primaryFile.file_id,
    file_name: primaryFile.file_name,
    status,
  };
}

function filterSubtitles(list) {
  return (list || []).map(normalizeSubtitle).filter(Boolean);
}

/* ------------------------ In-memory Cache ------------------------ */
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const memoryCache = {
  search: new Map(),
  latest: { data: null, expiresAt: 0 },
  top: { data: null, expiresAt: 0 },
};

function setCache(map, key, data) {
  map.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}
function getCache(map, key) {
  const item = map.get(key);
  if (item && Date.now() < item.expiresAt) return item.data;
  map.delete(key);
  return null;
}

/* ------------------------ Proxy Endpoints ------------------------ */
async function proxyPodnapisi(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ success: false, error: "Missing query" });

  try {
    const data = await fetchPodnapisi(query);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Podnapisi fetch failed:", err.message);
    res.status(500).json({ success: false, error: "Podnapisi fetch failed" });
  }
}

exports.searchTVSubtitles = async (req, res) => {
  try {
    const query = req.query.query;
    const results = await fetchTVSubtitles(query);
    res.json({ success: true, source: "tvsubtitles", data: results });
  } catch (err) {
    console.error("TVSubtitles fetch failed:", err);
    res.status(500).json({ success: false, error: "TVSubtitles failed" });
  }
};

exports.searchPodnapisi = async (req, res) => {
  try {
    const query = req.query.query;
    const results = await fetchPodnapisi(query);
    res.json({ success: true, source: "podnapisi", data: results });
  } catch (err) {
    console.error("Podnapisi fetch failed:", err);
    res.status(500).json({ success: false, error: "Podnapisi failed" });
  }
};

exports.searchOpenSubtitles = async (req, res) => {
  try {
    const query = req.query.query;
    const results = await searchSubtitles(query, "en", 10);
    res.json({ success: true, source: "opensubtitles", data: results });
  } catch (err) {
    console.error("OpenSubtitles fetch failed:", err);
    res.status(500).json({ success: false, error: "OpenSubtitles failed" });
  }
};


async function proxyAddic7ed(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ success: false, error: "Missing query" });

  try {
    const data = await fetchAddic7ed(query);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Addic7ed fetch failed:", err.message);
    res.status(500).json({ success: false, error: "Addic7ed fetch failed" });
  }
}

async function proxyBSPlayer(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ success: false, error: "Missing query" });

  try {
    const data = await fetchBSPlayer(query);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ BSPlayer fetch failed:", err.message);
    res.status(500).json({ success: false, error: "BSPlayer fetch failed" });
  }
}


/* ------------------------ Main Endpoints ------------------------ */
async function getSubtitles(req, res) {
  const { query, language = "en" } = req.query;
  if (!query)
    return res.status(400).json({ success: false, error: "Missing query" });

  const key = `${query}|${language}`.toLowerCase();
  const cached = getCache(memoryCache.search, key);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  try {
    const results = await searchSubtitles(query, language);
    const filtered = filterSubtitles(results);
    setCache(memoryCache.search, key, filtered);
    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("❌ getSubtitles failed:", err.message);
    res.status(500).json({ success: false, error: "Subtitle fetch failed" });
  }
}

async function getLatest(req, res) {
  if (Date.now() < memoryCache.latest.expiresAt) {
    return res.json({
      success: true,
      cached: true,
      data: memoryCache.latest.data,
    });
  }
  try {
    const results = await getCombinedLatestSubtitles(); // ✅ USE multiSource version
    const filtered = filterSubtitles(results);
    memoryCache.latest = { data: filtered, expiresAt: Date.now() + CACHE_TTL };
    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("❌ getLatest failed:", err.message);
    res.json({ success: true, data: [] });
  }
}


async function getTopRated(req, res) {
  if (Date.now() < memoryCache.top.expiresAt) {
    return res.json({
      success: true,
      cached: true,
      data: memoryCache.top.data,
    });
  }
  try {
    const results = await getCombinedTopRatedSubtitles(); // ✅ USE multiSource version
    const filtered = filterSubtitles(results);
    memoryCache.top = { data: filtered, expiresAt: Date.now() + CACHE_TTL };
    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("❌ getTopRated failed:", err.message);
    res.json({ success: true, data: [] });
  }
}


async function fetchMovie(req, res) {
  const { imdbID } = req.query;
  if (!imdbID)
    return res.status(400).json({ success: false, error: "Missing imdbID" });
  try {
    const details = await getMovieDetails(imdbID);
    if (!details)
      return res.status(404).json({ success: false, error: "Movie not found" });
    res.json({ success: true, data: details });
  } catch (err) {
    console.error("❌ fetchMovie failed:", err.message);
    res.status(500).json({ success: false, error: "OMDb lookup failed" });
  }
}

/* ------------------------ Download Subtitle ------------------------ */
async function downloadSubtitle(req, res) {
  const fileId = req.params.fileId || req.query.fileId;
  let { fileName } = req.query;

  if (!fileId) {
    console.warn("❌ Missing fileId in request");
    return res.status(400).json({ success: false, error: "Missing fileId" });
  }

  fileName = sanitizeFileName(fileName) || `subtitle-${fileId}.srt`;

  // If fileId is a full URL (YIFY/Podnapisi/etc), stream directly
  if (/^https?:\/\//.test(fileId)) {
    console.log(`Proxying external subtitle: ${fileId}`);
    try {
      const response = await fetch(fileId);
      if (!response.ok) throw new Error(`Failed fetch: ${response.statusText}`);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return response.body.pipe(res);
    } catch (err) {
      console.error("External download failed:", err);
      return res.status(500).json({ success: false, error: "Failed to download external subtitle" });
    }
  }

  // Otherwise use OpenSubtitles
  try {
    const filePath = await downloadAndCacheSubtitle(fileId, fileName);
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ Subtitle not found: fileId=${fileId}`);
      return res.status(404).json({ success: false, error: "Subtitle not found" });
    }
    console.log(`📥 Downloading subtitle: ${fileName} (${filePath})`);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.download(filePath);
  } catch (err) {
    console.error("❌ downloadSubtitle failed:", err);
    return res.status(500).json({ success: false, error: "Internal error serving subtitle" });
  }
}

/* ------------------------ Upload + User Uploads ------------------------ */
async function uploadSubtitle(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const subtitle = await Subtitle.create({
      user: req.user ? req.user._id : null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date(),
    });

    return res.status(201).json({ success: true, data: subtitle });
  } catch (err) {
    console.error("❌ uploadSubtitle failed:", err.message);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
}

async function getUserUploads(req, res) {
  try {
    const uploads = await Subtitle.find(req.user ? { user: req.user._id } : {})
      .sort({ uploadedAt: -1 })
      .limit(10);
    res.json({ success: true, data: uploads });
  } catch (err) {
    console.error("❌ getUserUploads failed:", err.message);
    res.status(500).json({ success: false, error: "Could not fetch uploads" });
  }
}

/* ------------------------ Utils ------------------------ */
function sanitizeFileName(name) {
  if (!name) return null;
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

// const { fetchCombinedSubtitles } = require("../services/multiSubtitlesService");

exports.searchSubtitles = async (req, res) => {
  try {
    const query = req.query.query;
    const subtitles = await fetchCombinedSubtitles(query);
    res.json({ subtitles });
  } catch (err) {
    console.error("Subtitle search error:", err);
    res.status(500).json({ error: "Failed to fetch subtitles" });
  }
};


module.exports = {
  getSubtitles,
  getLatest,
  getTopRated,
  downloadSubtitle,
  fetchMovie,
  uploadSubtitle,
  getUserUploads,
  proxyPodnapisi,
  proxyAddic7ed,
  proxyBSPlayer,
  proxyTVSubtitlesDownload,
};
