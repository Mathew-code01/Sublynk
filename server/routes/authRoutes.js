// server/routes/authRoutes.js
// server/routes/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const { signup, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/* Signup */
router.post(
  "/signup",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("name").optional().isLength({ min: 2 }).withMessage("Name too short"),
  ],
  signup
);

/* Login */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  login
);

/* Current user */
router.get("/me", protect, getMe);

module.exports = router;
