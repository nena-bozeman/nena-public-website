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
- Empty body — expand from the archive URL in frontmatter before publishing

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

Actions → **Mailchimp RSS draft stubs** → **Run workflow**, from the **default branch**. The workflow checks out that branch and reads the default feed URL in `scripts/rss-to-notes.mjs`. There is no input for a different feed.

### Review pull request

- Branch: `automation/mailchimp-rss-stubs`. One open pull request against the default branch.
- A run with nothing new does not commit and does not open a pull request.
- A later run updates that same pull request when another campaign is new. It does not open a second one.
- Commits add only new `src/content/news/*.md` draft stubs. They do not modify or delete files already on the branch or on the default branch.
- Edits on the open pull request stay, including a stub someone filled in or removed. A removed stub is not put back while that pull request is open.
- If that branch has non-automation commits and the pull request is closed, the job fails instead of force-pushing. Reopen the pull request or delete the branch.
- A closed pull request whose commits are only from this workflow can be replaced from the default branch when stubs are still missing there. The replacement uses `git push --force-with-lease`.
- Import failures (HTTP error, empty body, non-RSS response, a stub that fails validation) stop before any push.
- Stubs stay `draft: true`. Production and preview builds omit drafts, so merging the review pull request stores them and does not publish them.

`pnpm run check` (content references and `astro check`) runs in the workflow before it pushes. Feed subjects and links are written only as frontmatter fields.

### One-time setup

1. In the repository, open **Settings → Actions → General → Workflow permissions** and enable **Allow GitHub Actions to create and approve pull requests**. `GITHUB_TOKEN` cannot open the review pull request until this is on. This workflow never approves or merges a pull request. It does not change this setting.
2. No new secret. The archive feed is public. Do not add a Mailchimp API key for this job.
3. The workflow asks for `contents: write` and `pull-requests: write` for `GITHUB_TOKEN`. If an organization policy blocks those permissions, an owner has to allow them. This repository change does not edit organization or repository settings.
4. Events created by `GITHUB_TOKEN` do not start other workflows. Opening or pushing this review pull request does **not** run [ci.yml](../.github/workflows/ci.yml) or [preview.yml](../.github/workflows/preview.yml). A person pushing a commit onto the branch will. A PAT or GitHub App token is not set up here; add one only if those workflows must start on their own, and store it with the repository's existing Actions secret process.

### Local import

`make rss-to-notes` still writes stubs into the checkout you have open. The Action runs the import against a temporary copy of the default branch, then commits only the new stub files.
