// client/src/api/subtitlesAPI.js
// client/src/api/subtitlesAPI.js

// client/src/api/subtitlesAPI.js
// client/src/api/subtitlesAPI.js
// client/src/api/subtitlesAPI.js
// client/src/api/subtitlesAPI.js
// -----------------------------------------------------------------------------

import { getAuthToken } from "./authToken";

const BASE = "/api/subtitles";
const OPEN_SUBS_WEB_BASE = "https://www.opensubtitles.com/en/subtitles";

// ------------------------------------------------------------------
// Runtime denylist of known-removed OpenSubtitles IDs (string form).
// ------------------------------------------------------------------
const removedIdSet = new Set();
export function registerRemovedId(id) {
  if (id != null) removedIdSet.add(String(id));
}
export function registerRemovedIds(ids = []) {
  ids.forEach(registerRemovedId);
}
export function isIdRegisteredRemoved(id) {
  return removedIdSet.has(String(id));
}

/* ------------------------------------------------------------------ */
/* Auth helpers                                                       */
/* ------------------------------------------------------------------ */
function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function withToken(url) {
  const token = getAuthToken();
  if (!token) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}token=${encodeURIComponent(token)}`;
}

/* ------------------------------------------------------------------ */
/* Internal Helpers                                                   */
/* ------------------------------------------------------------------ */
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse error (subtitlesAPI):", err, "raw:", text);
    return null;
  }
}

function unwrap(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
  return [];
}

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
        sub.file_name || sub.filename || sub.name || `subtitle-${getId(sub)}.srt`,
    };
  }

  const files = getFilesArray(sub);
  const first = files.find((f) => f?.file_id);
  if (!first) return null;

  return {
    file_id: first.file_id,
    file_name:
      first.file_name ||
      first.filename ||
      first.name ||
      sub?.file_name ||
      `subtitle-${getId(sub)}.srt`,
  };
}

function getStatus(sub) {
  return sub?.status || sub?.attributes?.status || "ok";
}

/* ------------------------------------------------------------------ */
/* Removed / Deleted Heuristics                                       */
/* ------------------------------------------------------------------ */
function looksLikeRemovedMeta(raw) {
  const id = getId(raw);
  if (id && isIdRegisteredRemoved(id)) return true;

  const a = raw?.attributes ?? {};
  if (raw.removed || a.removed) return true;
  if (raw.deleted || a.deleted) return true;
  if (raw.is_removed || a.is_removed) return true;
  if (raw.isDeleted || a.isDeleted) return true;

  const st = getStatus(raw);
  if (st === "removed" || st === "disabled") return true;

  const txtFields = [
    raw?.description,
    raw?.comment,
    a?.description,
    a?.comment,
    a?.notes,
  ]
    .concat(
      Array.isArray(a?.tags) ? a.tags.join(" ") : "",
      Array.isArray(a?.labels) ? a.labels.join(" ") : ""
    )
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    txtFields.includes("content was removed") ||
    txtFields.includes("content removed") ||
    txtFields.includes("deleted subtitle") ||
    txtFields.includes("removed subtitle")
  ) {
    return true;
  }

  return false;
}

function buildOpenSubsExternalUrl(id) {
  return id ? `${OPEN_SUBS_WEB_BASE}/${encodeURIComponent(id)}` : null;
}

function buildRemovedWarningMessage(id) {
  return `OpenSubtitles entry ${id} appears to have been removed.`;
}

function augmentNormalized(raw, norm) {
  const id = norm.id;
  norm.external_url = buildOpenSubsExternalUrl(id);
  norm.is_removed_meta = looksLikeRemovedMeta(raw);
  if (norm.is_removed_meta) {
    norm.removed_warning = buildRemovedWarningMessage(id);
  }
  return norm;
}

function normalizeSubtitle(raw) {
  if (!raw) return null;

  const id = getId(raw);
  if (!id) return null;

  const status = getStatus(raw);
  if (status === "removed" || status === "disabled") return null;
  if (looksLikeRemovedMeta(raw)) return null;

  const primaryFile = pickPrimaryFile(raw);

  // ✅ Accept TVSubtitles if they have a download_page
  if (!primaryFile?.file_id && !raw.download_page) return null;

  const norm = {
    ...raw,
    id,
    file_id: primaryFile?.file_id || id, // placeholder if no file_id
    file_name: primaryFile?.file_name || `subtitle-${id}.srt`,
    status,
  };

  return augmentNormalized(raw, norm);
}


function normalizeAndFilter(list) {
  return (list || []).map(normalizeSubtitle).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Shared fetch+normalize helper                                      */
/* ------------------------------------------------------------------ */
async function fetchAndNormalize(url, label) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    const parsed = await safeJson(res);
    const arr = unwrap(parsed);
    const filtered = normalizeAndFilter(arr);

    if (filtered.length === 0 && arr.length > 0) {
      console.warn(`[subtitlesAPI] ${label}: received ${arr.length}, but 0 usable.`);
    } else {
      console.log(`[subtitlesAPI] ${label}: ${filtered.length}/${arr.length} usable.`);
    }

    return filtered;
  } catch (err) {
    console.error(`[subtitlesAPI] Fetch error (${label}):`, err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Public API Fetchers                                                */
/* ------------------------------------------------------------------ */
const randomDefaults = [
  "Inception",
  "Avatar",
  "Interstellar",
  "Gladiator",
  "Titanic",
  "John Wick",
  "Avengers",
  "The Dark Knight",
];
function getRandomQuery() {
  return randomDefaults[Math.floor(Math.random() * randomDefaults.length)];
}

export async function fetchSubtitles(
  query = getRandomQuery(),
  language = "en",
  limit = 50,
  { requireQuery = false } = {}
) {
  if (requireQuery && !query?.trim()) {
    console.warn("[subtitlesAPI] Empty query with requireQuery=true → returning [].");
    return [];
  }

  const url = `${BASE}/search?query=${encodeURIComponent(
    query
  )}&language=${language}&limit=${limit}`;

  return fetchAndNormalize(url, `search "${query}"`);
}

/* ------------------------------------------------------------------ */
/* Download Helpers                                                   */
/* ------------------------------------------------------------------ */
export function buildDownloadUrl(sub) {
  const norm = normalizeSubtitle(sub);
  if (!norm) return "#";
  return withToken(
    `${BASE}/download?fileId=${encodeURIComponent(norm.file_id)}&fileName=${encodeURIComponent(
      norm.file_name || `subtitle-${norm.id}.srt`
    )}`
  );
}

export async function downloadSubtitlesAsZip(subtitleList = []) {
  if (!Array.isArray(subtitleList) || subtitleList.length === 0) return;

  const normalized = normalizeAndFilter(subtitleList);
  if (normalized.length === 0) {
    console.warn("No valid subtitles to download.");
    return;
  }

  if (normalized.length === 1) {
    const sub = normalized[0];
    const downloadUrl = buildDownloadUrl(sub);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.setAttribute("download", sub.file_name || `subtitle-${sub.id}.srt`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  try {
    const res = await fetch(withToken(`${BASE}/download-zip`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ subtitles: normalized }),
    });

    if (!res.ok) throw new Error(`ZIP failed (${res.status})`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("ZIP download failed:", err);
    normalized.forEach((sub) => {
      const a = document.createElement("a");
      a.href = buildDownloadUrl(sub);
      a.setAttribute("download", sub.file_name || `subtitle-${sub.id}.srt`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
}

/* ------------------------------------------------------------------ */
/* Exported normalization util (used by Dashboard & multiSubtitles)   */
/* ------------------------------------------------------------------ */
export function normalizeSubtitleList(list) {
  return normalizeAndFilter(list);
}

// ✅ ADD THIS
export async function fetchLatestSubtitles() {
  const res = await fetchAndNormalize(`${BASE}/latest`, "latest");
  return res;
}

export async function fetchTopRatedSubtitles() {
  const res = await fetchAndNormalize(`${BASE}/top-rated`, "top-rated");
  return res;
}
