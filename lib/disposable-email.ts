import disposableDomains from "disposable-email-domains";

const DISPOSABLE_DOMAINS = new Set(disposableDomains.map((d) => d.toLowerCase()));

/** True for known temporary/throwaway email providers (Mailinator, Guerrilla Mail, 10minutemail, etc.). */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
