// server/controllers/requestController.js
// server/controllers/requestController.js
const Request = require("../models/Request"); // We'll create this model

// Create a new subtitle request
async function createRequest(req, res) {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: "Title is required" });
    }

    const newRequest = await Request.create({
      title,
      status: "Pending",
      user: req.user ? req.user._id : null,
    });

    res.status(201).json({ success: true, data: newRequest });
  } catch (err) {
    console.error("createRequest error:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// Fetch all requests
async function getRequests(req, res) {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error("getRequests error:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

// Update request status (Admin feature)
async function updateRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const request = await Request.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!request) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: request });
  } catch (err) {
    console.error("updateRequestStatus error:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
}

module.exports = { createRequest, getRequests, updateRequestStatus };

