// server/index.js
// server/index.js
// server/index.js
// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

// Routes
const subtitleRoutes = require("./routes/subtitleRoutes");
const authRoutes = require("./routes/authRoutes");
const forumRoutes = require("./routes/forumRoutes");
const podnapisiRoutes = require("./routes/podnapisi");
const addic7edRoutes = require("./routes/addic7ed");
const subdbRoutes = require("./routes/subdb");
const bsplayerRoutes = require("./routes/bsplayer");
const tvSubtitlesRoutes = require("./routes/TVSubtitles");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });


  // Global if needed
  global.io = io;

  // Middleware
  app.use(cors());
  app.use(express.json()); // Handles JSON request bodies
  app.use(express.urlencoded({ extended: true })); // ✅ Handles form-urlencoded bodies
  app.use(compression());
  app.use(morgan("dev"));

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/subtitles", subtitleRoutes);
  app.use("/api/forum", forumRoutes);
  app.use("/api/podnapisi", podnapisiRoutes);
  app.use("/api/addic7ed", addic7edRoutes);
  app.use("/api/subdb", subdbRoutes);
  app.use("/api/bsplayer", bsplayerRoutes);
  app.use("/api/yify", require("./routes/yify"));
  app.use("/api/tvsubtitles", tvSubtitlesRoutes);

  // Health check
  app.get("/health", (req, res) =>
    res.json({ status: "ok", uptime: process.uptime() })
  );

  // Static subtitle cache
  const subtitlesCacheDir = path.join(__dirname, "cache/subtitles");
  fs.mkdirSync(subtitlesCacheDir, { recursive: true });
  app.use("/cache/subtitles", express.static(subtitlesCacheDir));

  // Socket.IO listeners
  io.on("connection", (socket) => {
    console.log("🟢 User connected");

    socket.on("newPost", (post) => {
      socket.broadcast.emit("newPost", post);
    });

    socket.on("deletePost", (id) => {
      socket.broadcast.emit("deletePost", id);
    });

    socket.on("disconnect", () => {
      console.log("🔴 User disconnected");
    });
  });

  // Start server
  server.listen(PORT, () =>
    console.log(`🚀 Sublynk API running on port ${PORT}`)
  );

  handleShutdown(server);
}

function handleShutdown(server) {
  ["SIGINT", "SIGTERM"].forEach((sig) => {
    process.on(sig, () => shutdown(sig, server));
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    shutdown("uncaughtException", server, 1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    shutdown("unhandledRejection", server, 1);
  });
}

function shutdown(signal, server, code = 0) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  server.close(() => {
    console.log("HTTP server closed.");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed.");
      process.exit(code);
    });
  });
}

start();
