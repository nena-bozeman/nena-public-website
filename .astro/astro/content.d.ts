declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"businesses": {
"bozeman-brewing.md": {
	id: "bozeman-brewing.md";
  slug: "bozeman-brewing";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
"bridger-pilates.md": {
	id: "bridger-pilates.md";
  slug: "bridger-pilates";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
"misco-mill.md": {
	id: "misco-mill.md";
  slug: "misco-mill";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
"mountains-walking-brewery.md": {
	id: "mountains-walking-brewery.md";
  slug: "mountains-walking-brewery";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
"treeline-coffee.md": {
	id: "treeline-coffee.md";
  slug: "treeline-coffee";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
"wild-crumb.md": {
	id: "wild-crumb.md";
  slug: "wild-crumb";
  body: string;
  collection: "businesses";
  data: InferEntrySchema<"businesses">
} & { render(): Render[".md"] };
};
"development": {
"nn-trail-extension.md": {
	id: "nn-trail-extension.md";
  slug: "nn-trail-extension";
  body: string;
  collection: "development";
  data: InferEntrySchema<"development">
} & { render(): Render[".md"] };
"north-rouse-mixed-use.md": {
	id: "north-rouse-mixed-use.md";
  slug: "north-rouse-mixed-use";
  body: string;
  collection: "development";
  data: InferEntrySchema<"development">
} & { render(): Render[".md"] };
"peach-street-apartments.md": {
	id: "peach-street-apartments.md";
  slug: "peach-street-apartments";
  body: string;
  collection: "development";
  data: InferEntrySchema<"development">
} & { render(): Render[".md"] };
};
"events": {
"2025-08-03-parade-of-sheds.md": {
	id: "2025-08-03-parade-of-sheds.md";
  slug: "2025-08-03-parade-of-sheds";
  body: string;
  collection: "events";
  data: InferEntrySchema<"events">
} & { render(): Render[".md"] };
"2025-09-15-walking-tour.md": {
	id: "2025-09-15-walking-tour.md";
  slug: "2025-09-15-walking-tour";
  body: string;
  collection: "events";
  data: InferEntrySchema<"events">
} & { render(): Render[".md"] };
"2026-04-20-annual-meeting.md": {
	id: "2026-04-20-annual-meeting.md";
  slug: "2026-04-20-annual-meeting";
  body: string;
  collection: "events";
  data: InferEntrySchema<"events">
} & { render(): Render[".md"] };
"2026-05-10-neighborhood-cleanup.md": {
	id: "2026-05-10-neighborhood-cleanup.md";
  slug: "2026-05-10-neighborhood-cleanup";
  body: string;
  collection: "events";
  data: InferEntrySchema<"events">
} & { render(): Render[".md"] };
};
"history": {
"1883-founding.md": {
	id: "1883-founding.md";
  slug: "1883-founding";
  body: string;
  collection: "history";
  data: InferEntrySchema<"history">
} & { render(): Render[".md"] };
"1902-beall-park.md": {
	id: "1902-beall-park.md";
  slug: "1902-beall-park";
  body: string;
  collection: "history";
  data: InferEntrySchema<"history">
} & { render(): Render[".md"] };
"1940-post-war-growth.md": {
	id: "1940-post-war-growth.md";
  slug: "1940-post-war-growth";
  body: string;
  collection: "history";
  data: InferEntrySchema<"history">
} & { render(): Render[".md"] };
"1985-nena-founded.md": {
	id: "1985-nena-founded.md";
  slug: "1985-nena-founded";
  body: string;
  collection: "history";
  data: InferEntrySchema<"history">
} & { render(): Render[".md"] };
"2010-renaissance.md": {
	id: "2010-renaissance.md";
  slug: "2010-renaissance";
  body: string;
  collection: "history";
  data: InferEntrySchema<"history">
} & { render(): Render[".md"] };
};
"news": {
"2026-01-10-tree-planting.md": {
	id: "2026-01-10-tree-planting.md";
  slug: "2026-01-10-tree-planting";
  body: string;
  collection: "news";
  data: InferEntrySchema<"news">
} & { render(): Render[".md"] };
"2026-02-20-community-meeting-recap.md": {
	id: "2026-02-20-community-meeting-recap.md";
  slug: "2026-02-20-community-meeting-recap";
  body: string;
  collection: "news";
  data: InferEntrySchema<"news">
} & { render(): Render[".md"] };
"2026-03-15-spring-newsletter.md": {
	id: "2026-03-15-spring-newsletter.md";
  slug: "2026-03-15-spring-newsletter";
  body: string;
  collection: "news";
  data: InferEntrySchema<"news">
} & { render(): Render[".md"] };
};
"objectives": {
"affordable-housing.md": {
	id: "affordable-housing.md";
  slug: "affordable-housing";
  body: string;
  collection: "objectives";
  data: InferEntrySchema<"objectives">
} & { render(): Render[".md"] };
"traffic-calming.md": {
	id: "traffic-calming.md";
  slug: "traffic-calming";
  body: string;
  collection: "objectives";
  data: InferEntrySchema<"objectives">
} & { render(): Render[".md"] };
"trails-pocket-parks.md": {
	id: "trails-pocket-parks.md";
  slug: "trails-pocket-parks";
  body: string;
  collection: "objectives";
  data: InferEntrySchema<"objectives">
} & { render(): Render[".md"] };
"trees.md": {
	id: "trees.md";
  slug: "trees";
  body: string;
  collection: "objectives";
  data: InferEntrySchema<"objectives">
} & { render(): Render[".md"] };
};
"pages": {
"about.md": {
	id: "about.md";
  slug: "about";
  body: string;
  collection: "pages";
  data: InferEntrySchema<"pages">
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = typeof import("../../src/content/config.js");
}
