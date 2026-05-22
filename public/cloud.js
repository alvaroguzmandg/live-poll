const questionEl = document.querySelector("#question");
const formEl = document.querySelector("#word-form");
const inputEl = document.querySelector("#word-input");
const statusEl = document.querySelector("#status");
const thanksEl = document.querySelector("#thanks");
const refreshButton = document.querySelector("#refresh-page");

let activity = null;
let isSubmitting = false;

function participantId() {
  const key = "live-poll-participant-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

function submittedKey(version) {
  return `live-cloud-submitted-${version}`;
}

function submittedWordKey(version) {
  return `live-cloud-word-${version}`;
}

function normalizeWord(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setLayoutDensity(question) {
  const length = question.length;
  document.body.dataset.questionSize = length > 120 ? "xlong" : length > 72 ? "long" : "normal";
}

function renderActivity() {
  if (activity.type !== "cloud") {
    questionEl.textContent = "La actividad activa no es una nube de palabras.";
    formEl.hidden = true;
    thanksEl.hidden = true;
    setStatus("Pedile al admin que active la nube.");
    return;
  }

  const hasSubmitted = localStorage.getItem(submittedKey(activity.version)) === "true";
  const submittedWord = localStorage.getItem(submittedWordKey(activity.version));

  questionEl.textContent = activity.question;
  setLayoutDensity(activity.question);
  formEl.hidden = hasSubmitted;
  thanksEl.hidden = !hasSubmitted;
  inputEl.disabled = hasSubmitted || isSubmitting;
  formEl.querySelector("button").disabled = hasSubmitted || isSubmitting;
  inputEl.value = "";
  setStatus(hasSubmitted ? `Mandaste: ${submittedWord}` : "Escribí una palabra o máximo 2.");
}

async function loadActivity() {
  const response = await fetch("/api/activity");
  activity = await response.json();
  renderActivity();
}

async function submitWord(event) {
  event.preventDefault();
  if (isSubmitting || localStorage.getItem(submittedKey(activity.version)) === "true") {
    renderActivity();
    return;
  }

  const word = normalizeWord(inputEl.value);
  if (!word || word.split(" ").filter(Boolean).length > 2) {
    setStatus("Usá una palabra o máximo 2 palabras.");
    return;
  }

  isSubmitting = true;
  inputEl.disabled = true;
  formEl.querySelector("button").disabled = true;
  setStatus("Enviando...");
  const response = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: participantId(),
      version: activity.version,
      word
    })
  });
  const result = await response.json();

  if (!response.ok) {
    isSubmitting = false;
    setStatus(result.error || "No se pudo enviar.");
    await loadActivity();
    return;
  }

  localStorage.setItem(submittedKey(activity.version), "true");
  localStorage.setItem(submittedWordKey(activity.version), result.word);
  isSubmitting = false;
  renderActivity();
}

formEl.addEventListener("submit", submitWord);
refreshButton.addEventListener("click", () => {
  window.location.reload();
});

loadActivity().catch(() => {
  questionEl.textContent = "No se pudo cargar la nube.";
  setStatus("Probá recargar la página.");
});
