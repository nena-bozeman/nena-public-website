/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly SITE: string;
  readonly ASSETS_PREFIX: string | Record<string, string>;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  readonly PUBLIC_GOOGLE_CALENDAR_ID?: string;
  readonly PUBLIC_MAILCHIMP_URL?: string;
  [key: string]: string | boolean | undefined | Record<string, string>;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}
