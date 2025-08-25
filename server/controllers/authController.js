// server/controllers/authController.js
// server/controllers/authController.js
// server/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { jwtSecret, jwtExpire } = require("../config/authConfig");
const User = require("../models/User");

// --- utils ---
const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const signToken = (userId) => jwt.sign({ id: userId }, jwtSecret, { expiresIn: jwtExpire });


// --- controllers ---

/* POST /api/auth/signup */
// server/controllers/authController.js
async function signup(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: "Validation failed", errors: errors.array() });
  }

  const email = normalizeEmail(req.body.email);
  const { username, password } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: "Username already taken." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: username.trim(),
      email,
      passwordHash,
    });

    const token = signToken(user._id);
    return res.status(201).json({ token, user: buildUserPayload(user) });
  } catch (err) {
    console.error("❌ signup:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// also update buildUserPayload:
const buildUserPayload = (u) => ({
  id: u._id,
  username: u.username,
  email: u.email,
});


/* POST /api/auth/login */
async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: "Validation failed", errors: errors.array() });
  }

  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: "Invalid credentials." });

    const token = signToken(user._id);
    return res.json({ token, user: buildUserPayload(user) });
  } catch (err) {
    console.error("❌ login:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

/* GET /api/auth/me (protected) */
async function getMe(req, res) {
  // req.user injected by protect middleware (already stripped)
  if (!req.user) return res.status(401).json({ message: "Not authenticated." });
  return res.json(buildUserPayload(req.user));
}

module.exports = { signup, login, getMe };
