const path = require("path");

// Load environment variables
loadDotEnv();

const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

module.exports = async (req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (req.method === "POST" && pathname === "/api/login") {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      await handleLogin(payload, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/coach") {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      await handleCoach(payload, res);
      return;
    }

    res.status(404).json({ ok: false, error: "Not found." });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ ok: false, error: error.message || "Server error." });
  }
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleLogin(payload, res) {
  try {
    const { email } = payload;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ ok: false, error: "Enter a valid email ID." });
      return;
    }

    if (APP_LOGIN_EMAIL && normalizedEmail !== APP_LOGIN_EMAIL) {
      res.status(401).json({ ok: false, error: "This email ID is not allowed." });
      return;
    }

    res.status(200).json({ ok: true, email: normalizedEmail });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ ok: false, error: "Login failed." });
  }
}

async function handleCoach(payload, res) {
  try {
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ ok: false, error: "Missing coaching payload." });
      return;
    }

    try {
      const advice = process.env.OPENAI_API_KEY
        ? await requestOpenAiCoach(payload)
        : localCoachAdvice(payload);
      res.status(200).json({ ok: true, advice });
    } catch (error) {
      res.status(200).json({ ok: true, advice: localCoachAdvice(payload), fallback: error.message });
    }
  } catch (error) {
    console.error("Coach Error:", error);
    res.status(500).json({ ok: false, error: "Coaching failed." });
  }
}

async function requestOpenAiCoach(payload) {
  const input = {
    date: payload.date,
    stats: payload.stats,
    dayPriorities: payload.dayPriorities || [],
    weekPriorities: payload.weekPriorities || [],
    logs: (payload.logs || []).slice(0, 24)
  };

  const response = await postJson("https://api.openai.com/v1/responses", {
    model: OPENAI_MODEL,
    instructions: [
      "You are a direct but kind time-management coach.",
      "Analyze the user's day log and return practical advice.",
      "Do not shame the user. Be concrete about what they should do next.",
      "Return only compact JSON with keys: summary, suggestions, nextBlock.",
      "suggestions must be an array of 3 to 4 short strings."
    ].join(" "),
    input: JSON.stringify(input)
  }, {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  });

  const text = response.output_text || extractResponseText(response);
  return normalizeCoachAdvice(JSON.parse(text));
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

  return normalizeCoachAdvice({
    summary: Number(stats.utilization || 0) >= 70
      ? "Good momentum. Defend it with a precise next block."
      : "The day is still recoverable if the next hour is specific and protected.",
    suggestions: suggestions.slice(0, 4),
    nextBlock: { focus: dayPriorities[0] || "Pick one outcome.", duration: "25 min" }
  });
}

function normalizeCoachAdvice(data) {
  return {
    summary: String(data.summary || ""),
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [],
    nextBlock: data.nextBlock || { focus: "", duration: "" }
  };
}

function extractResponseText(response) {
  if (typeof response === "string") return response;
  if (response.text) return response.text;
  if (response.output_text) return response.output_text;
  return JSON.stringify(response);
}

async function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const https = require("https");
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };

    const request = https.request(url, options, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        try {
          let parsed = JSON.parse(responseBody);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${response.statusCode}`));
          }
        } catch {
          reject(new Error(`Invalid JSON response from API`));
        }
      });
    });

    request.on("error", reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadDotEnv() {
  const fsSync = require("fs");
  const envPath = path.join(__dirname, "..", ".env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
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
}
