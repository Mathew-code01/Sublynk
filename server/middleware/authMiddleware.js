// server/middleware/authMiddleware.js
// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/authConfig");
const User = require("../models/User");

async function protect(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No token. Authorization denied." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("❌ protect middleware:", err.message);
    return res.status(401).json({ message: "Invalid token." });
  }
}

module.exports = { protect };
