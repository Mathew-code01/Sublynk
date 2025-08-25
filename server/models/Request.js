// server/models/Request.js
const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true }, // movie/show name
    notes: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Subtitle" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);
