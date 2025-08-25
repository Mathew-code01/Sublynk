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
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error("deletePost error:", err);
    return false;
  }
}
