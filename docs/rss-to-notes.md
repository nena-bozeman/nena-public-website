# rss-to-notes

The script [`scripts/rss-to-notes.mjs`](../scripts/rss-to-notes.mjs) downloads the **NENA Mailchimp campaign archive RSS feed** (or reads a saved XML file) and prints a **compact table** of each campaign: publication date, subject line, and web archive link.

With **`--write`**, it also creates **draft** news posts under [`src/content/news/`](../src/content/news/) for campaigns whose `mailchi.mp` archive link is not already referenced anywhere in `src/content/news/` or `src/content/events/`.

## Default feed

The default URL is the public archive feed for this neighborhood list:

`https://us18.campaign-archive.com/feed?u=f1ec16560a226111c086eeb58&id=16f66e5916`

To point at a different list without changing the script, set **`RSS_TO_NOTES_URL`** or pass **`--url`**.

## Commands

```bash
# Markdown table on stdout (default)
pnpm run rss-to-notes

# Create draft news stubs for campaigns missing from content
pnpm run rss-to-notes -- --write
make rss-to-notes

# Preview stub paths without writing
pnpm run rss-to-notes -- --write --dry-run

# Machine-readable index only
pnpm run rss-to-notes -- --format json
pnpm run rss-to-notes -- --format tsv

# Saved copy (e.g. from browser or curl), including Cursor uploads with a "Source URL" preamble
pnpm run rss-to-notes -- --file ./path/to/feed.xml

# Another feed
pnpm run rss-to-notes -- --url 'https://us18.campaign-archive.com/feed?u=...&id=...'
```

## Workflow

1. Run **`make rss-to-notes`** (or **`pnpm run rss-to-notes -- --write`**) to list campaigns and create draft stubs for new ones.
2. **Invite vs reminder:** a later “today/tonight” campaign is a new stub (different Mailchimp id) but should **reuse** the existing event. Keep the reminder as its own news post when it adds same-day detail; delete the stub only if it is a true duplicate with nothing new.
3. Fill stubs from each **archive link** (the RSS `<description>` is awkward to parse). Prefer the **expand-mailchimp-stubs** skill: it fetches `mailchimpArchiveUrl`, rewrites the news post, and creates or reuses [`src/content/events/`](../src/content/events/) entries when the campaign is a gathering.
4. Set **`draft: false`** when the post is ready. Event schema: [`src/content.config.ts`](../src/content.config.ts).

## What `--write` creates

Each stub includes:

- Frontmatter: `title`, `date` (from RSS `pubDate`), placeholder `summary`, `draft: true`, and `mailchimpArchiveUrl` when the feed provides a link
- Empty body — the GitHub Action fills this from the campaign when the model succeeds and then sets `draft: false`. A file that stays a bare stub keeps `draft: true`

`--write` also prints a reminder to run the **expand-mailchimp-stubs** skill.

Matching is by **`mailchi.mp` campaign id** already present in any news or events markdown file (including `mailchimpArchiveUrl` in frontmatter). Existing posts are never overwritten.

## Limitations

- **Parsing** is regex-based so malformed XML or unusual entities may drop fields; if something looks wrong, use **`--file`** on a fresh download. The item `<description>` (campaign HTML) is not parsed or executed.
- **`pubDate`** can be missing if the feed item is truncated (rare); those items are skipped with an error when using **`--write`**.
- **`--write` refuses an empty body or a response that is not an RSS document** (`<rss>` and `<channel>`). A valid feed with zero `<item>`s writes nothing. Existing news and event files are never deleted or overwritten.
- Stubs are **news only**. Use the **expand-mailchimp-stubs** skill (`.cursor/skills/expand-mailchimp-stubs/`) to fill bodies and add event pages from the archive URL.

## GitHub Actions

[`.github/workflows/mailchimp-rss-stubs.yml`](../.github/workflows/mailchimp-rss-stubs.yml) runs this same `--write` import. It does not expand stubs, send email, deploy, or merge.

### Schedule

`15 14 * * *` — every day at **14:15 UTC** (7:15am MST, 8:15am MDT). This job had no earlier cadence; daily is the initial default. Edit that cron to change it.

### Manual run

Actions → **Mailchimp RSS draft stubs** → **Run workflow**. Leave **Dry run** off and pick the **default branch**. The workflow checks out that branch and reads the default feed URL in `scripts/rss-to-notes.mjs`. There is no input for a different feed. A run that is not a dry run refuses any other branch, so it cannot update `automation/mailchimp-rss-stubs` from a feature branch. That stop is written to the job summary: which branch ran, why a non-dry run is limited to the default branch, and the fix (rerun with **Dry run** checked, or run from the default branch).

To try a fix before merging it, pick the branch that contains this workflow file and set **Dry run** to true. That dispatch still receives repository Actions secrets such as `GEMINI_API_KEY`. The **Check Gemini model is available** step runs first, including on a dry run. It then imports against the default branch's content, calls the model for campaigns that are not already in that content, and writes the summaries and extracted events to the job summary. It does not commit, push, or open a pull request.

### Review pull request

- Branch: `automation/mailchimp-rss-stubs`. One open pull request against the default branch.
- A run with nothing new does not commit and does not open a pull request.
- A later run updates that same pull request when another campaign is new. It does not open a second one.
- Commits add only new `src/content/news/*.md` draft stubs. They do not modify or delete files already on the branch or on the default branch.
- Edits on the open pull request stay, including a stub someone filled in or removed. A removed stub is not put back while that pull request is open.
- If that branch has non-automation commits and the pull request is closed, the job fails instead of force-pushing. Reopen the pull request or delete the branch.
- A closed pull request whose commits are only from this workflow can be replaced from the default branch when stubs are still missing there. The replacement uses `git push --force-with-lease`.
- Import failures (HTTP error, empty body, non-RSS response, a stub that fails validation) stop before any push.
- Summarized news posts use `draft: false`, the same as other published news. Merging the review pull request puts them on the site. Bare stubs stay `draft: true`. Production builds omit those drafts, so merging stores them and does not publish them. The pull request and the job summary say which files are drafts and why. Event files from the same run are published when their date is today or later: merging puts them on the site, and the production deploy syncs them to Google Calendar. The news post links those events, and each event links back to the news post.

`pnpm run check` (content references and `astro check`) runs in the workflow before it pushes. Feed subjects and links are written only as frontmatter fields.

### Campaign summaries

When repository secret **`GEMINI_API_KEY`** is set, each **new** stub is filled from its campaign page before the first commit that adds that file. A later run does not call the model again for a path already on `automation/mailchimp-rss-stubs`, and it does not call the model for a stub someone removed from that open pull request.

1. The workflow uses the campaign HTML already in the RSS `<description>`. `mailchi.mp` often returns HTTP 503 to the importer, so that short link is only a fallback. Unsubscribe, preference, share, and tracking lines are dropped. At most 8,000 characters of that text are sent. If a campaign stays a bare stub, the review pull request says why.
2. It calls Google Gemini at `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with the key in the `x-goog-api-key` header. The default model is **`gemini-3.5-flash-lite`**. A 429, 500, 502, 503, 504, network, or timeout is retried up to five times. The wait starts at 20 seconds, doubles with jitter, and is capped at 3 minutes. A `Retry-After` header or `RetryInfo` delay is used when Gemini sends one, still capped at 3 minutes. 400, 401, 403, and 404 are not retried. Optional variable **`GEMINI_FALLBACK_MODEL`** is a second Flash or Flash-Lite id. After the primary model is still returning HTTP 503, that id is used only if the models list includes it and it supports `generateContent`. The job summary and the review pull request show how many retries each campaign used. `GEMINI_RETRY_ATTEMPTS`, `GEMINI_RETRY_BASE_MS`, and `GEMINI_RETRY_MAX_MS` change the waits. The models-list check retries 5xx more gently (`GEMINI_LIST_RETRY_*`, three attempts, starting at 2 seconds). The [models guide](https://ai.google.dev/gemini-api/docs/models) lists that id as a stable Flash-Lite model and says new projects should use 3.5 Flash-Lite or 3.8 Flash, because access to the 2.5 models is limited to projects that have already used them. An optional repository variable **`GEMINI_MODEL`** overrides the id; leave it unset to keep the default. A blank value also uses the default. The page is data, inside a delimiter, with a prompt that says to ignore instructions in the newsletter. News output is capped at 512 tokens. Gemini 2.5 models get `thinkingBudget: 0`. Newer models get `thinkingLevel: MINIMAL`. If the call fails, the review pull request includes the model id and the API error message, with the key redacted.
3. The script writes the front matter itself: RSS title and date, `draft: false` when the summary is usable, empty topics and tags, and the original `mailchimpArchiveUrl`. A bare or failed stub keeps `draft: true`. The model cannot add or change those fields. A link in the body must already appear on the page.
4. The review pull request marks summarized files as published on merge and marks bare stubs as drafts that will not publish. It says why each bare stub failed so it can be rerun or filled in.
5. A second model call looks for gatherings. It can add zero, one, or several event files when the page states a date and a clock time, the model marks the item high confidence, and the location appears in the page. Past gatherings, duplicates of events already in `src/content/events`, low-confidence items, and replies without an explicit time are listed in the pull request and not added. The news post links the new events, and each event links back with `newsSlugs`. Those event files are ordinary published events for a date of today or later: merging the review pull request puts them on the site, and the production deploy then syncs them to Google Calendar. They are not on `main` until that merge, so they are not in production or on the calendar before then. A summarized news post is also published on that merge. A bare stub is not.

Before the import, **Check Gemini model is available** (`scripts/check-gemini-model.mjs`) calls `https://generativelanguage.googleapis.com/v1beta/models` with the key in the `x-goog-api-key` header. The key is not printed. The step runs for a scheduled run, a normal manual run, and a dry run. It passes when the configured model is in that list and supports `generateContent`. On a pass, the job summary says so, names the model and whether it came from the `GEMINI_MODEL` variable or the default in `scripts/lib/gemini-summary.mjs`, includes the display name and token limits when the API returns them, and lists the other `generateContent` models in a collapsed section with Flash-Lite and Flash first. The import step then adds the campaign summaries and extracted events to that same job summary, for a normal run and a dry run.

The step fails the job, with a `::error` annotation and the same text in the job summary, when:

- `GEMINI_API_KEY` is missing
- Gemini returns 401 or 403 (bad key or the API is not enabled; the message links to [Google AI Studio](https://aistudio.google.com/apikey))
- the models list cannot be reached, or Gemini returns 5xx
- the configured model is missing or does not support `generateContent`. That message names the model id and where it came from, lists the models that do support `generateContent` with Flash-Lite and Flash first, and says to set `GEMINI_MODEL` under **Settings → Secrets and variables → Actions → Variables** to one of those ids, or update the default in `scripts/lib/gemini-summary.mjs`, then rerun

A later per-campaign model failure still leaves that file as a bare stub and the run continues. Files already on the automation branch are not rewritten. To summarize a bare stub that is already on the open pull request, delete that file from the branch and run the workflow again.

#### Add `GEMINI_API_KEY`

This change does not create the secret.

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey) and sign in.
2. Create an API key. Leave billing unlinked if you want the free tier below.
3. In this repository, open **Settings → Secrets and variables → Actions → New repository secret**.
4. Name the secret exactly `GEMINI_API_KEY`. Paste the AI Studio key as the value. Do not commit the key or put it in the workflow file.

To pin a different model, add an Actions **variable** (not a secret) named `GEMINI_MODEL` under **Settings → Secrets and variables → Actions → Variables**. The value is the model id, for example `gemini-3.5-flash-lite`.

#### Price

Numbers below are copied from the **Standard** rows for `gemini-3.5-flash-lite` on [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) (“A cost-efficient model, optimized for high-volume agentic tasks, translation, and simple data processing”). This workflow does not enable Search grounding or Maps grounding.

| | Free tier | Paid tier, per 1M tokens |
| --- | --- | --- |
| Input (text, image, video, audio) | Free of charge | $0.30 |
| Output, including thinking tokens | Free of charge | $2.50 |

On that same table, **Used to improve our products** is **Yes** for the free tier and **No** for the paid tier. The Standard rows are token prices. This workflow does not add Search or Maps grounding.

### One-time setup

1. In the repository, open **Settings → Actions → General → Workflow permissions** and enable **Allow GitHub Actions to create and approve pull requests**. `GITHUB_TOKEN` cannot open the review pull request until this is on. This workflow never approves or merges a pull request. It does not change this setting.
2. Optional secret **`GEMINI_API_KEY`**, from Google AI Studio, if new stubs should be summarized. The archive feed itself is public. Do not add a Mailchimp API key. Setup is under [Campaign summaries](#campaign-summaries).
3. The workflow asks for `contents: write` and `pull-requests: write` for `GITHUB_TOKEN`. If an organization policy blocks those permissions, an owner has to allow them. This repository change does not edit organization or repository settings.
4. Events created by `GITHUB_TOKEN` do not start other workflows. Opening or pushing this review pull request does **not** run [ci.yml](../.github/workflows/ci.yml) or [preview.yml](../.github/workflows/preview.yml). A person pushing a commit onto the branch will. A PAT or GitHub App token is not set up here; add one only if those workflows must start on their own, and store it with the repository's existing Actions secret process.

### Local import

`make rss-to-notes` still writes stubs into the checkout you have open. The Action runs the import against a temporary copy of the default branch, then commits only the new stub files.
