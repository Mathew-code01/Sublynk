// server/models/SubtitleCache.js
// server/models/SubtitleCache.js
const mongoose = require("mongoose");

const subtitleItemSchema = new mongoose.Schema({
  title: String,
  url: String,
  language: String,
  downloads: Number,
  uploadedAt: Date // or fetchedAt if you're scraping
}, { _id: false });

const subtitleCacheSchema = new mongoose.Schema({
  type: { type: String, unique: true }, // e.g., 'latest', 'most-downloaded'
  data: [subtitleItemSchema],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SubtitleCache", subtitleCacheSchema);
