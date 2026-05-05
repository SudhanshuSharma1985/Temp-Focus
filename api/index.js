const path = require("path");
const fs = require("fs");

loadDotEnv();

const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (req.method === "POST" && pathname === "/api/login") {
    return handleLogin(req, res);
  }

  if (req.method === "POST" && pathname === "/api/coach") {
    return handleCoach(req, res);
  }

  return res.status(404).json({ ok: false, error: "Not found." });
};

function handleLogin(req, res) {
  readRequestBody(req)
    .then((body) => {
      const payload = body ? JSON.parse(body) : {};
      const { email } = payload;
      const normalizedEmail = String(email || "").trim().toLowerCase();

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ ok: false, error: "Enter a valid email ID." });
      }

      if (APP_LOGIN_EMAIL && normalizedEmail !== APP_LOGIN_EMAIL) {
        return res.status(401).json({ ok: false, error: "This email ID is not allowed." });
      }

      return res.status(200).json({ ok: true, email: normalizedEmail });
    })
    .catch((error) => {
      console.error("Login error:", error);
      return res.status(500).json({ ok: false, error: error.message || "Login failed." });
    });
}

function handleCoach(req, res) {
  readRequestBody(req)
    .then((body) => {
      const payload = body ? JSON.parse(body) : {};

      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ ok: false, error: "Missing coaching payload." });
      }

      try {
        const advice = localCoachAdvice(payload);
        return res.status(200).json({ ok: true, advice });
      } catch (error) {
        console.error("Coach error:", error);
        return res.status(200).json({ ok: true, advice: localCoachAdvice(payload), fallback: error.message });
      }
    })
    .catch((error) => {
      console.error("Coach request error:", error);
      return res.status(500).json({ ok: false, error: error.message || "Coaching failed." });
    });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", (error) => {
      reject(error);
    });

    setTimeout(() => {
      reject(new Error("Request timeout."));
    }, 10000);
  });
}

function localCoachAdvice(payload) {
  const stats = payload.stats || {};
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const threshold = Number(payload.threshold || 3);
  const lowBlocks = logs.filter((log) => Number(log.score) < 45);
  const bestBlocks = logs.filter((log) => Number(log.score) >= 75);
  const dayPriorities = Array.isArray(payload.dayPriorities) ? payload.dayPriorities : [];
  const suggestions = [];

  if (!logs.length) {
    suggestions.push("Log the last completed hour first. Honest data beats a perfect plan.");
    suggestions.push("Pick one priority and convert it into a 25-minute next action.");
  } else if (lowBlocks.length) {
    suggestions.push(`${lowBlocks[0].time || "One block"} was the leak. Identify the trigger and remove it before the next block.`);
    suggestions.push("Put the phone away, keep one work surface open, and define a single finish line.");
  } else {
    suggestions.push("You are not losing the day badly. Plan the next hour before it starts.");
  }

  if (Number(stats.wasteHours || 0) >= threshold) {
    suggestions.push("Do a reset block now: water, clear desk, one task, timer on.");
  }
  if (bestBlocks.length) {
    suggestions.push(`Repeat the conditions from ${bestBlocks[0].time || "your best block"} because that pattern already worked.`);
  }
  if (dayPriorities.length) {
    suggestions.push(`Attach the next block to "${dayPriorities[0]}" so the priority drives the calendar.`);
  }

  return {
    summary: Number(stats.utilization || 0) >= 70
      ? "Good momentum. Defend it with a precise next block."
      : "The day is still recoverable if the next hour is specific and protected.",
    suggestions: suggestions.slice(0, 4),
    nextBlock: { focus: dayPriorities[0] || "Pick one outcome.", duration: "25 min" }
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch (error) {
    console.log("No .env file found");
  }
}
