# Cloudflare Workers deploys via GitHub Actions

Production and preview deploys use **Wrangler / Workers API** with static assets from `dist` per [`wrangler.jsonc`](../wrangler.jsonc) (`name`: **`nena-public-website`**). There is no GitHub Pages deploy and no `/nena-public-website/` subpath.

| Workflow | Trigger | Command |
|----------|---------|---------|
| [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) | Push to `main`, manual | `pnpm run build` → `wrangler deploy` |
| [`.github/workflows/preview.yml`](../.github/workflows/preview.yml) | PRs and non-`main` branches | `pnpm run build` → `wrangler versions upload` |

Local production deploy: **`pnpm run deploy`** (`build` then `wrangler deploy`).

Use this checklist when onboarding a new fork or rotating credentials.

## Prerequisites

- Access to the Cloudflare account that owns the Worker (see `name` in `wrangler.jsonc`).
- Admin access to the GitHub repository **Settings → Secrets and variables → Actions**.

---

## Todo: Cloudflare dashboard

- [x] **Confirm the Worker exists**
  Cloudflare Dashboard → **Workers & Pages** → open the Worker whose name matches `name` in `wrangler.jsonc`. Create it if needed (e.g. first local `pnpm run deploy` or dashboard **Create**).

- [ ] **Use GitHub Actions as the only Git-driven deploy (recommended)**
  If this Worker is **also** connected to the GitHub repo under **Settings → Builds** (or legacy Git integration), Cloudflare will build and deploy on every push **in addition** to these workflows—duplicate deploys and confusing deployment history. **Disconnect** the repo from Cloudflare for builds and rely on GitHub Actions.

- [ ] **If you keep Workers Builds connected**, update **Settings → Build** on the Worker so commands match [`package.json`](../package.json) (the old `*:cf` scripts were aliases for root-hosted builds; `ASTRO_BASE_PATH=/` is now the default):

  | Setting | Value |
  |---------|-------|
  | Build command | `pnpm run build` |
  | Deploy command | `pnpm run deploy` (or `npx wrangler deploy` if build runs separately) |
  | Non-production branch deploy command | `npx wrangler versions upload` |
  | Build variables | `PUBLIC_GOOGLE_MAPS_API_KEY` (required for maps at build time) |

  Thin `build:cf` / `deploy:cf` aliases remain in `package.json` so existing dashboard settings keep working until you update them.

- [x] **Copy the Account ID**
  Dashboard **Overview** (right sidebar) or the Worker’s **Settings** → copy **Account ID** (32-character hex). Store this as `CLOUDFLARE_ACCOUNT_ID`.

- [x] **Create an API token for CI**
  Dashboard → **My Profile** (or account menu) → **API Tokens** → **Create Token**.

  Recommended approach:

  - Start from template **“Edit Cloudflare Workers”**, **or** create a **Custom token** with minimal scope.

  Minimum scopes that match **`wrangler deploy`** / **`wrangler versions upload`** (labels may vary slightly):

  - **Account** → **Workers Scripts** → **Edit** (or the Workers edit scope included in the template above).
  - Optionally narrow **Account Resources** to this account only.

  If deploy fails with permission errors, compare against [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) and add the smallest extra scope the error asks for.

- [x] **Save the token value once**
  After creation, Cloudflare shows the token **only once**. Copy it to a password manager; you will paste it into GitHub as `CLOUDFLARE_API_TOKEN`.

```bash
# Replace repo if onboarding a fork.
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo nena-bozeman/nena-public-website
gh secret set CLOUDFLARE_API_TOKEN --repo nena-bozeman/nena-public-website
```

---

## Todo: GitHub repository secrets

Repository → **Settings** → **Secrets and variables → Actions** → **New repository secret**.

| Secret | Required | Notes |
|--------|----------|--------|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | From Cloudflare Overview or Worker settings. |
| `CLOUDFLARE_API_TOKEN` | Yes | Token with permission to deploy Worker versions for this account. |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Yes for maps | Same variable name as local `.env`; inlined at build time. |

- [x] Add **`CLOUDFLARE_ACCOUNT_ID`**
- [x] Add **`CLOUDFLARE_API_TOKEN`**
- [x] Add **`PUBLIC_GOOGLE_MAPS_API_KEY`** (if not already set)

---

## Verify

- [x] Push to **`main`** → **Deploy to Cloudflare** succeeds and updates production at `https://nena-public-website.nenabozeman.workers.dev`.
- [x] Open a **pull request** or push a branch **other than `main`** → **Deploy Preview** succeeds.
- [x] **Dependabot** and **fork** pull requests skip **Deploy Preview** (no access to Cloudflare secrets). **CI** still runs on those PRs: `astro check`, unit tests, `pnpm run build`, content-reference validation, internal-link checks, and `wrangler deploy` / `wrangler versions upload` **dry-runs** (no API token required).
- [x] In Cloudflare → **Workers & Pages** → select the Worker → **Versions**, confirm new versions appear.

---

## Legacy GitHub Pages URLs

The site was previously hosted at `https://nena-bozeman.github.io/nena-public-website/`. After disabling GitHub Pages in repo settings, add redirects at the DNS/hosting layer if needed. On the Worker, [`public/_redirects`](../public/_redirects) maps `/nena-public-website/*` → `/*` for any links that still use the old subpath pattern.

When **`nenabozeman.org`** goes live, set `ASTRO_SITE` in CI/local builds and update `site_domain` in [`public/admin/config.main.yml`](../public/admin/config.main.yml).
