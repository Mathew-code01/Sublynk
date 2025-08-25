// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
// server/services/openSubtitlesService.js
/* ------------------------------------------------------------------
 * server/services/openSubtitlesService.js
 * Optimized OpenSubtitles API Integration + Fallback Strategy
 * ------------------------------------------------------------------
 * Responsibilities:
 *   • Authenticate with OpenSubtitles API (token caching)
 *   • Search subtitles by query/language
 *   • Provide "Latest" & "Top Rated" sample feeds via search shortcuts
 *   • Return a normalized record shape for the frontend
 *   • Provide signed download URLs (when file_id exists)
 *   • Download + cache subtitle files locally for proxy download
 *   • Gracefully fallback to YIFY subtitles when OpenSubtitles
 *     doesn't provide downloadable items
 * ------------------------------------------------------------------ */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// -------------------------------------------------------------------
// Env
// -------------------------------------------------------------------
const API_KEY   = process.env.OPENSUBTITLES_API_KEY;
const USERNAME  = process.env.OPENSUBTITLES_USERNAME;
const PASSWORD  = process.env.OPENSUBTITLES_PASSWORD;
const BASE_URL  = "https://api.opensubtitles.com/api/v1";

// Basic sanity warning (do not crash app)
if (!API_KEY)   console.warn("⚠️  Missing OPENSUBTITLES_API_KEY in env.");
if (!USERNAME)  console.warn("⚠️  Missing OPENSUBTITLES_USERNAME in env.");
if (!PASSWORD)  console.warn("⚠️  Missing OPENSUBTITLES_PASSWORD in env.");

// -------------------------------------------------------------------
// Token state
// -------------------------------------------------------------------
let AUTH_TOKEN = null;
let AUTH_TOKEN_EXPIRES_AT = 0;

// -------------------------------------------------------------------
// Cache directory
// -------------------------------------------------------------------
const CACHE_DIR = path.join(__dirname, "../cache/subtitles");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// -------------------------------------------------------------------
// Axios base client (note: auth header injected at call-time)
// -------------------------------------------------------------------
const baseHeaders = {
  "Api-Key": API_KEY,
  "User-Agent": "Sublynk/1.0",
  "Content-Type": "application/json",
  Accept: "application/json",
};
const client = axios.create({ baseURL: BASE_URL, headers: baseHeaders });

/* ===================================================================
 * Auth
 * =================================================================== */
async function authenticate(force = false) {
  const now = Date.now();
  if (!force && AUTH_TOKEN && now < AUTH_TOKEN_EXPIRES_AT - 30_000) {
    return AUTH_TOKEN; // still valid
  }

  try {
    const { data } = await axios.post(
      `${BASE_URL}/login`,
      { username: USERNAME, password: PASSWORD },
      { headers: baseHeaders }
    );

    AUTH_TOKEN = data.token;
    const ttl = data.expires_in ? Number(data.expires_in) * 1000 : 3600000; // fallback 1h
    AUTH_TOKEN_EXPIRES_AT = Date.now() + ttl;

    console.log("✅ Authenticated with OpenSubtitles");
    return AUTH_TOKEN;
  } catch (err) {
    logError("Authentication failed", err);
    throw new Error("OpenSubtitles authentication failed");
  }
}

/* ===================================================================
 * Utils
 * =================================================================== */
function normalizeTitle(title) {
  return (title || "")
    .replace(/[._-]/g, " ")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\d{4}.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSubtitleExt(name) {
  if (!name) return "subtitle.srt";
  return /\.(srt|vtt|ass|ssa|sub|txt)$/i.test(name) ? name : `${name}.srt`;
}

function sanitizeFileName(name) {
  if (!name) return null;
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function computeExternalUrl(id) {
  // OpenSubtitles canonical subtitle page
  return `https://www.opensubtitles.com/en/subtitles/${id}`;
}

function basicAttributesForUI(attrs = {}, fileName, downloadable) {
  return {
    language: attrs.language,
    release: attrs.release,
    file_name: fileName,
    download_count: attrs.download_count,
    hearing_impaired: attrs.hearing_impaired,
    feature_details: attrs.feature_details,
    uploader: attrs.uploader,
    proxied_download: downloadable,
  };
}

/* ===================================================================
 * Subtitle Normalization
 * =================================================================== */
/**
 * Convert a raw OpenSubtitles API item into a normalized record
 * consumed by the frontend.
 *
 * Returned shape:
 * {
 *   id,                // OpenSubtitles item id
 *   file_id,           // numeric file id for direct download (nullable)
 *   downloadable,      // boolean: can we proxy-download?
 *   external_url,      // web fallback
 *   attributes: {...}  // UI display metadata
 * }
 */
function processSubtitle(item) {
  const { attributes = {}, id } = item;
  const files = attributes.files || [];

  // Pick the best candidate file
  let fileObj =
    files.find((f) => /\.(srt|vtt|ass|ssa|sub|txt)$/i.test(f.file_name || "")) ||
    files[0];

  const fileId = fileObj?.file_id || null;
  let name =
    fileObj?.file_name ||
    attributes.release ||
    attributes.feature_details?.title ||
    `subtitle_${id}`;

  name = ensureSubtitleExt(name.trim());

  const downloadable = Boolean(fileId);

  return {
    id,
    file_id: fileId,
    downloadable,
    external_url: computeExternalUrl(id),
    attributes: basicAttributesForUI(attributes, name, downloadable),
  };
}

/* ===================================================================
 * Core Search
 * =================================================================== */
async function searchSubtitles(query = "Eden", language = "en", limit = 50) {
  await authenticate();

  const normalizedQuery = normalizeTitle(query);
  try {
    const { data } = await client.get("/subtitles", {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      params: { query: normalizedQuery, languages: language, limit },
    });

    const raw = data?.data || [];
    console.log(`🔍 Found ${raw.length} subtitles for "${normalizedQuery}"`);

    const processed = raw.map(processSubtitle).filter(Boolean);

    // If we got zero *downloadable* items, merge in YIFY fallback.
    if (!processed.some((s) => s.downloadable)) {
      console.log("⚠️  No direct downloads from OpenSubtitles; merging YIFY fallback...");
      const yifySubs = await fallbackToYify(normalizedQuery, language);
      return [...processed, ...yifySubs];
    }

    return processed;
  } catch (err) {
    if (err.response?.status === 437) {
      console.warn("⚠️  437 error (token/limit). Retrying with forced auth...");
      await authenticate(true);
      return await searchSubtitles(query, language, limit);
    }

    logError("searchSubtitles failed", err);
    return await fallbackToYify(query, language);
  }
}

/* ===================================================================
 * Signed Download URL
 * =================================================================== */
async function getSignedDownloadUrl(fileId) {
  if (!fileId) return null;
  await authenticate();
  try {
    const { data } = await client.get("/download", {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      params: { file_id: fileId },
    });
    return data?.link || null;
  } catch (err) {
    logError(`Failed to get signed URL for fileId ${fileId}`, err);
    return null;
  }
}

/* ===================================================================
 * Download + Cache
 * =================================================================== */
async function downloadAndCacheSubtitle(fileId, fileName = "subtitle.srt") {
  const safeName = sanitizeFileName(ensureSubtitleExt(fileName)) || `subtitle-${fileId}.srt`;
  const destPath = path.join(CACHE_DIR, safeName);

  // Serve from cache if exists
  if (fs.existsSync(destPath)) {
    console.log(`✅ Serving cached subtitle: ${safeName}`);
    return destPath;
  }

  // Need a signed URL
  const signedUrl = await getSignedDownloadUrl(fileId);
  if (!signedUrl) {
    console.warn(`❌ No signed download URL for fileId=${fileId}`);
    return null;
  }

  try {
    const resp = await axios.get(signedUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(destPath, resp.data);
    console.log(`💾 Cached subtitle: ${safeName}`);
    return destPath;
  } catch (err) {
    logError(`Failed to download subtitle ${fileId}`, err);
    return null;
  }
}

/* ===================================================================
 * Convenience Feeds
 * =================================================================== */
/**
 * "Latest" – There is no dedicated OpenSubtitles endpoint in v1 for "latest"
 * that I've seen widely available, so we approximate by running a generic
 * broad query. You can tweak the query string for better relevance.
 */
async function getLatestSubtitles(language = "en", limit = 50) {
  return await searchSubtitles("the", language, limit);
}

/**
 * "Top Rated" – Likewise approximated; adjust the query to something popular.
 */
async function getTopRatedSubtitles(language = "en", limit = 50) {
  return await searchSubtitles("matrix", language, limit);
}

/* ===================================================================
 * YIFY Fallback
 * =================================================================== */
async function fallbackToYify(query, language) {
  try {
    console.log("🔁 Using YIFY fallback...");
    const yify = require("yifysubtitles");
    const { getMovieDetailsByTitle } = require("./omdbService");

    const movie = await getMovieDetailsByTitle(query);
    if (!movie?.imdbID) return [];

    const subs = await yify(movie.imdbID, { langs: [language] });

    return subs.map((sub, i) => ({
      id: `yify_${i}`,
      file_id: null,
      downloadable: false, // not proxied yet
      external_url: sub.url, // direct YIFY link
      attributes: {
        language: sub.langShort || language,
        release: `${movie.Title} [YIFY]`,
        file_name: sub.file || `yify_${i}.srt`,
        feature_details: { title: movie.Title, year: movie.Year },
        uploader: { name: "YIFY" },
        proxied_download: false,
      },
    }));
  } catch (err) {
    logError("YIFY fallback failed", err);
    return [];
  }
}

/* ===================================================================
 * Error Logger
 * =================================================================== */
function logError(context, error) {
  console.error(`❌ ${context}:`);
  if (error?.response) {
    console.error("Status:", error.response.status);
    console.error("Data:", JSON.stringify(error.response.data, null, 2));
  } else if (error?.request) {
    console.error("No response received.");
  } else if (error) {
    console.error("Error:", error.message);
  }
}

/* ===================================================================
 * Exports
 * =================================================================== */
module.exports = {
  searchSubtitles,
  getLatestSubtitles,
  getTopRatedSubtitles,
  downloadAndCacheSubtitle,
  // exposed utilities (optional if needed elsewhere)
  ensureSubtitleExt,
  sanitizeFileName,
};
