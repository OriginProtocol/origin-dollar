const webpack = require('webpack')
const nextSourceMaps = require('@zeit/next-source-maps')()

require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? 'prod.env' : '.env'
})

try {
  require('envkey')
} catch (err) {
  console.error('EnvKey not set')
}

const isProduction = process.env.NODE_ENV === 'production'

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
  }
}
