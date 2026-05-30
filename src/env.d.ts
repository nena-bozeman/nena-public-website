/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly SITE: string;
  readonly ASSETS_PREFIX: string | Record<string, string>;
  [key: string]: string | boolean | undefined | Record<string, string>;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }
}
