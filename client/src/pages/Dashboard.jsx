// client/src/pages/Dashboard.jsx

// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx

// client/src/pages/Dashboard.jsx

// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
// client/src/pages/Dashboard.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  // fetchCombinedSubtitles,
  fetchLatestTVSubtitles,
  fetchMostDownloadedTVSubtitles,
  fetchTVSubtitles,
  fetchPodnapisiSubtitles,
  fetchYifySubtitles,
  fetchAddic7ed,
} from "../api/multiSubtitles"; // Multi-API
import {
  // fetchLatestSubtitles,
  // fetchTopRatedSubtitles,
  normalizeSubtitleList,  // normalize multi-source data to consistent shape
  buildDownloadUrl        // build OpenSubtitles-authenticated download
} from "../api/subtitlesAPI";
import DashHeader from "../components/DashHeader";
import DashFooter from "../components/DashFooter";
import useMediaQuery from "../hooks/useMediaQuery";
import "../styles/Dashboard.css";
import { API_BASE_URL } from "../api/config";


import {
  FiSearch,
  FiUploadCloud,
  FiAlertCircle,
  FiDownload,
  FiVideo,
  FiTrendingUp,
  FiClock,
  FiFolderPlus,
  FiXCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiAlertTriangle,
} from "react-icons/fi";

import { FaSpinner } from "react-icons/fa"; // ✅ Correct

// Top of your component file (e.g. Dashboard.jsx)
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);




/* --------------------------------------------------------------
 * Helper: prioritize full-season packs
 * -------------------------------------------------------------- */
function prioritizeSeasonPacks(subtitles) {
  if (!Array.isArray(subtitles)) return [];
  return [...subtitles].sort((a, b) => {
    const nameA = a?.attributes?.release?.toLowerCase() || "";
    const nameB = b?.attributes?.release?.toLowerCase() || "";
    const isFullSeason = (name) =>
      /complete.season|full.season|season\s?\d+|s\d{2}(?!e\d{2})/.test(name) &&
      !/s\d{2}e\d{2}/.test(name);
    const aIsSeason = isFullSeason(nameA);
    const bIsSeason = isFullSeason(nameB);
    if (aIsSeason && !bIsSeason) return -1;
    if (!aIsSeason && bIsSeason) return 1;
    return 0;
  });
}

/* --------------------------------------------------------------
 * External URL builder (view page)
 * -------------------------------------------------------------- */
// function externalUrlFor(sub) {
//   return (
//     sub?.external_url ||
//     (sub?.id ? `https://www.opensubtitles.com/en/subtitles/${sub.id}` : null)
//   );
// }

/* --------------------------------------------------------------
 * Filter renderable items
 * -------------------------------------------------------------- */
function filterRenderable(list) {
  return (list || []).filter((s) => {
    const hasFiles = s.file_id || s.attributes?.files?.length > 0;
    const isTVSubtitles = s.source === "TVSubtitles"; // ✅ allow TVSubtitles
    const notRemoved = s.status !== "removed" && !s.removed;

    return (hasFiles || isTVSubtitles) && notRemoved;
  });
}



/* --------------------------------------------------------------
 * Get best download href for any source
 * -------------------------------------------------------------- */
// Convert TVSubtitles API response to normalized format
function convertTVSubtitlesToNormalized(input, group = "tvsub") {
  const data = Array.isArray(input)
    ? input
    : Array.isArray(input?.value)
    ? input.value
    : [];

  return data.map((item, index) => ({
    id: `${group}-${index}-${
      item.url?.split("/").pop() || item.release || "x"
    }`,
    source: "TVSubtitles",
    external_url: item.url,
    attributes: {
      language: item.lang,
      release: item.release,
      uploaded_at: item.uploaded_at ?? null,
      download_count: item.downloads ?? null,
      uploader: { name: "TVSubtitles" },
      feature_details: {
        title: item.title,
      },
    },
  }));
}

/* ============================================================== 
 * Component
 * ============================================================== */
const Dashboard = () => {
  const [subtitles, setSubtitles] = useState([]);
  const [latest, setLatest] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSources, setLoadingSources] = useState(new Set()); // ← Add this
  const [downloadStatus, setDownloadStatus] = useState({});

  const fileInputRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 1200px)");
  const [rotatingSource, setRotatingSource] = useState("");

  // 🔹 Rotate through sources while loading
  useEffect(() => {
    if (loading && loadingSources.size > 0) {
      const sources = Array.from(loadingSources);
      let index = 0;
      setRotatingSource(sources[index]);

      const interval = setInterval(() => {
        index = (index + 1) % sources.length;
        setRotatingSource(sources[index]);
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setRotatingSource("");
    }
  }, [loading, loadingSources]);

  /* ------------------------------------------------------------
   * Handle View
   * ------------------------------------------------------------ */
  // const handleView = useCallback((sub) => {
  //   const url = externalUrlFor(sub);
  //   if (!url) {
  //     toast.error("Unable to open subtitle page.");
  //     return;
  //   }
  //   window.open(url, "_blank", "noopener,noreferrer");
  //   toast.info(`Opening subtitle on ${sub.source || "OpenSubtitles"}...`);
  // }, []);

  /* ------------------------------------------------------------
   * Handle Download
   * ------------------------------------------------------------ */
  /* ------------------------------------------------------------
   * Handle Download
   * ------------------------------------------------------------ */
  const handleDownload = useCallback(
    async (sub) => {
      // ────────────────────────────────────────────────────────────
      // Helpers for logging, normalization, and filenames
      // ────────────────────────────────────────────────────────────
      const reqId = `DL-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const t0 = performance.now();
      const STEP = (n, msg, extra) => {
        const delta = (performance.now() - t0).toFixed(1);
        if (extra !== undefined) {
          console.log(
            `[${reqId}] ${String(n).padStart(2, "0")} ${msg} (+${delta}ms)`,
            extra
          );
        } else {
          console.log(
            `[${reqId}] ${String(n).padStart(2, "0")} ${msg} (+${delta}ms)`
          );
        }
      };

      let subId; // <-- declare outside
      const hostOf = (u) => {
        try {
          return new URL(u).hostname;
        } catch {
          return null;
        }
      };
      const same = (a, b) =>
        (a || "").toLowerCase() === (b || "").toLowerCase();

      const safeFilename = (name) => {
        const before = name;
        let fn = (name || "subtitle")
          .replace(/[<>:"/\\|?*]+/g, "-")
          .replace(/\s+/g, "_");
        if (!fn.toLowerCase().endsWith(".zip")) fn += ".zip";
        STEP("FN", `Sanitize filename: "${before}" -> "${fn}"`);
        return fn;
      };

      // ────────────────────────────────────────────────────────────
      // 01. Basic guards and initial state
      // ────────────────────────────────────────────────────────────
      console.groupCollapsed(`%c[${reqId}] handleDownload()`, "color:#0aa");
      try {
        const subId =
          sub.id ||
          sub.external_url ||
          sub.download_url ||
          sub.downloadUrl ||
          Math.random().toString(36).slice(2);
        STEP(1, "Input subtitle object", sub);

        if (downloadStatus[subId] === "downloaded") {
          STEP(2, "Already downloaded, early return");
          console.groupEnd();
          return;
        }

        setDownloadStatus((prev) => ({ ...prev, [subId]: "please-wait" }));
        setTimeout(() => {
          setDownloadStatus((prev) => ({ ...prev, [subId]: "downloading" }));
        }, 500);

        // ──────────────────────────────────────────────────────────
        // 02. Build a stable, safe filename
        // ──────────────────────────────────────────────────────────
        const title = sub?.attributes?.title || sub?.title || "subtitle";
        const release = sub?.attributes?.release || sub?.release || "release";
        const fallbackFileName = safeFilename(`${title} - ${release}`);

        // ──────────────────────────────────────────────────────────
        // 03. Normalize provider/source
        // ──────────────────────────────────────────────────────────
        const providerRaw = sub.source || sub.provider || "";
        const provider = providerRaw.toLowerCase();
        STEP(
          3,
          `Provider/source normalized: "${providerRaw}" -> "${provider}"`
        );

        // ──────────────────────────────────────────────────────────
        // 04. Inspect candidate URLs passed from backend
        //     (IMPORTANT: use backend's "downloadUrl" if present)
        // ──────────────────────────────────────────────────────────
        const cand = {
          downloadUrl: sub.downloadUrl || sub.download_url || null,
          externalUrl: sub.external_url || null,
          fileId: sub.file_id || null,
        };
        STEP(4, "Candidate URLs from item", cand);

        // Ensure we log if host already looks wrong
        if (cand.downloadUrl) {
          STEP(
            "4a",
            `downloadUrl host=${hostOf(cand.downloadUrl)}`,
            cand.downloadUrl
          );
        }
        if (cand.externalUrl) {
          STEP(
            "4b",
            `externalUrl host=${hostOf(cand.externalUrl)}`,
            cand.externalUrl
          );
        }

        // ──────────────────────────────────────────────────────────
        // 05. Decide route based on provider
        // ──────────────────────────────────────────────────────────
        let downloadUrl = null; // final URL we fetch (our backend endpoints)
        let resolvedUrl = null; // any resolved page URL (like download-*.html)
        let backend = null; // which backend we hit

        if (same(provider, "opensubtitles")) {
          // Direct OpenSubtitles builder (as in your code)
          backend = "OpenSubtitles";
          STEP(5, "Branch: OpenSubtitles");
          downloadUrl = buildDownloadUrl(sub); // assumed existing util
          STEP("5a", "buildDownloadUrl() ->", downloadUrl);
        } else if (same(provider, "podnapisi")) {
          backend = "Podnapisi";
          STEP(5, "Branch: Podnapisi");

          // ✅ Always use the raw Podnapisi URL, not the file_id/proxy
          const pageUrl = sub.download_url;
          console.log("Podnapisi download_url:", sub.download_url);
          if (!pageUrl) throw new Error("Podnapisi: missing page URL");
          if (!pageUrl) throw new Error("Podnapisi: missing page URL");
          downloadUrl = `${API_BASE_URL}/api/podnapisi/download?url=${encodeURIComponent(
            pageUrl
          )}&filename=${encodeURIComponent(fallbackFileName)}`;
          STEP("5a", "Prepared backend download URL", downloadUrl);
        } else if (same(provider, "addic7ed")) {
          backend = "Addic7ed";
          STEP(5, "Branch: Addic7ed");
          const pageUrl = cand.downloadUrl || cand.externalUrl;
          if (!pageUrl) throw new Error("Addic7ed: missing page URL");
          downloadUrl = `${API_BASE_URL}/api/addic7ed/download?url=${encodeURIComponent(
            pageUrl
          )}&filename=${encodeURIComponent(fallbackFileName)}&debug=1`;
          STEP("5a", "Prepared backend download URL", downloadUrl);
        } else if (
          same(provider, "tvsubtitles") ||
          same(providerRaw, "TVSubtitles")
        ) {
          backend = "TVSubtitles";
          STEP(5, "Branch: TVSubtitles");

          // ✅ IMPORTANT:
          // Prefer "downloadUrl" coming from backend search payload (e.g., /download-1452-1-en.html)
          // Only call /resolve if we lack a TVSubtitles download page.
          let candidate = cand.downloadUrl;

          // If no downloadUrl but fileId is actually an /api/tvsubtitles/resolve?url=...
          if (
            !candidate &&
            cand.fileId?.startsWith(`${API_BASE_URL}/api/tvsubtitles/resolve?`)
          ) {
            try {
              const u = new URL(cand.fileId, window.location.origin);
              const real = u.searchParams.get("url");
              if (real) candidate = decodeURIComponent(real);
            } catch {}
          }

          if (!candidate) candidate = cand.externalUrl;

          STEP("5a", "TVSubtitles candidate", candidate);

          const isTvHost =
            candidate && /(^|\/\/)www\.tvsubtitles\.net/i.test(candidate);
          const looksLikeDownloadPage =
            candidate &&
            /\/download-\d+(-\d+)?-?[a-z]{0,3}\.html$/i.test(candidate);

          if (candidate && isTvHost && looksLikeDownloadPage) {
            // We already have the right download page
            resolvedUrl = candidate;
            STEP(
              "5b",
              "Using backend-provided download page (no resolve)",
              resolvedUrl
            );
          } else {
            // Resolve from subtitle page to download page
            const pageUrl = candidate;
            if (!pageUrl)
              throw new Error("TVSubtitles: missing page URL to resolve");
            const resolveUrl = `${API_BASE_URL}/api/tvsubtitles/resolve?url=${encodeURIComponent(
              pageUrl
            )}&debug=1`;
            STEP(
              "5c",
              "Resolving TVSubtitles page -> download page",
              resolveUrl
            );

            const res = await fetch(resolveUrl);
            STEP(
              "5d",
              `Resolve response: ok=${res.ok} status=${res.status} redirected=${res.redirected} url=${res.url}`
            );
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              STEP("5e", "Resolve error body", txt);
              throw new Error(
                `TVSubtitles: resolve failed (status ${res.status})`
              );
            }
            const json = await res.json();
            resolvedUrl = json?.url;
            STEP("5f", "Resolved download page URL", resolvedUrl);
            if (!resolvedUrl) throw new Error("TVSubtitles: no resolved URL");
            if (!/(^|\/\/)www\.tvsubtitles\.net/i.test(resolvedUrl)) {
              STEP("5g", "⚠️ Resolved URL host mismatch!", {
                host: hostOf(resolvedUrl),
                resolvedUrl,
              });
            }
          }

          // Now hit backend /download which will extract the ZIP and stream it
          downloadUrl = `${API_BASE_URL}/api/tvsubtitles/download?url=${encodeURIComponent(
            resolvedUrl
          )}&filename=${encodeURIComponent(fallbackFileName)}&debug=1`;
          STEP("5h", "Prepared backend download URL", downloadUrl);
        } else {
          // Generic fallback: try direct file or external link
          backend = "Generic";
          STEP(5, "Branch: Generic fallback");
          downloadUrl =
            cand.fileId || cand.downloadUrl || cand.externalUrl || null;
          STEP("5a", "Generic candidate", downloadUrl);
        }

        if (!downloadUrl) {
          STEP("X", "No download URL available -> fail");
          toast.error("No download link available.");
          setDownloadStatus((prev) => ({ ...prev, [subId]: "failed" }));
          console.groupEnd();
          return;
        }

        // ──────────────────────────────────────────────────────────
        // 06. Fetch the file via backend (as Blob)
        //     NOTE: we read server debug headers (X-*) for tracing.
        // ──────────────────────────────────────────────────────────
        STEP(6, `Fetching download from backend [${backend}]`, downloadUrl);
        const response = await fetch(downloadUrl, { redirect: "follow" });
        STEP(
          "6a",
          `Response: ok=${response.ok} status=${response.status} redirected=${response.redirected} url=${response.url}`
        );

        // Read debug headers returned by your backend
        const rid = response.headers.get("X-Debug-Request-Id");
        const resolvedZipUrl = response.headers.get("X-Resolved-Zip-Url");
        const hopsHeader = response.headers.get("X-Redirect-Hops");
        let hops = null;
        try {
          hops = hopsHeader ? JSON.parse(decodeURIComponent(hopsHeader)) : null;
        } catch {}

        STEP("6b", "Server debug headers", { rid, resolvedZipUrl, hops });

        if (!response.ok) {
          const statusHeader = response.headers.get("X-Subtitle-Status");
          if (statusHeader === "missing") {
            setDownloadStatus((prev) => ({ ...prev, [subId]: "missing" }));
            toast.error("Subtitle ZIP is missing.");
            return;
          }

          const clone = response.clone();
          const errTxt = await clone.text().catch(() => "");
          STEP("6c", "Backend error body", errTxt);
          throw new Error(
            `Download request failed (status ${response.status})`
          );
        }

        // ──────────────────────────────────────────────────────────
        // 07. Trigger browser download
        // ──────────────────────────────────────────────────────────
        const blob = await response.blob();
        STEP(7, `Blob received: size=${blob.size} type=${blob.type}`);

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fallbackFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        STEP("7a", "Browser download triggered");

        setDownloadStatus((prev) => ({ ...prev, [subId]: "downloaded" }));
        toast.success(
          `Downloaded from ${sub.source || sub.provider || "source"}!`
        );
        STEP(8, "Done");
      } catch (err) {
        STEP("ERR", "Download failed", err);
        console.error(`[${reqId}] Download failed:`, err);

        // If fetch succeeded but response was !ok, we mark "failed-server"
        if (err.message?.includes("status")) {
          setDownloadStatus((prev) => ({ ...prev, [subId]: "failed-server" }));
        } else {
          // true network/JS error, keep "failed"
          setDownloadStatus((prev) => ({ ...prev, [subId]: "failed" }));
        }
      } finally {
        console.groupEnd();
      }
    },
    [downloadStatus]
  );

  /* ------------------------------------------------------------
   * Search (multi API)
   * ------------------------------------------------------------ */
  /* ------------------------------------------------------------
   * Search (multi API)
   * ------------------------------------------------------------ */
  /* ------------------------------------------------------------
   * Search (multi API)
   * ------------------------------------------------------------ */
  /* ------------------------------------------------------------
   * Search (multi API)
   * ------------------------------------------------------------ */
  /* ------------------------------------------------------------
   * Search (multi API)
   * ------------------------------------------------------------ */
const handleSearch = useCallback(async () => {
  const term = query.trim();
  if (!term) {
    toast.error("Enter a movie or show title.");
    return;
  }

  const providers = [
    { name: "TVSubtitles", fetchFn: fetchTVSubtitles },
    { name: "Podnapisi", fetchFn: fetchPodnapisiSubtitles },
    { name: "YIFY", fetchFn: fetchYifySubtitles },
    { name: "Addic7ed", fetchFn: fetchAddic7ed },
  ];

  const activeSources = new Set(providers.map((p) => p.name));
  setSubtitles([]);
  setLoadingSources(new Set(activeSources));
  setLoading(true);
  setError("");
  setHasSearched(true);

  const runProvider = async ({ name, fetchFn }) => {
    try {
      const raw = await fetchFn(term);
      const normalized = normalizeSubtitleList(raw);
      const filtered = filterRenderable(normalized);
      const sorted = prioritizeSeasonPacks(filtered);

      if (sorted.length) {
        setSubtitles((prev) => [...prev, ...sorted]);
      }
    } catch (err) {
      console.warn(`${name} fetch failed:`, err);

      // ✅ Bubble up backend errors / detect offline
      if (!navigator.onLine) {
        setError(
          "You appear to be offline. Please check your internet connection."
        );
      } else if (err?.message) {
        setError(err.message); // backend-provided error
      } else {
        setError(
          `Failed to fetch subtitles from ${name}. Please try again later.`
        );
      }
    } finally {
      activeSources.delete(name);
      setLoadingSources(new Set(activeSources));

      if (activeSources.size === 0) {
        setLoading(false);

        // ✅ only set fallback if *no results* and *still no error*
        setSubtitles((prev) => {
          if (prev.length === 0) {
            setError(
              (curr) =>
                curr || "No subtitles could be fetched from any provider."
            );
          }
          return prev;
        });
      }
    }
  };

  // Run TVSubtitles first
  await runProvider(providers[0]);

  // Run the others in parallel
  providers.slice(1).forEach((provider) => runProvider(provider));
}, [query]);


  const [fallbackList, setFallbackList] = useState([]);

  /* ------------------------------------------------------------
   * Load Latest + Top Rated
   * ------------------------------------------------------------ */
  const loadDefaultFeeds = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [latestTVRaw, topTVRaw] = await Promise.allSettled([
        fetchLatestTVSubtitles(),
        fetchMostDownloadedTVSubtitles(),
      ]);

      let fallbackData = [];

      if (latestTVRaw.status === "fulfilled") {
        const latestTV = convertTVSubtitlesToNormalized(
          latestTVRaw.value,
          "latest"
        );
        const latestProcessed = prioritizeSeasonPacks(
          filterRenderable(latestTV)
        );
        setLatest(latestProcessed);
        fallbackData = fallbackData.concat(latestProcessed);
      }

      if (topTVRaw.status === "fulfilled") {
        const topTV = convertTVSubtitlesToNormalized(topTVRaw.value, "top");
        const topProcessed = prioritizeSeasonPacks(filterRenderable(topTV));
        setTopRated(topProcessed);
        fallbackData = fallbackData.concat(topProcessed);
      } else {
        console.error(
          "Failed to load most downloaded subtitles:",
          topTVRaw.reason
        );
      }

      // Save fallback if one or both failed
      if (fallbackData.length > 0) {
        setFallbackList(fallbackData);
      }

      console.log("🔥 Raw Latest TV:", latestTVRaw);
      console.log("🔥 Raw Top TV:", topTVRaw);

      const latestTV = convertTVSubtitlesToNormalized(latestTVRaw, "latest");
      const topTV = convertTVSubtitlesToNormalized(topTVRaw, "Top");

      console.log("✅ Normalized TVSubs (top):", topTV); // 👈 Paste here

      const combinedLatest = latestTV;
      const combinedTop = topTV;

      setLatest(prioritizeSeasonPacks(filterRenderable(combinedLatest)));
      setTopRated(prioritizeSeasonPacks(filterRenderable(combinedTop)));

      console.log(
        "📦 Final latest:",
        prioritizeSeasonPacks(filterRenderable(combinedLatest))
      );
      console.log(
        "📦 Final topRated:",
        prioritizeSeasonPacks(filterRenderable(combinedTop))
      );
    } catch (err) {
      console.error("Failed loading default feeds:", err);
      setError("Failed to load default feeds.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setSubtitles([]);
    setHasSearched(false);
    loadDefaultFeeds();
  }, [loadDefaultFeeds]);

  /* ------------------------------------------------------------
   * File Upload Handlers
   * ------------------------------------------------------------ */
  const triggerFileUpload = () => fileInputRef.current?.click();
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file.");
      return;
    }
    const cleaned = file.name.replace(/\.[^/.]+$/, "");
    setQuery(cleaned);
    toast.info(`🎞 Detecting subtitles for "${cleaned}"...`);
    setTimeout(handleSearch, 0);
  };
  const handleVideoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please drop a video file.");
      return;
    }
    const cleaned = file.name.replace(/\.[^/.]+$/, "");
    setQuery(cleaned);
    toast.info(`🎞 Detecting subtitles for "${cleaned}"...`);
    setTimeout(handleSearch, 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleSearch();
  };

  /* ------------------------------------------------------------
   * Lifecycle
   * ------------------------------------------------------------ */
  useEffect(() => {
    loadDefaultFeeds();
  }, [loadDefaultFeeds]);

  useEffect(() => {
    if (hasSearched && query.trim() === "") {
      loadDefaultFeeds();
      setHasSearched(false);
      setSubtitles([]);
    }
  }, [query, hasSearched, loadDefaultFeeds]);

  /* ------------------------------------------------------------
   * Render subtitle cards (mobile)
   * ------------------------------------------------------------ */
  const renderSubtitleCards = (list) => (
    <div className="subtitles-card-list">
      {list.map((sub) => {
        const attrs = sub.attributes || {};
        const title =
          attrs.feature_details?.title || attrs.release || "Untitled";
        const lang = attrs.language?.toUpperCase() || "EN";
        const downloads = attrs.download_count ?? "-";
        const source = sub.source || "OpenSubtitles";

        return (
          <div
            key={`${sub.id}-${sub.source}-${
              sub.external_url || sub.file_id || Math.random()
            }`}
            className="subtitle-card-mobile"
          >
            <div className="subtitle-header">
              <strong>{title}</strong>
              <span className="subtitle-lang">{lang}</span>
            </div>
            <p>
              <em>{attrs.release}</em>
            </p>
            <p>Uploader: {attrs.uploader?.name || "Anonymous"}</p>
            <p>Source: {source}</p>
            <p>Downloaded: {downloads} times</p>
            <p>
              Uploaded:{" "}
              {sub.attributes?.uploaded_at
                ? dayjs(sub.attributes.uploaded_at).fromNow()
                : "—"}
            </p>

            <div className="card-buttons">
              {(() => {
                const status = downloadStatus[sub.id || sub.download_url];

                if (status === "please-wait") {
                  return (
                    <button className="download-btn" disabled>
                      <FiClock style={{ marginRight: "6px" }} />
                      Please wait...
                    </button>
                  );
                }

                if (status === "downloading") {
                  return (
                    <button className="download-btn" disabled>
                      <FaSpinner
                        className="spinner-icon"
                        style={{ marginRight: "6px" }}
                      />
                      Downloading...
                    </button>
                  );
                }

                if (status === "failed-server") {
                  return (
                    <button className="download-btn failed" disabled>
                      <FiXCircle style={{ marginRight: "6px" }} />
                      Failed
                    </button>
                  );
                }

                if (status === "failed") {
                  return (
                    <button
                      className="download-btn retry"
                      onClick={() =>
                        setDownloadStatus((prev) => ({
                          ...prev,
                          [sub.id || sub.download_url]: null,
                        }))
                      }
                    >
                      <FiRefreshCw style={{ marginRight: "6px" }} />
                      Retry
                    </button>
                  );
                }

                if (status === "missing") {
                  return (
                    <button className="download-btn missing" disabled>
                      <FiAlertTriangle style={{ marginRight: "6px" }} />
                      Missing
                    </button>
                  );
                }

                if (status === "downloaded") {
                  return (
                    <button className="download-btn" disabled>
                      <FiCheckCircle style={{ marginRight: "6px" }} />
                      Downloaded
                    </button>
                  );
                }

                return (
                  <button
                    className="download-btn"
                    onClick={() => handleDownload(sub)}
                  >
                    <FiDownload style={{ marginRight: "6px" }} />
                    Download
                  </button>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ------------------------------------------------------------
   * Render table (desktop)
   * ------------------------------------------------------------ */
  const renderTable = (data, className = "", options = {}) => {
    const { hideUploaded = false } = options;

    return (
      <div className={`table-wrapper ${className}`}>
        <table className="subtitles-table">
          <thead>
            <tr>
              <th>Lang</th>
              <th>Release / Title</th>
              <th>Uploader</th>
              {!hideUploaded && <th>Uploaded</th>}
              <th>Source</th>
              <th>Downloads</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((sub) => {
              const attrs = sub.attributes || {};
              const title =
                attrs.feature_details?.title || attrs.release || "Untitled";
              const lang = attrs.language?.toUpperCase() || "EN";
              const downloads = attrs.download_count ?? "-";
              const source = sub.source || "OpenSubtitles";

              return (
                <tr
                  key={`${sub.id}-${sub.source}-${
                    sub.external_url || sub.file_id || Math.random()
                  }`}
                >
                  <td>{lang}</td>
                  <td>
                    {title}
                    <br />
                    <em>{attrs.release}</em>
                  </td>
                  <td>{attrs.uploader?.name || "Anonymous"}</td>
                  {!hideUploaded && (
                    <td>
                      {attrs.uploaded_at
                        ? dayjs(attrs.uploaded_at).fromNow()
                        : "—"}
                    </td>
                  )}
                  <td>{source}</td>
                  <td>{downloads}</td>
                  <td>
                    {(() => {
                      const status = downloadStatus[sub.id || sub.download_url];

                      if (status === "please-wait") {
                        return (
                          <button className="download-btn" disabled>
                            <FiClock style={{ marginRight: "6px" }} />
                            Please wait...
                          </button>
                        );
                      }

                      if (status === "downloading") {
                        return (
                          <button className="download-btn" disabled>
                            <FaSpinner
                              className="spinner-icon"
                              style={{ marginRight: "6px" }}
                            />
                            Downloading...
                          </button>
                        );
                      }

                      if (status === "failed-server") {
                        return (
                          <button className="download-btn failed" disabled>
                            <FiXCircle style={{ marginRight: "6px" }} />
                            Failed
                          </button>
                        );
                      }

                      if (status === "failed") {
                        return (
                          <button
                            className="download-btn retry"
                            onClick={() =>
                              setDownloadStatus((prev) => ({
                                ...prev,
                                [sub.id || sub.download_url]: null,
                              }))
                            }
                          >
                            <FiRefreshCw style={{ marginRight: "6px" }} />
                            Retry
                          </button>
                        );
                      }

                      if (status === "missing") {
                        return (
                          <button className="download-btn missing" disabled>
                            <FiAlertTriangle style={{ marginRight: "6px" }} />
                            Missing
                          </button>
                        );
                      }

                      if (status === "downloaded") {
                        return (
                          <button className="download-btn" disabled>
                            <FiCheckCircle style={{ marginRight: "6px" }} />
                            Downloaded
                          </button>
                        );
                      }

                      return (
                        <button
                          className="download-btn"
                          onClick={() => handleDownload(sub)}
                        >
                          <FiDownload style={{ marginRight: "6px" }} />
                          Download
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /* ------------------------------------------------------------
   * Root Render
   * ------------------------------------------------------------ */
  return (
    <div
      className="dashboard"
      onDrop={handleVideoDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <DashHeader />
      <header className="dashboard-header">
        <h1>
          <FiVideo style={{ marginRight: "6px" }} /> Subtitle Finder
        </h1>
        <div className="search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by movie or show title..."
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? (
              "Searching..."
            ) : (
              <>
                <FiSearch /> Search
              </>
            )}
          </button>
          <button onClick={triggerFileUpload}>
            <FiFolderPlus /> Upload Video
          </button>
          <button onClick={handleClear}>
            <FiXCircle /> Clear
          </button>
          <input
            id="video-upload-input"
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
        </div>
        <p className="drag-info">
          <FiUploadCloud /> Drag and drop a video file to detect subtitles
        </p>
      </header>
      <main className="dashboard-content">
        {/* 🔹 Show single rotating source message */}
        {loading && rotatingSource && (
          <div className="loading-sources">
            <div className="spinner">
              <svg className="loader-rotate" viewBox="0 0 50 50">
                <circle
                  className="loader-track"
                  cx="25"
                  cy="25"
                  r="20"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  className="loader-head"
                  cx="25"
                  cy="25"
                  r="20"
                  strokeWidth="5"
                  fill="none"
                />
              </svg>
            </div>
            <div className="loader-caption">
              Loading from {rotatingSource}...
            </div>
          </div>
        )}

        {/* 🔹 Show global loading status */}
        {loading ? (
          <div className="loading">
            <FiClock /> Fetching subtitles...
          </div>
        ) : error ? (
          <div className="error-message">
            <FiAlertCircle />{" "}
            {error.includes("timeout")
              ? "The request took too long. Please try again."
              : error}
          </div>
        ) : subtitles.length > 0 ? (
          isMobile ? (
            renderSubtitleCards(subtitles)
          ) : (
            renderTable(subtitles)
          )
        ) : !hasSearched ? (
          fallbackList.length > 0 ? (
            <section className="subtitle-section">
              <h2>
                <FiTrendingUp /> Popular & Recent Subtitles
              </h2>
              {isMobile
                ? renderSubtitleCards(fallbackList)
                : renderTable(fallbackList)}
            </section>
          ) : (
            <>
              <section className="subtitle-section">
                <h2>
                  <FiTrendingUp /> Most Downloaded Subtitles
                </h2>
                {isMobile
                  ? renderSubtitleCards(topRated)
                  : renderTable(topRated, "", {
                      hideView: true,
                      hideUploaded: false,
                    })}
              </section>
              <section className="subtitle-section">
                <h2>
                  <FiClock /> Latest Uploads
                </h2>
                {isMobile
                  ? renderSubtitleCards(latest)
                  : renderTable(latest, "no-scroll")}
              </section>
            </>
          )
        ) : (
          <div className="no-results">
            <FiAlertCircle /> No subtitles found for: <strong>{query}</strong>
          </div>
        )}
      </main>

      <DashFooter />
    </div>
  );
};

export default Dashboard;

