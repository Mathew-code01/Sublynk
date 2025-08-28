// server/controllers/authController.js
// server/controllers/authController.js
// server/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { jwtSecret, jwtExpire } = require("../config/authConfig");
const User = require("../models/User");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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

// server/controllers/authController.js
// server/controllers/authController.js
async function forgotPassword(req, res) {
  const email = (req.body.email || "").trim().toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Security: same message even if no user
      return res.json({
        message: "If that email exists, a reset link was sent.",
      });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Save hashed token & expiry (1h)
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Reset link (frontend route)
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Brand colors (from variables.css)
    const brandAccent = "#FF4C8B";
    const brandAccentHover = "#e0437a";
    const brandAccentActive = "#c83768";
    const brandBase = "#0F172A";

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background: #ffffff;">
        <h2 style="text-align: center; color: ${brandAccent};">🔑 Sublynk Password Reset</h2>
        <p>Hi <strong>${user.username || "there"}</strong>,</p>
        <p>We received a request to reset your <strong>Sublynk</strong> account password.</p>
        <p>You can reset it by clicking the button below. This link is valid for <strong>1 hour</strong>:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetURL}" 
             style="background: ${brandAccent}; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #555;">${resetURL}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 14px; color: #777;">
          If you did not request this, you can safely ignore this email.  
          Your password will remain unchanged.
        </p>
        <p style="font-size: 14px; color: #777; text-align: center;">
          — The Sublynk Team
        </p>
      </div>
    `;

    await transporter.sendMail({
      to: user.email,
      from: `"Sublynk Support" <${process.env.EMAIL_USER}>`,
      subject: "🔑 Reset Your Sublynk Password",
      text: `Hi ${
        user.username || "there"
      },\n\nReset your password using this link (valid for 1 hour):\n${resetURL}\n\nIf you didn’t request this, ignore this email.\n\n— The Sublynk Team`,
      html: htmlMessage,
    });

    return res.json({
      message: "If that email exists, a reset link was sent.",
    });
  } catch (err) {
    console.error("❌ forgotPassword:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("❌ resetPassword:", err);
    return res.status(500).json({ message: "Server error" });
  }
}


module.exports = { signup, login, getMe, forgotPassword, resetPassword };


