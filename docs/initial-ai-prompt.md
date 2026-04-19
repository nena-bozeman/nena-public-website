Here's a prompt you can paste directly into that Copilot box:

---

Build a static neighborhood association website for NENA (Northeast Neighborhood Association) in Bozeman, Montana using Astro, Tailwind CSS, and Decap CMS. The site should be deployable to Cloudflare Pages with a devcontainer configuration for GitHub Codespaces support.

## Tech Stack

- **Framework:** Astro (latest) with static output by default
- **Styling:** Tailwind CSS
- **CMS:** Decap CMS (git-based, no database) with `local_backend: true` for development
- **Deployment target:** Cloudflare Pages
- **Package manager:** npm
- **TypeScript:** enabled
- **Content:** Astro Content Collections for all content types

## Repository Structure

```
nena-website/
├── .devcontainer/
│   ├── devcontainer.json
│   └── start.sh
├── .github/
│   └── workflows/
│       └── preview.yml
├── public/
│   ├── admin/
│   │   ├── index.html          # Decap CMS entry point
│   │   └── config.yml          # Decap CMS schema
│   └── images/
│       └── uploads/            # Media uploaded via Decap
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── Navigation.astro
│   │   ├── home/
│   │   │   ├── Hero.astro
│   │   │   ├── MissionStatement.astro
│   │   │   └── LatestNews.astro
│   │   ├── events/
│   │   │   ├── EventCard.astro
│   │   │   └── EventList.astro
│   │   ├── news/
│   │   │   ├── NewsCard.astro
│   │   │   └── NewsList.astro
│   │   ├── businesses/
│   │   │   ├── BusinessCard.astro
│   │   │   ├── BusinessList.astro
│   │   │   └── BusinessMap.astro
│   │   ├── history/
│   │   │   ├── Timeline.astro
│   │   │   └── HistoryPhoto.astro
│   │   └── development/
│   │       ├── ProjectCard.astro
│   │       └── ProjectMap.astro
│   ├── content/
│   │   ├── config.ts           # Content collection schemas
│   │   ├── news/               # Markdown news posts
│   │   ├── events/             # Markdown event entries
│   │   ├── businesses/         # Markdown business directory entries
│   │   ├── history/            # Markdown history timeline entries
│   │   ├── development/        # Markdown development project entries
│   │   ├── objectives/         # Markdown committee/objective pages
│   │   └── pages/              # Markdown for static pages (about, etc.)
│   ├── layouts/
│   │   ├── Base.astro          # HTML shell, SEO meta, fonts
│   │   └── ContentPage.astro   # Layout for markdown-driven pages
│   ├── pages/
│   │   ├── index.astro         # Homepage
│   │   ├── about.astro
│   │   ├── news/
│   │   │   ├── index.astro     # News listing
│   │   │   └── [slug].astro    # Individual post
│   │   ├── events/
│   │   │   └── index.astro     # Events listing
│   │   ├── businesses/
│   │   │   └── index.astro     # Business directory
│   │   ├── history/
│   │   │   └── index.astro     # Neighborhood history
│   │   ├── development/
│   │   │   └── index.astro     # Development watch
│   │   ├── objectives/
│   │   │   ├── index.astro     # Objectives overview
│   │   │   └── [slug].astro    # Individual objective page
│   │   └── 404.astro
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Devcontainer Configuration

Create `.devcontainer/devcontainer.json`:
```json
{
  "name": "NENA Website",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:22",
  "forwardPorts": [4321, 8081],
  "portsAttributes": {
    "4321": {
      "label": "Astro Dev Server",
      "onAutoForward": "openPreview"
    },
    "8081": {
      "label": "Decap Local Backend",
      "onAutoForward": "silent"
    }
  },
  "postCreateCommand": "npm install",
  "postStartCommand": "bash .devcontainer/start.sh",
  "customizations": {
    "vscode": {
      "extensions": [
        "astro-build.astro-vscode",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "dbaeumer.vscode-eslint"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode"
      }
    }
  }
}
```

Create `.devcontainer/start.sh`:
```bash
#!/bin/bash
npx decap-server &
npm run dev -- --host
```

## Content Collections Schema

Define all collections in `src/content/config.ts` using Zod:

### News Posts
```typescript
const news = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    summary: z.string(),
    author: z.string().optional(),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});
```

### Events
```typescript
const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    startDate: z.date(),
    endDate: z.date().optional(),
    location: z.string(),
    address: z.string().optional(),
    summary: z.string(),
    category: z.enum(['social', 'civic', 'committee', 'tour', 'other']),
    featured: z.boolean().default(false),
    externalUrl: z.string().url().optional(),
  }),
});
```

### Business Directory
```typescript
const businesses = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    category: z.enum([
      'food-drink',
      'retail',
      'services',
      'arts-culture',
      'fitness-wellness',
      'nonprofit',
      'other'
    ]),
    address: z.string(),
    website: z.string().url().optional(),
    phone: z.string().optional(),
    founded: z.number().optional(),
    logo: z.string().optional(),
    legacy: z.boolean().default(false),
    active: z.boolean().default(true),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
});
```

### History Timeline
```typescript
const history = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    year: z.number(),
    decade: z.number(),
    category: z.enum(['founding', 'development', 'community', 'landmark', 'other']),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});
```

### Development Projects
```typescript
const development = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    status: z.enum(['proposed', 'under-review', 'approved', 'under-construction', 'complete', 'denied']),
    address: z.string(),
    developer: z.string().optional(),
    submittedDate: z.date().optional(),
    lastUpdated: z.date(),
    summary: z.string(),
    cityPlanningUrl: z.string().url().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    tags: z.array(z.string()).default([]),
  }),
});
```

### Objectives/Committees
```typescript
const objectives = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    active: z.boolean().default(true),
    order: z.number().default(99),
    contactEmail: z.string().email().optional(),
  }),
});
```

## Decap CMS Configuration

Create `public/admin/config.yml` with the following collections. Use `local_backend: true` at the top for development:

```yaml
local_backend: true

backend:
  name: github
  repo: nena-bozeman/website
  branch: main
  base_url: https://nena-oauth.workers.dev

media_folder: public/images/uploads
public_folder: /images/uploads

collections:
  - name: news
    label: News Posts
    label_singular: News Post
    folder: src/content/news
    create: true
    slug: "{{year}}-{{month}}-{{day}}-{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Publish Date, name: date, widget: datetime }
      - { label: Summary, name: summary, widget: text }
      - { label: Author, name: author, widget: string, required: false }
      - { label: Featured, name: featured, widget: boolean, default: false }
      - { label: Tags, name: tags, widget: list, required: false }
      - { label: Body, name: body, widget: markdown }

  - name: events
    label: Events
    label_singular: Event
    folder: src/content/events
    create: true
    slug: "{{year}}-{{month}}-{{day}}-{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Start Date, name: startDate, widget: datetime }
      - { label: End Date, name: endDate, widget: datetime, required: false }
      - { label: Location Name, name: location, widget: string }
      - { label: Address, name: address, widget: string, required: false }
      - { label: Summary, name: summary, widget: text }
      - label: Category
        name: category
        widget: select
        options: [social, civic, committee, tour, other]
      - { label: Featured, name: featured, widget: boolean, default: false }
      - { label: External URL, name: externalUrl, widget: string, required: false }
      - { label: Description, name: body, widget: markdown }

  - name: businesses
    label: Business Directory
    label_singular: Business
    folder: src/content/businesses
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Business Name, name: name, widget: string }
      - label: Category
        name: category
        widget: select
        options:
          - { label: Food & Drink, value: food-drink }
          - { label: Retail, value: retail }
          - { label: Services, value: services }
          - { label: Arts & Culture, value: arts-culture }
          - { label: Fitness & Wellness, value: fitness-wellness }
          - { label: Nonprofit, value: nonprofit }
          - { label: Other, value: other }
      - { label: Address, name: address, widget: string }
      - { label: Website, name: website, widget: string, required: false }
      - { label: Phone, name: phone, widget: string, required: false }
      - { label: Year Founded, name: founded, widget: number, required: false }
      - { label: Logo, name: logo, widget: image, required: false }
      - { label: Legacy Business (10+ years), name: legacy, widget: boolean, default: false }
      - { label: Currently Active, name: active, widget: boolean, default: true }
      - { label: Latitude, name: lat, widget: number, required: false }
      - { label: Longitude, name: lng, widget: number, required: false }
      - { label: History & Description, name: body, widget: markdown }

  - name: history
    label: History Timeline
    label_singular: History Entry
    folder: src/content/history
    create: true
    slug: "{{year}}-{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Year, name: year, widget: number }
      - { label: Decade, name: decade, widget: number }
      - label: Category
        name: category
        widget: select
        options: [founding, development, community, landmark, other]
      - { label: Photo, name: image, widget: image, required: false }
      - { label: Photo Caption, name: imageAlt, widget: string, required: false }
      - { label: Description, name: body, widget: markdown }

  - name: development
    label: Development Watch
    label_singular: Development Project
    folder: src/content/development
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Project Name, name: title, widget: string }
      - label: Status
        name: status
        widget: select
        options:
          - { label: Proposed, value: proposed }
          - { label: Under Review, value: under-review }
          - { label: Approved, value: approved }
          - { label: Under Construction, value: under-construction }
          - { label: Complete, value: complete }
          - { label: Denied, value: denied }
      - { label: Address, name: address, widget: string }
      - { label: Developer/Applicant, name: developer, widget: string, required: false }
      - { label: Date Submitted, name: submittedDate, widget: datetime, required: false }
      - { label: Last Updated, name: lastUpdated, widget: datetime }
      - { label: Summary, name: summary, widget: text }
      - { label: City Planning URL, name: cityPlanningUrl, widget: string, required: false }
      - { label: Latitude, name: lat, widget: number, required: false }
      - { label: Longitude, name: lng, widget: number, required: false }
      - { label: Tags, name: tags, widget: list, required: false }
      - { label: Full Description, name: body, widget: markdown }

  - name: objectives
    label: Objectives & Committees
    label_singular: Objective
    folder: src/content/objectives
    create: true
    slug: "{{slug}}"
    fields:
      - { label: Title, name: title, widget: string }
      - { label: Summary, name: summary, widget: text }
      - { label: Active, name: active, widget: boolean, default: true }
      - { label: Display Order, name: order, widget: number, default: 99 }
      - { label: Contact Email, name: contactEmail, widget: string, required: false }
      - { label: Content, name: body, widget: markdown }
```

## Page Requirements

### Homepage (`src/pages/index.astro`)
- Hero section with full-width image, neighborhood name, and tagline "Last Best Neighborhood"
- Mission statement section
- Grid of 3 latest news posts with title, date, summary, and "Read more" link
- Grid of 3 upcoming events (filtered to future dates only, sorted ascending)
- Call to action section with links to newsletter signup (Mailchimp), donate, and register
- Use Tailwind for all styling; design should feel warm, civic, and community-oriented

### News (`src/pages/news/`)
- Index page: paginated list of all posts sorted newest first, 10 per page
- Show title, date, author, summary, tags
- Individual post page `[slug].astro`: full markdown content, back link, share-friendly meta tags

### Events (`src/pages/events/index.astro`)
- Split into two sections: Upcoming (future, sorted ascending) and Past (sorted descending, collapsed or limited)
- Show category badge, date, location, summary
- Link to external URL if present (e.g., Luma or Eventbrite)
- Embed a Google Calendar iframe below the list (placeholder with instructions for the actual calendar ID)

### Business Directory (`src/pages/businesses/index.astro`)
- Filter bar by category
- Toggle between list view and map view
- Map view: embed Google Maps with markers for businesses that have lat/lng set
- Each business card shows name, category badge, founded year if present, legacy badge if applicable, website link
- Full history/description visible on expand or separate detail page

### History (`src/pages/history/index.astro`)
- Vertical timeline sorted by year ascending
- Grouped by decade
- Each entry shows year, title, category badge, description, and photo if present
- Design should feel archival and warm

### Development Watch (`src/pages/development/index.astro`)
- Status filter (proposed, under-review, approved, etc.)
- Color-coded status badges (proposed=yellow, under-review=orange, approved=green, under-construction=blue, complete=gray, denied=red)
- Map embed showing project locations with color-coded pins where lat/lng available
- Link to city planning documents where provided
- "Subscribe to development alerts" call to action linking to Mailchimp signup with a development tag

### Objectives (`src/pages/objectives/`)
- Index: grid of active objectives/committees with title, summary, and link
- Individual `[slug].astro`: full content, contact email if present

### About (`src/pages/about.astro`)
- Static page driven by a markdown file in `src/content/pages/about.md`
- Board members section (can be hardcoded initially)
- Contact information

## Sample Content

Create realistic sample content files for each collection so the site renders meaningfully on first run:

- 3 news posts (e.g., Spring 2026 newsletter, a community meeting recap, a tree planting announcement)
- 4 events (2 upcoming, 2 past — e.g., neighborhood cleanup, annual meeting, walking tour, Parade of Sheds)
- 6 businesses matching the real NENA directory (Wild Crumb, Bozeman Brewing Company, Treeline Coffee Roasters, Mountains Walking Brewery, Bridger Pilates, Wild Crumb)
- 5 history timeline entries spanning different decades of the Northeast Neighborhood
- 3 development projects with mixed statuses
- 4 objectives matching real NENA committees (Trees, Traffic Calming, Trails & Pocket Parks, Affordable Housing)

## Navigation

Top navigation should include:
- Home
- News
- Events
- Objectives (dropdown with active objectives)
- History
- Businesses
- Development Watch
- About

Mobile: hamburger menu with full-screen overlay or slide-in drawer.

## Design Guidelines

- Color palette: warm and civic — suggest deep green (`#2D5016`) as primary, warm cream (`#F5F0E8`) as background, amber (`#D4840A`) as accent
- Typography: a serif for headings (e.g., Georgia or a Google Font like Playfair Display), sans-serif for body
- The neighborhood's tagline "Last Best Neighborhood" should appear prominently on the homepage
- All pages should have proper Open Graph meta tags for social sharing
- Favicon: placeholder SVG using the initials "NE"

## Environment Variables

Document the following as required environment variables in a `.env.example` file:
```
# Mailchimp
PUBLIC_MAILCHIMP_URL=https://your-list.us1.list-manage.com/subscribe/post

# Google Maps
PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here

# Google Calendar
PUBLIC_GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
```

## README

Generate a thorough `README.md` covering:
- Project overview and mission
- Tech stack summary
- Getting started locally and via Codespaces (one-click badge)
- How to run the Decap local backend
- How to add content via the CMS
- Deployment to Cloudflare Pages (build command `npm run build`, output directory `dist`)
- Environment variables reference
- How to contribute
- License (MIT)

---

That should give Copilot enough to scaffold a solid starting point. Expect it to get the structure and config right but likely produce placeholder styling — the Tailwind design work will need iteration. The content collection schemas and Decap config are the most important parts to get right from the jump since they're the most tedious to fix after the fact.