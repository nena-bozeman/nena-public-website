# Migrated media (nenabozeman.org)

Place images, PDFs, and other static files pulled from the legacy site here so they are versioned and served from this repo.

**Automated pull (images):** `bash scripts/download-legacy-media.sh` — uses `curl` + `rg`; see `EXTRA_PAGES` in that script.

**PDFs and attachments:** use `bash scripts/download-legacy-pdfs.sh` (newsletters, minutes, etc. via `/files/download/`). See `public/documents/migrated/README.md`.

**Suggested layout**

- `public/images/migrated/` — photos, logos, carousel images, committee banners
- `public/documents/migrated/` — newsletters, meeting minutes, agendas (create this folder when you add PDFs)

**Using in content**

After adding `public/images/migrated/example.jpg`, reference it in Markdown or front matter as:

`/images/migrated/example.jpg`

(The `public/` prefix is omitted in URLs.)

Decap CMS uploads continue to use `/images/uploads/`; keep migrated legacy files in `migrated/` to avoid mixing sources.
