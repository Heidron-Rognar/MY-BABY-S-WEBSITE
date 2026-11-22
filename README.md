# ✍️ Caption Studio

One place for all your social media captions: no more Google Docs, random notes, or screenshots.

- **A daily moment of encouragement** in every theme: a greeting card with a World English Bible (WEB) verse and reference. **100 public-domain verses are bundled with the app**—no Bible API, subscription, or key setup. A per-device shuffle keeps the verse fixed for the local calendar day and changes it at midnight or when you return to the app.
- **Recover unfinished edits** after a refresh or closed tab, with device-local text recovery and a “Keep draft & close” option. Photos still need to be saved or reattached.
- **Reuse caption templates** across devices: save named structures with your caption, title, notes, type, and platforms.
- **Move scheduled captions** by dragging them to another calendar day, or choose a caption and tap a destination on mobile or with a keyboard.
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
- **Make it yours** in Settings → Theme, including **Beach**: crystal-clear turquoise water, pearl seashells, warm sand, and a seaside caption-writing desk. Themes are saved per device.
- Works great on your phone. You can "Add to Home Screen" so it feels like an app.
- Protected by a password, with portable JSON backup/restore (including photos and templates), plus CSV spreadsheet exports.

## Planning tools

### Unsaved-draft recovery

The editor automatically keeps unfinished text and scheduling selections in this browser's local storage. After signing back in or reloading, use **Resume draft** in the recovery banner. Edits to an existing caption return to that caption, not a duplicate. You can keep separate unfinished edits for existing posts plus one new-caption draft (up to 50 recovery entries).

- **Keep draft & close** closes the editor only after the device confirms the recovery copy was written. It does **not** save a post to the database or schedule reminders.
- **Save** writes the caption to the server and clears its recovery copy. Closing and confirming **Discard** removes those unfinished edits, without deleting the previously saved caption.
- Recovery includes title, caption, notes, content type, platforms, status, date/time, and reminder selection. **New photos, removals, and image order are not recovered.** Saved server photos remain attached; review attachments after restoring.
- If the original caption changed, recovery warns before restoring over its latest version. If it was deleted, the banner offers to recover the text as a new caption.
- Recovery is **device-local, not synced or encrypted**. It remains on this browser after logout, but the banner is only shown after login. On a shared device, discard recovery copies before leaving. Private browsing, cleared site data, disabled storage, or storage limits can prevent recovery; the editor reports failures and still lets you save normally.

### Reusable templates

Open **Reusable caption templates** in the caption editor. Give the current text a name and choose **Save current as template**. Templates sync with the application's database, so another signed-in device can use them after loading the app. There are up to 30 named templates; saving the same name offers to replace it.

**Use template** copies its title, caption, notes, content type, and platforms into the editor (with confirmation before replacing text). It deliberately leaves the current date/time, photos, status, and reminders untouched. A template never publishes or schedules anything on its own. Deleting a template does not affect captions previously made from it. Version 2 JSON backups include templates and can bundle photos. CSV spreadsheets and older JSON exports contain caption records only; device-local recovery copies are never included.

### Calendar rescheduling

On desktop, drag an unposted calendar caption to another day. On touch devices or with a keyboard, choose a caption in the calendar's move controls, choose **Choose destination**, then tap a day or focus it and press Enter. Month navigation lets you select destinations in other months. Confirm the move, or cancel it without changing the post.

Moves preserve the **device-local wall-clock posting time**, caption content, photos, status, and reminder offsets; reminders follow the new scheduled timestamp. The confirmation explicitly warns about dates in the past. Invalid daylight-saving times are rejected so they can be corrected in the editor. Posted/archived history cannot be moved. The server rejects stale-page conflicts instead of overwriting a newer change, and unsuccessful requests leave the saved schedule unchanged. As with the existing editor/calendar, posting dates display in the device's timezone; Telegram digest settings continue to use the configured reminder timezone.

## Movable calendar completion stamps

The calendar now includes an optional **A little well done** stamp collection: **50 world-place postage designs**, **50 literary postage designs**, **50 engraved wax seals** (10 emblems in five wax finishes), **50 retro soda bottle caps**, **50 pearly storybook wax seals**, and **20 embroidered patches**. All 270 designs are original, bundled vector artwork, with no external image service or font requirement. They are decorative studio stamps, not real postage.

Wax seals use original botanical/ornamental engravings, an irregular poured-wax edge, inset impressions and subtle textured highlights. Existing wax IDs and saved choices are preserved; the 50 postage designs are unchanged.

The retro bottle-cap collection has five fictional soda flavors for each of ten show/game-inspired worlds: Stranger Things, Fallout, Cyberpunk, The Witcher, Crimson Desert, Arcane, The Last of Us, Wednesday, One Piece, and The Mandalorian. These are curated references, **not a measured popularity ranking**. Every cap uses original label names and pictograms, crimped metal edges and worn enamel; no official logos or product images are bundled. Filter **Bottle caps** or search a franchise/flavor in the picker. Caps use the same per-day selection, saved placement and completion rules as stamps.

The **Pearly storybook wax** collection adds 50 pale, raised-relief seals: 25 Harry Potter-inspired and 25 Enola Holmes-inspired motifs. These use pearl/ivory with subtle blush, moonstone and champagne tints, smooth hand-poured edges and sculpted highlights rather than dark ink outlines. Filter the full pearly collection or either story individually. Each has its own motif (owls, winged keys, potion bottles, botanical clues, bicycles, ciphers and more), not just a recolor. No official crests, logos or product photographs are used. Existing postage, engraved wax and cap designs and saved IDs are unchanged.

The **The Bright Years** literary-postage collection contains 50 original illustrations inspired by **Sarah Damoff’s** novel (not Alison Espach). Its broad themes and Texas setting inform five groups: home, family ties, Texas landscapes, memory/keepsakes, and grace/renewal. These are **spoiler-light thematic interpretations**, not claims that every illustrated object appears in the story. All have distinct motifs, warm paper, perforations and a device-local date cancellation. Search the book title or author, or filter **The Bright Years · 50 styles**. No cover art, quotations, plot revelations or official affiliation are used. The previous 200 designs and saved IDs remain unchanged.

Book identification/theme reference: [Simon & Schuster — The Bright Years by Sarah Damoff](https://www.simonandschuster.com/books/The-Bright-Years/Sarah-Damoff/9781668061459). The collection does not reproduce text from the novel.

The **Embroidered patches** collection adds **20 distinct compositions** across flowers, skies, beach shells, books, calligraphy, art and matcha, often combining themes. The original vector artwork uses colored cloth weave, directional satin-thread patterns, petal/leaf veins, tiny stitches, thread highlights and raised merrow-style borders. Designs have varied silhouettes (oval, round, arched, shield, scalloped and rounded-square) and individual color palettes rather than template recolors. Filter **Embroidered patches · 20 designs**, then search a theme such as *matcha*, *skies*, *beach*, *books* or *calligraphy*. Patch previews are larger for detail inspection; calendar decorations still fit their reserved space. Per-day choice, dragging, keyboard movement, rotation and saved position work exactly like the existing decorations. All previous 250 artworks are unchanged.

### When a stamp appears

A day earns one stamp when it has **at least one scheduled caption and every caption scheduled on that device-local date is marked Posted**. The calculation uses all saved captions, independently of search/content filters, and includes archived posted history. Empty days, unscheduled ideas, and partly finished days do not qualify. Reverting a caption to Draft/Ready removes the visible stamp; completing the day again restores it in its remembered position. The app currently has **no separate goals tracker**, so this feature does not claim to verify other goals or off-app work. No content-gap nudges, reminders, or Telegram messages are added.

### Choosing and arranging

- Tap any completed day’s stamp, or use **Choose a completed day → Choose stamp for this day · 270 styles**. Browse/search all 270 designs and press **Use for this day only**. This saves an individual choice without changing other days, the shared default, or that day’s position/tilt. No Arrange mode is needed; Cancel makes no change.
- **Change shared default** is a separate, explicitly labeled action. It affects only days without their own stamp choice; individually chosen stamps remain unchanged.
- Choose **Arrange stamps** to move stamps using a mouse or finger. Select a completed day in the inspector, or select its stamp. Focus a stamp and use arrow keys (Shift for larger steps), or use the directional buttons. Adjust **Tilt** between −18° and +18°.
- The day picker sets an individual style; **Use default style for this day** removes that style override. **Reset position** restores corner placement and the default tilt while keeping the day’s selected style.
- **Done arranging** restores ordinary calendar interactions. Caption opening/drag-rescheduling is paused inside day boxes while arranging, so stamp gestures cannot accidentally move a post. The normal caption move controls return afterward.
- Stamps live in reserved space below date/task information, not over caption labels. Movement is constrained to this space inside the original day. Position is stored proportionally and bounded using the rotated stamp’s corners, so desktop and phone layouts stay legible. Narrow phone boxes necessarily have less horizontal movement.
- **Show completion stamps** turns the feature off without deleting layouts. There are no notifications or overdue warnings.

Preferences and per-day placements/styles are stored in D1 and sync across devices on reload or returning to the calendar tab. Dates follow the viewing device’s local calendar (the same convention as the existing calendar), not the Telegram digest timezone. Concurrent edits to the same stamp are rejected with a reload/retry message instead of silently overwriting another device; a failed save is never reported as successful. Layout is decoration only: stored positions cannot award an incomplete day a stamp. Caption/photo/template portable backups do not include these cosmetic preferences or layouts; a restored day’s eligibility is recalculated from its captions.

## Title icon personalization

In **Settings → Personalize → Icon beside your title**, choose **Original theme icon**, **Choose an emoji**, or **Upload an image**. Preview changes before pressing **Save icon**. A custom choice syncs through the database and appears beside the signed-in studio title on other devices after reloading. **Use original theme icon** resets it to the current theme's original badge/ornament treatment, including themes that normally hide the badge.

One emoji can include combined emoji such as families, flags, or skin-tone variants. Images can be PNG, JPG, WebP, or GIF up to 8 MB; the browser re-encodes them into a small, static 128 × 128 PNG with preserved transparency and contain-fit (no cropping). Only the bounded PNG is saved, not the original upload, filename, metadata, animation, or an external image URL. The existing badge size/shape, title layout, and theme design remain intact. The login screen, browser favicon, installed app icon, caption photos, and daily verse ornaments are unchanged. This is an app setting, so it is deliberately excluded from portable caption/photo/template backups.

## Backup and restore

Open **Settings → Your data** to download or restore a portable JSON backup.

- **Download backup (JSON)** creates a version 2 Caption Studio file with saved captions, dates, statuses, notes, custom reminder offsets, posted/archive history, and reusable templates. **Include photos** is checked by default and embeds original image bytes in their saved order. Thumbnails are not duplicated; restored photos work through the existing thumbnail fallback. A text-only export records missing-photo counts and does not pretend those photos are recoverable. Photo-only captions need a photo-inclusive backup (or a title before a text-only export).
- Select a JSON file to validate the **entire file** and preview counts, bundled/missing photos, duplicates, and templates. Selecting a file does not import anything. CSV is for spreadsheets, not restore. Older `{ exported_at, posts }` caption exports are supported with an explicit missing-photo warning; an old photo-only caption without a title/text cannot be recovered from metadata alone.
- Restore is **additive**, never a database replacement: it creates missing captions with fresh database IDs, skips previously imported snapshots, and keeps existing captions. Source IDs plus creation/update timestamps recognize originals already in the same studio; fingerprints recognize previously restored snapshots across retries. Changed snapshots may be added as separate recovery copies rather than overwriting newer work. Repeated entries inside one file are skipped.
- **Unposted captions restore as unscheduled drafts by default**, so they cannot trigger posting reminders. Original schedules/statuses require explicitly checking **Restore original schedules** and confirming a warning. That option can resend reminders already delivered elsewhere, including overdue reminders; review dates carefully. Posted and archived history retains its dates/status either way.
- **Add missing templates** is optional and preserves existing same-named templates. The 30-template limit is checked before importing. Application settings, Telegram links/tokens, password/session secrets, sent-reminder history, theme selection, and device-local recovery drafts are deliberately excluded.
- Each caption and its photos are saved in **one transactional D1 batch**. The overall file is imported incrementally to avoid large Worker transactions. If a request fails or the tab closes, already completed captions remain, the status reports partial progress, and selecting/retrying the **same file** resumes safely without duplicating those captions or photos. Canceling the confirmation makes no changes. Keep the tab open while exporting/importing.
- Portable files are limited to **100 MB and 10,000 captions**, with the existing 10-photo/per-caption and resized-image size limits. Oversized exports fail explicitly rather than downloading a truncated/unrestorable file. For larger photo collections, use a text-only backup and download photos separately; this portable workflow is not a substitute for a full Cloudflare D1 database backup.
- Backup files contain **private, unencrypted** caption/photo data. Store them somewhere safe and only restore files you trust. Exports are assembled in your browser; no third-party backup service receives them.

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
   Your site gets an address like `https://my-baby-s-website.<your-name>.workers.dev`.

> Prefer the terminal? Run `npm install`, then `npx wrangler login`, then `npx wrangler deploy`.

### 3. Add your two secrets
In the Cloudflare dashboard, go to your **my-baby-s-website** Worker → **Settings → Variables and Secrets → Add**. Choose type **Secret** for both:

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

## Daily World English Bible verses

Daily cards use the **World English Bible (WEB)**, a modern-English, public-domain translation. There is no Bible-service account, API key, provider request, or verse cache to configure. All 100 selected verses ship as a small static JavaScript module, so the daily reading can change without a verse-service connection once the app's assets are loaded. This does not turn the entire caption planner into an offline app.

- The 100 references and their order are unchanged, preserving existing devices' daily selections. Each device keeps its random seed under `cs-verse-seed`; the same local calendar day always selects the same verse, even after a reload or theme change.
- All 100 readings appear once per 100-day rotation. Midnight, focus, and resume refresh the greeting and reading without touching an unsaved caption. The device's local date is used, independently of the reminder time zone.
- Cards identify the translation as **WEB** and link to [WorldEnglish.Bible](https://worldenglish.bible/). See the [publisher's public-domain statement](https://ebible.org/eng-web/copyright.htm).

### Scripture provenance and maintenance

`public/web-verses.js` contains only the selected 100 verses, not a full Bible or generated paraphrases. The words come from the classic WEB HTML published by eBible.org on 14 June 2017, as parsed in the pinned [TehShrike/world-english-bible snapshot](https://github.com/TehShrike/world-english-bible/tree/68669ba3be9719ae4d1135b19d9e0b6587b7c356). Verse sections/poetry lines are joined with normalized whitespace; the wording and punctuation are preserved, and footnotes are excluded. The translation's public-domain status permits bundling and redistribution. The name “World English Bible” identifies the faithful source text, not an AI-generated adaptation.

To reproduce the bundled module, run `python3 scripts/import-web-verses.py`. This development-only script downloads the pinned source snapshot into memory, extracts the 100 references in `public/daily-verses.js`, and writes `public/web-verses.js`. It also accepts `--archive /path/to/snapshot.zip` for an already-downloaded source. The full source archive is never added to Git, and the running website never downloads it.
