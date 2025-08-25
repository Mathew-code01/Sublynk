// server/routes/forumRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getPosts,
  createPost,
  deletePost,
  toggleLike,
  addComment,
} = require("../controllers/forumController");

router.get("/", getPosts);
router.post("/", protect, createPost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);
router.post("/:id/comment", protect, addComment);

module.exports = router;

