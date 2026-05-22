const displayQuestion = document.querySelector("#display-question");
const displayTotal = document.querySelector("#display-total");
const wordCloud = document.querySelector("#word-cloud");

const colors = ["#d2efa1", "#ffffff", "#9de6c1", "#c8f7e2", "#ecffd0"];

function setLayoutDensity(question, wordCount) {
  const length = question.length;
  document.body.dataset.questionSize = length > 120 ? "xlong" : length > 72 ? "long" : "normal";
  document.body.dataset.optionCount = String(Math.max(1, wordCount));
}

function renderWordCloud(data) {
  if (data.type !== "cloud") {
    displayQuestion.textContent = "La actividad activa no es una nube de palabras.";
    displayTotal.textContent = "0 palabras";
    wordCloud.innerHTML = "";
    return;
  }

  displayQuestion.textContent = data.question;
  displayTotal.textContent = `${data.total} ${data.total === 1 ? "palabra" : "palabras"}`;
  wordCloud.innerHTML = "";
  setLayoutDensity(data.question, data.results.length);

  if (!data.results.length) {
    const empty = document.createElement("p");
    empty.className = "word-cloud-empty";
    empty.textContent = "Esperando palabras...";
    wordCloud.appendChild(empty);
    return;
  }

  data.results.forEach((item, index) => {
    const word = document.createElement("span");
    const scale = 0.85 + item.weight * 2.4;
    word.className = "cloud-word";
    word.textContent = item.word;
    word.title = `${item.count} ${item.count === 1 ? "vez" : "veces"}`;
    word.style.setProperty("--word-scale", scale.toFixed(2));
    word.style.color = colors[index % colors.length];
    wordCloud.appendChild(word);
  });
}

async function loadCloudResults() {
  const response = await fetch("/api/results");
  const data = await response.json();
  renderWordCloud(data);
}

loadCloudResults().catch(() => {
  displayQuestion.textContent = "No se pudieron cargar los resultados.";
});
setInterval(() => loadCloudResults().catch(() => {}), 1500);
