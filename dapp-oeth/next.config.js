const path = require('path')
const webpack = require('webpack')
const nextSourceMaps = require('@zeit/next-source-maps')()

const isStaging = process.env.STAGING === 'true'
const isProduction = process.env.NODE_ENV === 'production' && !isStaging

let envFile = 'local.env'
/*
 * Environmental variables are inserted into the code at the next build step. So it doesn't matter what
 * env variables the production instance has, because the vars have already been inserted and replaced at
 * build step. For that reason we decode production and staging all into deploy.env and have google instances
 * read from that env file.
 */
if (isProduction || isStaging) {
  envFile = 'deploy.env'
}

require('dotenv').config({
  /* can not use ".env" file name for local environment, because env vars from .env file
   * get set to process.env before the `dotenv` is initialized and dotenv doesn't
   * override the values with the prod values.
   */
  path: path.resolve(__dirname, envFile),
})

try {
  require('envkey')
} catch (err) {
  console.error('EnvKey not set')
}

const config = {
  webpack: (config, { isServer, buildId }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.SENTRY_RELEASE': JSON.stringify(buildId),
      })
    )

    if (!isServer) {
      // Fixes npm packages that depend on node modules
      config.resolve.fallback = {
        fs: false,
        crypto: false,
        stream: false,
        path: false,
        http: false,
        https: false,
        os: false,
        zlib: false,
        net: false,
        tls: false,
      }
      config.resolve.alias['@sentry/node'] = '@sentry/browser'
    }

    config.resolve.alias = {
      ...(config.resolve?.alias ?? {}),
      components: path.resolve(__dirname, 'src/components'),
      constants: path.resolve(__dirname, 'src/constants'),
      utils: path.resolve(__dirname, 'src/utils'),
      pages: path.resolve(__dirname, 'src/pages'),
      hoc: path.resolve(__dirname, 'src/hoc'),
      stores: path.resolve(__dirname, 'src/stores'),
      hooks: path.resolve(__dirname, 'src/hooks'),
    }

    return config
  },
  async redirects() {
    return [
      {
        source: '/swap',
        destination: '/',
        permanent: true,
      },
      {
        source: '/dapp',
        destination: '/',
        permanent: true,
      },
      {
        source: '/mint',
        destination: '/',
        permanent: true,
      },
      {
        source: '/stake',
        destination: '/earn',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/(.*)?', // Matches all pages
        headers: [
          {
            // Cache all pages for 10 minutes, give server an extra 2 minutes
            // to regenerate the content in the background during which the
            // cache can still keep serving the content it has.
            key: 'Cache-Control',
            value: 'public, max-age=600, stale-while-revalidate=120',
          },
          {
            key: 'x-ipfs-path',
            value: '/ipns/ousd.eth/',
          },
          {
            key: 'Content-Security-Policy',
            value:
              'frame-ancestors https://*.ledger.com *.safe.global *.5afe.dev',
          },
        ],
      },
    ]
  },
}

if (process.env.NO_LANDING === 'true') {
  console.log('Building without landing page')
  config.exportPathMap = async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    return {
      '/': { page: '/mint' },
    }
  }
}

// Ipfs requires relative paths instead of absolute ones
if (process.env.DEPLOY_MODE === 'ipfs') {
  config.assetPrefix = './'
}

module.exports = config
