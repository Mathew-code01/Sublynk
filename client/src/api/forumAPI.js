// client/src/api/forumAPI.js
// client/src/api/forumAPI.js
import { getAuthToken } from "./authToken";
import { API_BASE_URL } from "../api/config";

const BASE = `${API_BASE_URL}/api/forum`;

/**
 * Fetch all forum posts
 * @returns {Promise<Array>} - Array of forum posts
 */
export async function fetchPosts() {
  try {
    const res = await fetch(BASE, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("fetchPosts error:", err);
    return [];
  }
}

/**
 * Create a new forum post
 * @param {string} content - The post content
 * @param {string} username - Author username
 * @param {string} avatar - Author avatar URL
 * @returns {Promise<object|null>} - Created post data or null if failed
 */
export async function createPost(content, username, avatar) {
  if (!content.trim()) return null;

  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ content, username, avatar }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("createPost error:", err);
    return null;
  }
}

/**
 * Delete a forum post by ID
 * @param {string} id - Post ID
 * @returns {Promise<boolean>} - Whether delete succeeded
 */
export async function deletePost(id) {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return res.ok; // ✅ simpler check
  } catch (err) {
    console.error("deletePost error:", err);
    return false;
  }
}

/**
 * Toggle like on a post
 * @param {string} id - Post ID
 * @returns {Promise<object|null>} - Updated post
 */
export async function toggleLike(id) {
  try {
    const res = await fetch(`${BASE}/${id}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return await res.json();
  } catch (err) {
    console.error("toggleLike error:", err);
    return null;
  }
}

/**
 * Add a comment to a post
 * @param {string} id - Post ID
 * @param {string} content - Comment text
 * @returns {Promise<object|null>} - Updated post
 */
export async function addComment(id, content) {
  if (!content.trim()) return null;

  try {
    const res = await fetch(`${BASE}/${id}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ content }),
    });
    return await res.json();
  } catch (err) {
    console.error("addComment error:", err);
    return null;
  }
}
