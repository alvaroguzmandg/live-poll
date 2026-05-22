const questionEl = document.querySelector("#question");
const formEl = document.querySelector("#vote-form");
const statusEl = document.querySelector("#status");
const thanksEl = document.querySelector("#thanks");
const refreshButton = document.querySelector("#refresh-page");

let poll = null;

function participantId() {
  const key = "live-poll-participant-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

function votedKey(version) {
  return `live-poll-voted-${version}`;
}

function selectedOptionKey(version) {
  return `live-poll-selected-option-${version}`;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setLayoutDensity(question, optionCount) {
  const length = question.length;
  document.body.dataset.questionSize = length > 120 ? "xlong" : length > 72 ? "long" : "normal";
  document.body.dataset.optionCount = String(optionCount);
}

function renderPoll() {
  if (poll.type !== "poll") {
    questionEl.textContent = "La actividad activa no es una encuesta.";
    formEl.innerHTML = "";
    thanksEl.hidden = true;
    setStatus("Pedile al admin que active la encuesta.");
    return;
  }

  questionEl.textContent = poll.question;
  formEl.innerHTML = "";
  setLayoutDensity(poll.question, poll.options.length);

  const hasVoted = localStorage.getItem(votedKey(poll.version)) === "true";
  const selectedOptionId = localStorage.getItem(selectedOptionKey(poll.version));
  thanksEl.hidden = !hasVoted;

  poll.options.forEach((option) => {
    const button = document.createElement("button");
    const isSelected = selectedOptionId === option.id;
    button.className = `option-button${isSelected ? " selected" : ""}`;
    button.type = "button";
    button.textContent = option.text;
    button.disabled = hasVoted;
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    button.addEventListener("click", () => vote(option.id));
    formEl.appendChild(button);
  });

  setStatus(hasVoted ? "Tu opción quedó marcada." : "Elegí una opción para votar.");
}

async function loadPoll() {
  const response = await fetch("/api/poll");
  poll = await response.json();
  renderPoll();
}

async function vote(optionId) {
  setStatus("Enviando voto...");
  const response = await fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: participantId(),
      optionId,
      version: poll.version
    })
  });

  const result = await response.json();
  if (!response.ok) {
    setStatus(result.error || "No se pudo votar.");
    await loadPoll();
    return;
  }

  localStorage.setItem(votedKey(poll.version), "true");
  localStorage.setItem(selectedOptionKey(poll.version), optionId);
  renderPoll();
}

refreshButton.addEventListener("click", () => {
  window.location.reload();
});

loadPoll().catch(() => {
  questionEl.textContent = "No se pudo cargar la encuesta.";
  setStatus("Probá recargar la página.");
});
