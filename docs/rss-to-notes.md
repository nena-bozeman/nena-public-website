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
2. **Collapse duplicates**: Mailchimp often sends a **reminder** with the same topic as an earlier **invite**—one news post and one event is usually enough. Delete or merge redundant stubs.
3. Open each **archive link** for full HTML; the RSS `<description>` is the entire email and is awkward to parse automatically. Pull dates, times, addresses, and survey links from the web version into the stub.
4. Set **`draft: false`** and flesh out the body when the post is ready. Add related **`events`** entries under [`src/content/events/`](../src/content/events/) when appropriate ([`src/content/config.ts`](../src/content/config.ts)).

## What `--write` creates

Each stub includes:

- Frontmatter: `title`, `date` (from RSS `pubDate`), placeholder `summary`, `draft: true`, and `mailchimpArchiveUrl` when the feed provides a link
- Empty body — expand from the archive URL in frontmatter before publishing

Matching is by **`mailchi.mp` campaign id** already present in any news or events markdown file (including `mailchimpArchiveUrl` in frontmatter). Existing posts are never overwritten.

## Limitations

- **Parsing** is regex-based so malformed XML or unusual entities may drop fields; if something looks wrong, use **`--file`** on a fresh download.
- **`pubDate`** can be missing if the feed item is truncated (rare); those items are skipped with an error when using **`--write`**.
- Stubs are **news only** — event entries still need to be added manually when a campaign announces a meeting or gathering.
