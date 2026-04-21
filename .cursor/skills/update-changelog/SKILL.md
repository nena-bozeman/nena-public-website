---
name: update-changelog
description: >-
  Updates or appends entries to this repository's CHANGELOG.md at `CHANGELOG.md`
  following project conventions. Use when the user asks to add or update the
  changelog, record release notes, document changes for a release, or after
  completing notable work that should be summarized for the project history.
---

# Update Changelog (nena-public-website)

## File and structure

- **Path:** `CHANGELOG.md` at the repo root.
- **Intro:** Keep the one-line note that entries are documented here and grouped by release period.

Sections in order:

1. **`## [Unreleased]`** — Short line that unreleased work is not yet released (optional bullets if you track unreleased items here).
2. **`---`** separator
3. **`## YYYY-MM-DD`** — Dated release buckets (newest date first, after `[Unreleased]`).
4. **`---`** separator
5. **`### Earlier planning`** — Historical; do not remove unless the user asks.

## When to add

- Append or edit when the user requests it, or when summarizing a meaningful batch of work (features, fixes, migrations, tooling).
- Prefer **one dated section per calendar day** of work; merge new bullets into the **existing date section** if the user is continuing the same day.

## Date selection

- Use the **authoritative “Today’s date”** from the conversation user info when present.
- If missing, use the current date in **YYYY-MM-DD** in the user’s timezone if known, or ask once.

## Bullet format (match existing style)

- **Bold lead phrase** (category or area) followed by a colon, then a concise description in **complete sentences**.
- Use **backticks** for file paths, routes, component names, and env vars when relevant.
- Keep bullets **proportional to the change** (no essay for a single-line fix).
- Group related bullets under the same date; order within a day: **most user-visible or significant first**, or **thematic clusters** (e.g. content, then tooling).

**Examples (style only):**

```markdown
- **Area name:** What changed and why it matters; optional detail (`file.ts`, `route/path`).
```

```markdown
- **Feature:** Short summary of behavior or capability added.
```

## What not to do

- Do not invent releases or version numbers unless the user defines them.
- Do not remove or rewrite past dated sections except to fix clear errors the user asked to correct.
- Do not add engagement bait or redundant headings inside a date block.
- Avoid editing `CHANGELOG.md` when the user only asked for code changes with no documentation request—unless they explicitly want changelog updates.

## Workflow

1. Read `CHANGELOG.md` (or the relevant section if the file is large).
2. Decide whether to add bullets under **`[Unreleased]`** or under a **`YYYY-MM-DD`** section (prefer the dated section for shipped or completed work).
3. If the date section for today does not exist, **insert it immediately after** the `[Unreleased]` block and its separator—**newest dates stay near the top** (below `[Unreleased]`).
4. Append bullets; preserve spacing and `---` separators between major sections.
5. Re-read the edited section for tone and consistency with neighboring bullets.

## Quick checklist

- [ ] Correct date and section placement
- [ ] Bold category + colon + clear description
- [ ] No duplicate or contradictory bullets for the same change
- [ ] Spelling and names (people, products, routes) match the codebase or user’s wording
