/**
 * Hostname for display next to external links (drops leading www).
 */
export function getWebsiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'Website';
  }
}
