import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Resolved from the project root so the check still works in the prerender bundle. */
const lucideIconsDir = join(process.cwd(), 'node_modules/@lucide/astro/src/icons');

/** Canonical Lucide icon name (`@lucide/astro/icons/<name>`). */
export type NavIconName = string;

/** True when `name` is a Lucide icon file, not an alias. */
export function isLucideIconName(name: string): name is NavIconName {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    return false;
  }
  return existsSync(join(lucideIconsDir, `${name}.ts`));
}

export function assertLucideIconName(name: string, context: string): NavIconName {
  if (!isLucideIconName(name)) {
    throw new Error(
      `Unknown Lucide icon "${name}" for ${context}. Use a Lucide icon name such as "tree-deciduous".`,
    );
  }
  return name;
}
