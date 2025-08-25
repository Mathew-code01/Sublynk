// client/src/api/authToken.js
// client/src/api/authToken.js
export function getAuthToken() {
  try {
    const saved = localStorage.getItem("sublynk_auth");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed.token || null;
  } catch {
    return null;
  }
}

export function getUsername() {
  return localStorage.getItem("username"); // or whatever key you use
}
