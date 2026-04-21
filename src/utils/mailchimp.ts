/**
 * Default: Mailchimp-hosted signup (eepurl). Override with PUBLIC_MAILCHIMP_URL
 * for another hosted URL (eepurl, list-manage hosted page, etc.).
 */
export const MAILCHIMP_SIGNUP_URL_DEFAULT = 'https://eepurl.com/i7HdCo';

/** Link target for newsletter CTAs (env override, else default hosted page). */
export function getMailchimpSignupUrl(): string {
  const fromEnv = import.meta.env.PUBLIC_MAILCHIMP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return MAILCHIMP_SIGNUP_URL_DEFAULT;
}
