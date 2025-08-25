// server/config/authConfig.js
// server/config/authConfig.js
module.exports = {
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
    jwtExpire: process.env.JWT_EXPIRES_IN || "7d",
  };
  
  