const formEl = document.querySelector("#poll-form");
const questionInput = document.querySelector("#question-input");
const optionInputs = document.querySelector("#option-inputs");
const addOptionButton = document.querySelector("#add-option");
const resetVotesButton = document.querySelector("#reset-votes");
const adminStatus = document.querySelector("#admin-status");
const resultsQuestion = document.querySelector("#results-question");
const resultsList = document.querySelector("#results-list");
const totalVotes = document.querySelector("#total-votes");
const voteLink = document.querySelector("#vote-link");
const copyLinkButton = document.querySelector("#copy-link");
const qrCode = document.querySelector("#qr-code");
const historyList = document.querySelector("#history-list");
const refreshHistoryButton = document.querySelector("#refresh-history");

let lastVersion = null;
let adminKey = new URLSearchParams(window.location.search).get("key") || sessionStorage.getItem("live-poll-admin-key") || "";

if (adminKey) {
  sessionStorage.setItem("live-poll-admin-key", adminKey);
}

function setStatus(message) {
  adminStatus.textContent = message || "";
}

function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(adminKey ? { "X-Admin-Key": adminKey } : {})
    }
  });
}

function currentVoteUrl() {
  return `${window.location.origin}/`;
}

function updateShareTools() {
  const url = currentVoteUrl();
  voteLink.value = url;
  qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
}

function addOptionInput(value = "") {
  const row = document.createElement("div");
  row.className = "option-input-row";

  const input = document.createElement("input");
  input.required = true;
  input.value = value;
  input.placeholder = "Texto de la opción";

  const remove = document.createElement("button");
  remove.className = "remove-option";
  remove.type = "button";
  remove.textContent = "Borrar";
  remove.addEventListener("click", () => {
    if (optionInputs.children.length > 2) {
      row.remove();
    }
  });

  row.append(input, remove);
  optionInputs.appendChild(row);
}

function syncEditor(data) {
  if (lastVersion === data.version) return;

  lastVersion = data.version;
  questionInput.value = data.question;
  optionInputs.innerHTML = "";
  data.options.forEach((option) => addOptionInput(option.text));
}

function renderResults(data) {
  resultsQuestion.textContent = data.question;
  totalVotes.textContent = `${data.total} ${data.total === 1 ? "voto" : "votos"}`;
  resultsList.innerHTML = "";

  data.results.forEach((option) => {
    const voteLabel = option.votes === 1 ? "voto" : "votos";
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <div class="result-meta">
        <strong></strong>
        <span>${option.votes} ${voteLabel} · ${option.percent}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${option.percent}%"></div>
      </div>
    `;
    row.querySelector("strong").textContent = option.text;
    resultsList.appendChild(row);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderHistory(items) {
  historyList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Todavía no hay encuestas archivadas.";
    historyList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-card-header">
        <div>
          <h3></h3>
          <p></p>
        </div>
        <button type="button" class="remove-option">Eliminar encuesta</button>
      </div>
      <div class="history-results"></div>
    `;

    card.querySelector("h3").textContent = item.question;
    card.querySelector("p").textContent = `${item.total} ${item.total === 1 ? "voto" : "votos"} · ${formatDate(item.archivedAt)}`;
    const results = card.querySelector(".history-results");

    item.results.forEach((option) => {
      const voteLabel = option.votes === 1 ? "voto" : "votos";
      const row = document.createElement("div");
      row.className = "history-result-row";
      row.innerHTML = `
        <div class="result-meta">
          <strong></strong>
          <span>${option.votes} ${voteLabel} · ${option.percent}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${option.percent}%"></div>
        </div>
      `;
      row.querySelector("strong").textContent = option.text;
      results.appendChild(row);
    });

    card.querySelector("button").addEventListener("click", () => deleteHistoryItem(item.archiveId));
    historyList.appendChild(card);
  });
}

async function loadResults({ sync = false } = {}) {
  const response = await fetch("/api/results");
  const data = await response.json();
  if (sync) syncEditor(data);
  renderResults(data);
}

async function loadHistory() {
  const response = await adminFetch("/api/admin/history");
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "No se pudo cargar el registro.");
    return;
  }

  renderHistory(data);
}

async function savePoll(event) {
  event.preventDefault();
  setStatus("Publicando...");

  const options = [...optionInputs.querySelectorAll("input")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  const response = await adminFetch("/api/admin/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: questionInput.value.trim(),
      options
    })
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "No se pudo publicar.");
    return;
  }

  lastVersion = data.version;
  renderResults(data);
  await loadHistory();
  setStatus("Encuesta publicada. El link y el QR siguen siendo los mismos.");
}

async function resetVotes() {
  setStatus("Limpiando votos...");
  const response = await adminFetch("/api/admin/reset", { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "No se pudieron limpiar los votos.");
    return;
  }

  renderResults(data);
  setStatus("Votos limpiados.");
}

async function deleteHistoryItem(archiveId) {
  setStatus("Eliminando encuesta archivada...");
  const response = await adminFetch(`/api/admin/history/${encodeURIComponent(archiveId)}`, {
    method: "DELETE"
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo eliminar la encuesta.");
    return;
  }

  renderHistory(data);
  setStatus("Encuesta eliminada del registro.");
}

addOptionButton.addEventListener("click", () => addOptionInput());
formEl.addEventListener("submit", savePoll);
resetVotesButton.addEventListener("click", resetVotes);
refreshHistoryButton.addEventListener("click", loadHistory);
copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(voteLink.value);
  setStatus("Link copiado.");
});

updateShareTools();
loadResults({ sync: true }).catch(() => setStatus("No se pudo cargar la encuesta."));
loadHistory().catch(() => setStatus("No se pudo cargar el registro."));
setInterval(() => loadResults().catch(() => {}), 1500);
