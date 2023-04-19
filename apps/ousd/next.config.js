//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withNx } = require('@nrwl/next/plugins/with-nx');
const locales = require('./locales');
const { withSentryConfig } = require('@sentry/nextjs');
const { STRAPI_API_URL, NEXT_PUBLIC_DAPP_URL, APP_ENV } = process.env;

const dappPaths = [
  '/earn',
  '/wrap',
  '/signTransfer',
  '/stake',
  '/dashboard',
  '/history',
  '/pool/:pool_name*',
];

const dappRedirects = dappPaths.map((path) => ({
  source: path,
  destination: `${NEXT_PUBLIC_DAPP_URL}${path}`,
  permanent: true,
}));

const nextConfig = {
  nx: {
    svgr: false,
  },
  swcMinify: true,
  experimental: {
    optimizeCss: true,
    images: { allowFutureImage: true },
  },
  reactStrictMode: true,
  images: {
    loader: 'default',
    domains: [
      'localhost',
      '0.0.0.0',
      'cmsmediaproduction.s3.amazonaws.com',
      'cmsmediastaging.s3.amazonaws.com',
      'avatars.githubusercontent.com',
    ],
  },
  i18n: {
    locales,
    defaultLocale: 'en',
  },
  staticPageGenerationTimeout: 120,
  sentry: {
    hideSourceMaps: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cross-Origin-Opener-Policy-Report-Only',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...dappRedirects,
      {
        source: '/swap',
        destination: `${NEXT_PUBLIC_DAPP_URL}`,
        permanent: true,
      },
      {
        source: '/dapp',
        destination: `${NEXT_PUBLIC_DAPP_URL}`,
        permanent: true,
      },
      {
        source: '/mint',
        destination: `${NEXT_PUBLIC_DAPP_URL}`,
        permanent: true,
      },
      {
        source: '/earn-info',
        destination: `/`,
        permanent: true,
      },
      {
        source: '/governance',
        destination: `/`,
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/sitemap.xml',
          destination: `${STRAPI_API_URL}/api/ousd/sitemap`,
        },
        {
          source: '/robots.txt',
          destination:
            APP_ENV === 'prod' ? '/robots.prod.txt' : '/robots.staging.txt',
        },
      ],
    };
  },
};

const sentryWebpackPluginOptions = {
  silent: true, // Suppresses all logs
};

module.exports = withNx(nextConfig);
