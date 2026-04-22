/**
 * Default: Mailchimp hosted signup form (list-manage). The previous eepurl
 * resolved to login.mailchimp.com (email-referral), not the audience form.
 * Override with PUBLIC_MAILCHIMP_URL if the list or URL changes.
 */
export const MAILCHIMP_SIGNUP_URL_DEFAULT =
  'https://NENABozeman.us18.list-manage.com/subscribe?u=f1ec16560a226111c086eeb58&id=16f66e5916';

/** Link target for newsletter CTAs (env override, else default hosted page). */
export function getMailchimpSignupUrl(): string {
  const fromEnv = import.meta.env.PUBLIC_MAILCHIMP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return MAILCHIMP_SIGNUP_URL_DEFAULT;
}
