// server/routes/subtitleRoutes.js
// server/routes/subtitleRoutes.js
// server/routes/subtitleRoutes.js
// server/routes/subtitleRoutes.js
// server/routes/subtitleRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch"); // Needed for proxying external URLs
const {
  getSubtitles,
  getLatest,
  getTopRated,
  downloadSubtitle,
  fetchMovie,
  uploadSubtitle,
  getUserUploads,
} = require("../controllers/subtitleController");
const subtitleController = require("../controllers/subtitleController");

const { searchSubtitles } = require("../services/openSubtitlesService");

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, "../cache/subtitles");
fs.mkdirSync(uploadDir, { recursive: true });

// Utility wrapper for async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ------------------------------------------------------
// Proxy Endpoints for External Subtitle Providers
// ------------------------------------------------------
async function proxyExternalDownload(req, res, baseName = "subtitle") {
  const { url } = req.query;
  if (!url)
    return res.status(400).json({ success: false, error: "Missing URL" });

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SubtitleFinder/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const fileName = `${baseName}-${Date.now()}.srt` || "subtitle.srt";
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.body.pipe(res);
  } catch (err) {
    console.error(`Proxy failed for ${url}:`, err);
    res
      .status(500)
      .json({ success: false, error: "Failed to proxy subtitle file." });
  }
}

router.get("/yify/download", (req, res) =>
  proxyExternalDownload(req, res, "yify")
);
router.get("/subdb/download", (req, res) =>
  proxyExternalDownload(req, res, "subdb")
);
router.get("/podnapisi/download", (req, res) =>
  proxyExternalDownload(req, res, "podnapisi")
);
router.get("/addic7ed/download", (req, res) =>
  proxyExternalDownload(req, res, "addic7ed")
);
router.get("/bsplayer/download", (req, res) =>
  proxyExternalDownload(req, res, "bsplayer")
);
router.get("/tvsubtitles/download", (req, res) =>
  proxyExternalDownload(req, res, "tvsubtitles")
);


router.get(
  "/search/tvsubtitles",
  asyncHandler(subtitleController.searchTVSubtitles)
);
router.get(
  "/search/podnapisi",
  asyncHandler(subtitleController.searchPodnapisi)
);
router.get(
  "/search/opensubtitles",
  asyncHandler(subtitleController.searchOpenSubtitles)
);


// ------------------------------------------------------
// Configure Multer for Subtitle Uploads
// ------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ------------------------------------------------------
// Routes
// ------------------------------------------------------
router.get("/search", asyncHandler(getSubtitles)); // 🔍 Search subtitles
router.get("/latest", asyncHandler(getLatest)); // 🆕 Latest
router.get("/top-rated", asyncHandler(getTopRated)); // ⭐ Top rated
router.get("/download", asyncHandler(downloadSubtitle)); // 📥 Download
router.get("/movie", asyncHandler(fetchMovie)); // 🎬 Movie details
router.post("/upload", upload.single("subtitle"), asyncHandler(uploadSubtitle)); // ⬆️ Upload
router.get("/uploads", asyncHandler(getUserUploads)); // 📂 User uploads

// 🛠 Debug: Search directly using service
router.get(
  "/debug-search",
  asyncHandler(async (req, res) => {
    const { query = "inception" } = req.query;
    const results = await searchSubtitles(query, "en", 10);
    res.json({ success: true, data: results });
  })
);

// ------------------------------------------------------
// Helper: Normalize Subtitles
// ------------------------------------------------------
function normalizeSubtitle(raw, source) {
  if (!raw) return null;
  const id = raw.id || raw.subtitle_id || null;
  if (!id) return null;
  if (raw.status === "removed" || raw.status === "disabled") return null;

  let file_id = raw.file_id || null;
  let file_name = raw.file_name || `subtitle-${id}.srt`;

  // ✅ Special case for TVSubtitles
  if (source === "tvsubtitles") {
    if (!raw.download_page && raw.page_url) {
      raw.download_page = raw.page_url;
    }
    if (!file_id) {
      file_id = id || Date.now(); // placeholder
    }
  }

  if (!file_id && !raw.download_page) return null;

  return {
    ...raw,
    id,
    file_id,
    file_name,
  };
}


function filterSubtitles(list, source) {
  return (list || [])
    .map((item) => {
      if (source === "yify" && item.download_page) return item;
      return normalizeSubtitle(item, source); // Pass source to normalize
    })
    .filter(Boolean);
}



module.exports = router;
