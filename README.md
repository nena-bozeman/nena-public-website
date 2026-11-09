# nena-public-website

Starting point for NENA's next website in 2026.

## Development

```bash
pnpm install
pnpm run dev
```

CI-style checks locally: **`make ci`** (types, tests, build, internal + external link checks).

Homebrew dev tools (including [Lychee](https://lychee.cli.rs/) for external link checks):

```bash
brew bundle
```

See [docs/link-checking.md](docs/link-checking.md) for other install options, commands, and config.

Mailchimp archive stubs: [docs/rss-to-notes.md](docs/rss-to-notes.md). A daily Action opens a review pull request when the import finds new campaigns.
