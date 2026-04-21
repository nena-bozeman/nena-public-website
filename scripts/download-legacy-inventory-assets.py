#!/usr/bin/env python3
"""Download legacy-inventory assets marked downloaded=no and update CSV + JSON."""

from __future__ import annotations

import csv
import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FILES_JSON = REPO / "data/website-2026-04-21/files.json"
CSV_PATH = REPO / "data/legacy-inventory.csv"
JSON_PATH = REPO / "data/legacy-inventory.json"
DOCS_DIR = REPO / "public/documents/migrated/nenabozeman-org"
IMAGES_DIR = REPO / "public/images/migrated/nenabozeman-org/files/large"

USER_AGENT = "nena-public-website-migration/1.0 (+https://www.nenabozeman.org)"

# The attachment URL 404s; canonical CMS download works.
URL_UPDATES = {
    "https://www.nenabozeman.org/attachment/pdf/885154/21-22_NURB_Work_Plan_draft_041521.pdf": (
        "https://www.nenabozeman.org/files/download/cd9a97ef5a7618e"
    ),
}


def safe_filename(name: str, ext: str) -> str:
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip()
    base = re.sub(r"\s+", " ", base)
    if not ext.startswith("."):
        ext = "." + ext
    if not base.lower().endswith(ext.lower()):
        base = base + ext
    return base


def parse_content_disposition_filename(header: str | None) -> str | None:
    if not header:
        return None
    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";\n]+)"?', header, re.I)
    if m:
        return urllib.parse.unquote(m.group(1).strip('"'))
    return None


def http_get(url: str) -> tuple[bytes, dict[str, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
        data = resp.read()
        headers = {k.lower(): v for k, v in resp.headers.items()}
    return data, headers


def main() -> None:
    with FILES_JSON.open() as f:
        files_by_id: dict[str, dict] = {o["id"]: o for o in json.load(f)}

    with CSV_PATH.open(newline="") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    for row in rows:
        if row.get("downloaded") != "no":
            continue
        kind = row["kind"]
        if kind not in ("file_download", "image_upload", "pdf_link"):
            continue

        url = row["url"].strip()
        orig_url = url
        url = URL_UPDATES.get(url, url)

        notes: list[str] = []
        if row.get("notes"):
            notes.append(row["notes"])

        local_rel: str | None = None

        try:
            if kind == "pdf_link":
                if "mtpmcbr11694" in url:
                    raise RuntimeError("HTTP 404: mtpmcbr11694.pdf not on live site")
                data, headers = http_get(url)
                cd = parse_content_disposition_filename(
                    headers.get("content-disposition")
                )
                name = cd or Path(urllib.parse.urlparse(url).path).name
                p = Path(name)
                dest = DOCS_DIR / safe_filename(p.stem, p.suffix or ".pdf")
                dest.write_bytes(data)
                local_rel = str(dest.relative_to(REPO))
            elif kind == "file_download":
                m = re.search(r"/files/download/([0-9a-f]+)", url)
                if not m:
                    raise RuntimeError("no file id in URL")
                fid = m.group(1)
                meta = files_by_id.get(fid)
                if not meta:
                    raise RuntimeError(f"id {fid} not in files.json")
                dl_url = f"https://www.nenabozeman.org/files/download/{fid}"
                data, headers = http_get(dl_url)
                cd = parse_content_disposition_filename(
                    headers.get("content-disposition")
                )
                ext = meta.get("extension") or ".pdf"
                if cd:
                    p = Path(cd)
                    dest = DOCS_DIR / safe_filename(p.stem, p.suffix or ext)
                else:
                    dest = DOCS_DIR / safe_filename(meta["name"], ext)
                dest.write_bytes(data)
                local_rel = str(dest.relative_to(REPO))
            elif kind == "image_upload":
                m = re.search(r"/files/large/([0-9a-f]+)", url)
                if not m:
                    raise RuntimeError("no image id in URL")
                iid = m.group(1)
                meta = files_by_id.get(iid)
                if not meta:
                    raise RuntimeError(f"id {iid} not in files.json")
                fn = meta.get("filename") or ""
                if not fn:
                    raise RuntimeError("no filename in files.json")
                img_url = f"https://www.nenabozeman.org/files/large/{fn}"
                data, _ = http_get(img_url)
                ext = "." + fn.split(".")[-1] if "." in fn else ".jpg"
                dest = IMAGES_DIR / f"{iid}{ext}"
                dest.write_bytes(data)
                local_rel = str(dest.relative_to(REPO))
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError, OSError) as e:
            notes.append(str(e))
            local_rel = None

        if local_rel:
            row["downloaded"] = "yes"
            row["migrated"] = "partial"
            row["local_repo_path"] = local_rel
        row["notes"] = "; ".join(n for n in notes if n)
        if url != orig_url:
            row["url"] = url

    with CSV_PATH.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)

    by_url = {r["url"]: r for r in rows}
    with JSON_PATH.open() as f:
        jrows = json.load(f)
    for orig, new in URL_UPDATES.items():
        for j in jrows:
            if j.get("url", "").strip() == orig:
                j["url"] = new
    for j in jrows:
        u = j.get("url", "").strip()
        if u in by_url:
            j.update(by_url[u])

    with JSON_PATH.open("w") as f:
        json.dump(jrows, f, indent=2)
        f.write("\n")

    pending = sum(
        1
        for r in rows
        if r.get("downloaded") == "no"
        and r["kind"] in ("file_download", "image_upload", "pdf_link")
    )
    print(f"Updated {CSV_PATH} and {JSON_PATH}. Asset rows still downloaded=no: {pending}")


if __name__ == "__main__":
    main()
