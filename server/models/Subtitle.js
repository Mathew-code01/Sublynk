// server/models/Subtitle.js
const mongoose = require("mongoose");

const subtitleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // actual filename on disk
    path: { type: String, required: true },
    size: { type: Number, required: true },
    ext: { type: String, required: true },
    language: { type: String }, // optional user-selected or parsed
    title: { type: String }, // movie / show title parsed from filename or provided
    tags: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subtitle", subtitleSchema);
