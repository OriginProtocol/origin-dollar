module.exports = {
  debug: process.env.NODE_ENV === 'development',
  localePath:
    typeof window === 'undefined'
      ? require('path').resolve('./apps/ousd-dapp/public/locales')
      : '/locales',
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de'],
  },
};
