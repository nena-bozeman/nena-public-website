# Migrated documents

PDFs, Word documents, and other downloads from the legacy PyroCMS site live under **`nenabozeman-org/`** (human-readable names from `Content-Disposition`).

## Automated download

From the repo root:

```bash
bash scripts/download-legacy-pdfs.sh
```

The script uses **`curl`** (with a HEAD pass to detect existing files, then `curl -J` for the real filename). It scrapes **`/files/download/<id>`** and direct **`.pdf`** links from the URLs listed in **`PDF_PAGES`** inside the script—extend that array for more sections (e.g. other objectives pages).

Legacy newsletters and meetings expose many files as **`/files/download/...`** (not `/files/large/`). The image script does not fetch those; use this PDF script instead.

## Linking in the new site

After a file is in `public/documents/migrated/nenabozeman-org/`, reference it in Markdown as:

`/documents/migrated/nenabozeman-org/Your%20File.pdf`

(URL-encode spaces in links, or rename files to use hyphens.)
