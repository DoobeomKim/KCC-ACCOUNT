import {getRequestConfig} from 'next-intl/server';
import {defaultLocale} from './settings';

export default getRequestConfig(async ({locale}) => {
  if (!locale) {
    locale = defaultLocale;
  }

  try {
    const messages = (await import(`@/messages/${locale}.json`)).default;
    return {
      locale,
      messages,
      timeZone: 'Europe/Berlin'
    };
  } catch (error) {
    console.error('Error loading messages for locale:', locale, error);
    console.log('Falling back to default locale:', defaultLocale);
    const messages = (await import(`@/messages/${defaultLocale}.json`)).default;
    return {
      locale: defaultLocale,
      messages,
      timeZone: 'Europe/Berlin'
    };
  }
}); 