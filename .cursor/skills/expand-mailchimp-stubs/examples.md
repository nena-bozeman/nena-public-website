# Mailchimp stub patterns

Use these as shape references. Copy structure and linking, not the prose.

## Event invite — fill stub + create event

News `src/content/news/2026-08-03-parade-of-sheds-planning-meeting.md` (send date = email day):

```yaml
title: Parade of Sheds planning meeting
date: '2026-08-03'
draft: false
topics: [parade-of-sheds, volunteer, community]
events:
  - 2026-08-06-parade-of-sheds-planning-meeting
mailchimpArchiveUrl: https://mailchi.mp/…
```

Event `src/content/events/2026-08-06-parade-of-sheds-planning-meeting.md` (filename date = gathering day):

```yaml
title: Parade of Sheds planning meeting
startDate: '2026-08-06T16:30:00'
endDate: '2026-08-06T18:00:00'
location: 702 E. Peach
address: 702 E Peach St, Bozeman, MT 59715
category: committee
newsSlugs:
  - 2026-08-03-parade-of-sheds-planning-meeting
```

If the invite also names a later flagship event that already exists, add that slug to news `events:` and mention it in the body — do not duplicate the event file.

## Reminder — fill stub, reuse event

Same gathering, new campaign (e.g. “Today: …” / “Tonight: …”). Keep the reminder as its own news post. Append its slug to the existing event’s `newsSlugs`. Do not create a second event.

See `src/content/news/2026-07-08-tonight-indreland-audubon-volunteer-pizza.md` → `src/content/events/2026-07-08-nena-wetland-volunteer-night.md`.

## Multi-date — one news, two events

`src/content/news/2026-07-20-come-walk-and-talk-about-high-to-low-density-transitions-in-our-neighborhood.md` lists both walk dates. Each date is its own event file (`2026-07-22-…` and `2026-07-27-…`), same `category: tour`, each pointing back via `newsSlugs`.

## News only — no event

Surveys, deadlines, newsletters, and civic asks with no NENA-hosted gathering: fill the stub, set topics, link surveys and related news. Example: `src/content/news/2026-06-29-ncod-on-line-survey-closes-tomorrow.md`.

## Weak vs strong

**Weak:** leave `draft: true` and the placeholder summary; paste Mailchimp HTML; create `2026-08-06-today-parade-of-sheds-planning-meeting` as a new event when `2026-08-06-parade-of-sheds-planning-meeting` already exists.

**Strong:** rewrite from the archive; quoted Mountain wall-clock datetimes; invite and reminder share one event; internal `/events/`, `/places/`, `/our-work/` links.
