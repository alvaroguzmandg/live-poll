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
  type: "poll",
  version: 1,
  question: "¿Qué opción preferís?",
  options: [
    { id: crypto.randomUUID(), text: "Opción A" },
    { id: crypto.randomUUID(), text: "Opción B" },
    { id: crypto.randomUUID(), text: "Opción C" }
  ],
  votes: {},
  words: {},
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
    type: poll.type || "poll",
    version: poll.version,
    question: poll.question,
    options: poll.type === "cloud" ? [] : poll.options,
    updatedAt: poll.updatedAt
  };
}

function pollResultsFor(sourcePoll) {
  if ((sourcePoll.type || "poll") === "cloud") {
    return cloudResultsFor(sourcePoll);
  }

  const counts = Object.fromEntries(sourcePoll.options.map((option) => [option.id, 0]));
  for (const optionId of Object.values(sourcePoll.votes || {})) {
    if (counts[optionId] !== undefined) {
      counts[optionId] += 1;
    }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    id: sourcePoll.id,
    type: "poll",
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

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function wordCount(value) {
  return normalizeWord(value).split(" ").filter(Boolean).length;
}

function cloudResultsFor(sourcePoll) {
  const counts = {};
  for (const word of Object.values(sourcePoll.words || {})) {
    counts[word] = (counts[word] || 0) + 1;
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(1, ...Object.values(counts));
  const results = Object.entries(counts)
    .map(([word, count]) => ({
      word,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
      weight: count / maxCount
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "es"));

  return {
    id: sourcePoll.id,
    type: "cloud",
    version: sourcePoll.version,
    question: sourcePoll.question,
    options: [],
    updatedAt: sourcePoll.updatedAt,
    total,
    results
  };
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

function isValidPollBackup(candidate) {
  return candidate
    && typeof candidate.question === "string"
    && typeof candidate.votes === "object";
}

function createNextActivity({ type, question, options }) {
  archiveCurrentPoll("replaced");

  poll = {
    id: poll.id,
    type,
    version: poll.version + 1,
    question,
    options: type === "poll" ? options.map((text) => ({ id: crypto.randomUUID(), text })) : [],
    votes: {},
    words: {},
    updatedAt: new Date().toISOString()
  };
  savePoll();
  return pollResults();
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/activity") {
    sendJson(res, 200, publicPoll());
    return;
  }

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

  if (req.method === "GET" && pathname === "/api/admin/backup") {
    sendJson(res, 200, {
      exportedAt: new Date().toISOString(),
      poll,
      history
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/vote") {
    const body = await readBody(req);
    const participantId = String(body.participantId || "").trim();
    const optionId = String(body.optionId || "").trim();
    const version = Number(body.version);

    if ((poll.type || "poll") !== "poll") {
      sendJson(res, 400, { error: "La actividad activa no es una encuesta." });
      return;
    }

    if (!participantId || version !== poll.version) {
      sendJson(res, 400, { error: "La encuesta cambió. Recargá y volvé a votar." });
      return;
    }

    if (poll.votes[participantId]) {
      sendJson(res, 400, { error: "Ya votaste en esta encuesta." });
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

  if (req.method === "POST" && pathname === "/api/word") {
    const body = await readBody(req);
    const participantId = String(body.participantId || "").trim();
    const submittedWord = normalizeWord(body.word);
    const version = Number(body.version);

    if ((poll.type || "poll") !== "cloud") {
      sendJson(res, 400, { error: "La actividad activa no es una nube de palabras." });
      return;
    }

    if (!participantId || version !== poll.version) {
      sendJson(res, 400, { error: "La consigna cambió. Recargá y volvé a responder." });
      return;
    }

    if (!submittedWord || submittedWord.length > 32 || wordCount(submittedWord) > 2) {
      sendJson(res, 400, { error: "Escribí una palabra o una frase de máximo 2 palabras." });
      return;
    }

    if (poll.words[participantId]) {
      sendJson(res, 400, { error: "Ya enviaste tu palabra en esta consigna." });
      return;
    }

    poll.words[participantId] = submittedWord;
    poll.updatedAt = new Date().toISOString();
    savePoll();
    sendJson(res, 200, { ok: true, word: submittedWord });
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

    sendJson(res, 200, createNextActivity({ type: "poll", question, options: optionTexts }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/activity") {
    const body = await readBody(req);
    const type = body.type === "cloud" ? "cloud" : "poll";
    const question = String(body.question || "").trim();
    const optionTexts = Array.isArray(body.options)
      ? body.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];

    if (question.length < 3) {
      sendJson(res, 400, { error: "La consigna necesita al menos 3 caracteres." });
      return;
    }

    if (type === "poll" && optionTexts.length < 2) {
      sendJson(res, 400, { error: "Cargá al menos 2 opciones." });
      return;
    }

    sendJson(res, 200, createNextActivity({ type, question, options: optionTexts }));
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/restore") {
    const body = await readBody(req);

    if (!isValidPollBackup(body.poll) || !Array.isArray(body.history)) {
      sendJson(res, 400, { error: "El backup no tiene un formato válido." });
      return;
    }

    poll = {
      id: body.poll.id || crypto.randomUUID(),
      type: body.poll.type === "cloud" ? "cloud" : "poll",
      version: Number(body.poll.version || 1),
      question: body.poll.question,
      options: Array.isArray(body.poll.options) ? body.poll.options : [],
      votes: body.poll.votes || {},
      words: body.poll.words || {},
      updatedAt: body.poll.updatedAt || new Date().toISOString()
    };
    history = body.history;
    savePoll();
    saveHistory();
    sendJson(res, 200, {
      restoredAt: new Date().toISOString(),
      results: pollResults(),
      history
    });
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
    if ((poll.type || "poll") === "cloud") {
      poll.words = {};
    } else {
      poll.votes = {};
    }
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
      : pathname === "/results" || pathname === "/encuesta-resultado"
        ? "results.html"
        : pathname === "/nube"
          ? "cloud.html"
          : pathname === "/nube-resultados"
            ? "cloud-results.html"
            : pathname === "/encuesta"
              ? "index.html"
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
