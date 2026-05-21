# rss-to-notes

The script [`scripts/rss-to-notes.mjs`](../scripts/rss-to-notes.mjs) downloads the **NENA Mailchimp campaign archive RSS feed** (or reads a saved XML file) and prints a **compact table** of each campaign: publication date, subject line, and web archive link. Use that output when creating [`src/content/news/`](../src/content/news/) posts and [`src/content/events/`](../src/content/events/) entries so you do not have to copy titles and URLs by hand.

## Default feed

The default URL is the public archive feed for this neighborhood list:

`https://us18.campaign-archive.com/feed?u=f1ec16560a226111c086eeb58&id=16f66e5916`

To point at a different list without changing the script, set **`RSS_TO_NOTES_URL`** or pass **`--url`**.

## Commands

```bash
# Markdown table on stdout (default)
pnpm run rss-to-notes

# Machine-readable
pnpm run rss-to-notes -- --format json
pnpm run rss-to-notes -- --format tsv

# Saved copy (e.g. from browser or curl), including Cursor uploads with a "Source URL" preamble
pnpm run rss-to-notes -- --file ./path/to/feed.xml

# Another feed
pnpm run rss-to-notes -- --url 'https://us18.campaign-archive.com/feed?u=...&id=...'
```

## Workflow

1. Run **`pnpm run rss-to-notes`** and paste or save the Markdown table into your notes, or use **`--format json`** for tooling.
2. **Collapse duplicates**: Mailchimp often sends a **reminder** with the same topic as an earlier **invite**—one news post and one event is usually enough.
3. Open each **archive link** for full HTML; the RSS `<description>` is the entire email and is awkward to parse automatically. Pull dates, times, addresses, and survey links from the web version.
4. Add content under **`src/content/news/`** and **`src/content/events/`** following existing frontmatter in this repo ([`src/content/config.ts`](../src/content/config.ts)).

## Limitations

- **Parsing** is regex-based so malformed XML or unusual entities may drop fields; if something looks wrong, use **`--file`** on a fresh download.
- **`pubDate`** can be missing if the feed item is truncated (rare); fill the date from Mailchimp when you draft the post.
