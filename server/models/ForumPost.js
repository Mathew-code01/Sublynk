// server/models/ForumPost.js
const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  username: { type: String, required: true }, // keep this
  content: String,
  createdAt: { type: Date, default: Date.now },
});

const forumPostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },

    content: { type: String, required: true, maxlength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    imageUrl: String, // optional
  },
  { timestamps: true }
);

module.exports = mongoose.model("ForumPost", forumPostSchema);

