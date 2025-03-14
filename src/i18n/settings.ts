export const locales = ['de', 'ko'] as const;
export const defaultLocale = 'de' as const;

export type Locale = (typeof locales)[number]; 