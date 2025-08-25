// client/src/api/uploadAPI.js
import { getAuthToken } from "./authToken";

import { API_BASE_URL } from "./config";

const BASE = `${API_BASE_URL}/api/subtitles`;

/**
 * Fetch all recent uploads for the logged-in user
 */
export async function fetchRecentUploads() {
  try {
    const res = await fetch(`${BASE}/uploads`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.error("fetchRecentUploads error:", err);
    return [];
  }
}

/**
 * Upload a subtitle file to the server
 * @param {File} file - The subtitle file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<boolean>} - Whether upload succeeded
 */
export function uploadSubtitle(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) return reject("No file provided");

    const formData = new FormData();
    formData.append("subtitle", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/upload`);

    const token = getAuthToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        resolve(true);
      } else {
        console.error("Upload failed:", xhr.responseText);
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed due to network error"));

    xhr.send(formData);
  });
}
