const path = require("path");
const fs = require("fs");

loadDotEnv();

const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.end();
  }

  try {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (req.method === "POST" && pathname === "/api/login") {
      return handleLogin(req, res);
    }

    if (req.method === "POST" && pathname === "/api/coach") {
      return handleCoach(req, res);
    }

    sendJson(res, 404, { ok: false, error: "Not found." });
  } catch (error) {
    console.error("Handler error:", error);
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

function handleLogin(req, res) {
  readRequestBody(req)
    .then((body) => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const { email } = payload;
        const normalizedEmail = String(email || "").trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
          return sendJson(res, 400, { ok: false, error: "Enter a valid email ID." });
        }

        if (APP_LOGIN_EMAIL && normalizedEmail !== APP_LOGIN_EMAIL) {
          return sendJson(res, 401, { ok: false, error: "This email ID is not allowed." });
        }

        sendJson(res, 200, { ok: true, email: normalizedEmail });
      } catch (err) {
        console.error("Login parse error:", err);
        sendJson(res, 500, { ok: false, error: "Parse error" });
      }
    })
    .catch((error) => {
      console.error("Login read error:", error);
      sendJson(res, 500, { ok: false, error: "Failed to read request" });
    });
}

function handleCoach(req, res) {
  readRequestBody(req)
    .then((body) => {
      try {
        const payload = body ? JSON.parse(body) : {};

        if (!payload || typeof payload !== "object") {
          return sendJson(res, 400, { ok: false, error: "Missing payload" });
        }

        const advice = localCoachAdvice(payload);
        sendJson(res, 200, { ok: true, advice });
      } catch (err) {
        console.error("Coach error:", err);
        sendJson(res, 500, { ok: false, error: "Coach failed" });
      }
    })
    .catch((error) => {
      console.error("Coach read error:", error);
      sendJson(res, 500, { ok: false, error: "Failed to read request" });
    });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    const timeout = setTimeout(() => {
      reject(new Error("Timeout reading body"));
    }, 5000);

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1048576) {
        clearTimeout(timeout);
        reject(new Error("Body too large"));
      }
    });

    req.on("end", () => {
      clearTimeout(timeout);
      resolve(body);
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function localCoachAdvice(payload) {
  const stats = payload.stats || {};
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const dayPriorities = Array.isArray(payload.dayPriorities) ? payload.dayPriorities : [];

  const suggestions = [
    "Log the last completed hour. Honest data beats a perfect plan.",
    "Define next block with one clear outcome.",
    "Put phone away and commit to timer.",
    "Review what worked and repeat it."
  ];

  return {
    summary: Number(stats.utilization || 0) >= 70
      ? "Good momentum. Defend it with a precise next block."
      : "Day is recoverable. Make the next hour specific.",
    suggestions: suggestions.slice(0, 3),
    nextBlock: { focus: dayPriorities[0] || "Pick one outcome.", duration: "25 min" }
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const sep = trimmed.indexOf("=");
      if (sep === -1) return;
      const key = trimmed.slice(0, sep).trim();
      const val = trimmed.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = val;
    });
  } catch (err) {
    console.log("No .env loaded");
  }
}
