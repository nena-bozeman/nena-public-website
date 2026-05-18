---
name: history-articles
description: >-
  Authors and edits Neighborhood History timeline articles in
  `src/content/history/` for the NENA public website. Covers frontmatter,
  slug naming, tone, structure, images, sourcing, and cross-links. Use when
  adding or revising history content, writing timeline entries, or when the
  user mentions history articles, neighborhood history, or the History page.
---

# Neighborhood History Articles

## Purpose and audience

History articles live on the **Neighborhood History** timeline (`/history`). They are for **residents, newcomers, and neighbors** who want to understand how the Northeast Neighborhood took shape—not for academic publication.

**Goals:**

1. **Place events in neighborhood context** — streets, landmarks, railroad corridor, Beall Park, NENA boundaries (North Broadway to North Grand, East Mendenhall to East Oak when relevant).
2. **Make the timeline useful** — each entry should answer *what happened*, *when*, and *why it matters here*.
3. **Earn trust** — longer pieces cite primary or authoritative sources; do not invent dates, addresses, or listing details.
4. **Connect the timeline** — link related history entries and, when natural, today’s businesses or city programs.

**Tone:** Clear, civic, and readable. Complete sentences. Third person. Past tense for historical events. Confident but not promotional. Explain specialized terms (NRHP, charter vs ordinance) briefly when they matter. Avoid jargon stacks and Wikipedia-style “some scholars believe” hedging unless uncertainty is the point.

**Not the goal:** Exhaustive historiography, generic Bozeman-wide history with no northeast tie-in, or news-style advocacy.

---

## File location and naming

| Item | Convention |
|------|------------|
| Path | `src/content/history/{slug}.md` |
| Slug | `{year}-{short-kebab-description}` — e.g. `1933-misco-grain-elevator-built-on-wallace-avenue.md` |
| Sort key | `year` in frontmatter (timeline orders by year, grouped by `decade`) |

Slug becomes the URL: `/history/{slug}`. Keep slugs stable once published; prefer editing the file over renaming.

---

## Frontmatter (required)

Schema: `src/content/config.ts` (`history` collection).

```yaml
---
title: "Human-readable headline"
year: 1991          # calendar year of the event (timeline badge)
decade: 1990        # floor decade for grouping (1985 → 1980, 2007 → 2000)
category: community # see categories below
image: images/history/example.jpg   # optional
imageAlt: "Describe the image for screen readers."  # required when image is set
---
```

### Categories

Use exactly one:

| Value | Use for |
|-------|---------|
| `founding` | Platting, early settlement, railroad arrival |
| `development` | Building booms, infrastructure, zoning-era change |
| `community` | NENA, city programs, culture, film, institutions |
| `landmark` | Buildings, districts, parks, NRHP listings |
| `other` | Only when nothing else fits |

### Images

- **Prefer** repo assets: `public/images/history/…` referenced as `images/history/filename.jpg` (no leading slash).
- **Hero image** = frontmatter `image` + `imageAlt`; shown above the article body and as the timeline thumbnail.
- **Inline images** in markdown use absolute site paths: `![alt text](/images/history/file.jpg)`.
- **External URLs** are allowed for `image` when licensing requires it; add a **photo credit** at the end of the article (see [1991-a-river-runs-through-it](src/content/history/1991-a-river-runs-through-it.md)).
- Every image needs meaningful **alt text** (what a blind reader needs, not “historic photo”).

---

## Citing sources (with links)

Readers should be able to verify facts. **Link the source in the sentence** where the claim appears—do not leave unsupported statements or footnotes-only citations.

**Inline citations (all tiers B and C, and Tier A when a source exists):**

- Wrap the source name in a markdown link: `According to the [1987 National Register nomination](https://npgallery.nps.gov/…), …`
- Prefer **stable, authoritative URLs**: NPGallery NRHP assets and listing pages, [Historic Montana](https://historicmt.org/), city charter/ordinance on Municode, official city program pages, museum or business “history” pages when they document the building.
- Use **descriptive link text** (“National Register nomination”, “Historic Montana sign program”)—not “click here” or raw URLs in the prose.
- One link per claim is enough; repeat the same PDF link when several facts come from the same nomination.

**When to add `## Sources` (Tier C, or any article with multiple references):**

- Numbered bibliography at the end: author/title, year, and **linked** PDF or catalog record.
- Mirror the best articles: nomination PDF · NRHP record · period photo set · interpretive pages.

**What to cite:** listing dates, NRHP numbers, construction dates, architects, ownership chains, boundaries, quotes, and anything a reader might challenge.

**What not to do:** “Sources say…” without a link; bare `https://…` in body text; inventing citations; citing Wikipedia as primary evidence when an NRHP PDF or Historic Montana entry exists.

---

## Body structure

Length should match the subject. Three common tiers:

### Tier A — Milestone (1 short paragraph)

For a single fact on the timeline with little to cite yet.

- Opening paragraph: what happened, year, neighborhood relevance.
- No headings required.
- Example style: [1985-nena-founded](src/content/history/1985-nena-founded.md), [1902-beall-park](src/content/history/1902-beall-park.md).

### Tier B — Standard (2–4 paragraphs or 1–2 sections)

For NRHP listings, district summaries, or events with a clear story.

- Strong opening paragraph (no heading needed before it).
- Optional `##` sections for distinct beats (locations, legacy, significance).
- **Bold** building or district names on first mention when helpful.
- Link out: [NPGallery NRHP](https://npgallery.nps.gov/), [Historic Montana](https://historicmt.org/), city pages, NENA `/about`.
- End with nomination PDF / period photos when applicable.
- Example style: [1987-north-tracy-avenue-historic-district…](src/content/history/1987-north-tracy-avenue-historic-district-added-to-the-national-register-of-historic-places.md).

### Tier C — Deep dive (multiple sections + sources)

For landmarks, films, or topics with rich documentation.

- Opening: set scene (who, when, where in the neighborhood).
- Sections such as: how it was built, trade/context, later owners, legacy, National Register.
- **Cross-links** to other history slugs: `[Misco Mill](/history/1933-misco-grain-elevator-built-on-wallace-avenue)`.
- Street addresses in **bold** when they anchor the map in the reader’s mind.
- `## Sources` with numbered list for NRHP nominations, sign program pages, museum catalogs.
- Italics for work titles (*A River Runs Through It*).
- Example style: [1933-misco-grain-elevator…](src/content/history/1933-misco-grain-elevator-built-on-wallace-avenue.md), [1991-a-river-runs-through-it](src/content/history/1991-a-river-runs-through-it.md).

### Policy / institutional articles

When explaining city systems (neighborhood associations, charter):

- State what changed and **why it matters to NENA**.
- Link charter, ordinance, and program URLs.
- Optional subsection for NENA’s place in the system.
- Example: [2007-bozeman-neighborhood-associations](src/content/history/2007-bozeman-neighborhood-associations.md).

---

## Writing checklist

Before finishing a new or updated article:

- [ ] `year` matches the event; `decade` is the floored decade (`Math.floor(year/10)*10`).
- [ ] `title` is concise and specific (no trailing spaces).
- [ ] `category` matches the primary angle.
- [ ] Northeast relevance is explicit in the opening or a dedicated section.
- [ ] Addresses and NRHP dates match authoritative sources.
- [ ] Factual claims link to sources inline (descriptive markdown links, not bare URLs).
- [ ] Tier C (or multi-source articles) include a `## Sources` section with linked references.
- [ ] If `image` is set, `imageAlt` is present and accurate.
- [ ] Related history entries are cross-linked where readers would want them.
- [ ] Photo credits included for third-party or CC images.
- [ ] No `.tmp` or unfinished assets committed; images live under `public/images/history/`.

---

## Workflow

1. **Pick tier** (A/B/C) from available sources and neighborhood importance.
2. **Draft frontmatter** — title, year, decade, category; add hero image when you have a rights-clear asset.
3. **Write opening paragraph** — hook + fact + why it belongs on *this* neighborhood’s timeline.
4. **Add sections** only when they improve scanability (avoid one-sentence headings).
5. **Add links** — NRHP/Historic Montana for landmarks; city/NENA for governance.
6. **Verify** — run site build or content collection; confirm slug URL and image paths resolve.

---

## Avoid

- Generic Bozeman history with no northeast angle.
- Unsupported superlatives (“only building in the West”) without a cited source.
- Duplicating an entire NRHP nomination; summarize and link the PDF.
- Broken image paths or missing alt text.
- Renaming slugs without redirects (static site has no automatic redirects).
- Storing engagement bait or calls-to-action; history pages inform, they don’t recruit.

---

## Quick reference — frontmatter template

```yaml
---
title: "Short descriptive title"
year: 0000
decade: 0000
category: landmark
image: images/history/your-photo.jpg
imageAlt: "What the photo shows, including location if known."
---
```

Opening paragraph here. Link to [related entry](/history/other-slug) when relevant.

## Additional examples

See [examples.md](examples.md) for side-by-side weak vs strong openings and NRHP boilerplate patterns.
