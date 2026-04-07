const axios = require("axios");

const http = axios.create({
  timeout: Number(process.env.TOPANIMES_TIMEOUT_MS || 15000),
  headers: {
    "User-Agent": process.env.TOPANIMES_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9"
  },
  validateStatus: (status) => status >= 200 && status < 400
});

module.exports = http;