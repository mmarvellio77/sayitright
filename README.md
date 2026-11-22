# 🎙️ SayItRight: Pronounciation Coach

SayItRight helps English learners pronounce difficult words (like _thorough_ or _colonel_).
You look up a word, read its meaning, listen to how it sounds, say it intoyour microphone and get a score out of 100.
Your scores are saved, so you can see which words still needs practice.

- **Live site:** https://YOUR-DOMAIN
- **Demo video:** https://YOUTUBE-LINK

> Use **Google Chrome** or **Microsoft Edge**. Spech recognition doen't work in FireFox.

## Features

- Search any English word, or click a suggested "hard" word
- See the phonetic spelling, meanings and examples
- Listen to a real recorded pronounciation
- Translate the word into French, Swahili, Kinyarwanda, Spanish or German
- Say the word and get a score(0 to 100)
- Progress table: \*search** words, **filter** (masteres / needs practice) and **sort\*\* (newest, lowest score, highest score, A to Z)
- Clear error messages(word not found, API down,microphone blocked,unsupported browser)

## APIs used (credits)

| API                                     | What it is used for           | Documentation                                                   |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Free Dictionary API                     | Meanings, phonetics, audio    | https://dictionaryapi.dev/                                      |
| MyMemory Translation API                | Translations                  | https://mymemory.translated.net/doc/spec.php                    |
| Web Speech API (built into the browser) | Speech recognition and speech | https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |

Neither external API needs an API key. The browser never calls them drectly: `server.js` calls them and sends back only the data the page needs. The optional `MYMEMORY_EMAIL` setting (it raises the translation limit) is stored in a `.env` file, which is listed in `.gitignore` so it never reaches GitHub.

Built with [Node.js](https://nodejs.org/), [Express](https://expressjs.com/) and [dotenv](https://github.com/motdotla/dotenv).

## How the score works

The browser turns your speech into text. The app compares that text with the word usinng the **Levenshtein distance** (the number of the letters you must change to turn one word into the other).
An exact match scores 100, and a close mistake like "through" for "thorough" scores 77.

## Files

```
server.js          Express server + API routes (/api/define, /api/translate, /api/health)
public/index.html  Page layout
public/style.css   Styling
public/script.js   Search, listen, translate, speech scoring, history
.env.example       Example settings (copy to .env)
```

##Run locally

```bash
git clone https://github.com/mmarvellio77/sayitright.git
cd sayitright
npm install
cp .env.example .env
npm start
```

Open https://localhost:3000 in Chrome.

## Deployment

```
            Users
              │  https
         ┌────▼────┐
         │  lb-01  │  HAProxy (round robin)
         └──┬───┬──┘
            │   │
     ┌──────▼┐ ┌▼──────┐
     │web-01 │ │web-02 │  Nginx → Node app (port 3000)
     └───────┘ └───────┘
```

### 1. On web-01 and web-02

Install Node.js, Nginx and pm2(pm2 keeps the app running):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y node.js nginx git && sudo npm install -g pm2
```

Get the code and start the app(use `web-02` as the name on the second server):

```bash
git clone https://github.com/mmarvellio77/sayitright.git ~/sayitright && cd ~/sayitright &&npm install
```

```bash
cp .env.example .env && sed -i 's/SERVER_NAME=local/SERVER_NAME=web-01/'.env
```

```bash
pm2 start server.js --name sayitright && pm2 save && pm2 startup
```

(`pm2 startup` prints one command. Run it so the app starts again after a reboot.)

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

Check it works: `curl https://localhost/api/health` should print `{"status":"ok", "server":"web-01"}`.

### 2. On lb-01(load balancer + HTTPS)

The browser only allows the microphone on **https** pages, so the load balancer needs an SSL certificate.
Point your domain to lb-01's IP, then:

```bash
sudo apt-get install -y haproxy certbot
```

```bash
sudo systemctl stop ha proxy && sudo certbot certonly --standalone -d
```
