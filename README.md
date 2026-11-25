# 🎙️ SayItRight: Pronunciation Coach

SayItRight helps English learners pronounce difficult words (like _thorough_ or _colonel_).
You look up a word, read its meaning, listen to how it sounds, say it into your microphone and get a score out of 100.
Your scores are saved, so you can see which words still need practice.

- **Live site:** https://www.mmarvellio.tech
- **Demo video:** https://youtu.be/6ftvPWy5thQ
- **Repository:** https://github.com/mmarvellio77/sayitright

> Use **Google Chrome** or **Microsoft Edge**. Speech recognition doesn't work in FireFox.

## Why I built this

I love languages: learning them, and especially practising a good accent. When I learn a new word, I want to know not only what it means but how to say it properly. Dictionaries show phonetic symbols that most people can't read, and practising alone gives no feedback on whether you got it right. SayItRight is the tool I wanted for myself: hear the word, say it, and get an instant score, then come back to the words that still need work.

## Features

- Search any English word, or click a suggested "hard" word
- See the phonetic spelling, meanings and examples
- Listen to a real recorded pronunciation
- Translate the word into French, Swahili, Kinyarwanda, Spanish or German
- Say the word and get a score(0 to 100)
- Progress table: **search** words, **filter** (mastered / needs practice) and **sort** (newest, lowest score, highest score, A to Z)
- Clear error messages(word not found, API down,microphone blocked,unsupported browser)

## APIs used (credits)

| API                                     | What it is used for               | Documentation                                                   |
| --------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Free Dictionary API                     | Meanings, phonetics, audio        | https://dictionaryapi.dev/                                      |
| MyMemory Translation API                | Meaning in the learner's language | https://mymemory.translated.net/doc/spec.php                    |
| Web Speech API (built into the browser) | Speech recognition and speech     | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |

Neither external API needs an API key.

- **Free Dictionary API** is called directly from the browser (`public/script.js`). It blocks requests from cloud servers such as AWS(see _Challenges_), so the user's browser fetches it.
- **MyMemory** is called by our server (server.js), which sends back only the translation. The optional MYMEMORY_EMAIL setting (it raises the daily translation limit) is stored in a .env file, which is listed in .gitignore so it never reaches GitHub.

Built with [Node.js](https://nodejs.org/), [Express](https://expressjs.com/) and [dotenv](https://github.com/motdotla/dotenv).

## How the score works

The browser turns your speech into text. The app compares that text with the word using the **Levenshtein distance** (the number of the letters you must change to turn one word into the other).
An exact match scores 100, and a close mistake like "through" for "thorough" scores 77.

## Files

```
server.js          Express server + API routes (/api/translate and /api/health)
public/index.html  Page layout
public/style.css   Styling
public/script.js   Search, listen, translate, speech scoring, history
.env.example       Example settings (copy to .env)
```

## Data storage

The app does not use a database. It doesn't need one:

- **Word meanings, phonetics and audio** come live from the Free Dictionary API.
- **Translations** come live from the MyMemory API, through our server.
- **Recently looked-up words** are kept in a small in-memory cache in the page, so looking up the same word again is instant. It resets when the page reloads.
- **Practice history** (best score, number of attempts) is saved in the browser's **localStorage**, on the user's own computer.

Because nothing is stored on the web servers, they are **stateless**: the load balancer can send any request to web-01 or web-02 and the user sees the same thing. If scores were saved on the servers instead, a score saved on web-01 would be missing when the next request went to web-02.

## Run locally

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/mmarvellio77/sayitright.git
cd sayitright
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000 in Chrome.

## Deployment

```
                Users
                  │  https://www.mmarvellio.tech
             ┌────▼────┐
             │  lb-01  │  HAProxy (round robin, SSL) 35.179.119.184
             └──┬───┬──┘
                │   │
         ┌──────▼┐ ┌▼──────┐
         │ web-01│ │web-02 │  Nginx → Node app (port 3000), kept
      running by pm2
         └───────┘ └───────┘
     18.171.170.245 18.171.175.36
```

### 1. On web-01 and web-02

Install Node.js, Nginx and pm2(pm2 keeps the app running):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y node.js nginx git && sudo npm install -g pm2
```

Get the code and start the app(use `web-02` as the name on the second server):

```bash
git clone https://github.com/mmarvellio77/sayitright.git ~/sayitright && cd ~/sayitright && npm install
```

```bash
cp .env.example .env && sed -i 's/SERVER_NAME=local/SERVER_NAME=web-01/'.env
```

```bash
pm2 start server.js --name sayitright && pm2 save && pm2 startup
```

Make the app start again after a reboot:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Make Nginx forward port 80 to the app. Replace the contents of `/etc/nginx/sites-available/default` with:

```nginx
server{
    listen 80;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo nginx -t && sudo systenctl reload nginx
```

Check it works: `curl http://localhost/api/health` should print `{"status":"ok", "server":"web-01"}`.

### 2. On lb-01(load balancer + HTTPS)

The browser only allows the microphone on **https** pages, so the load balancer(HAProxy) and the SSL certificatenfor `www.mmarvellio.tech` (Let's Encrypt) were already set up in an earlier project, and the domain's A record points to lb-01 (35.179.119.184).

The relevant part of `/etc/haproxy//haproxy.cfg`:

```
    frontend http_front
    bind*;80
    http-request redirect scheme https code 301 unless { ssl_fc}
    default_backend web_servers

frontend https_front
    bind*:443 ssl crt /etc/haproxy/certs/ww/mmarvellio.tech.pem
    http-requestvset-header X-Forwarded-Proto https
    default_backend web_servers

backend web_servers
    balance roundrobin
    option httpchk GET /api/health
    server 7355-web-01 18.171.170.245.:80 check
    server 7355-web-02 18.171.175.36:80 check
```

- `redirect scheme https` sends every http visitor to the secure https site.
- `balance roundrobin` sends requests to web-01 and wb-02 in turn.
- `option httpchk GET /api/health` (added for this project) checks the app on each server. If one stops answering, HAProxy stops sending users to it.

After editing: `sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl restart haproxy`

### 3. Test the load balancer

```bash
for i in 1 2 3 4; do curl -s https://www.mmarvellio.tech/api/health;
echo;done
```

The answers alternate between `web-01` and `web-02`. On the website, the header shows "Served by web-01" or "Served by web-02" and changes as you look up words.

To update after a code change, run this on each web server:

```bash
cd ~/sayitright && git pull && npm install && pm2 restart sayitright
```

## Error handling

- Word not found → "'xyz' was not found. Check the spelling." (the previous word is hidden so it isn't confusing)
- Invalid input (numbers, symbols) → "Please type a word using leters only."
- Dictionary or translation API down → a friendly message instead of a crash
- No internet → "Cannot reach the dictionary. Check your internet."
- Microphone blocked or nothing heard → a spcific message
- Browser without peech recognition → warning banner, and the mic button is disabled
- No recording for a word → the browser reads the word aloud instead

## Limitations

- **Only common English words.** the Free Dictionary API does not include proper nouns, so names of countries and cities (e.g. _Rwanda_, _Paris_), months and days (e.g. _February_, _Monday_) and abbreviations( *e.g. *NASA*) show "was not found". Some slang (e.g. *gonna*) is also missing. Verb forms and plurals work (e.g. *went*, *running*, *cities*, *children\*).
- **Letters only.** Words with numbers or accented letters (e.g. _café_) are rejected.
- **English pronunciation only.** The translation shows what the word means in your language to help you understand it, but speaking practice is always in English.
- **Speech recognition needs Google Chrome or Microsoft Edge** and an internet connection, and works only on https(or localhost).
- **Similar-sounding words** can be misheard (e.g. _colonel_ as _kernel_). The app keeps the best of 5 guesses, but the score can still be lower than it should be.
- **Not every word has a recording.** If the dictionary has no audio, the browser's built-in voice reads the word instead.
- **Translation has a daily limit** on MyMemory's free plan (5000 characters per day, or 50, 000 with an email set in `.env`).
- **Progress is saved in youe browser only**, so it doesn't follow youy to another device or browser,, and clearing browser data deletes it.

## Challenges

- **The microphone needs HTTPS.** It worked on localhost but would be blocked on a plan http address. I used the load balancer's existing SSL certificate so the site runs on https.
- **The dictionary API blocked my servers (403 Forbidden).** Lookups worked locally but failed on web-01 and web-02. I found the cause in the pm2 error log (`Dictionary API error 403`) and confirmed it with `curl` from the server: the API's Cloudflare protection blocks cloud server addresses, even with a browser User-Agent. I moved the dictionary call to the browser, which is not blocked.
- **The health check took the site down.** I added the HAProxy health check before the app was deployed, so bothmservers failed it and the site showed "503 Service Unavailable". I removed the check, deployed the app on both servers, confirmed `/api/health` answered, then added the check back.
- **Typos broke the page.** A missing `<script>` tag and small mistakes (`=` instead of `-` in a sort, a route missing its `/`, quotes instead of backticks, a missing variable) made the buttons do nothing. I found them with Chrome's console(Cmd + Option + J) and the server logs.
- **A suggested word didn't exist.** "february" always showed "not found". Testing the API directly showed it has no month nmaes, so I replaced it with "vegetable" and listed this under _Limitations_.
- **Scores were too generous.** "through" first scored 88 for "thorough". I squared the similarity so mistakes count more, and only an exact match gets 100.
- **Similar-sounding words.** Speech recognition can hear "colonel" as "kernel". The app asks for 5 guesses and keeps the best one.

## Credentials

No login and no API keys are needed. The optional `MYMEMORY_EMAIL` in `.env` only raises the free translation limit.
