//----------Page elements----------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const errorBox = document.getElementById("error");
const loading = document.getElementById("loading");
const wordBox = document.getElementById("word-box");

let currenrWord = null; // the word the user is practising

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
