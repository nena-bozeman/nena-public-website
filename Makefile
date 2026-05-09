.PHONY: ci

# Mirrors .github/workflows/ci.yml (install, astro check, tests, Pages + CF builds & link checks)
ci:
	CI=true pnpm install --frozen-lockfile
	pnpm run check
	pnpm test
	pnpm run build
	pnpm run check:internal-links
	pnpm run check:internal-links:cf
