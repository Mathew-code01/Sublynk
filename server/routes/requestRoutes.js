// server/routes/requestRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  createRequest,
  getRequests,
  updateRequestStatus,
} = require("../controllers/requestController");

router.post("/", auth, createRequest);
router.get("/", getRequests);
router.patch("/:id", auth, updateRequestStatus); // optional

module.exports = router;
