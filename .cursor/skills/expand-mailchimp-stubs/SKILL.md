---
name: expand-mailchimp-stubs
description: >-
  Turns Mailchimp campaign stubs from `make rss-to-notes` into news posts by
  fetching each mailchi.mp archive URL, then creates or links event pages when
  the email announces a gathering. Use after rss-to-notes, when expanding draft
  news stubs, converting Mailchimp campaigns into src/content/news or
  src/content/events, or when the user mentions Mailchimp archives, newsletter
  stubs, or campaign-to-events.
---

# Expand Mailchimp stubs

Complete the workflow in `docs/rss-to-notes.md`: stubs are empty drafts; this skill fills them from the web archive and adds events when the campaign is about a gathering.

Schema: `src/content.config.ts`. Topics: `src/schemas/topics.ts`. Mirror published pairs such as `src/content/news/2026-08-03-parade-of-sheds-planning-meeting.md` + `src/content/events/2026-08-06-parade-of-sheds-planning-meeting.md`. Side-by-side patterns: [examples.md](examples.md).

## Workflow

Copy and track:

```
- [ ] Stubs present (run `make rss-to-notes` if not)
- [ ] Each stub’s archive fetched
- [ ] Duplicates classified (invite vs reminder vs new topic)
- [ ] News stubs updated
- [ ] Events created or reused
- [ ] Bidirectional slug links
- [ ] `node scripts/validate-content-references.mjs` passes
```

**Do not commit** unless the user asks.

### 1. Find work

Draft stubs live in `src/content/news/` with `draft: true` and `mailchimpArchiveUrl`. Process all of them unless the user names files.

If there are no stubs and the user wants new campaigns ingested, run from the public-website repo:

```bash
make rss-to-notes
```

Keep the stub **filename**. News `date` stays the RSS send date (`'YYYY-MM-DD'` quoted). Do not rename.

### 2. Fetch the archive

For each stub, open `mailchimpArchiveUrl` (WebFetch; `curl -L` if the page is too thin).

Use the **campaign body** only. Ignore view-in-browser, share bars, unsubscribe, address footer, and “powered by Mailchimp”.

Pull: headline, dates/times, location, RSVP or survey URLs, parking, and any second gathering mentioned.

Prefer the **real destination** for links (Partiful, city calendar, engage.bozemanmt.gov). Drop Mailchimp tracking wrappers when the destination is visible. Do not hotlink Mailchimp CDN images unless the user asks.

Do not invent times, addresses, or RSVP links. If the archive is empty or blocked, stop on that stub and report it.

### 3. Classify

| Kind | News | Event |
|------|------|--------|
| **Invite** — dated gathering (meeting, walk, volunteer night, potluck, parade, hearing NENA is mobilizing for) | Fill stub | Create if none exists |
| **Reminder** — same gathering as an earlier campaign | Fill stub; keep as its own post | **Reuse** the existing event; append this news slug |
| **Multi-date** — two walks, two meetings | One news post | One event file per date |
| **Related future event** mentioned in passing (e.g. Parade of Sheds date inside a planning-meeting email) | Link it | Create only if that gathering is not already in `src/content/events/` |
| **Survey / deadline / newsletter / civic ask** with no NENA gathering | Fill stub only | None |
| **NENA spring/fall meeting** | Fill stub | Event + `meetingSlug` if `src/content/meetings/` already has that season; **do not** create a meetings entry from an invite |

Search existing news/events by title, date, and topic before creating. Mailchimp campaign IDs differ for invite vs reminder, so both get stubs — that is expected.

### 4. Update the news stub

Set `draft: false` when the body is complete. Keep `mailchimpArchiveUrl`. `featured: false` unless it is a major neighborhood-wide event (spring/fall meeting, Parade of Sheds). `tags` stay `[]` unless a freeform tag truly helps.

```yaml
---
title: Human title (clean the subject; keep it recognizable)
date: '2026-08-03'
summary: >-
  One or two sentences: who, what, when, where. Must work as a list blurb.
featured: false
draft: false
tags: []
topics:
  - parade-of-sheds
  - volunteer
  - community
events:
  - 2026-08-06-parade-of-sheds-planning-meeting
places:
  - beall-park
mailchimpArchiveUrl: https://mailchi.mp/…
---
```

- **`topics`:** only values from `TOPIC_VALUES`. Typical: `community` plus the subject (`volunteer`, `meeting`, `parade-of-sheds`, `environment`, `bozeman-udc`, `historic-preservation`, …). Omit `newsletter` unless it is actually a newsletter issue.
- **`events` / `places` / `developments` / `meetings`:** slugs of files that exist (no `.md`). Add `places` when the email is at a known directory place.
- **`date`:** quoted `'YYYY-MM-DD'`.

**Body:** Civic, neighborly, complete sentences. Lead with the action and the datetime. Bold the when/where. Link:

- Events: `/events/{slug}`
- Other news: `/news/{slug}`
- Places: `/places/{slug}`
- Our Work: `/our-work/{objective-slug}` (from `TOPIC_OBJECTIVE_SLUG` in `src/schemas/topics.ts`)

Include RSVP, parking, and survey links from the email. Optional `##` headings for parking or agenda. Do not paste the whole Mailchimp HTML. Do not add a “see the Mailchimp announcement” line on news unless there is no better primary link.

### 5. Create or reuse events

**Create** when the email is an invite (or a reminder whose event is missing) and `src/content/events/` has no matching gathering.

**Filename:** `{YYYY-MM-DD}-{kebab-title}.md` using the **event** calendar date, not the email send date.

```yaml
---
title: Parade of Sheds planning meeting
startDate: '2026-08-06T16:30:00'
endDate: '2026-08-06T18:00:00'
location: 702 E. Peach
address: 702 E Peach St, Bozeman, MT 59715
summary: >-
  One or two sentences for the events list.
category: committee
featured: false
externalUrl: https://partiful.com/…   # RSVP or city calendar; else mailchi.mp
topics:
  - parade-of-sheds
  - volunteer
  - community
newsSlugs:
  - 2026-08-03-parade-of-sheds-planning-meeting
---
```

- **Datetimes:** quoted America/Denver **wall clock** `'YYYY-MM-DDTHH:mm:ss'` — no `Z`, no offset. `4:30–6:00 p.m.` → `T16:30:00` / `T18:00:00`. Omit `endDate` if the email has no end and duration is unknown (do not guess).
- **`location`:** short name people say. **`address`:** full Bozeman street when known.
- **`category`:** `social` (potluck, volunteer, parade, stroll) · `civic` (NENA meeting, hearing NENA is turning out for) · `committee` (planning/organizing session) · `tour` (walk, walking tour) · `other` (last resort).
- **`featured`:** true only for flagship events (Parade of Sheds, seasonal NENA meeting).
- **`externalUrl`:** RSVP or official calendar first; Mailchimp archive is fine if that is the only URL.
- **`newsSlugs`:** every related news slug, including this one and any earlier invite.

Event body: what / when / where, then RSVP and parking. Link the news post and any related event (other date, the main parade, etc.). A Mailchimp link at the end of the **event** page is OK.

**Reuse:** if the event exists, add this news slug to `newsSlugs`, do not duplicate the file, and still set news `events:` to that slug.

**Spring/fall NENA meeting:** set event `meetingSlug` and meetings `eventSlug` / `newsSlugs` only when that meetings file already exists.

Do not create places, objectives, or development entries.

### 6. Validate

```bash
node scripts/validate-content-references.mjs
```

Fix unknown topics and broken relation slugs. Summarize for the user: files updated, events created vs reused, stubs skipped (blocked archive, not an event, duplicate).

## Writing rules

- Facts come from the archive (and existing site pages you link). No invented end times or addresses.
- Times in prose: `4:30–6:00 p.m.`, day of week + date.
- Cross-link invite ↔ reminder ↔ event.
- One gathering = one event file. Extra campaigns become extra news posts.

## Avoid

- Leaving `draft: true` or the placeholder summary after a successful fetch
- Creating a second event for a “today/tonight/reminder” email
- Unquoted YAML dates (`date: 2026-08-03` or `startDate: 2026-08-06T16:30:00Z`)
- Topics not in `TOPIC_VALUES`
- Committing or opening a PR unless asked
