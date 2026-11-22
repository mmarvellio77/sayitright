require("dotenv").config();
const express = require("express");
const os = require("os");
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.SERVER_NAME || os.hostname();
const cache = {}; // simple cache: same word = no new API call

//Tell the browser which server answered(to see the load balancer working)
app.use((req, res, next) => {
  res.set("X-Served-By", SERVER_NAME);
  next();
});

app.use(express.static("public"));

// Look up a word in the Free Dictionary API
app.get("/api/define", async (req, res) => {
  const word = (req.query.word || "").trim().toLowerCase();
  if (!/^[a-z'-]{1,40}$/.test(word)) {
    return res.status(400).json({
      error: "Please type a word using letters only.",
    });
  }
  if (cache[word]) return res.json(cache[word]);

  try {
    const response = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(word),
    );

    if (response.status === 404) {
      return res.status(404).json({
        error: '"${word}" was not found. Check the spelling.',
      });
    }
    if (!response.ok)
      throw new Error("Dictionary API error " + response.status);

    const data = await response.json();
    const entry = data[0];
    const result = {
      word: entry.word,
      phonetic:
        entry.phonetic ||
        (entry.phonetics.find((p) => p.text) || {}).text ||
        "",
      audio: (entry.phonetics.find((p) => p.audio) || {}).audio || "",
      meanings: entry.meanings.map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: m.definitions[0].definition,
        example: m.definitions[0].example || "",
      })),
    };
    cache[word] = result;
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(502).json({
      error:
        "The dictionary service is not responding. Please try again later.",
    });
  }
});

// Translate a word with the MyMemory API
app.get("/api/translate", async (req, res) => {
  const text = (req.query.text || "").trim();
  const lang = req.query.lang;
  if (!text || !lang)
    return res.status(400).json({ error: "Missing text or language." });

  try {
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
    if (process.env.MYMEMORY_EMAIL) url += "&de=" + process.env.MYMEMORY_EMAIL;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseStatus != 200) throw new Error(data.responseDetails);
    res.json({ translation: data.responseData.translatedText });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ error: "Translation is not available right now." });
  }
});

//Health check used by the load balancer
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", server: SERVER_NAME }),
);

app.listen(PORT, () =>
  console.log(
    `SayItRight is running on http://localhost:${PORT} (${SERVER_NAME})`,
  ),
);
