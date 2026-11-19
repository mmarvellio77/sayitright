const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
// Look up a word in the Free Dictionary API
app.get("api/define", async (req, res) => {
  const word = (req.query.word || "").trim().toLowerCase();
  if (!/^[a-z'-]{1,40}$/.test(word)) {
    return res.status(400).json({
      error: "Please type a word using letters only.",
    });
  }

  const response = await fetch(
    "ttps://api.dictionaryapi.dev/api/v2/entries/en/" +
      encodeURIComponent(word),
  );

  if (response.status === 404) {
    return res.status(404).json({
      error: '"${word}" was not found. Check the spelling.',
    });
  }

  const data = await response.json();
  const entry = data[0];
  const result = {
    word: entry.word,
    phonetic:
      entry.phonetic || (entry.phonetics.find((p) => p.text) || {}).text || "",
    audio: (entry.phonetics.find((p) => p.audio) || {}).audio || "",
    meanings: entry.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definition: m.definitions[0].definition,
      example: m.definitions[0].definition,
      example: m.definitions[0].example || "",
    })),
  };
});
app.use(express.static("public"));
app.listen(PORT, () =>
  console.log(
    "SayItRight is running on http://localhost:${PORT} (${SERVER_NAME})",
  ),
);
