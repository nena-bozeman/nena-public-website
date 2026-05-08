# Cloudflare secrets for GitHub Actions

The workflow [`.github/workflows/preview.yml`](../.github/workflows/preview.yml) deploys **preview builds** to Cloudflare Pages on pushes to non-`main` branches and on pull requests. It needs Cloudflare credentials and the same public build secrets as local builds.

Use this checklist when onboarding a new fork or rotating credentials.

## Prerequisites

- Access to the Cloudflare account that owns the Pages project (see `projectName` in `preview.yml`, currently **`nena-public-website`**).
- Admin access to the GitHub repository **Settings → Secrets and variables → Actions**.

---

## Todo: Cloudflare dashboard

- [x] **Confirm the Pages project exists**
  Cloudflare Dashboard → **Workers & Pages** → open the project whose name matches `projectName` in `preview.yml`. Create the project if it does not exist (you can connect GitHub later or rely only on this Action—either works once the project name matches).

- [ ] **Copy the Account ID**
  Dashboard **Overview** (right sidebar) or **Workers & Pages** → your Pages project → copy **Account ID** (32-character hex). You will store this as `CLOUDFLARE_ACCOUNT_ID`.

- [ ] **Create an API token for CI**
  Dashboard → **My Profile** (or account menu) → **API Tokens** → **Create Token**.

  Recommended approach:

  - Use template **“Edit Cloudflare Workers”** as a starting point **or** create a **Custom token** with minimal scope.

  Minimum scopes that match deploying to Pages via the API (adjust if the UI labels differ slightly):

  - **Account** → **Cloudflare Pages** → **Edit**
  - Optionally narrow **Account Resources** to this account only.

  If deploy fails with permission errors, compare against [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) and add the smallest extra scope the error asks for.

- [ ] **Save the token value once**
  After creation, Cloudflare shows the token **only once**. Copy it to a password manager; you will paste it into GitHub as `CLOUDFLARE_API_TOKEN`.

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo nena-bozeman/nena-public-website
gh secret set CLOUDFLARE_API_TOKEN --repo nena-bozeman/nena-public-website
```

---

## Todo: GitHub repository secrets

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Required for previews | Notes |
|--------|----------------------|--------|
| `CLOUDFLARE_ACCOUNT_ID` | Yes | From Cloudflare Overview / Pages project. |
| `CLOUDFLARE_API_TOKEN` | Yes | Token with Pages deploy permission for this account. |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Yes for maps on previews | Same variable name as local `.env`; inlined at build time. |

- [x] Add **`CLOUDFLARE_ACCOUNT_ID`**
- [x] Add **`CLOUDFLARE_API_TOKEN`**
- [x] Add **`PUBLIC_GOOGLE_MAPS_API_KEY`** (if not already set for other workflows)

The workflow also passes `GITHUB_TOKEN` automatically; no manual secret is needed for it.

---

## Verify

- [ ] Open a **pull request** or push a branch **other than `main`**.
- [ ] In GitHub → **Actions**, confirm **Deploy Preview** succeeds.
- [ ] In Cloudflare → **Workers & Pages** → **Deployments**, confirm a new preview deployment appears.

---

## Related

- **Production:** [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) deploys `main` to **GitHub Pages**, not Cloudflare.
- **Manual Cloudflare Workers deploy:** `pnpm run deploy:cf` uses `wrangler.jsonc`; that path is separate from this preview workflow.
