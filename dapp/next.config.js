const path = require('path')
const webpack = require('webpack')
const nextSourceMaps = require('@zeit/next-source-maps')()

const isStaging = process.env.STAGING === 'true'
const isProduction = process.env.NODE_ENV === 'production' && !isStaging

let envFile = 'local.env'
/*
 * Environmental variables are inserted into the code at the next build step. So it doesn't matter what
 * env variables the production instance has, because the vars have already been inserted and replaced at 
 * build step. For that reason we decode production and staging all into deploy.env and have google instaces
 * read from that env file.
 */
if (isProduction || isStaging) {
  envFile = 'deploy.env'
}

require("dotenv").config({
  /* can not use ".env" file name for local environment, because env vars from .env file
   * get set to process.env before the `dotenv` is initialized and dotenv doesn't
   * override the values with the prod values. 
   */
  path: path.resolve(__dirname, envFile)
})

try {
  require('envkey')
} catch (err) {
  console.error('EnvKey not set')
}

module.exports = {
  webpack: (config, { isServer, buildId }) => {
    // Fixes npm packages that depend on `fs` module
    config.node = {
      fs: 'empty'
    }
    /**
     * Returns environment variables as an object
     */
    const env = Object.keys(process.env).reduce((acc, curr) => {
      acc[`process.env.${curr}`] = JSON.stringify(process.env[curr])
      return acc
    }, {})

    //console.log("CONFIG: ", JSON.stringify(config.module.rules))
    
    /** Allows you to create global constants which can be configured
    * at compile time, which in our case is our environment variables
    */
    config.plugins.push(new webpack.DefinePlugin(env))

    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.SENTRY_RELEASE': JSON.stringify(buildId),
      })
    )

    if (!isServer) {
      config.resolve.alias['@sentry/node'] = '@sentry/browser'
    }

    return config
  },
  cssLoaderOptions: {
    url: false
  },
  async headers() {
    return [
      {
        source: '/(.*)?', // Matches all pages
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          }
        ]
      }
    ]
  }
}
