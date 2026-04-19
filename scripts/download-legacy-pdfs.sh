#!/usr/bin/env bash
# Archive PDFs (and other attachments) from www.nenabozeman.org into public/documents/migrated/.
# Discovers /files/download/<id> and direct .pdf links on configured HTML pages. Uses curl -J
# so the server-provided filename is preserved (e.g. "NENA NEWS Spring 2026.pdf").
#
# Usage: bash scripts/download-legacy-pdfs.sh
# Requires: curl, rg

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/documents/migrated/nenabozeman-org"
BASE="https://www.nenabozeman.org"
UA='Mozilla/5.0 (compatible; NENA-migration/1.0; +local-repo-script)'

mkdir -p "$DEST"

TMP=$(mktemp)
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

# Add paths that link to newsletters, minutes, or other PDFs.
PDF_PAGES=(
  "/objectives/nena-newsletters"
  "/objectives/nena-meetings"
  "/blog"
  "/blog/2024/12/fall-2024-nena-news"
  "/blog/2025/10/nena-news-fall-2025"
  "/blog/2026/04/nena-news-spring-2026"
)

collect_download_urls() {
  local html="$1"
  rg -o 'https://www\.nenabozeman\.org/files/download/[0-9a-f]+' "$html" 2>/dev/null || true
  rg -o '//www\.nenabozeman\.org/files/download/[0-9a-f]+' "$html" 2>/dev/null | sed 's|^//|https://|' || true
  rg -o '/files/download/[0-9a-f]+' "$html" 2>/dev/null | while read -r p; do echo "${BASE}${p}"; done || true
  rg -o 'https://www\.nenabozeman\.org[^"'\'')<> ]+\.pdf(\?[^"'\''<> ]*)?' "$html" 2>/dev/null || true
  rg -o '//www\.nenabozeman\.org[^"'\'')<> ]+\.pdf(\?[^"'\''<> ]*)?' "$html" 2>/dev/null | sed 's|^//|https://|' || true
}

normalize_url() {
  sed -e 's|https://www\.nenabozeman\.org//\+|https://www.nenabozeman.org/|g' <<<"$1" | sed 's|[[:space:]]||g'
}

remote_attachment_filename() {
  local url="$1"
  local line
  line="$(curl -sSIL -m 45 -A "$UA" "$url" | tr -d '\r' | rg -i '^content-disposition:' | tail -1 || true)"
  if [[ "$line" =~ filename\*=UTF-8\'\'([^;]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$line" =~ filename=\"([^\"]+)\" ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

sanitize_filename() {
  # Avoid path components in Content-Disposition
  basename "$1" | tr '/\\' '__' | tr -d '\0'
}

for page in "${PDF_PAGES[@]}"; do
  echo "=== HTML: $page ==="
  curl -fsSL -m 60 -A "$UA" "${BASE}${page}" -o "$TMP" || { echo "warn: failed $page"; continue; }
  collect_download_urls "$TMP"
done | while read -r raw; do
  [[ -z "$raw" ]] && continue
  url="$(normalize_url "$raw")"
  [[ "$url" == *nenabozeman.org* ]] || continue
  echo "$url"
done | sort -u >"${TMP}.urls"

while read -r url; do
  [[ -z "$url" ]] && continue
  fname=""
  if fname="$(remote_attachment_filename "$url")"; then
    fname="$(sanitize_filename "$fname")"
  else
    id="${url##*/}"
    id="${id%%\?*}"
    fname="download-${id}.bin"
  fi
  target="${DEST}/${fname}"
  if [[ -f "$target" ]]; then
    echo "skip (exists): $fname"
    continue
  fi
  echo "GET $url -> $fname"
  curl -fsSL -m 120 -A "$UA" -J "$url" --output-dir "$DEST" -o "$fname" || echo "warn: curl failed $url"
  # If server lied and it's not PDF, file(1) helps spot it
  if [[ -f "$target" ]]; then
    echo "  $(file -b "$target" | head -c 80)"
  fi
done <"${TMP}.urls"

echo "Done. PDFs under: $DEST"
