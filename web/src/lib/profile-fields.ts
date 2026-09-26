/** Editable user-layer profile fields. Unexposed YAML keys remain untouched. */
export type ProfileFields = {
  name?: string; email?: string; location?: string; roles?: string[];
  compMin?: number; compMax?: number; currency?: string; remote?: string;
  compRange?: string; compPeriod?: string; minimum?: string;
  country?: string; visa?: string; timezone?: string; dealBreakers?: string[];
  outputLanguage?: string; spendTier?: string;
  appliedDays?: number; subsequentDays?: number; maxFollowups?: number; thankyouDays?: number;
};
export const PROFILE_PATHS: Record<keyof ProfileFields, string[]> = {
  name: ['candidate','full_name'], email: ['candidate','email'], location: ['candidate','location'],
  roles: ['target_roles','primary'], currency: ['compensation','currency'], remote: ['compensation','location_flexibility'],
  compRange: ['compensation','target_range'], compPeriod: ['compensation','period'], minimum: ['compensation','minimum'],
  compMin: [], compMax: [], country: ['location','country'], visa: ['location','visa_status'], timezone: ['location','timezone'],
  dealBreakers: ['constraints','deal_breakers'], outputLanguage: ['language','output'], spendTier: ['spend_tier'],
  appliedDays: ['followup_cadence','applied_first_days'], subsequentDays: ['followup_cadence','applied_subsequent_days'],
  maxFollowups: ['followup_cadence','applied_max_followups'], thankyouDays: ['followup_cadence','interview_thankyou_days'],
};

export function validateProfilePatch(patch: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in PROFILE_PATHS)) return `Unknown profile field: ${key}`;
    if (['roles','dealBreakers'].includes(key)) {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || v.length > 500) || value.length > 100) return `${key} must be a list of text values.`;
    } else if (['compMin','compMax','appliedDays','subsequentDays','maxFollowups','thankyouDays'].includes(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return `${key} must be a non-negative number.`;
      if (!key.startsWith('comp') && (!Number.isInteger(value) || value > 365)) return `${key} must be a whole number between 0 and 365.`;
    } else if (typeof value !== 'string' || value.length > 4000) return `${key} must be text (up to 4,000 characters).`;
  }
  if (typeof patch.email === 'string' && patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return 'Enter a valid email address.';
  if (typeof patch.currency === 'string' && patch.currency && !Intl.supportedValuesOf('currency').includes(patch.currency.toUpperCase())) return 'Use a supported three-letter currency code, such as USD or PKR.';
  if (patch.compPeriod !== undefined && !['year','month','hour'].includes(String(patch.compPeriod))) return 'Compensation period must be year, month, or hour.';
  if (patch.compMin !== undefined || patch.compMax !== undefined) {
    if (typeof patch.compMin !== 'number' || typeof patch.compMax !== 'number' || patch.compMin > patch.compMax) return 'Provide both compensation bounds with minimum no higher than maximum.';
  }
  if (typeof patch.compRange === 'string' && patch.compRange) {
    const range = patch.compRange.match(/^\s*[$€£]?\s*([\d,.]+)\s*([kKmM]?)\s*[-–]\s*[$€£]?\s*([\d,.]+)\s*([kKmM]?)\s*$/);
    if (!range) return 'Use a compensation range such as 150000-200000 or 150K-200K; choose its currency and period separately.';
    const amount = (n: string, unit: string) => Number(n.replaceAll(',', '')) * (unit.toLowerCase() === 'k' ? 1000 : unit.toLowerCase() === 'm' ? 1000000 : 1);
    const low = amount(range[1], range[2]); const high = amount(range[3], range[4]);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) return 'Compensation minimum must not exceed maximum.';
  }
  if (typeof patch.remote === 'string' && /remote.only/i.test(patch.remote) && /onsite.only|on.site.only/i.test(patch.remote)) return 'Location policy conflicts: choose remote-only or onsite-only.';
  if (patch.spendTier !== undefined && !['economy','standard','premium'].includes(String(patch.spendTier))) return 'Choose economy, standard, or premium.';
  return null;
}
