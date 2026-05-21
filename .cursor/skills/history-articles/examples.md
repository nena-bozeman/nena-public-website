# History article examples

Reference only—read when drafting or reviewing. Canonical patterns live in `src/content/history/`.

Every example below includes **full required frontmatter**: `title`, `summary`, `year`, `decade`, `category`. Optional fields: `image`, `imageAlt` (set both when using a hero image).

Filenames must use the **`{year}-` prefix** (e.g. `1985-nena-founded.md`).

---

## Tier A — milestone (minimal body)

**File:** `src/content/history/1985-nena-founded.md`

```markdown
---
title: "NENA Founded"
summary: "Residents formally organized NENA in 1985 to speak up in city planning and build community around Beall Park."
year: 1985
decade: 1980
category: community
image: images/nena-logo-lg.png
imageAlt: "Northeast Neighborhood Association (NENA) logo."
---

The Northeast Neighborhood Association (NENA) was formally organized in 1985 to give voice to residents in city planning decisions and to foster community connection. The organization began hosting regular meetings at Beall Park and quickly became a model for neighborhood organizing in Bozeman.
```

**Without hero image** (omit `image` and `imageAlt`):

```markdown
---
title: "Post-War Neighborhood Growth"
summary: "After World War II, veterans and growing families filled the northeast with modest bungalows and ranch homes that still shape the streetscape."
year: 1945
decade: 1940
category: development
---

Following World War II, the Northeast Neighborhood experienced a wave of new construction as returning veterans and their families sought housing in Bozeman. Many of the neighborhood's modest mid-century bungalows and ranch homes date from this era.
```

---

## Tier B — standard (NRHP listing)

**File:** `src/content/history/1987-north-tracy-avenue-historic-district-added-to-the-national-register-of-historic-places.md`

```markdown
---
title: "North Tracy Avenue Historic District added to the National Register of Historic Places"
summary: "The 300–500 blocks of North Tracy hold the densest collection of historic homes north of Main, listed as a National Register district in 1987."
year: 1987
decade: 1980
category: landmark
image: images/history/north-tracy-avenue.jpg
imageAlt: "400 block of North Tracy Avenue Historic District, facing southwest, photographed in 1987. Montana State Historic Preservation Office."
---

**North Tracy Avenue Historic District**

The North Tracy Avenue Historic District spans the 300–500 blocks of North Tracy Avenue, from Villard to Peach Streets. Listed on October 23, 1987 as part of the Bozeman Multiple Resource Area, the district contains the most significant concentration of historic residential architecture north of Main Street—29 modest homes with 21 contributing buildings dating from the 1890s through the 1920s.

Platted in 1885 in response to the coming railroad and expanded in 1891, the area remained sparsely built until after 1900. Homes here were generally less elaborate than those south of Main, built for sale rather than commission, and housed much of Bozeman's working-class north side. Architectural styles include Queen Anne, Bungalow/Craftsman, and Colonial Revival; anchor properties include the houses at 316 and 322 North Tracy (1890 and 1900) and the bungalows at 518 and 519 North Tracy (1916 and 1929).

Read the [National Park Service nomination](https://npgallery.nps.gov/NRHP/GetAsset/9ccd0e14-84d3-48a1-9352-e6634860fd60) and see [period photographs](https://npgallery.nps.gov/NRHP/GetAsset/145bd790-e332-4955-be54-93d5777038a5). More context is on [Historic Montana](https://historicmt.org/items/show/570).
```

---

## Tier C — deep dive (sections + Sources)

**File:** `src/content/history/1933-misco-grain-elevator-built-on-wallace-avenue.md` (abbreviated)

```markdown
---
title: "Misco grain elevator built on North Wallace Avenue"
summary: "MISCO built a wooden-crib grain elevator at 700 North Wallace Avenue beside the railroad—one of few elevators raised in the West during the Depression and later listed on the National Register."
year: 1933
decade: 1930
category: landmark
image: images/history/misco-grain-elevator-wallace-avenue.jpg
imageAlt: "The MISCO grain elevator at 700 North Wallace Avenue, Bozeman, a wooden cribbed structure beside the railroad."
---

In 1933, the **Missoula Mercantile Company** (MISCO) added a towering grain elevator to the Bozeman skyline at **700 North Wallace Avenue**, at the intersection of Wallace and East Cottonwood Street. According to the [1987 National Register nomination](https://npgallery.nps.gov/NRHP/GetAsset/89905238-3149-4052-a28d-bcb1c32521f2), it was one of very few grain elevators constructed between Minneapolis and Seattle during those years.

## How the elevator was built

Although concrete elevators had grown common after 1920, the MISCO elevator was built with the older **wooden crib technique**…

## National Register listing

The MISCO Grain Elevator was listed on the **National Register of Historic Places** on [October 23, 1987](https://npgallery.nps.gov/AssetDetail/NRIS/87001831) (NRHP #87001831) for its significance in agriculture and architecture.

## Sources

Primary records and interpretive materials used for this article:

1. **Bick, Patricia.** *MISCO Grain Elevator* (Montana Historic/Architectural Inventory #26). National Register nomination, 1987. [Nomination PDF](https://npgallery.nps.gov/NRHP/GetAsset/89905238-3149-4052-a28d-bcb1c32521f2) · [NRHP record](https://npgallery.nps.gov/AssetDetail/NRIS/87001831).
2. **Montana National Register Sign Program.** “Misco Grain Elevator.” [Historic Montana](https://historicmt.org/items/show/595).
```

---

## Policy / institutional article

**File:** `src/content/history/2007-bozeman-neighborhood-associations.md` (opening only)

```markdown
---
title: "Bozeman wide neighborhoods program"
year: 2007
decade: 2000
category: community
image: images/history/bozeman-city-hall-1965.jpg
imageAlt: "Bozeman City Hall and Opera House, photographed in 1965."
---

## 2007 — The Neighborhoods Program

The City of Bozeman's [Neighborhoods Program](https://www.bozeman.net/departments/administration/communications-engagement/neighborhoods-program) was established in 2007 to enhance communication between residents and the City…

### NENA's place in the system

The [Northeast Neighborhood Association (NENA)](https://www.nenabozeman.org/about) is one of Bozeman's 13 active neighborhood associations…
```

---

## External hero image + photo credit

**File:** `src/content/history/1991-a-river-runs-through-it.md` (abbreviated)

```markdown
---
title: "A River Runs Through It Filmed in Bozeman"
year: 1991
decade: 1990
category: community
image: https://bigskyjournal.com/wp-content/uploads/2026/01/16-BSJ-FF26-Feat_4-849x1024.jpg
imageAlt: "Robert Redford, in chest waders, directs a scene on the Gallatin River during filming of A River Runs Through It, summer 1991."
---

In the summer of 1991, Robert Redford brought a major Hollywood production to southwest Montana…

![Former Northern Pacific passenger depot at 820 Front Street in Bozeman.](/images/history/bozeman-depot-south-faces.jpg)

*Hero photograph: Robert Redford directing on the Gallatin River, 1991. Photograph by [Thomas Burns](https://bigskyjournal.com/parting-words/); reprinted in [Big Sky Journal](https://bigskyjournal.com/parting-words/). Depot photograph: [Wikimedia Commons](url) (CC0).*
```

---

## Opening paragraphs (body only)

**Weak** (too vague, no neighborhood):

> Bozeman grew quickly in the early 20th century. Many towns in Montana had grain elevators.

**Strong** (specific place + why it matters):

> In 1933, the **Missoula Mercantile Company** (MISCO) added a towering grain elevator to the Bozeman skyline at **700 North Wallace Avenue**, beside the Northern Pacific Railroad line and the Bon Ton Flour Mill.

---

## Inline source links (body only)

**Weak:**

> The elevator was listed on the National Register in 1987. It was built using the wooden crib technique.

**Strong:**

> The MISCO Grain Elevator was listed on the **National Register of Historic Places** on [October 23, 1987](https://npgallery.nps.gov/AssetDetail/NRIS/87001831) (NRHP #87001831). The nomination describes it as the best remaining example of wooden cribbed grain elevator construction in Bozeman ([1987 NRHP nomination](https://npgallery.nps.gov/NRHP/GetAsset/89905238-3149-4052-a28d-bcb1c32521f2)).

---

## Cross-linking (body only)

```markdown
The [**Misco Mill**](/history/1933-misco-grain-elevator-built-on-wallace-avenue)—the historic MISCO grain elevator at **700 North Wallace Avenue**—served as the gambling house in the film.
```

Use the slug from the filename, not the title.

---

## Frontmatter field reference

| Field | Required | Notes |
|-------|----------|--------|
| `title` | yes | Timeline headline; no trailing spaces |
| `summary` | yes | List blurb and article subtitle (1–2 sentences) |
| `year` | yes | Event year (timeline badge); must match filename prefix |
| `decade` | yes | Floored decade: `1985` → `1980`, `2007` → `2000` |
| `category` | yes | `founding` \| `development` \| `community` \| `landmark` \| `other` |
| `image` | no | `images/history/…` or `https://…` |
| `imageAlt` | when `image` set | Describe the photo for accessibility |
| `dateCreated` | no | Rarely used on history entries |
| `dateUpdated` | no | Rarely used on history entries |
