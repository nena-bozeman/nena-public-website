# Legacy site inventory

Regenerate from the repo root:

```bash
npm run inventory:legacy
```

- **`legacy-inventory.csv`** — open in Sheets/Excel; filter `downloaded=no` to queue asset pulls, `migrated=no` for content work.
- **`legacy-inventory.json`** — same rows as JSON for scripting.

**Sources:** `blog/rss/all.rss` (titles for blog posts), `sitemap.xml` → blog + pages sitemaps, then each listed HTML page is crawled for linked assets (`/files/download/`, `/files/large/`, theme images, `.pdf`).

**Flags:** `--no-crawl-assets` (pages only, faster), `--no-fetch` (reuse cached HTML under `data/.cache/`, still does HEAD for download URLs unless cached).

**Column semantics (heuristic, not legal truth):**

| Column | Meaning |
|--------|--------|
| `downloaded` | `yes` if a matching file exists under `public/…/migrated/nenabozeman-org/`; `n/a` for HTML pages. |
| `migrated` | Blog → `src/content/news` title match (same **year** as URL + score); objectives → markdown exists; assets → `yes` only if linked from `src/` (otherwise `partial` if on disk). |
| `new_site_path` | Suggested route on the Astro site; placeholders like `/news/(suggested legacy slug: …)` mean no confident news file yet. |

Edit the CSV in place to track human decisions (e.g. set `migrated=yes` when a post is ported, fill `new_site_path`).

---

## Cloudflare redirects (from inventory)

After the inventory JSON exists:

```bash
npm run redirects:legacy
```

- **`public/_redirects`** — [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/redirects/) format (`/old/path /new/path 301`). Only rows with a **concrete** `new_site_path` (no `(suggested …)` placeholders) become rules. Copied to **`dist/_redirects`** on `astro build`.

- **`data/cloudflare-bulk-redirects.csv`** — for [Bulk Redirects](https://developers.cloudflare.com/rules/url-forwarding/bulk-redirects/reference/csv-file-format/) on the **legacy** zone (cross-domain to the new site). **No header row** (Cloudflare requirement). Generated only when you set:

  `MIGRATION_TARGET_ORIGIN=https://YOUR-NEW-PAGES-URL` (no trailing slash)

  Optional: `LEGACY_ALSO_APEX=1` duplicates each line for `nenabozeman.org` (no `www`).

If `MIGRATION_TARGET_ORIGIN` is unset, see **`data/cloudflare-bulk-redirects.env-note.txt`** instead of the CSV.

Typical pipeline:

```bash
npm run inventory:legacy
npm run redirects:legacy
MIGRATION_TARGET_ORIGIN=https://nena.pages.dev npm run redirects:legacy
```
