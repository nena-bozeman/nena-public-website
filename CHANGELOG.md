# Changelog

All notable changes to this project are documented here. Entries are derived from the git history and grouped by release period.

## [Unreleased]

Changes not yet released.

---

## 2026-05-30

- **Site-wide content linking:** Curated **topics** (`src/schemas/topics.ts`) replace tag-driven objective linking; `topics` front matter on news, events, meetings, places, development, history, and objectives powers cross-collection **RelatedContent**, **TopicPills**, topic browse at `/topics/[topic]`, and a build-time **backlink** index (`src/utils/backlinks.ts`, `src/utils/related-content.ts`, `src/utils/content-relationships.ts`).
- **Businesses → places migration:** The `businesses` content collection is now **`places`** with `placeType` (`business` | `park` | `landmark`); directory routes live at `/places` with `/businesses/*` and `/ne-business-directory` redirected; parks and landmarks join neighborhood businesses on the map and listings.
- **Decap CMS meetings + relation widgets:** New **NENA Meetings** collection and relation pickers on news, events, and meetings for linked entities; shared **topics** multiselect synced via `scripts/generate-cms-topic-options.mjs` (`pnpm cms:topic-options`).
- **Content backfill:** `scripts/migrate-content-linking.mjs` and manual edits add `topics` and entity cross-refs across news, events, objectives, development, and places; `scripts/validate-content-references.mjs` (`pnpm validate:content-references`) guards slug integrity in CI.
- **`businesses/[slug]` build fix:** Legacy business detail URLs redirect to `/places/[slug]` so static paths no longer conflict with the places collection after the rename.
- **Spring 2026 meeting:** Meeting entry for the April 13 potluck linked to the calendar event and related news posts; formal minutes pending with notes recap linked.
- **Places directory filters:** **Place type** pills (Business, Park, Landmark) on `/places` alongside existing category filters; map view respects the active type filter.
- **Legacy tag redirects:** `/news/tag/{tag}` 301 redirects to `/topics/{topic}` for migrated curated topics (trees, UDC, housing, environment, and others).

---

## 2026-05-07

- **Cloudflare preview deploys (GitHub Actions):** Non-`main` pushes and all pull requests run `.github/workflows/preview.yml`: `pnpm install --frozen-lockfile`, `pnpm run build:cf`, then `wrangler versions upload` through `cloudflare/wrangler-action@v3` with `packageManager: pnpm`. Static assets are served from `dist` per `wrangler.jsonc`. Required secrets are `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `PUBLIC_GOOGLE_MAPS_API_KEY`; the workflow passes `gitHubToken` for Wrangler’s GitHub integration.
- **Hosting split:** Production traffic on `main` is still published to **GitHub Pages** by `.github/workflows/deploy-pages.yml` using `pnpm run build`. A **full** Cloudflare Worker deploy (not the preview upload) is `pnpm run deploy:cf` (`build:cf` then `wrangler deploy`).

---

## 2026-04-22

- **News drafts:** Boolean `draft` on news entries so unfinished posts are omitted from production builds but still appear in development; `NewsDraftBadge.astro` on listings and post pages; filtering consolidated in `news.ts` and applied across news index, pagination, tag, home, and objective-related views; Decap CMS field in `public/admin/config.yml`.
- **Business geocoding:** Batch address geocoding via `scripts/geocode-business-addresses.mjs` with Geocoding API setup noted in `.env.example`; refined coordinates and optional image fields in business front matter feed the map, cards, and detail pages, with supporting helpers (`business-image.ts`, `website-label.ts`, category utilities).

## 2026-04-21

- **Google map (business directory):** **Map** view on `/businesses` (list / map toggle) using the **Google Maps JavaScript API** via `BusinessMap.astro` and a **`PUBLIC_GOOGLE_MAPS_API_KEY`** in the environment. Category-colored pins, legend, info windows, and overlapping-pin spreading (`business-map-points.ts`); map initializes when the map tab is shown, with a clear message when the key is missing or the API is misconfigured.
- **Business hero / cover images:** Per-listing cover art in `src/assets/businesses/<slug>.*`, resolved with `getBusinessCoverImage()` and shown on `BusinessCard` and business detail pages. **Batch fetch** of `og:image` / `twitter:image` from public sites with `scripts/fetch-business-hero-images.mjs`, with **manual** assets for listings where a site has no useful preview, only a logo, or a fetch fails.
- **Business directory:** Many Northeast / Northside business listings added as markdown entries with individual pages; main directory list and map limited to **open** listings.
- **Business status and archive:** Replaced `active` with **`status`** (`open` | `closed`) and optional **`closedYear`** in the content schema; **`/businesses/archive`** page for past businesses; cards and detail pages show closed state; Decap CMS business fields updated.
- **Business content corrections:** **Misco Mill** kept open; **Live from the Divide** marked closed (former Bozeman location; venue now in Livingston); removed erroneous closed status from Misco Mill.
- **News and objectives:** Link news posts to objectives via tags; filter and display related news on objective pages (`ObjectiveRelatedNews`, `news.ts` utilities).
- **Meeting minutes:** Meeting minutes archive and improved base URL handling for assets and links.
- **Legacy migration:** Inventory scripts and news backfill tooling for migrating content from the legacy site.

## 2026-04-19

- **Navigation and content:** Navigation and footer updates; objectives order and titles; timeline and footer with images and layout tweaks.
- **Legacy redirects:** Initial `_redirects` mapping from old URLs to the new site.
- **Branding and UX:** Favicon, logo, Tailwind styling, simplified header, email copy clarification.
- **Quality:** Internal link checker enhancements (verbose output, skip reasons); CI workflow and dependency updates.
- **Tooling:** Legacy inventory management scripts and data; migration-related documentation under `public/documents/migrated` and scripts.

## 2026-04-14

- **Core site:** Initial static NENA website (Astro): pages, content collections, layouts, and styling.
- **Security:** Astro upgraded to 5.15.8 (patch for reflected XSS advisory).
- **CMS / admin:** Decap CMS admin route and `config.yml` path fixes for Astro 5 dev server and GitHub Pages.
- **Hosting:** GitHub Actions workflow to publish to GitHub Pages; `BASE_URL` applied across internal links for project-page hosting.
- **Repository:** `.gitignore` added; build artifacts and `node_modules` removed from tracking.

## 2026-04-13

- **Bootstrap:** Initial repository and merge of the first static-site implementation (pull request #1).

---

### Earlier planning

- Initial planning and prompt artifacts committed at the start of the project (`Initial commit`, `Initial plan`, `initial prompt for building the site`).
