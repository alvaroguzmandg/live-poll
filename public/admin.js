const formEl = document.querySelector("#poll-form");
const activityTitleInput = document.querySelector("#activity-title");
const activityTypeInput = document.querySelector("#activity-type");
const questionInput = document.querySelector("#question-input");
const pollOptionsEditor = document.querySelector("#poll-options-editor");
const optionInputs = document.querySelector("#option-inputs");
const addOptionButton = document.querySelector("#add-option");
const saveActivityButton = document.querySelector("#save-activity");
const resetVotesButton = document.querySelector("#reset-votes");
const adminStatus = document.querySelector("#admin-status");
const resultsQuestion = document.querySelector("#results-question");
const resultsList = document.querySelector("#results-list");
const totalVotes = document.querySelector("#total-votes");
const voteLink = document.querySelector("#vote-link");
const copyLinkButton = document.querySelector("#copy-link");
const qrCode = document.querySelector("#qr-code");
const resultsLink = document.querySelector("#results-link");
const historyList = document.querySelector("#history-list");
const pollActivitiesList = document.querySelector("#poll-activities-list");
const cloudActivitiesList = document.querySelector("#cloud-activities-list");
const newPollButton = document.querySelector("#new-poll");
const newCloudButton = document.querySelector("#new-cloud");
const refreshHistoryButton = document.querySelector("#refresh-history");
const downloadBackupButton = document.querySelector("#download-backup");
const restoreBrowserBackupButton = document.querySelector("#restore-browser-backup");
const backupStatus = document.querySelector("#backup-status");

let lastVersion = null;
let editorActivityType = "poll";
let activeActivityType = "poll";
let selectedActivityId = null;
let savedActivities = [];
let adminKey = new URLSearchParams(window.location.search).get("key") || sessionStorage.getItem("live-poll-admin-key") || "";
const browserBackupKey = "live-poll-admin-backup";

if (adminKey) {
  sessionStorage.setItem("live-poll-admin-key", adminKey);
}

function setStatus(message) {
  adminStatus.textContent = message || "";
}

function setBackupStatus(message) {
  backupStatus.textContent = message || "";
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
  return `${window.location.origin}/${editorActivityType === "cloud" ? "nube" : "encuesta"}`;
}

function currentResultsUrl() {
  return `${window.location.origin}/${editorActivityType === "cloud" ? "nube-resultados" : "encuesta-resultado"}`;
}

function updateShareTools() {
  const url = currentVoteUrl();
  voteLink.value = url;
  qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  resultsLink.href = currentResultsUrl();
}

function syncActivityControls() {
  editorActivityType = activityTypeInput.value;
  pollOptionsEditor.hidden = editorActivityType === "cloud";
  updateShareTools();
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

function editorPayload() {
  return {
    type: activityTypeInput.value,
    title: activityTitleInput.value.trim() || questionInput.value.trim(),
    question: questionInput.value.trim(),
    options: [...optionInputs.querySelectorAll("input")]
      .map((input) => input.value.trim())
      .filter(Boolean)
  };
}

function clearEditor(type = "poll") {
  selectedActivityId = null;
  activityTitleInput.value = "";
  activityTypeInput.value = type;
  questionInput.value = "";
  optionInputs.innerHTML = "";
  if (type === "poll") {
    addOptionInput();
    addOptionInput();
  }
  syncActivityControls();
  setStatus(type === "cloud" ? "Nueva nube lista para cargar." : "Nueva encuesta lista para cargar.");
}

function loadActivityIntoEditor(activity) {
  selectedActivityId = activity.id;
  activityTitleInput.value = activity.title || "";
  activityTypeInput.value = activity.type || "poll";
  questionInput.value = activity.question || "";
  optionInputs.innerHTML = "";
  (activity.options || []).forEach((option) => addOptionInput(option));
  if (activity.type !== "cloud" && optionInputs.children.length < 2) {
    addOptionInput();
    addOptionInput();
  }
  syncActivityControls();
  setStatus(`Editando: ${activity.title}`);
}

function syncEditor(data) {
  if (lastVersion === data.version) return;

  lastVersion = data.version;
  editorActivityType = data.type || "poll";
  activeActivityType = editorActivityType;
  activityTypeInput.value = editorActivityType;
  syncActivityControls();
  activityTitleInput.value = data.title || data.question;
  questionInput.value = data.question;
  optionInputs.innerHTML = "";
  (data.options || []).forEach((option) => addOptionInput(option.text));
  if (editorActivityType === "poll" && optionInputs.children.length < 2) {
    addOptionInput();
    addOptionInput();
  }
}

function renderActivitiesLibrary(data) {
  savedActivities = data.activities || [];
  pollActivitiesList.innerHTML = "";
  cloudActivitiesList.innerHTML = "";

  if (!savedActivities.length) {
    renderLibraryEmpty(pollActivitiesList, "Todavía no hay encuestas guardadas.");
    renderLibraryEmpty(cloudActivitiesList, "Todavía no hay nubes guardadas.");
    return;
  }

  const polls = savedActivities.filter((activity) => activity.type !== "cloud");
  const clouds = savedActivities.filter((activity) => activity.type === "cloud");
  renderActivityGroup(pollActivitiesList, polls, "Todavía no hay encuestas guardadas.");
  renderActivityGroup(cloudActivitiesList, clouds, "Todavía no hay nubes guardadas.");
}

function renderLibraryEmpty(container, message) {
  const empty = document.createElement("p");
  empty.className = "history-empty";
  empty.textContent = message;
  container.appendChild(empty);
}

function renderActivityGroup(container, group, emptyMessage) {
  if (!group.length) {
    renderLibraryEmpty(container, emptyMessage);
    return;
  }

  group.forEach((activity) => {
    const card = document.createElement("article");
    card.className = `activity-card${activity.isActive ? " is-active" : ""}`;
    const typeLabel = activity.type === "cloud" ? "Nube" : "Encuesta";
    const totalRuns = activity.history ? activity.history.length : 0;
    card.innerHTML = `
      <div class="activity-card-main">
        <span></span>
        <h3></h3>
        <p></p>
        <small></small>
      </div>
      <div class="activity-actions">
        <button type="button" data-action="activate">Activar</button>
        <button type="button" data-action="edit" class="secondary-button">Editar</button>
        <button type="button" data-action="delete" class="remove-option">Eliminar</button>
      </div>
    `;
    card.querySelector("span").textContent = activity.isActive ? `${typeLabel} activa` : typeLabel;
    card.querySelector("h3").textContent = activity.title || activity.question;
    card.querySelector("p").textContent = activity.question;
    card.querySelector("small").textContent = `${totalRuns} ${totalRuns === 1 ? "historial guardado" : "historiales guardados"}`;
    card.querySelector('[data-action="activate"]').disabled = activity.isActive;
    card.querySelector('[data-action="activate"]').addEventListener("click", () => activateSavedActivity(activity.id));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => loadActivityIntoEditor(activity));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteSavedActivity(activity.id));
    container.appendChild(card);
  });
}

function renderResults(data) {
  activeActivityType = data.type || "poll";
  resultsQuestion.textContent = data.question;
  totalVotes.textContent = activeActivityType === "cloud"
    ? `${data.total} ${data.total === 1 ? "palabra" : "palabras"}`
    : `${data.total} ${data.total === 1 ? "voto" : "votos"}`;
  resultsList.innerHTML = "";

  if (activeActivityType === "cloud") {
    renderCloudResults(data);
    return;
  }

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

function renderCloudResults(data) {
  if (!data.results.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Todavía no hay palabras.";
    resultsList.appendChild(empty);
    return;
  }

  const cloud = document.createElement("div");
  cloud.className = "admin-word-cloud";
  data.results.forEach((item) => {
    const word = document.createElement("span");
    word.className = "admin-cloud-word";
    word.textContent = `${item.word} (${item.count})`;
    word.style.setProperty("--word-scale", (0.85 + item.weight * 1.7).toFixed(2));
    cloud.appendChild(word);
  });
  resultsList.appendChild(cloud);
}

function saveBrowserBackup(backup) {
  localStorage.setItem(browserBackupKey, JSON.stringify({
    ...backup,
    savedInBrowserAt: new Date().toISOString()
  }));
}

async function fetchBackup() {
  const response = await adminFetch("/api/admin/backup");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "No se pudo crear el backup.");
  }

  saveBrowserBackup(data);
  return data;
}

async function refreshBrowserBackup() {
  try {
    const backup = await fetchBackup();
    setBackupStatus(`Backup local actualizado: ${formatDate(backup.exportedAt)}`);
  } catch (error) {
    setBackupStatus(error.message);
  }
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
    empty.textContent = "Todavía no hay actividades archivadas.";
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
        <button type="button" class="remove-option">Eliminar actividad</button>
      </div>
      <div class="history-results"></div>
    `;

    card.querySelector("h3").textContent = item.question;
    const itemType = item.type || "poll";
    const totalLabel = itemType === "cloud"
      ? `${item.total} ${item.total === 1 ? "palabra" : "palabras"}`
      : `${item.total} ${item.total === 1 ? "voto" : "votos"}`;
    card.querySelector("p").textContent = `${totalLabel} · ${formatDate(item.archivedAt)}`;
    const results = card.querySelector(".history-results");

    if (itemType === "cloud") {
      const cloud = document.createElement("div");
      cloud.className = "admin-word-cloud";
      item.results.forEach((wordItem) => {
        const word = document.createElement("span");
        word.className = "admin-cloud-word";
        word.textContent = `${wordItem.word} (${wordItem.count})`;
        word.style.setProperty("--word-scale", (0.85 + (wordItem.weight || 0.5) * 1.4).toFixed(2));
        cloud.appendChild(word);
      });
      results.appendChild(cloud);
    } else {
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
    }

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
  refreshBrowserBackup();
}

async function loadActivities() {
  const response = await adminFetch("/api/admin/activities");
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo cargar la biblioteca.");
    return;
  }

  renderActivitiesLibrary(data);
}

async function savePoll(event) {
  event.preventDefault();
  setStatus("Publicando...");

  const payload = editorPayload();

  const response = await adminFetch("/api/admin/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "No se pudo publicar.");
    return;
  }

  lastVersion = data.version;
  selectedActivityId = null;
  renderResults(data);
  await loadHistory();
  await loadActivities();
  setStatus("Actividad publicada. El QR se actualizó con la modalidad activa.");
}

async function saveActivityToLibrary() {
  const payload = editorPayload();
  setStatus(selectedActivityId ? "Actualizando actividad..." : "Guardando actividad...");
  const response = await adminFetch(selectedActivityId ? `/api/admin/activities/${selectedActivityId}` : "/api/admin/activities", {
    method: selectedActivityId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo guardar la actividad.");
    return;
  }

  renderActivitiesLibrary(data);
  if (!selectedActivityId && data.activities.length) {
    selectedActivityId = data.activities[0].id;
  }
  setStatus("Actividad guardada en la biblioteca.");
  refreshBrowserBackup();
}

async function activateSavedActivity(activityId) {
  setStatus("Activando actividad...");
  const response = await adminFetch(`/api/admin/activities/${activityId}/activate`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo activar la actividad.");
    return;
  }

  lastVersion = data.results.version;
  renderResults(data.results);
  renderActivitiesLibrary(data.activities);
  await loadHistory();
  setStatus("Actividad activada. La anterior quedó archivada.");
}

async function deleteSavedActivity(activityId) {
  setStatus("Eliminando actividad guardada...");
  const response = await adminFetch(`/api/admin/activities/${activityId}`, { method: "DELETE" });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo eliminar la actividad.");
    return;
  }

  if (selectedActivityId === activityId) {
    clearEditor();
  }

  renderActivitiesLibrary(data);
  setStatus("Actividad eliminada de la biblioteca.");
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
  refreshBrowserBackup();
  setStatus("Respuestas limpiadas.");
}

async function deleteHistoryItem(archiveId) {
  setStatus("Eliminando actividad archivada...");
  const response = await adminFetch(`/api/admin/history/${encodeURIComponent(archiveId)}`, {
    method: "DELETE"
  });
  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "No se pudo eliminar la encuesta.");
    return;
  }

  renderHistory(data);
  refreshBrowserBackup();
  setStatus("Actividad eliminada del registro.");
}

async function downloadBackup() {
  setBackupStatus("Preparando backup...");

  try {
    const backup = await fetchBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `live-poll-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupStatus("Backup descargado.");
  } catch (error) {
    setBackupStatus(error.message);
  }
}

async function restoreBrowserBackup() {
  const rawBackup = localStorage.getItem(browserBackupKey);

  if (!rawBackup) {
    setBackupStatus("No hay backup guardado en este navegador.");
    return;
  }

  const backup = JSON.parse(rawBackup);
  setBackupStatus("Restaurando backup...");
  const response = await adminFetch("/api/admin/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      poll: backup.poll,
      history: backup.history,
      activities: backup.activities
    })
  });
  const data = await response.json();

  if (!response.ok) {
    setBackupStatus(data.error || "No se pudo restaurar el backup.");
    return;
  }

  renderResults(data.results);
  renderHistory(data.history);
  await loadActivities();
  setBackupStatus("Backup restaurado. La encuesta activa y el historial volvieron al servidor.");
  await loadResults({ sync: true });
}

addOptionButton.addEventListener("click", () => addOptionInput());
formEl.addEventListener("submit", savePoll);
saveActivityButton.addEventListener("click", saveActivityToLibrary);
resetVotesButton.addEventListener("click", resetVotes);
refreshHistoryButton.addEventListener("click", loadHistory);
newPollButton.addEventListener("click", () => clearEditor("poll"));
newCloudButton.addEventListener("click", () => clearEditor("cloud"));
downloadBackupButton.addEventListener("click", downloadBackup);
restoreBrowserBackupButton.addEventListener("click", restoreBrowserBackup);
copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(voteLink.value);
  setStatus("Link copiado.");
});
activityTypeInput.addEventListener("change", syncActivityControls);

updateShareTools();
loadResults({ sync: true }).catch(() => setStatus("No se pudo cargar la encuesta."));
loadHistory().catch(() => setStatus("No se pudo cargar el registro."));
loadActivities().catch(() => setStatus("No se pudo cargar la biblioteca."));
setInterval(() => loadResults().catch(() => {}), 1500);
