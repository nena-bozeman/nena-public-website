#!/usr/bin/env bash
# Download images (and image-like /files/*) from www.nenabozeman.org into public/images/migrated/.
# Re-run after adding paths to EXTRA_PAGES. Requires curl.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/images/migrated/nenabozeman-org"
BASE="https://www.nenabozeman.org"
UA='Mozilla/5.0 (compatible; NENA-migration/1.0; +local-repo-script)'

mkdir -p "$DEST"

download() {
  local url="$1"
  local out="$2"
  mkdir -p "$(dirname "$out")"
  if [[ -f "$out" ]]; then
    echo "skip (exists): $out"
    return 0
  fi
  echo "GET $url -> $out"
  curl -fsSL -m 60 -A "$UA" "$url" -o "$out"
  # Pyro /files/large/<id> has no extension — add one from Content-Type bytes
  local base
  base="$(basename "$out")"
  if [[ "$out" == *'/files/'* ]] && [[ "$base" != *.* ]]; then
    case "$(file -b --mime-type "$out")" in
      image/jpeg) mv "$out" "${out}.jpg" && echo "  -> renamed ${out}.jpg" ;;
      image/png) mv "$out" "${out}.png" && echo "  -> renamed ${out}.png" ;;
      image/gif) mv "$out" "${out}.gif" && echo "  -> renamed ${out}.gif" ;;
      image/webp) mv "$out" "${out}.webp" && echo "  -> renamed ${out}.webp" ;;
    esac
  fi
}

# Theme assets referenced on homepage (paths mirror site for traceability)
THEME_IMGS=(
  "/addons/shared_addons/themes/bootstrap_slim/img/nena_logo_lg.png"
  "/addons/shared_addons/themes/bootstrap_slim/img/favicon/apple-touch-icon.png"
  "/addons/shared_addons/themes/bootstrap_slim/img/favicon/favicon-16x16.png"
  "/addons/shared_addons/themes/bootstrap_slim/img/favicon/favicon-32x32.png"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/Beall_Park.jpg"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/Beall_Park_Center.jpg"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/Mtn_Man.jpg"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/Parade_Rock.jpg"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/n-wallace-mill-1680.jpg"
  "/addons/shared_addons/themes/bootstrap_slim/img/home-slider/peach_st_studio.jpg"
)

for path in "${THEME_IMGS[@]}"; do
  download "${BASE}${path}" "${DEST}${path}"
done

# Homepage inline (PyroCMS /files/large/2ec09042822984d — DB title historicNE.jpg); name in data/migrated-legacy-large-by-id.json
download "${BASE}/files/large/2ec09042822984d" "${DEST}/files/large/historicne.jpg"

TMP=$(mktemp)
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

EXTRA_PAGES=(
  "/about"
  "/blog"
  "/objectives"
  "/objectives/affordable-housing"
  "/objectives/nena-newsletters"
  "/objectives/nena-meetings"
  "/objectives/udc"
  "/objectives/vision-ne"
  "/objectives/trailsandpocketparks"
  "/objectives/trees"
  "/ne-business-directory"
  "/upcoming-events"
  "/donate"
  "/blog/2024/12/fall-2024-nena-news"
  "/blog/2025/10/nena-news-fall-2025"
  "/blog/2026/04/nena-news-spring-2026"
)

collect_urls_from_html() {
  local file="$1"
  # Protocol-relative and absolute URLs on this host
  rg -o 'https://www\.nenabozeman\.org[^"'\'')<> ]+' "$file" 2>/dev/null || true
  rg -o '//www\.nenabozeman\.org[^"'\'')<> ]+' "$file" 2>/dev/null | sed 's|^//|https://|' || true
  # Root-relative theme and uploads
  rg -o '/addons/shared_addons/[^"'\'')<> ]+\.(jpg|jpeg|png|gif|webp|svg|ico)' "$file" 2>/dev/null | while read -r p; do echo "${BASE}${p}"; done || true
  rg -o '/files/[^"'\'')<> ]+' "$file" 2>/dev/null | rg '/files/(large|medium|small)/' | while read -r p; do echo "${BASE}${p}"; done || true
}

for page in "${EXTRA_PAGES[@]}"; do
  echo "=== Fetch HTML: $page ==="
  curl -fsSL -m 45 -A "$UA" "${BASE}${page}" -o "$TMP" || { echo "warn: failed $page"; continue; }
  while IFS= read -r url; do
    [[ -z "$url" ]] && continue
    # Strip trailing punctuation junk
    url="${url%%\?*}"
    case "$url" in
      *.jpg|*.jpeg|*.png|*.gif|*.webp|*.svg|*.ico) ;;
      *'/files/large/'*|*'/files/medium/'*|*'/files/small/'*)
        # Often no extension; PyroCMS commonly serves JPEGs for photos
        ;;
      *) continue ;;
    esac
    rel="${url#https://www.nenabozeman.org}"
    out="${DEST}${rel}"
    download "$url" "$out" || true
  done < <(collect_urls_from_html "$TMP" | sort -u)
done

echo "Done. Assets under: $DEST"
