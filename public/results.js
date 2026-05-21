const displayQuestion = document.querySelector("#display-question");
const displayTotal = document.querySelector("#display-total");
const displayResults = document.querySelector("#display-results");

function setLayoutDensity(question, optionCount) {
  const length = question.length;
  document.body.dataset.questionSize = length > 120 ? "xlong" : length > 72 ? "long" : "normal";
  document.body.dataset.optionCount = String(optionCount);
}

function renderDisplayResults(data) {
  displayQuestion.textContent = data.question;
  displayTotal.textContent = `${data.total} ${data.total === 1 ? "voto" : "votos"}`;
  displayResults.innerHTML = "";
  setLayoutDensity(data.question, data.results.length);

  data.results.forEach((option) => {
    const voteLabel = option.votes === 1 ? "voto" : "votos";
    const row = document.createElement("div");
    row.className = "display-result-row";
    row.innerHTML = `
      <div class="display-result-meta">
        <strong></strong>
        <span>${option.votes} ${voteLabel} · ${option.percent}%</span>
      </div>
      <div class="display-bar-track">
        <div class="display-bar-fill" style="width: ${option.percent}%"></div>
      </div>
    `;
    row.querySelector("strong").textContent = option.text;
    displayResults.appendChild(row);
  });
}

async function loadDisplayResults() {
  const response = await fetch("/api/results");
  const data = await response.json();
  renderDisplayResults(data);
}

loadDisplayResults().catch(() => {
  displayQuestion.textContent = "No se pudieron cargar los resultados.";
});
setInterval(() => loadDisplayResults().catch(() => {}), 1500);
