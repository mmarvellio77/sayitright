//----------Page elements----------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const errorBox = document.getElementById("error");
const loading = document.getElementById("loading");
const wordBox = document.getElementById("word-box");

let currentWord = null; // the word the user is practising

//----------1. Look up a word----------
async function lookUp(word) {
  errorBox.classList.add("hidden");

  loading.classList.remove("hidden");
  try {
    const response = await fetch(
      "/api/define?word=" + encodeURIComponent(word),
    );
    showServer(response);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    currentWord = data;
    showWord(data);
  } catch (err) {
    //err.message is our server's message, or a network error
    showError(
      err.message === "Failed to fetch"
        ? "Cannot reach the server. Check your internet."
        : err.message,
    );
  }
}

function showWord(data) {
  document.getElementById("word").textContent = data.word;

  document.getElementById("phonetic").textContent = data.phonetic;

  document.getElementById("target").textContent = data.word;

  document.getElementById("translation").textContent = "";

  document.getElementById("lang").value = "";
  result.textContent = "";

  const meanings = document.getElementById("meanings");
  meanings.innerHTML = "";
  data.meanings.forEach((m) => {
    const div = document.createElement("div");
    div.className = "meaning";
    div.innerHTML = `<strong>${m.partOfSpeech}</strong>: <span></span><br><em></em>`;

    div.querySelector("span").textContent = m.definition; // textContent = safe from XSS

    div.querySelector("em").textContent = m.example ? `"${m.example}"` : "";
    meanings.appendChild(div);
  });

  wordBox.classList.remove("hidden");
}

function showError(message) {
  errorBox.textContent = message;

  errorBox.classList.remove("hidden");
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();

  lookUp(searchInput.value.trim());
});

//Suggested hard words
[
  "thorough",
  "colonel",
  "february",
  "comfortable",
  "entrepreneur",
  "squirrel",
].forEach((w) => {
  const btn = document.createElement("button");
  btn.textContent = w;
  btn.onclick = () => {
    searchInput.value = w;
    lookUp(w);
  };

  document.getElementById("suggestions").appendChild(btn);
});
// ----------2. Listen ----------
document.getElementById("listen-btn").addEventListener("click", () => {
  if (currentWord.audio) {
    //Play the real recording; if it fails, use the browser's voice
    new Audio(currentWord.audio).play().catch(() => speak(currentWord.word));
  } else {
    speak(currentWord.word);
  }
});

function speak(text) {
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = "en-US";
  speechSynthesis.speak(voice);
}

// ----------3. Translate ----------
document.getElementById("lang").addEventListener("change", async (e) => {
  const output = document.getElementById("translation");
  if (!e.target.value) return (output.textContent = "");
  output.textContent = "Translating...";
  try {
    const response = await fetch(
      `/api/translate?text=${encodeURIComponent(currentWord.word)}&lang=${e.target.value}`,
    );
    const data = await response.json();
    output.textContent = response.ok ? data.translation : data.error;
  } catch {
    output.textContent = "Translation failed.";
  }
});

// ---------- 4. Speak and get a score ----------
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  micBtn.disabled = true;

  document.getElementById("warning").textContent =
    "Speaking practice only works in Google Chrome or Microsoft Edge.";

  document.getElementById("warning").classList.remove("hidden");
}

micBtn.addEventListener("click", () => {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.maxAlternatives = 5; //get several guesses, keep the best one

  recognition.onresult = (event) => {
    const guesses = Array.from(event.results[0]).map((alt) => alt.transcript);
    const best = guesses
      .map((text) => ({ text, score: getScore(currentWord.word, text) }))
      .sort((a, b) => (b.score = a.score))[0];

    const message =
      best.score === 100
        ? "Perfect!"
        : best.score >= 80
          ? "Very close!"
          : "Try again ";
    result.innerHTML = `<span class="${best.score >= 80 ? "good" : "bad"}">${best.score}/100</span>}> - ${message}<br>We heard: <b></b>`;
    result.querySelector("b").textContent = best.text;
    saveAttempt(currentWord.word, best.score);
  };

  recognition.onerror = (event) => {
    const messages = {
      "not-allowed":
        "Microphone access was blocked. Please allow it in your browser.",
      "no-speech": "We did not hear anything. Please try again.",
      network: "Speech recognition needs an internet connection.",
    };
    result.textContent =
      messages[event.error] || "Speech error: " + event.error;
  };

  recognition.onend = () => {
    micBtn.classList.remove("listening");
    micBtn.textContent = "Start speaking";
  };

  recognition.start();

  micBtn.classList.add("listening");
  micBtn.textContent = "Listening...";
});

//Compare two words: 100=identical. Uses Levenshtein distance
//(how many letters must be added, removed or changed to turn one word into the other).
function getScore(target, heard) {
  const a = target
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();
  const b = heard
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();
  if (a === b) return 100;

  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
    }
  }

  const similarity = 1 - d[a.length][b.length] / Math.max(a.length, b.length);
  return Math.min(95, Math.round(similarity * similarity * 100)); // only an exact match gets 100
}

// ---------- 5. History(saved in the browser) ----------
function getHistory() {
  return JSON.parse(localStorage.getItem("history") || "[]");
}

function saveAttempt(word, score) {
  const history = getHistory();
  let item = history.find((h) => h.word === word);
  if (!item) {
    item = { word, best: 0, attempts: 0 };
    history.push(item);
  }
  item.best = Math.max(item.best, score);
  item.attempts++;
  item.date = Date.now();

  localStorage.setItem("history", JSON.stringify(history));
  showHistory();
}

function showHistory() {
  const search = document.getElementById("history-search").value.toLowerCase();
  const filter = document.getElementById("history-filter").value;
  const sort = document.getElementById("history-sort").value;

  letlist = getHistory().filter((h) => h.word.includes(search));
  if (filter === "good") list = list.filter((h) => h.best >= 80);
  if (filter === "bad") list = list.filter((h) => h.best < 80);

  if (sort === "date") list.sort((a, b) => (b.date = a.date));
  if (sort === "low") list.sort((a, b) => a.best - b.best);
  if (sort === "high") list.sort((a, b) => b.best - a.best);
  if (sort === "az") list.sort((a, b) => a.word.localeCompare(b.word));

  const table = document.getElementById("history");
  table.innerHTML = list.length
    ? ""
    : '<tr><tdcolspan="4">No words yet. Look up a word and press the mic!</td></tr>';
  list.forEach((h) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${h.word}</td><td class="${h.best >= 80 ? "good" : "bad"}">${h.best}</td><td>${h.best.attempts}</td><td><button>Practice</button></td>`;

    row.querySelector("button").onclick = () => lookUp(h.word);
    table.appendChild(row);
  });
}

document
  .getElementById("history-search")
  .addEventListener("input", showHistory);
document
  .getElementById("history-filter")
  .addEventListener("change", showHistory);
document.getElementById("history-sort").addEventListener("change", showHistory);
document.getElementById("clear-btn").addEventListener("click", () => {
  if (confirm("Delete all your history?")) {
    localStorage.removeItem("history");
    showHistory();
  }
});

showHistory();
