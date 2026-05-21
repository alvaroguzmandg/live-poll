const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "poll-state.json");
const HISTORY_FILE = path.join(DATA_DIR, "poll-history.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultPoll = {
  id: crypto.randomUUID(),
  version: 1,
  question: "¿Qué opción preferís?",
  options: [
    { id: crypto.randomUUID(), text: "Opción A" },
    { id: crypto.randomUUID(), text: "Opción B" },
    { id: crypto.randomUUID(), text: "Opción C" }
  ],
  votes: {},
  updatedAt: new Date().toISOString()
};

let poll = loadPoll();
let history = loadHistory();

function loadPoll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.question && Array.isArray(parsed.options)) {
      return parsed;
    }
  } catch {
    // First run: create the initial poll state below.
  }

  savePoll(defaultPoll);
  return defaultPoll;
}

function savePoll(nextPoll = poll) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextPoll, null, 2));
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // First run: no archived polls yet.
  }

  saveHistory([]);
  return [];
}

function saveHistory(nextHistory = history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(nextHistory, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function isAdminAuthorized(req) {
  return !ADMIN_KEY || req.headers["x-admin-key"] === ADMIN_KEY;
}

function publicPoll() {
  return {
    id: poll.id,
    version: poll.version,
    question: poll.question,
    options: poll.options,
    updatedAt: poll.updatedAt
  };
}

function pollResultsFor(sourcePoll) {
  const counts = Object.fromEntries(sourcePoll.options.map((option) => [option.id, 0]));
  for (const optionId of Object.values(sourcePoll.votes || {})) {
    if (counts[optionId] !== undefined) {
      counts[optionId] += 1;
    }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    id: sourcePoll.id,
    version: sourcePoll.version,
    question: sourcePoll.question,
    options: sourcePoll.options,
    updatedAt: sourcePoll.updatedAt,
    total,
    results: sourcePoll.options.map((option) => ({
      ...option,
      votes: counts[option.id] || 0,
      percent: total ? Math.round(((counts[option.id] || 0) / total) * 100) : 0
    }))
  };
}

function pollResults() {
  return pollResultsFor(poll);
}

function archiveCurrentPoll(reason = "replaced") {
  const snapshot = {
    archiveId: crypto.randomUUID(),
    archivedAt: new Date().toISOString(),
    reason,
    ...pollResultsFor(poll)
  };

  history = [snapshot, ...history];
  saveHistory();
  return snapshot;
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/poll") {
    sendJson(res, 200, publicPoll());
    return;
  }

  if (req.method === "GET" && pathname === "/api/results") {
    sendJson(res, 200, pollResults());
    return;
  }

  if (pathname.startsWith("/api/admin/") && !isAdminAuthorized(req)) {
    sendJson(res, 401, { error: "Clave de admin inválida o faltante." });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/history") {
    sendJson(res, 200, history);
    return;
  }

  if (req.method === "POST" && pathname === "/api/vote") {
    const body = await readBody(req);
    const participantId = String(body.participantId || "").trim();
    const optionId = String(body.optionId || "").trim();
    const version = Number(body.version);

    if (!participantId || version !== poll.version) {
      sendJson(res, 400, { error: "La encuesta cambió. Recargá y volvé a votar." });
      return;
    }

    if (!poll.options.some((option) => option.id === optionId)) {
      sendJson(res, 400, { error: "Esa opción no existe." });
      return;
    }

    poll.votes[participantId] = optionId;
    poll.updatedAt = new Date().toISOString();
    savePoll();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/poll") {
    const body = await readBody(req);
    const question = String(body.question || "").trim();
    const optionTexts = Array.isArray(body.options)
      ? body.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];

    if (question.length < 3) {
      sendJson(res, 400, { error: "La pregunta necesita al menos 3 caracteres." });
      return;
    }

    if (optionTexts.length < 2) {
      sendJson(res, 400, { error: "Cargá al menos 2 opciones." });
      return;
    }

    archiveCurrentPoll("replaced");

    poll = {
      id: poll.id,
      version: poll.version + 1,
      question,
      options: optionTexts.map((text) => ({ id: crypto.randomUUID(), text })),
      votes: {},
      updatedAt: new Date().toISOString()
    };
    savePoll();
    sendJson(res, 200, pollResults());
    return;
  }

  const historyDeleteMatch = pathname.match(/^\/api\/admin\/history\/([^/]+)$/);
  if (req.method === "DELETE" && historyDeleteMatch) {
    const archiveId = decodeURIComponent(historyDeleteMatch[1]);
    const originalLength = history.length;
    history = history.filter((item) => item.archiveId !== archiveId);

    if (history.length === originalLength) {
      sendJson(res, 404, { error: "No se encontró esa encuesta archivada." });
      return;
    }

    saveHistory();
    sendJson(res, 200, history);
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/reset") {
    poll.votes = {};
    poll.updatedAt = new Date().toISOString();
    savePoll();
    sendJson(res, 200, pollResults());
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, pathname) {
  const routeFile =
    pathname === "/admin"
      ? "admin.html"
      : pathname === "/results"
        ? "results.html"
        : pathname === "/"
          ? "index.html"
          : pathname.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, routeFile));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Error interno" });
  }
});

server.listen(PORT, () => {
  console.log(`Encuesta lista en http://localhost:${PORT}`);
  console.log(`Admin listo en http://localhost:${PORT}/admin`);
});
