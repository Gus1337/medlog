# MedLog

A private medication and effect log for one person, on one iPhone. Log each dose with one tap, note the effects you notice with a timestamp, and see how each medication affects you over the hours after a dose and over the weeks. An optional weekly summary is written by Claude from statistics computed on the phone.

- **No account, no backend, no analytics.** Everything is stored in the browser's IndexedDB on your iPhone.
- **Works offline** once installed.
- **The only network call** is to Anthropic's API, and only when you have added your own API key and tap **Generate**.

It is an installable web app (PWA): React, TypeScript, Vite, Tailwind CSS, Dexie, Recharts and vite-plugin-pwa, tested with Vitest.

## Install on your iPhone

You need the app's HTTPS address (see [Deploying](#deploying)).

1. On the iPhone, open the address in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**. Keep **Open as Web App** switched on, then tap **Add**.
4. Open **MedLog** from the new Home Screen icon. Always use this icon from now on.

Why the icon matters: Safari keeps a normal tab's storage separate from the Home Screen app. Opened in a Safari tab, MedLog only shows install instructions, so you can't accidentally log data in the wrong place.

The first launch needs an internet connection. After that MedLog works offline. When a new version is deployed, it updates itself in the background; close and reopen the app to use it.

### First steps

1. **Medications** tab → **Add medication**: name, usual dose and unit, what it's for, a colour, and usual times of day.
2. **Today**: tap **Taken** on a card when you take a dose (an **Undo** appears for a few seconds). Tap a logged dose to change its time or amount, mark it skipped, or remove it.
3. **I noticed something**: type what you noticed, tap a feel (Good, Neutral or Unwanted), then **Save**. Tags, strength, medication and time are optional. "Not sure" is the default medication.
4. **Evening check-in** at the bottom of Today: four 1–5 sliders, or **Not today**.

## Habits

Habits are a separate tracker that lives on **Today**, below the medications. They are not part of the medication graphs or AI summaries.

- **Add a habit**: on Today (or **Habits → Add habit**), pick a preset such as Read, Workout or 10K steps, or make your own.
  - **Done / not done** habits are logged with one tap on the circle. Tap again to undo.
  - **Amount** habits (steps, minutes, pages) open a small sheet where you type the amount or tap **Reached the target**.
- **Targets**: every habit has a number of days per week you aim for, and amount habits also have a daily target. A day counts when you reach the daily target.
- **Progress** (on Today, next to the Habits heading): one line per habit showing how much of its weekly target you reached over the 7 days up to each day, over 4 weeks, 3 months or a year. Tap the habit chips to show or hide lines.
- **Habit page** (tap a habit's name): this week and the period at a glance, the last 14 days to fill in or correct, a line of days on target, and for amount habits a line of the daily amounts against the target. Habits can be edited, archived (history kept) or deleted.

There are no streaks and nothing marks a missed day.

## Back up and restore your data

Your data exists only on this iPhone. Deleting the Home Screen icon deletes the data with it. Back up now and then.

### Back up

1. **Settings** (gear icon, top right) → **Backup** → **Back up now**.
2. In the share sheet choose **Save to Files**, and pick **iCloud Drive** or **On My iPhone**. AirDrop to a Mac or emailing it to yourself also works.
3. Settings shows the date of your last backup.

The backup is one JSON file with all medications, doses, effects, tags, notes, check-ins, summaries and habits. It deliberately leaves out your API key and PIN. The file isn't encrypted, so keep it somewhere private.

### Restore (for example on a new phone, or after reinstalling)

1. Install MedLog as above and open it from the Home Screen.
2. **Settings** → **Backup** → **Restore from a backup file**, and choose the file in Files.
3. Confirm. **Everything currently in MedLog is replaced** by the backup's contents.
4. If you used AI summaries, paste your API key again, and set your PIN again if you want one.

### Other data options

- **Export CSV**: all raw data as spreadsheet files, one per kind of record (doses, effects with time since dose, notes, check-ins, habits and the habit log, and so on).
- **Summary as PDF**: open a saved summary and tap **Print or PDF**. In the print preview, use **Share → Save to Files** (or pinch out on the preview) to get a PDF.
- **Delete all data**: removes everything, including the API key and PIN, after a confirmation.

## AI summaries

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) → **API keys**. Usage is billed to that Anthropic account; a weekly summary is one short request.
2. In MedLog: **Settings** → **AI summaries**, paste the key, then **Save key**. It is stored only on the phone.
3. **Insights** → **Weekly summary**: choose Overall or a medication and a week, then tap **Generate**.

What is sent: statistics computed on the phone (counts per tag, typical hours after a dose, good versus unwanted counts, dose and check-in figures, and the same figures for the week before), plus up to eight short excerpts from effect entries and four notes. Nothing else.

With fewer than 5 effect entries in the week, MedLog says there isn't enough data and sends nothing. The model is told to describe patterns only, never to give dosing or medical advice, to state how many entries the summary is based on, and to say so when it cannot tell which medication caused an effect.

The model ID is set once, in `src/lib/summary/claude.ts` (`CLAUDE_MODEL_ID`, currently `claude-opus-5-5`). Requests use server-side refusal fallbacks (`fallbacks: "default"`), so if Anthropic's safety classifier declines a request, the API retries it on another model instead of failing.

## PIN lock

**Settings** → **Lock** → **Turn on PIN lock** (4–8 digits). MedLog then asks for the PIN when it opens and after two minutes in the background. The lock is a privacy screen: it keeps people who pick up your phone out of the app, but it does not encrypt the stored data. A forgotten PIN can't be recovered; the lock screen offers to erase everything so you can restore a backup.

## Development

Requirements: Node.js 20 or later.

```sh
npm install
npm run dev        # http://localhost:5173/?browser&sample
npm test           # unit tests (Vitest)
npm run build      # type-check and production build into dist/
npm run preview    # serve dist/ locally
npm run icons      # regenerate the PNG icons in public/
```

In development, `?browser` skips the install screen so you can use a desktop browser, and `?sample` replaces all data with a few weeks of made-up entries. **Settings → Development → Load sample data** does the same. None of this is included in production builds.

Project layout:

| Path | What's there |
|---|---|
| `src/db/` | Dexie database and record types |
| `src/data/` | Reads and writes (medications, entries, check-ins, habits, summaries, backup) |
| `src/lib/` | Pure logic with tests: time since dose, analytics, habit progress, search, CSV, PIN, summary aggregation and prompt |
| `src/components/`, `src/screens/` | UI |
| `src/dev/sampleData.ts` | Development-only sample data |

## Deploying

MedLog is a static site: `npm run build` produces `dist/`, which any HTTPS static host can serve. The build reads `BASE_PATH` when the site lives under a subpath (for example `BASE_PATH=/medlog/` for `https://you.github.io/medlog/`).

### GitHub Pages (how MedLog is deployed)

`.github/workflows/deploy.yml` runs the tests, builds with `BASE_PATH=/<repository name>/`, and publishes `dist/` to GitHub Pages on every push to `main`. The site is then at `https://<your-username>.github.io/<repository name>/`.

First-time setup with the GitHub CLI:

```sh
brew install gh                 # if it isn't installed
gh auth login                   # GitHub.com → HTTPS → log in with a web browser
gh repo create medlog --public --source . --push
gh api -X POST repos/{owner}/medlog/pages -f build_type=workflow   # turn on Pages, source: GitHub Actions
gh run watch                    # follow the first deployment
```

Or on github.com: create an empty repository, then run `git remote add origin https://github.com/<you>/<repo>.git` and `git push -u origin main`. Then go to the repository's **Settings → Pages** and set **Source** to **GitHub Actions**.

GitHub Pages on a free account needs a public repository. That only exposes the code: your data stays on your phone and the repository contains no keys or personal data.

**Updating:** commit and `git push`. The workflow redeploys, and the installed app picks up the new version the next time you close and reopen it.

**Moving to a different address loses access to the data.** iOS ties a Home Screen app's storage to its web address. If the repository is renamed or you switch hosts, back up first, install from the new address, and restore the backup there.
