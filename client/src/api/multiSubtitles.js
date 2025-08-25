// client/src/api/multiSubtitles.js
// client/src/api/multiSubtitles.js
// client/src/api/multiSubtitles.js
//
// Unified subtitle fetcher:
//   • OpenSubtitles (official API via subtitlesAPI.js)
//   • YIFY Subtitles (public JSON API w/ HTML fallback)
//   • Podnapisi (backend scraping proxy)
//   • Addic7ed  (backend scraping proxy)
//
// This version:
//   ✅ Queries ALL enabled providers in parallel.
//   ✅ Maps to unified objects (with backend download proxy URLs where possible).
//   ✅ Filters *before returning to caller*: keep only subtitles that have
//        (file_id download) OR (external_url http/https).
//   ✅ Skips OpenSubtitles entries pointing to "content was removed".
//   ✅ Marks items without file_id but with external_url as status: "external-only".
//   ✅ Skips anything with neither file_id nor usable link.
//   ✅ Optional strategy: "all" (default) | "first-downloadable"
//

import { fetchSubtitles as fetchOpenSubtitles } from "./subtitlesAPI";
import { API_BASE_URL } from "../api/config";


/* --------------------------------------------------------------
 * Language Normalization
 * -------------------------------------------------------------- */
const LANG_MAP = {
  english: "EN",
  en: "EN",
  spanish: "ES",
  es: "ES",
  french: "FR",
  fr: "FR",
  german: "DE",
  de: "DE",
  italian: "IT",
  it: "IT",
  portuguese: "PT",
  pt: "PT",
  russian: "RU",
  ru: "RU",
  arabic: "AR",
  ar: "AR",
};

function normalizeLang(str = "", fallback = "EN") {
  const s = String(str).trim();
  if (!s) return fallback;
  const lc = s.toLowerCase();
  if (LANG_MAP[lc]) return LANG_MAP[lc];
  for (const key of Object.keys(LANG_MAP)) {
    if (lc.includes(key)) return LANG_MAP[key];
  }
  return s.slice(0, 5).toUpperCase();
}

function safeRelease(item, source) {
  return (
    item.release ||
    item.release_name ||
    item.movie ||
    item.title ||
    `${source} Release`
  );
}

function safeUrl(u) {
  if (!u) return null;

  // Allow multiple providers, not just tvsubtitles
  const allowedHosts = [
    "www.tvsubtitles.net",
    "tvsubtitles.net",
    "yifysubtitles.ch",
    "yifysubtitles.org",
    "www.addic7ed.com",
    "www.podnapisi.net",
    "www.opensubtitles.org",
    "www.subdl.com",
  ];

  try {
    const fullUrl = u.startsWith("/") ? `https://www.tvsubtitles.net${u}` : u;

    const urlObj = new URL(fullUrl);
    if (!allowedHosts.includes(urlObj.hostname)) {
      console.warn("⚠️ Blocked unsupported URL:", fullUrl);
      return null;
    }

    return fullUrl;
  } catch (err) {
    console.warn("⚠️ Invalid URL:", u);
    return null;
  }
}






/* --------------------------------------------------------------
 * Download Proxy Builders
 * -------------------------------------------------------------- */
const buildDownloadProxyForYify = (rawUrl) =>
  `${API_BASE_URL}/api/yify/download?url=${encodeURIComponent(rawUrl)}`;
const buildDownloadProxyForPodnapisi = (rawUrl) =>
  `${API_BASE_URL}/api/podnapisi/download?url=${encodeURIComponent(rawUrl)}`;
const buildDownloadProxyForAddic7ed = (rawUrl) =>
  `${API_BASE_URL}/api/addic7ed/download?url=${encodeURIComponent(rawUrl)}`;

/* --------------------------------------------------------------
 * Provider → Unified Object Mappers
 * -------------------------------------------------------------- */
function mapYify(items = []) {
  return items.map((item, index) => {
    const rawUrl = safeUrl(item.download_url || item.url);
    const langCode = normalizeLang(item.lang || item.language || "EN");
    return {
      id: `YIFY-${item.id || index}`,
      file_id: rawUrl ? buildDownloadProxyForYify(rawUrl) : null,
      file_name: item.filename || `YIFY-${langCode}.srt`,
      status: rawUrl ? "ok" : "external-only",
      attributes: {
        language: langCode,
        release: safeRelease(item, "YIFY"),
        uploader: { name: "YIFY" },
        uploaded_at: "few days ago",
        download_count: item.downloads || "-",
      },
      external_url: rawUrl || null,
      source: "YIFY",
    };
  });
}

function mapPodnapisi(items = []) {
  console.debug(`DEBUG: Mapping ${items.length} Podnapisi subtitles`);

  return (
    items
      // 🚫 filter out forum posts (non-downloadable chatter threads)
      .filter(
        (item) => item.download_url && !/\/forum\//.test(item.download_url)
      )
      .map((item, index) => {
        // Normalize download_url to absolute URL
        let podUrl = item.download_url || null;
        if (podUrl && !podUrl.startsWith("http")) {
          try {
            podUrl = new URL(podUrl, "https://www.podnapisi.net").toString();
          } catch (err) {
            console.warn("DEBUG: Podnapisi URL failed to normalize:", podUrl);
            podUrl = null;
          }
        }

        const langCode = normalizeLang(item.lang || item.language || "EN");
        const ext = (item.filename && item.filename.split(".").pop()) || "srt";

        // Use raw podUrl for backend download, avoid double-proxying URLs
        const fileId = podUrl ? buildDownloadProxyForPodnapisi(podUrl) : null;

        const mapped = {
          id: item.id ? `POD-${item.id}` : `POD-${index}`,
          file_id: fileId,
          file_name: item.filename || `Podnapisi-${langCode}.${ext}`,
          status: podUrl ? "ok" : "external-only",
          download_url: podUrl,
          attributes: {
            language: langCode,
            release: safeRelease(item, "Podnapisi"),
            uploaded_at: item.postedAtISO || null,
            uploader: { name: item.author || "Podnapisi" },
            download_count:
              typeof item.downloads === "number" ? item.downloads : 0,
          },
          external_url: podUrl || null,
          source: "Podnapisi",
        };

        if (!podUrl) {
          console.warn(
            "DEBUG: Podnapisi subtitle missing usable download_url:",
            item
          );
          mapped.attributes.note = "Download available only on Podnapisi site";
        } else {
          console.debug("DEBUG: Podnapisi mapped subtitle:", mapped);
        }

        return mapped;
      })
  );
}




// Fetch Podnapisi subtitles via backend proxy API
async function fetchPodnapisi(query) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/podnapisi/search?query=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error(`Podnapisi API error: ${res.status}`);
    const data = await res.json();
    return mapPodnapisi(data.subtitles || []);
  } catch (err) {
    console.error("[fetchPodnapisi] Error fetching subtitles:", err);
    return [];
  }
}


function mapAddic7ed(items = []) {
  return items.map((item, index) => {
    const rawUrl = safeUrl(item.download_url || item.url);
    const langCode = normalizeLang(item.lang || item.language || "EN");
    return {
      id: `ADD-${item.id || index}`,
      file_id: rawUrl ? buildDownloadProxyForAddic7ed(rawUrl) : null,
      file_name: item.filename || `Addic7ed-${langCode}.srt`,
      status: rawUrl ? "ok" : "external-only",
      attributes: {
        language: langCode,
        release: safeRelease(item, "Addic7ed"),
        uploader: { name: "Addic7ed" },
        download_count: item.downloads || "-",
      },
      external_url: rawUrl || null,
      source: "Addic7ed",
    };
  });
}

/* --------------------------------------------------------------
 * Provider Fetchers
 * -------------------------------------------------------------- */
async function fetchYifySubtitles(query) {
  try {
    console.debug("[fetchYifySubtitles] Starting search with query:", query);

    // Step 1: Search for the movie + direct .zip links
    const searchRes = await fetch(
      `${API_BASE_URL}/api/yify/search?query=${encodeURIComponent(query)}`
    );
    const searchText = await searchRes.text();
    console.debug("[fetchYifySubtitles] Raw search response:", searchText);

    let searchData;
    try {
      searchData = JSON.parse(searchText);
    } catch (err) {
      console.error("[fetchYifySubtitles] Failed to parse search JSON:", err);
      return [];
    }

    if (!searchData.subtitles?.length) {
      console.warn("[fetchYifySubtitles] No subtitles found in search data.");
      return [];
    }

    // Step 2: Filter English subtitles (or keep all if needed)
    const englishSubs = searchData.subtitles.filter(
      (s) => s.lang === "English" || s.lang === "EN"
    );
    console.debug(
      "[fetchYifySubtitles] Filtered English subtitles:",
      englishSubs
    );

    // Step 3: Map them to your standard format
    const displayTitle = searchData.matchedTitle || query;

    const mappedSubs = englishSubs.map((entry) => ({
      id: entry.download_url.split("/").pop().replace(".zip", ""),
      lang: entry.lang,
      title: displayTitle,
      release: displayTitle,
      download_url: entry.download_url,
    }));


    console.debug("[fetchYifySubtitles] Final mapped downloads:", mappedSubs);
    return mapYify(mappedSubs);
  } catch (err) {
    console.error("[fetchYifySubtitles] Full chain failed:", err);
    return [];
  }
}


async function fetchAddic7ed(query) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/addic7ed/search?query=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error(`Addic7ed API error: ${res.status}`);
    const data = await res.json();
    return mapAddic7ed(data.subtitles || []);
  } catch (err) {
    console.error("Addic7ed fetch error:", err);
    return [];
  }
}

async function fetchTVSubtitles(query) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/tvsubtitles/search?query=${encodeURIComponent(
        query
      )}&_=${Date.now()}`
    );

    if (!res.ok) throw new Error(`TVSubtitles API error: ${res.status}`);
    const data = await res.json();

    // ✅ Only keep TVSubtitles.net items
    const filtered = (data.subtitles || []).filter((item) => {
      const url =
        item.downloadUrl ||
        item.download_url ||
        item.url ||
        item.page_url ||
        "";
      return /tvsubtitles\.net/i.test(url);
    });

    return mapTVSubtitles(filtered);
  } catch (err) {
    console.error("TVSubtitles fetch error:", err);
    return [];
  }
}

function mapTVSubtitles(items = []) {
  return items
    .map((item, index) => {
      console.debug("[TVS][map] Raw item:", item);

      const rawUrl = safeUrl(
        item.downloadUrl || item.download_url || item.url || item.page_url
      );

      // ✅ Only allow tvsubtitles.net links
      if (!rawUrl || !/tvsubtitles\.net/i.test(rawUrl)) {
        console.warn("[TVS][map] Skipping non-TVSubtitles URL:", rawUrl);
        return null;
      }

      const langCode = normalizeLang(item.lang || item.language || "EN");

      const mapped = {
        id: `TVS-${item.id || index}`,
        file_id: `/api/tvsubtitles/resolve?url=${encodeURIComponent(rawUrl)}`,
        file_name: item.filename || `TVSubtitles-${langCode}.srt`,
        status: "ok",
        attributes: {
          language: langCode,
          release: safeRelease(item, "TVSubtitles"),
          uploader: { name: "TVSubtitles" },
          download_count: item.downloads || "0",
          uploaded_at: "few days ago",
        },
        downloadUrl: rawUrl, // ✅ keep it here
        external_url: rawUrl,
        source: "TVSubtitles",
      };


      console.debug("[TVS][map] Final mapped object:", mapped);
      return mapped;
    })
    .filter(Boolean); // remove skipped items
}


function isDownloadable(sub) {
  const pass = !!(sub && typeof sub.file_id === "string" && sub.file_id.trim());
  console.debug(
    `[DEBUG] isDownloadable -> ${pass} | source=${sub.source}, file_id=${sub.file_id}`
  );
  if (!pass) {
    console.warn("[DEBUG] Not downloadable:", sub);
  }
  return pass;
}

/** Check if external URL is valid and not a removed content page */
function isValidExternal(sub) {
  console.debug(`[DEBUG] isValidExternal() called for ${sub?.source || "??"}`, sub);

  // ✅ Allow TVSubtitles even if external_url is missing
  if (sub.source === "TVSubtitles") {
    console.debug("[DEBUG] → TVSubtitles source → returning true (special case)");
    return true;
  }

  // ✅ Allow items with a direct file_id even if no external_url
  if (!sub.external_url && !sub.file_id && sub.source !== "TVSubtitles") {
    console.debug(
      "[DEBUG] → No external_url, but has file_id → returning true"
    );
    return true;
  }

  // ❌ Reject if neither external_url nor file_id is provided
  if (!sub.external_url) {
    console.debug("[DEBUG] → FAIL: external_url missing/null");
    return false;
  }

  // ❌ Invalid URL scheme
  if (!/^https?:/i.test(sub.external_url.trim())) {
    console.debug("[DEBUG] → FAIL: external_url has invalid scheme:", sub.external_url);
    return false;
  }

  // 🚫 Skip OpenSubtitles "removed content"
  if (sub.source === "OpenSubtitles" && /opensubtitles\.com/i.test(sub.external_url)) {
    if (
      sub.external_url.includes("/removed") ||
      sub.external_url.includes("content-was-removed") ||
      /\/subtitles\/\d+$/.test(sub.external_url)
    ) {
      console.debug("[DEBUG] → FAIL: OpenSubtitles removed content link");
      return false;
    }
  }

  console.debug("[DEBUG] → PASS: external_url accepted:", sub.external_url);
  return true;
}



function isUsable(sub) {
  const downloadable = isDownloadable(sub);
  const validExternal = isValidExternal(sub);
  console.debug(
    `[DEBUG] isUsable -> ${
      downloadable || validExternal
    } | downloadable=${downloadable}, validExternal=${validExternal}, source=${
      sub.source
    }`
  );
  return downloadable || validExternal;
}

/* --------------------------------------------------------------
 * Debug-friendly filter that keeps all results
 * -------------------------------------------------------------- */
function filterDebug(list = []) {
  return (list || []).map((s) => {
    if (!isUsable(s)) {
      return { ...s, status: "unusable" }; // tag unusable ones
    }
    if (!s.file_id && isValidExternal(s)) {
      return { ...s, status: "external-only" };
    }
    return s;
  });
}

/* --------------------------------------------------------------
 * Combined Fetcher (debug version)
 * -------------------------------------------------------------- */
export async function fetchCombinedSubtitles(
  rawQuery,
  {
    includePodnapisi = true,
    includeAddic7ed = true,
    includeTVSubtitles = true,
    strategy = "all",
    minQueryLength = 3,
    perSourceLimit = 10,
    perSourceChunkSize = 10,
    onPartial = null,
  } = {}
) {
  const query = (rawQuery || "").trim();
  console.log(`[DEBUG] Starting fetchCombinedSubtitles, query="${query}"`);

  if (query.length < minQueryLength) {
    console.warn(
      `[DEBUG] Query "${query}" too short (<${minQueryLength}); skipping.`
    );
    return [];
  }

  const results = {
    tvsubtitles: [],
    podnapisi: [],
    opensubtitles: [],
    yify: [],
    addic7ed: [],
  };

  const emitBatches = async ({ source, list }) => {
    console.log(
      `[DEBUG] emitBatches(${source}) - raw count: ${list?.length || 0}`
    );
    console.debug(`[DEBUG] emitBatches(${source}) - raw data:`, list);

    const usable = filterDebug(list).slice(0, perSourceLimit);
    console.log(
      `[DEBUG] emitBatches(${source}) - after filterDebug: ${usable.length} usable items`
    );

    if (usable.length === 0) {
      console.warn(`[DEBUG] emitBatches(${source}) - No usable subtitles`);
      onPartial?.({ source, subtitles: [], done: true });
      return usable;
    }

    for (let i = 0; i < usable.length; i += perSourceChunkSize) {
      const chunk = usable.slice(i, i + perSourceChunkSize);
      const isLast = i + perSourceChunkSize >= usable.length;
      console.log(
        `[DEBUG] emitBatches(${source}) - Emitting chunk ${
          i / perSourceChunkSize + 1
        } (${chunk.length} items)`
      );
      onPartial?.({ source, subtitles: chunk, done: isLast });
    }

    return usable;
  };

  // ---- FETCH SOURCES ----
  if (includeTVSubtitles) {
    console.log(`[DEBUG] Fetching from TVSubtitles...`);
    const raw = await fetchTVSubtitles(query);
    console.debug(`[DEBUG] Raw TVSubtitles data:`, raw);
    results.tvsubtitles = await emitBatches({
      source: "TVSubtitles",
      list: raw,
    });
  }

  if (includePodnapisi) {
    console.log(`[DEBUG] Fetching from Podnapisi...`);
    const raw = await fetchPodnapisi(query);
    console.debug(`[DEBUG] Raw Podnapisi data:`, raw);
    results.podnapisi = await emitBatches({ source: "Podnapisi", list: raw });
  }

  console.log(`[DEBUG] Fetching from OpenSubtitles...`);
  const openRaw = await fetchOpenSubtitles(query);
  console.debug(`[DEBUG] Raw OpenSubtitles data:`, openRaw);
  results.opensubtitles = await emitBatches({
    source: "OpenSubtitles",
    list: openRaw,
  });

  console.log(`[DEBUG] Fetching from YIFY...`);
  const yifyRaw = await fetchYifySubtitles(query);
  console.debug(`[DEBUG] Raw YIFY data:`, yifyRaw);
  results.yify = await emitBatches({ source: "YIFY", list: yifyRaw });

  if (includeAddic7ed) {
    console.log(`[DEBUG] Fetching from Addic7ed...`);
    const raw = await fetchAddic7ed(query);
    console.debug(`[DEBUG] Raw Addic7ed data:`, raw);
    results.addic7ed = await emitBatches({ source: "Addic7ed", list: raw });
  }

  // ---- MERGE & DEDUP ----
  console.log(`[DEBUG] Merging all results...`);
  const allMerged = [
    ...results.tvsubtitles,
    ...results.podnapisi,
    ...results.opensubtitles,
    ...results.yify,
    ...results.addic7ed,
  ];
  console.log(`[DEBUG] Total before deduplication: ${allMerged.length}`);

  const seen = new Set();
  const unique = [];
  for (const sub of allMerged) {
    const key =
      (sub.source || "") +
      "::" +
      (sub.attributes?.language || "") +
      "::" +
      (sub.attributes?.release || sub.id);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sub);
    } else {
      console.debug(`[DEBUG] Duplicate skipped:`, sub);
    }
  }

  console.log(`[DEBUG] Final unique count: ${unique.length}`);
  console.debug(`[DEBUG] Final subtitles:`, unique);

  return unique;
}



// subtitlesAPI.js or wherever your API functions are

export async function fetchLatestTVSubtitles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tvsubtitles/latest`);
    if (!res.ok) {
      console.error("❌ Failed to fetch latest subtitles:", res.statusText);
      return [];
    }
    const data = await res.json();
    console.log("🔎 Subtitles API Response For Latest:", data);
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.error("❌ Exception in fetchLatestTVSubtitles:", err);
    return [];
  }
}



export async function fetchMostDownloadedTVSubtitles() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tvsubtitles/most-downloaded`);
    if (!res.ok) {
      console.error(
        "❌ Failed to fetch most-downloaded subtitles:",
        res.statusText
      );
      return [];
    }
    const data = await res.json();
    console.log("🔎 Subtitles API Response For Most-Download:", data);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("❌ Exception in fetchMostDownloadedTVSubtitles:", err);
    return [];
  }
}


/* --------------------------------------------------------------
 * Shuffle Utility to Randomize Final Results
 * -------------------------------------------------------------- */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --------------------------------------------------------------
 * Latest / TopRated Subtitles (Simulated via Search Terms)
 * -------------------------------------------------------------- */
export async function fetchLatestCombinedSubtitles(options = {}) {
  const keywords = [
    "2025", "latest movies", "new release", "latest episodes", "tv 2025"
  ];
  const resultSets = await Promise.all(
    keywords.map((q) =>
      fetchCombinedSubtitles(q, { ...options, strategy: "all" })
    )
  );
  const all = resultSets.flat();
  const seen = new Set();
  const unique = all.filter((sub) => {
    const key = sub.id + "::" + sub.attributes?.release;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return shuffleArray(unique);
}

export async function fetchTopRatedCombinedSubtitles(options = {}) {
  const keywords = [
    "breaking bad", "game of thrones", "money heist",
    "oppenheimer", "barbie", "john wick", "avengers",
    "stranger things", "top gun", "squid game"
  ];
  const resultSets = await Promise.all(
    keywords.map((q) =>
      fetchCombinedSubtitles(q, { ...options, strategy: "all" })
    )
  );
  const all = resultSets.flat();
  const seen = new Set();
  const unique = all.filter((sub) => {
    const key = sub.id + "::" + sub.attributes?.release;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return shuffleArray(unique);
}


// at the very end of client/src/api/multiSubtitles.js
export { 
  fetchTVSubtitles, 
  fetchPodnapisi as fetchPodnapisiSubtitles, 
  fetchYifySubtitles, 
  fetchAddic7ed 
};
