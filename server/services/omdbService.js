// server/services/omdbService.js
require("dotenv").config();
const axios = require("axios");

const OMDB_API_KEY = process.env.OMDB_API_KEY;
const BASE_URL = "https://www.omdbapi.com/";

// 📌 Get movie details by IMDb ID
exports.getMovieDetails = async (imdbID) => {
  if (!OMDB_API_KEY) {
    console.error("❌ OMDB_API_KEY missing in .env file");
    return null;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        i: imdbID,
        apikey: OMDB_API_KEY,
      },
    });

    if (response.data?.Response === "False") {
      console.warn("⚠️ OMDb returned no result:", response.data.Error);
      return null;
    }

    return response.data;
  } catch (err) {
    console.error("❌ Failed to fetch from OMDb:", err.message);
    return null;
  }
};

// ✅ Get movie details by title (used for searching)
exports.getMovieDetailsByTitle = async (title) => {
  if (!OMDB_API_KEY) {
    console.error("❌ OMDB_API_KEY missing in .env file");
    return null;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        t: title,
        apikey: OMDB_API_KEY,
      },
    });

    if (response.data?.Response === "False") {
      console.warn(
        "⚠️ OMDb returned no result for title:",
        response.data.Error
      );
      return null;
    }

    return response.data;
  } catch (err) {
    console.error("❌ OMDb search by title failed:", err.message);
    return null;
  }
};
