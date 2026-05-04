const fsSync = require("fs");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");

loadDotEnv();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const APP_LOGIN_EMAIL = String(process.env.APP_LOGIN_EMAIL || "").trim().toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".zip": "application/zip"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/coach") {
      await handleCoach(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return;
    }

    await serveStatic(url.pathname, req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Server error." });
  }
});

server.listen(PORT, () => {
  console.log(`TempoFocus running at http://localhost:${PORT}/`);
});

async function handleLogin(req, res) {
  const { email } = await readJson(req);
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    sendJson(res, 400, { ok: false, error: "Enter a valid email ID." });
    return;
  }

  if (APP_LOGIN_EMAIL && normalizedEmail !== APP_LOGIN_EMAIL) {
    sendJson(res, 401, { ok: false, error: "This email ID is not allowed." });
    return;
  }

  sendJson(res, 200, { ok: true, email: normalizedEmail });
}

async function handleCoach(req, res) {
  const payload = await readJson(req);

  if (!payload || typeof payload !== "object") {
    sendJson(res, 400, { ok: false, error: "Missing coaching payload." });
    return;
  }

  try {
    const advice = process.env.OPENAI_API_KEY
      ? await requestOpenAiCoach(payload)
      : localCoachAdvice(payload);
    sendJson(res, 200, { ok: true, advice });
  } catch (error) {
    sendJson(res, 200, { ok: true, advice: localCoachAdvice(payload), fallback: error.message });
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
    suggestions,
    nextBlock: "Write the one result you want by the end of the next hour, then log whether it happened."
  });
}

function normalizeCoachAdvice(advice) {
  return {
    summary: String(advice.summary || "Here is a tighter plan for the next block.").slice(0, 220),
    suggestions: (Array.isArray(advice.suggestions) ? advice.suggestions : [])
      .map((item) => String(item).slice(0, 220))
      .filter(Boolean)
      .slice(0, 4),
    nextBlock: String(advice.nextBlock || "Pick one small task, set a timer, and log the result.").slice(0, 260)
  };
}

function extractResponseText(response) {
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");
}

async function postJson(url, payload, headers = {}) {
  const target = new URL(url);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = require("https").request({
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        let parsed = {};
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          parsed = {};
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.error?.message || `HTTP ${response.statusCode}`));
        }
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error("Request body too large.");
  }
  return body ? JSON.parse(body) : {};
}

async function serveStatic(urlPath, req, res) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const decodedPath = decodeURIComponent(requested);
  const filePath = path.resolve(ROOT, `.${decodedPath}`);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { ok: false, error: "Forbidden." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const headers = {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    };

    if (filePath.includes(`${path.sep}downloads${path.sep}`)) {
      headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
    }

    res.writeHead(200, {
      ...headers,
      "Content-Length": file.length
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(file);
    }
  } catch {
    sendJson(res, 404, { ok: false, error: "Not found." });
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
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
