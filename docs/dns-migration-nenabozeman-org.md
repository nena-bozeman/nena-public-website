# DNS migration to nenabozeman.org

Move public traffic from the staging Worker URL (`nena-public-website.nenabozeman.workers.dev`) to the production domain **`nenabozeman.org`**. The site is a static Astro build deployed to the Cloudflare Worker **`nena-public-website`** ([`wrangler.jsonc`](../wrangler.jsonc)); GitHub Actions on `main` runs the deploy ([`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml)).

Use this checklist when you are ready to cut over. Most application changes are a single environment variable (`ASTRO_SITE`); DNS and Cloudflare routing are the main operational work.

## Current vs target

| | Today | After cutover |
|---|--------|----------------|
| Public URL | `https://nena-public-website.nenabozeman.workers.dev` | `https://nenabozeman.org` (or `https://www.nenabozeman.org`) |
| Hosting | Cloudflare Worker + static assets | Same Worker, custom domain attached |
| Content URLs in HTML | Built from `ASTRO_SITE` | Built from production `ASTRO_SITE` |
| Google Calendar event links | Staging URL in descriptions | Production URL (updated automatically on next deploy) |
| Decap CMS `site_domain` | `nena-public-website.nenabozeman.workers.dev` | Production hostname editors use |

The old Craft CMS site lived at **`www.nenabozeman.org`**. Plan redirects so bookmarks, search results, and inbound links keep working.

---

## Prerequisites

- [ ] Admin access to the **Cloudflare account** that hosts the Worker (see [`docs/cloudflare-github-actions-setup.md`](cloudflare-github-actions-setup.md)).
- [ ] Access to **DNS** for `nenabozeman.org` (registrar and/or Cloudflare zone).
- [ ] Admin access to the **GitHub** repo (`cloudflare-production` environment).
- [ ] Staging site verified at `https://nena-public-website.nenabozeman.workers.dev` before switching DNS.

---

## Step 1: Choose the canonical hostname

Pick **one** primary URL and redirect the other to it everywhere (SEO, calendar links, OAuth).

| Option | Canonical | Typical redirect |
|--------|-----------|------------------|
| Apex (matches [`Base.astro`](../src/layouts/Base.astro) fallback) | `https://nenabozeman.org` | `www.nenabozeman.org` → apex |
| Legacy-style | `https://www.nenabozeman.org` | `nenabozeman.org` → www |

The rest of this doc uses **`https://nenabozeman.org`** as the example. Substitute `https://www.nenabozeman.org` if you choose www as canonical.

---

## Step 2: Cloudflare — zone and DNS

### If `nenabozeman.org` is not on Cloudflare yet

1. Cloudflare Dashboard → **Add a site** → enter `nenabozeman.org`.
2. Copy the assigned **nameservers** at your domain registrar (GoDaddy, Google Domains, etc.).
3. Wait for the zone to become **Active** (can take up to 24–48 hours, often faster).

### Attach the domain to the Worker

1. **Workers & Pages** → **`nena-public-website`** → **Settings** → **Domains & Routes** (or **Triggers** → **Custom Domains**, depending on dashboard layout).
2. **Add Custom Domain** → enter `nenabozeman.org` (and `www.nenabozeman.org` if you serve both).
3. If the zone is on Cloudflare, confirm the suggested **DNS records** (Worker routes / proxied records are created automatically).

### If DNS stays at an external provider

You can still use a Cloudflare Worker custom domain, but setup differs. Prefer moving the zone to Cloudflare for simplicity. If you cannot:

- Point a **CNAME** for `www` to the hostname Cloudflare provides for the Worker custom domain, **or**
- Follow [Cloudflare’s external DNS guidance](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) for your case.

### SSL

With the zone on Cloudflare and the orange cloud (proxied) enabled, **Universal SSL** covers HTTPS. Confirm **SSL/TLS** mode is **Full (strict)** once the custom domain is active.

---

## Step 3: Redirect legacy Craft URLs

Two layers handle old paths:

### Path redirects (same host)

[`public/_redirects`](../public/_redirects) ships with the static build and maps legacy paths (e.g. `/objectives/...`, `/businesses/...`) to the new site structure. Regenerate when the legacy inventory changes:

```bash
pnpm run inventory:legacy
MIGRATION_TARGET_ORIGIN=https://nenabozeman.org pnpm run redirects:legacy
```

Commit updated `_redirects` before cutover if you changed mappings.

### Host-level bulk redirects (old `www.nenabozeman.org` URLs)

[`scripts/build-cloudflare-redirects.mjs`](../scripts/build-cloudflare-redirects.mjs) emits `data/cloudflare-bulk-redirects.csv` for Cloudflare **Bulk Redirects** (full URLs from the old site → new site):

```bash
MIGRATION_TARGET_ORIGIN=https://nenabozeman.org \
LEGACY_ALSO_APEX=1 \
pnpm run redirects:legacy
```

Import the CSV in Cloudflare Dashboard → **Bulk Redirects** (see `data/cloudflare-bulk-redirects.env-note.txt` after generation). Set `LEGACY_ALSO_APEX=1` so both `www.nenabozeman.org` and `nenabozeman.org` legacy URLs redirect.

### www ↔ apex

Add a **Redirect Rule** (or Bulk Redirect) so the non-canonical host redirects to the canonical one with **301**, e.g.:

- If canonical is apex: `https://www.nenabozeman.org/*` → `https://nenabozeman.org/$1`

---

## Step 4: Application and CI configuration

These changes make generated links, CMS auth, and calendar sync use the production domain.

### `ASTRO_SITE` (primary knob)

Used by [`astro.config.mjs`](../astro.config.mjs) (canonical URLs, sitemap, OG tags, markdown link expansion) and by [Google Calendar sync](../docs/google-calendar-sync-setup.md) (event descriptions and `source.url`).

**Recommended:** GitHub → **Settings → Environments → `cloudflare-production` → Environment variables**:

| Variable | Value |
|----------|--------|
| `ASTRO_SITE` | `https://nenabozeman.org` |

Then update [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) so **build and sync** both see it (job-level `env` is ideal):

```yaml
env:
  ASTRO_SITE: https://nenabozeman.org
  PUBLIC_GOOGLE_MAPS_API_KEY: ${{ secrets.PUBLIC_GOOGLE_MAPS_API_KEY }}
```

Remove any duplicate `ASTRO_SITE` on individual steps once it is set at job level.

**Do not** change `ASTRO_SITE` for PR preview deploys ([`preview.yml`](../.github/workflows/preview.yml)); previews should keep using the workers.dev URL.

### Decap CMS

In [`public/admin/config.main.yml`](../public/admin/config.main.yml):

```yaml
site_domain: nenabozeman.org   # must match the hostname where editors open /admin
```

Run `pnpm cms:build-config` (or push to `main`; `prebuild` runs it automatically). The OAuth proxy (`nena-website-edit.nenabozeman.workers.dev`) stays the same; only the public `site_domain` changes.

### Google Maps API key

In Google Cloud Console, add HTTP referrer restrictions for the production site:

- `https://nenabozeman.org/*`
- `https://www.nenabozeman.org/*` (if used)
- Keep `http://localhost:4321/*` for local dev

See [`.env.example`](../.env.example) and [`scripts/geocode-business-addresses.mjs`](../scripts/geocode-business-addresses.mjs) for the separate geocoding key (not referrer-restricted).

### Google Calendar sync

No code changes. After `ASTRO_SITE` points at production, the next deploy updates all synced events (content hash includes calendar descriptions). See [`docs/google-calendar-sync-setup.md`](google-calendar-sync-setup.md).

### Local development

Optional in `.env`:

```bash
ASTRO_SITE=https://nenabozeman.org
```

Use staging URL locally if you prefer not to generate production canonicals on your machine.

### GitHub deployment environment URL

Update the `url:` under `environment:` in `deploy-cloudflare.yml` to `https://nenabozeman.org` so GitHub’s deployment links point at production.

---

## Step 5: Recommended cutover order

Do these in order to minimize broken links and double deploys:

1. **Prepare redirects** — regenerate `_redirects` and bulk CSV with `MIGRATION_TARGET_ORIGIN=https://nenabozeman.org`; import bulk redirects in Cloudflare.
2. **Attach custom domain** to the Worker; confirm HTTPS works on the new hostname *before* changing public DNS (Cloudflare often allows testing via dashboard).
3. **Set `ASTRO_SITE`** in GitHub and Decap `site_domain`; merge to `main`.
4. **Deploy** — push triggers build → calendar sync (production URLs) → `wrangler deploy`.
5. **Switch DNS** (if nameservers or records were not already pointing at Cloudflare).
6. **Verify** (checklist below).
7. **Keep** `nena-public-website.nenabozeman.workers.dev` available for staging/debug; optionally add a redirect rule from workers.dev → production if you do not want a public staging URL.

---

## Step 6: Verify

- [ ] `https://nenabozeman.org` loads the homepage over HTTPS.
- [ ] Non-canonical host redirects to canonical (www ↔ apex).
- [ ] Sample legacy URLs redirect (e.g. old `/objectives/...`, `/blog/...` paths from bookmarks or bulk list).
- [ ] `/admin` loads Decap; login and save a test edit on production hostname.
- [ ] An event page shows correct canonical / OG URL in page source.
- [ ] Google Calendar event description links use `nenabozeman.org` (after post-cutover deploy).
- [ ] Embedded map loads (Maps API referrer allowlist).
- [ ] GitHub **Deploy to Cloudflare** workflow succeeds on `main`.

---

## What you do not need to change

| Item | Why |
|------|-----|
| Event/news markdown internal links (`/events/...`, `/places/...`) | Expanded at build time from `ASTRO_SITE` |
| `legacyUrl` / `legacyBlogUrl` in content | Intentional references to the old site |
| Calendar sync script | Reads `ASTRO_SITE` from the environment |
| Worker name in `wrangler.jsonc` | Same Worker; only custom domains added |

---

## Rollback

If something goes wrong after DNS cutover:

1. Revert DNS or custom-domain attachment so traffic returns to the workers.dev URL (or previous host).
2. Set `ASTRO_SITE` back to `https://nena-public-website.nenabozeman.workers.dev` and redeploy.
3. Revert Decap `site_domain` if editors cannot authenticate.

Google Calendar entries will update again on the next sync after `ASTRO_SITE` changes.

---

## Related docs

- [Cloudflare GitHub Actions setup](cloudflare-github-actions-setup.md)
- [Google Calendar sync setup](google-calendar-sync-setup.md)
- [Link checking](link-checking.md) — run after large URL changes if you rebuild locally
