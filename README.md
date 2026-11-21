# ✍️ Caption Studio

One place for all your social media captions: no more Google Docs, random notes, or screenshots.

- **Write captions** with a live character, word, and hashtag counter, plus warnings when a caption is too long for Instagram, TikTok, X, Threads, etc.
- **Schedule them** with a date and time, a **content type** (Showcase, Relatable, Trend, Motivational, Feedbacks, Educational, Personal/Brand, Mini Quiz; editable in Settings), and **platforms**.
- **Attach photos** (up to 10 per post). Paste, drag & drop or pick from your gallery. They're resized in your browser to max 2048 px so they fit the free database, and sent to you on Telegram at posting time. Videos aren't supported (too big for free storage), so paste a Drive link in the notes instead.
- **See everything**: an Upcoming list, a month **Calendar**, **Ideas & drafts** (captions with no date yet), and a **Posted** archive you can search and reuse.
- **Get Telegram reminders**:
  - before each post (default: 1 day before, 1 hour before, and at posting time)
  - **custom times** like 45 minutes or 2 hours before, either for all posts (Settings) or for a single post (in the editor, choose Reminders → Custom)
  - at posting time your **photos** arrive (as an album if there are several), then the caption as its own message, so you can save, long-press, copy, and post
  - an optional **morning summary** of today's posts
  - a **"Did you post it?"** nudge if you forgot to mark it as posted
  - tap **✅ Mark as posted** right in Telegram
  - send your bot `/today`, `/week`, or `/next` any time
- Works great on your phone. You can "Add to Home Screen" so it feels like an app.
- Protected by a password, and you can download a backup (JSON or CSV) any time.

## 💸 Cost: free

| Piece | Service | Free plan |
| --- | --- | --- |
| Website + API | Cloudflare Workers | 100,000 requests/day |
| Database (captions + photos) | Cloudflare D1 | 500 MB per database: unlimited captions, roughly 400–800 photos |
| Reminder schedule | Cloudflare Cron Triggers | runs every 5 minutes |
| Notifications | Telegram Bot API | free |

You don't need a credit card. On the free plan there's **no way to get billed**: if a limit is ever reached, that feature just pauses (for example, photo uploads say "storage is full") until you free up space or the daily limit resets.

**About photos:** the free database is capped at 500 MB, and photos fill most of it (captions are tiny). **Settings → Photo storage** shows how full it is and can remove photos from posts you posted more than 30 days ago (the captions stay).

---

## 🚀 Setup (about 15 minutes, one time only)

### 1. Create your Telegram bot
1. In Telegram, open **[@BotFather](https://t.me/BotFather)** and send `/newbot`.
2. Pick a name (for example *My Caption Reminders*) and a username that ends in `bot`.
3. BotFather replies with a **token** that looks like `7123456789:AAH...`. Keep it secret; you'll need it in step 3.

### 2. Put the website online (Cloudflare, free)
1. Create a free account at **[dash.cloudflare.com](https://dash.cloudflare.com/sign-up)**.
2. Go to **Workers & Pages → Create → Import a repository**.
3. Connect GitHub and pick this repository (`MY-BABY-S-WEBSITE`). Keep the default settings: the deploy command is `npx wrangler deploy`.
4. Click **Deploy**. Cloudflare builds the site and **creates the database automatically**.
   Your site gets an address like `https://caption-studio.<your-name>.workers.dev`.

> Prefer the terminal? Run `npm install`, then `npx wrangler login`, then `npx wrangler deploy`.

### 3. Add your two secrets
In the Cloudflare dashboard, go to your **caption-studio** Worker → **Settings → Variables and Secrets → Add**. Choose type **Secret** for both:

| Name | Value |
| --- | --- |
| `APP_PASSWORD` | The password you'll use to open the website |
| `TELEGRAM_BOT_TOKEN` | The token from BotFather |

(Terminal: `npx wrangler secret put APP_PASSWORD` and `npx wrangler secret put TELEGRAM_BOT_TOKEN`.)

### 4. Connect Telegram
1. Open your site and log in with your password.
2. Tap the ⚙️ **Settings** icon, then **Connect bot**.
3. Tap **Open Telegram**, then press **Start** in the chat with your bot. You'll get a "✅ Connected!" message.
4. Press **Send a test message** to make sure it works. 🎉

Only *your* Telegram chat can control the bot. The secret link from step 3 is what pairs it, so anyone else who finds your bot just sees "private bot".

---

## ⚙️ Settings you can change in the app
- Which reminders to get (1 week, 3 days, 1 day, 3 hours, 1 hour, 30 min, 15 min before, at posting time, or any **custom** time up to 14 days before; max 8)
- The morning summary time, or turn it off
- Your time zone (default `Asia/Manila`)
- Your own list of content types and platforms
- The website's name (for example "Bea's Caption Studio" 💕)

## 🧑‍💻 Running it on your computer (optional)
```bash
npm install
cp .dev.vars.example .dev.vars   # then edit the password
npm run dev                       # http://localhost:8787
npm test                          # unit tests for the reminder logic
```
Telegram can only connect to the deployed **https** site, not to localhost.

## 🗂 How it's built
```
public/          the website (plain HTML/CSS/JS, no build step)
src/worker.js    API, login, Telegram bot webhook, reminder cron job
src/lib.js       reminder timing, validation, formatting (unit-tested)
test/            node --test unit tests
wrangler.jsonc   Cloudflare config (D1 database, cron every 5 min)
```
Database tables are created automatically the first time the app runs, and upgraded automatically when new versions add features. Images are stored as base64 in the `images` table.
